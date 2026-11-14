"""Multi-Camera Remote Photoplethysmography (rPPG) Engine for Heart Rate (BPM) & HRV.

Supports:
- Standard RGB Cameras via Plane-Orthogonal-to-Skin (POS) and Chrominance (CHROM).
- Near-Infrared (NIR) / Night-Vision / Monochrome Cameras via Spatial-Temporal Single-Channel Detrending.
"""

from collections import deque
from typing import Deque, Dict, List, Tuple
import numpy as np
from scipy import signal

from src.config import (
    RPPG_BANDPASS_HIGH_HZ,
    RPPG_BANDPASS_LOW_HZ,
    RPPG_BUFFER_SECONDS,
    RPPG_DEFAULT_FPS,
    RPPG_MIN_SECONDS_FOR_ESTIMATE,
    RPPG_RESP_HIGH_HZ,
    RPPG_RESP_LOW_HZ,
)
from src.schemas import CameraMode, HeartRateMetrics


class RPPGEngine:
    """Lightweight CPU DSP engine for contactless BPM, HRV (RMSSD/SDNN), and Respiration."""

    def __init__(self, buffer_seconds: float = RPPG_BUFFER_SECONDS) -> None:
        self.buffer_seconds = buffer_seconds
        self.timestamps: Deque[float] = deque()
        self.rgb_forehead: Deque[np.ndarray] = deque()
        self.rgb_left_cheek: Deque[np.ndarray] = deque()
        self.rgb_right_cheek: Deque[np.ndarray] = deque()
        self.rgb_combined: Deque[np.ndarray] = deque()
        self._smoothed_bpm: float = 0.0
        self._last_valid_metrics: HeartRateMetrics | None = None

    def reset(self) -> None:
        self.timestamps.clear()
        self.rgb_forehead.clear()
        self.rgb_left_cheek.clear()
        self.rgb_right_cheek.clear()
        self.rgb_combined.clear()
        self._smoothed_bpm = 0.0
        self._last_valid_metrics = None

    def update(
        self,
        timestamp: float,
        face_detected: bool,
        roi_rgb_means: Dict[str, np.ndarray],
        camera_mode: CameraMode = CameraMode.RGB_POS,
    ) -> HeartRateMetrics:
        if not face_detected or "combined" not in roi_rgb_means:
            return HeartRateMetrics(
                bpm=round(self._smoothed_bpm, 1),
                signal_quality=0.0,
                camera_mode=camera_mode,
                buffer_fill_pct=self._compute_buffer_fill(),
                status="no_face",
            )

        # Enforce strictly increasing timestamps
        if self.timestamps and timestamp <= self.timestamps[-1]:
            timestamp = self.timestamps[-1] + (1.0 / RPPG_DEFAULT_FPS)

        self.timestamps.append(timestamp)
        self.rgb_combined.append(roi_rgb_means.get("combined", np.zeros(3)))
        self.rgb_forehead.append(roi_rgb_means.get("forehead", roi_rgb_means["combined"]))
        self.rgb_left_cheek.append(roi_rgb_means.get("left_cheek", roi_rgb_means["combined"]))
        self.rgb_right_cheek.append(roi_rgb_means.get("right_cheek", roi_rgb_means["combined"]))

        # Evict samples older than buffer_seconds
        while len(self.timestamps) > 2 and (self.timestamps[-1] - self.timestamps[0]) > self.buffer_seconds:
            self.timestamps.popleft()
            self.rgb_combined.popleft()
            self.rgb_forehead.popleft()
            self.rgb_left_cheek.popleft()
            self.rgb_right_cheek.popleft()

        duration = self.timestamps[-1] - self.timestamps[0] if len(self.timestamps) > 1 else 0.0
        fill_pct = float(np.clip((duration / self.buffer_seconds) * 100.0, 0.0, 100.0))

        if duration < RPPG_MIN_SECONDS_FOR_ESTIMATE or len(self.timestamps) < 32:
            return HeartRateMetrics(
                bpm=round(self._smoothed_bpm, 1),
                signal_quality=0.0,
                camera_mode=camera_mode,
                buffer_fill_pct=round(fill_pct, 1),
                status="calibrating",
            )

        # Resample onto a uniform 30 Hz temporal grid to handle variable frame rates accurately
        fs = RPPG_DEFAULT_FPS
        t_raw = np.array(self.timestamps, dtype=np.float64)
        n_uniform = int(duration * fs)
        if n_uniform < 32:
            return HeartRateMetrics(
                bpm=round(self._smoothed_bpm, 1),
                signal_quality=0.0,
                camera_mode=camera_mode,
                buffer_fill_pct=round(fill_pct, 1),
                status="calibrating",
            )

        t_uniform = np.linspace(t_raw[0], t_raw[-1], n_uniform)
        rgb_raw = np.vstack(self.rgb_combined)  # shape (N, 3) in RGB order
        rgb_u = np.column_stack([np.interp(t_uniform, t_raw, rgb_raw[:, ch]) for ch in range(3)])

        # Check if signal is monochrome (NIR/IR camera or grayscale stream)
        rg_diff = float(np.mean(np.abs(rgb_u[:, 0] - rgb_u[:, 1])))
        gb_diff = float(np.mean(np.abs(rgb_u[:, 1] - rgb_u[:, 2])))
        is_monochrome = (rg_diff < 1.e-2 and gb_diff < 1.e-2) or (camera_mode == CameraMode.NIR_IR)

        if is_monochrome:
            raw_bvp = self._extract_nir_monochrome(t_raw, t_uniform)
        elif camera_mode == CameraMode.RGB_CHROM:
            raw_bvp = self._extract_chrom(rgb_u)
        else:
            raw_bvp = self._extract_pos(rgb_u, fs)

        # Detrend and Bandpass filter (0.75 Hz - 3.0 Hz -> 45 - 180 BPM)
        detrended = signal.detrend(raw_bvp, type="linear")
        filtered_bvp = self._bandpass_filter(detrended, fs, RPPG_BANDPASS_LOW_HZ, RPPG_BANDPASS_HIGH_HZ)

        # Estimate BPM and Signal Quality Index (SQI) via high-resolution Welch / FFT periodogram
        est_bpm, sqi, freqs_bpm, power_norm = self._estimate_bpm_spectral(filtered_bvp, fs)

        # Smooth BPM across frames
        if est_bpm > 0.0:
            if self._smoothed_bpm <= 0.0:
                self._smoothed_bpm = est_bpm
            else:
                alpha = 0.35 if sqi >= 45.0 else 0.15
                self._smoothed_bpm = alpha * est_bpm + (1.0 - alpha) * self._smoothed_bpm

        # Estimate HRV (RMSSD, SDNN) from time-domain BVP systolic peaks
        rmssd_ms, sdnn_ms = self._estimate_hrv(filtered_bvp, fs, self._smoothed_bpm)

        # Estimate Respiration Rate (RPM) from low-frequency envelope / respiratory modulation
        resp_rpm = self._estimate_respiration(detrended, fs)

        # Normalize recent BVP waveform for frontend oscilloscope display (last 120 samples = 4s)
        tail = filtered_bvp[-120:]
        std_tail = float(np.std(tail))
        norm_wave = (tail / std_tail).tolist() if std_tail > 1e-6 else tail.tolist()
        norm_wave = [round(float(np.clip(v, -3.5, 3.5)), 3) for v in norm_wave]

        status = "locked" if sqi >= 30.0 else "low_signal"
        return HeartRateMetrics(
            bpm=round(self._smoothed_bpm, 1),
            hrv_rmssd_ms=round(rmssd_ms, 1),
            hrv_sdnn_ms=round(sdnn_ms, 1),
            respiration_rpm=round(resp_rpm, 1),
            signal_quality=round(sqi, 1),
            camera_mode=CameraMode.NIR_IR if is_monochrome else camera_mode,
            buffer_fill_pct=round(fill_pct, 1),
            bvp_waveform=norm_wave,
            spectrum_freqs_bpm=freqs_bpm,
            spectrum_power=power_norm,
            status=status,
        )

    def _compute_buffer_fill(self) -> float:
        if len(self.timestamps) < 2:
            return 0.0
        duration = self.timestamps[-1] - self.timestamps[0]
        return round(float(np.clip((duration / self.buffer_seconds) * 100.0, 0.0, 100.0)), 1)

    @staticmethod
    def _extract_pos(rgb: np.ndarray, fs: float) -> np.ndarray:
        """Plane-Orthogonal-to-Skin (POS) rPPG algorithm (Wang et al., 2017)."""
        n = rgb.shape[0]
        win_len = max(16, int(1.6 * fs))
        h = np.zeros(n, dtype=np.float64)

        for start in range(0, n - win_len + 1):
            end = start + win_len
            window = rgb[start:end, :]
            means = np.mean(window, axis=0, keepdims=True)
            means = np.where(means < 1e-5, 1.0, means)
            cn = window / means - 1.0
            # POS projection: S1 = G - B, S2 = G + B - 2R
            s1 = cn[:, 1] - cn[:, 2]
            s2 = cn[:, 1] + cn[:, 2] - 2.0 * cn[:, 0]
            std_s2 = float(np.std(s2))
            alpha = float(np.std(s1)) / std_s2 if std_s2 > 1e-7 else 0.0
            h_win = s1 + alpha * s2
            h_win = h_win - np.mean(h_win)
            h[start:end] += h_win

        # Handle tail if window is larger than signal
        if np.all(np.abs(h) < 1e-9):
            means = np.maximum(np.mean(rgb, axis=0, keepdims=True), 1.0)
            cn = rgb / means - 1.0
            h = (cn[:, 1] - cn[:, 2]) + (cn[:, 1] + cn[:, 2] - 2.0 * cn[:, 0])
        return h

    @staticmethod
    def _extract_chrom(rgb: np.ndarray) -> np.ndarray:
        """Chrominance-based (CHROM) rPPG algorithm (De Haan & Jeanne, 2013)."""
        means = np.maximum(np.mean(rgb, axis=0, keepdims=True), 1.0)
        cn = rgb / means - 1.0
        xs = 3.0 * cn[:, 0] - 2.0 * cn[:, 1]
        ys = 1.5 * cn[:, 0] + cn[:, 1] - 1.5 * cn[:, 2]
        std_ys = float(np.std(ys))
        alpha = float(np.std(xs)) / std_ys if std_ys > 1e-7 else 0.0
        return xs - alpha * ys

    def _extract_nir_monochrome(self, t_raw: np.ndarray, t_uniform: np.ndarray) -> np.ndarray:
        """Spatial-Temporal Single-Channel NIR/IR rPPG combiner across forehead and cheek sub-ROIs."""
        fh = np.vstack(self.rgb_forehead)[:, 1]
        lc = np.vstack(self.rgb_left_cheek)[:, 1]
        rc = np.vstack(self.rgb_right_cheek)[:, 1]

        fh_u = np.interp(t_uniform, t_raw, fh)
        lc_u = np.interp(t_uniform, t_raw, lc)
        rc_u = np.interp(t_uniform, t_raw, rc)

        # Normalize each anatomical patch by its temporal mean to reject global illumination drift
        def _norm(sig: np.ndarray) -> np.ndarray:
            m = float(np.mean(sig))
            return (sig / m - 1.0) if m > 1e-5 else sig

        # Forehead has highest capillary density in NIR; cheeks provide spatial redundancy
        combined = 0.50 * _norm(fh_u) + 0.25 * _norm(lc_u) + 0.25 * _norm(rc_u)
        return combined

    @staticmethod
    def _bandpass_filter(sig: np.ndarray, fs: float, low_hz: float, high_hz: float) -> np.ndarray:
        nyq = 0.5 * fs
        low = max(0.01, min(0.95, low_hz / nyq))
        high = max(low + 0.05, min(0.99, high_hz / nyq))
        b, a = signal.butter(3, [low, high], btype="bandpass")
        if sig.size > 15:
            return signal.filtfilt(b, a, sig)
        return signal.lfilter(b, a, sig)

    @staticmethod
    def _estimate_bpm_spectral(
        filtered_bvp: np.ndarray, fs: float
    ) -> Tuple[float, float, List[float], List[float]]:
        n = filtered_bvp.size
        win = np.hanning(n)
        windowed = filtered_bvp * win
        nfft = 2048
        freqs = np.fft.rfftfreq(nfft, d=1.0 / fs)
        psd = np.abs(np.fft.rfft(windowed, n=nfft)) ** 2

        mask = (freqs >= RPPG_BANDPASS_LOW_HZ) & (freqs <= RPPG_BANDPASS_HIGH_HZ)
        valid_freqs = freqs[mask]
        valid_psd = psd[mask]

        if valid_psd.size == 0 or float(np.max(valid_psd)) <= 1e-12:
            return 0.0, 0.0, [], []

        peak_idx = int(np.argmax(valid_psd))
        peak_freq = float(valid_freqs[peak_idx])

        # Parabolic interpolation around peak bin for sub-bin accuracy
        if 0 < peak_idx < (valid_psd.size - 1):
            y0, y1, y2 = float(valid_psd[peak_idx - 1]), float(valid_psd[peak_idx]), float(valid_psd[peak_idx + 1])
            denom = y0 - 2.0 * y1 + y2
            if abs(denom) > 1e-12:
                delta = 0.5 * (y0 - y2) / denom
                df = float(valid_freqs[1] - valid_freqs[0])
                peak_freq += float(np.clip(delta, -0.5, 0.5)) * df

        bpm = peak_freq * 60.0

        # Compute Spectral Signal Quality Index (SQI): ratio of energy near peak + 2nd harmonic to total in-band energy
        df_bin = float(valid_freqs[1] - valid_freqs[0]) if valid_freqs.size > 1 else 0.02
        half_width_hz = 0.12  # +/- 7.2 BPM around fundamental peak
        in_peak = np.abs(valid_freqs - peak_freq) <= half_width_hz
        in_harm = np.abs(valid_freqs - (2.0 * peak_freq)) <= half_width_hz
        signal_energy = float(np.sum(valid_psd[in_peak | in_harm]))
        total_energy = float(np.sum(valid_psd))
        raw_ratio = signal_energy / max(1e-12, total_energy)
        sqi = float(np.clip(raw_ratio * 135.0, 0.0, 100.0))

        # Downsample spectrum to ~45 points for lightweight telemetry plotting
        step = max(1, valid_freqs.size // 45)
        freqs_bpm_out = [round(float(f * 60.0), 1) for f in valid_freqs[::step]]
        max_p = float(np.max(valid_psd))
        power_out = [round(float(p / max_p), 3) for p in valid_psd[::step]]

        return bpm, sqi, freqs_bpm_out, power_out

    @staticmethod
    def _estimate_hrv(filtered_bvp: np.ndarray, fs: float, bpm: float) -> Tuple[float, float]:
        if bpm <= 0.0 or filtered_bvp.size < 45:
            return 0.0, 0.0
        expected_period_samples = (60.0 / bpm) * fs
        min_dist = max(6, int(0.65 * expected_period_samples))
        peaks, _ = signal.find_peaks(filtered_bvp, distance=min_dist, prominence=float(np.std(filtered_bvp)) * 0.25)
        if peaks.size < 3:
            return 0.0, 0.0

        ibi_ms = np.diff(peaks) * (1000.0 / fs)
        # Reject physiological outliers outside [300ms, 1500ms]
        valid_ibi = ibi_ms[(ibi_ms >= 300.0) & (ibi_ms <= 1500.0)]
        if valid_ibi.size < 2:
            return 0.0, 0.0

        diff_ibi = np.diff(valid_ibi)
        rmssd = float(np.sqrt(np.mean(diff_ibi**2))) if diff_ibi.size > 0 else 0.0
        sdnn = float(np.std(valid_ibi))
        return float(np.clip(rmssd, 5.0, 180.0)), float(np.clip(sdnn, 5.0, 200.0))

    def _estimate_respiration(self, detrended_sig: np.ndarray, fs: float) -> float:
        if detrended_sig.size < int(4.0 * fs):
            return 0.0
        resp_wave = self._bandpass_filter(detrended_sig, fs, RPPG_RESP_LOW_HZ, RPPG_RESP_HIGH_HZ)
        nfft = 1024
        freqs = np.fft.rfftfreq(nfft, d=1.0 / fs)
        psd = np.abs(np.fft.rfft(resp_wave * np.hanning(resp_wave.size), n=nfft)) ** 2
        mask = (freqs >= RPPG_RESP_LOW_HZ) & (freqs <= RPPG_RESP_HIGH_HZ)
        if not np.any(mask):
            return 15.0
        valid_f = freqs[mask]
        valid_p = psd[mask]
        peak_f = float(valid_f[int(np.argmax(valid_p))])
        return float(np.clip(peak_f * 60.0, 8.0, 30.0))
