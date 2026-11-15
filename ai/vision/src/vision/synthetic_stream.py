"""Synthetic Astronaut Video Generator with physiological rPPG, sleep, and mood signals.

Synthesizes BGR and Near-Infrared (NIR) monochrome cabin frames containing a simulated
subject whose facial skin reflectance exhibits cardiac Blood Volume Pulse (fundamental
+ 2nd harmonic dicrotic notch + respiratory envelope), alongside controllable blinks,
yawns, head nodding, brow furrowing, smiling, and sleep-pod restlessness motion.
"""

import math
from dataclasses import dataclass
import cv2
import numpy as np


@dataclass
class SimulationConfig:
    """Configuration state driving the synthetic astronaut biometric video stream."""

    target_bpm: float = 72.0
    respiration_rpm: float = 15.0
    state: str = "nominal"        # nominal, happy, stressed, drowsy, sleeping_calm, sleeping_restless
    nir_mode: bool = False        # Simulate Near-Infrared / Night-Vision monochrome camera
    width: int = 640
    height: int = 480


class SyntheticAstronautGenerator:
    """Generates synthetic astronaut cabin frames with physiological skin pulse modulation."""

    def __init__(self, config: SimulationConfig | None = None) -> None:
        self.cfg = config or SimulationConfig()
        self._frame_count = 0

    def update_config(
        self,
        target_bpm: float | None = None,
        state: str | None = None,
        nir_mode: bool | None = None,
    ) -> None:
        """Updates simulated heart rate (clamped to 48-175 BPM), behavioral state, or NIR mode."""
        if target_bpm is not None:
            self.cfg.target_bpm = float(np.clip(target_bpm, 48.0, 175.0))
        if state is not None:
            self.cfg.state = state
        if nir_mode is not None:
            self.cfg.nir_mode = bool(nir_mode)

    def next_frame(self, timestamp: float) -> np.ndarray:
        """Renders the next synthetic BGR frame at `timestamp` seconds."""
        self._frame_count += 1
        w, h = self.cfg.width, self.cfg.height
        canvas = np.zeros((h, w, 3), dtype=np.uint8)

        # Space cabin dark background with subtle instrument grid
        canvas[:] = (28, 22, 18)
        for gx in range(0, w, 80):
            cv2.line(canvas, (gx, 0), (gx, h), (38, 32, 26), 1)
        for gy in range(0, h, 80):
            cv2.line(canvas, (0, gy), (w, gy), (38, 32, 26), 1)

        # Compute physiological pulse wave (fundamental + dicrotic notch 2nd harmonic + respiratory modulation)
        freq_hz = self.cfg.target_bpm / 60.0
        resp_hz = self.cfg.respiration_rpm / 60.0
        phase = 2.0 * math.pi * freq_hz * timestamp
        resp_wave = math.sin(2.0 * math.pi * resp_hz * timestamp)
        bvp_signal = (
            math.sin(phase)
            + 0.25 * math.sin(2.0 * phase - 0.6)
            + 0.18 * resp_wave
        )

        # Head / body motion based on state
        dx, dy = 0, 0
        if self.cfg.state == "drowsy":
            # Slow head nodding downwards
            nod = max(0.0, math.sin(2.0 * math.pi * 0.22 * timestamp))
            dy = int(nod * 32)
        elif self.cfg.state == "sleeping_restless":
            dx = int(28 * math.sin(2.0 * math.pi * 0.65 * timestamp) + 12 * math.cos(5.1 * timestamp))
            dy = int(22 * math.cos(2.0 * math.pi * 0.48 * timestamp))
        elif self.cfg.state == "sleeping_calm":
            # Subtle breathing motion only
            dy = int(2 * resp_wave)

        cx = w // 2 + dx
        cy = h // 2 + dy
        fw = int(w * 0.44)
        fh = int(h * 0.72)
        fx = cx - fw // 2
        fy = cy - fh // 2

        # Base skin color in BGR + hemoglobin absorption modulation
        # Green channel has strongest blood volume pulse absorption in RGB; NIR has strong uniform intensity modulation
        base_b, base_g, base_r = 142.0, 168.0, 210.0
        if self.cfg.nir_mode:
            nir_val = float(np.clip(165.0 + 4.8 * bvp_signal, 20.0, 245.0))
            skin_color = (int(nir_val), int(nir_val), int(nir_val))
        else:
            # Physiological POS/CHROM ratios: strongest in G, medium in B, smallest in R
            mod_r = base_r + 1.2 * bvp_signal
            mod_g = base_g - 4.5 * bvp_signal
            mod_b = base_b - 2.1 * bvp_signal
            skin_color = (
                int(np.clip(mod_b, 0, 255)),
                int(np.clip(mod_g, 0, 255)),
                int(np.clip(mod_r, 0, 255)),
            )

        # Astronaut flight suit collar / shoulders
        cv2.ellipse(
            canvas,
            (cx, int(h * 0.96)),
            (int(w * 0.36), int(h * 0.22)),
            0,
            180,
            360,
            (95, 75, 55) if not self.cfg.nir_mode else (90, 90, 90),
            -1,
        )

        # Draw main face oval
        cv2.ellipse(
            canvas,
            (cx, cy),
            (fw // 2, fh // 2),
            0,
            0,
            360,
            skin_color,
            -1,
        )

        # Determine Eye openness (EAR) and Mouth opening (MAR) from state
        eye_open_px = 14
        mouth_open_px = 4
        furrow_lines = False
        smiling = False

        if self.cfg.state == "nominal":
            # Periodic natural blink every 3.8 seconds lasting 0.18s
            if (timestamp % 3.8) < 0.18:
                eye_open_px = 2
        elif self.cfg.state == "happy":
            smiling = True
            if (timestamp % 4.0) < 0.16:
                eye_open_px = 2
        elif self.cfg.state == "stressed":
            furrow_lines = True
            eye_open_px = 16
            mouth_open_px = 2
        elif self.cfg.state == "drowsy":
            # Eyes mostly closed (high PERCLOS) + periodic yawning
            cycle = timestamp % 5.0
            eye_open_px = 2 if cycle < 3.6 else 9
            if 1.5 < cycle < 3.8:
                mouth_open_px = 28  # Yawn
        elif self.cfg.state in ("sleeping_calm", "sleeping_restless"):
            eye_open_px = 1
            mouth_open_px = 3 if self.cfg.state == "sleeping_calm" else 10

        # Draw Eyes inside anatomical eye boxes: y+0.30*fh .. y+0.44*fh
        eye_y = fy + int(0.37 * fh)
        l_eye_x = fx + int(0.32 * fw)
        r_eye_x = fx + int(0.68 * fw)
        eye_half_w = int(0.09 * fw)

        cv2.ellipse(
            canvas,
            (l_eye_x, eye_y),
            (eye_half_w, max(1, eye_open_px)),
            0,
            0,
            360,
            (25, 25, 25),
            -1,
        )
        cv2.ellipse(
            canvas,
            (r_eye_x, eye_y),
            (eye_half_w, max(1, eye_open_px)),
            0,
            0,
            360,
            (25, 25, 25),
            -1,
        )

        # Draw Eyebrows (and glabella furrow if stressed)
        brow_y = fy + int(0.28 * fh) + (4 if furrow_lines else 0)
        cv2.line(
            canvas,
            (l_eye_x - eye_half_w, brow_y - (3 if not furrow_lines else -2)),
            (l_eye_x + eye_half_w, brow_y + (5 if furrow_lines else 0)),
            (45, 40, 38),
            4,
        )
        cv2.line(
            canvas,
            (r_eye_x - eye_half_w, brow_y + (5 if furrow_lines else 0)),
            (r_eye_x + eye_half_w, brow_y - (3 if not furrow_lines else -2)),
            (45, 40, 38),
            4,
        )
        if furrow_lines:
            # Dark vertical glabella furrow lines between brows
            cv2.rectangle(
                canvas,
                ( fx + int(0.44 * fw), fy + int(0.23 * fh) ),
                ( fx + int(0.56 * fw), fy + int(0.31 * fh) ),
                (45, 42, 40),
                -1,
            )

        # Draw Nose bridge / tip
        cv2.line(canvas, (cx, fy + int(0.38 * fh)), (cx, fy + int(0.57 * fh)), (95, 110, 140), 2)

        # Draw Mouth inside y+0.66*fh .. y+0.88*fh
        mouth_y = fy + int(0.76 * fh)
        mouth_half_w = int(0.14 * fw)
        cv2.ellipse(
            canvas,
            (cx, mouth_y),
            (mouth_half_w, max(2, mouth_open_px)),
            0,
            0,
            360,
            (30, 28, 35),
            -1,
        )
        if smiling:
            # Raised dark mouth corners in top-left and top-right of mouth patch
            cv2.circle(
                canvas,
                (fx + int(0.34 * fw), fy + int(0.71 * fh)),
                10,
                (35, 30, 35),
                -1,
            )
            cv2.circle(
                canvas,
                (fx + int(0.66 * fw), fy + int(0.71 * fh)),
                10,
                (35, 30, 35),
                -1,
            )

        if self.cfg.nir_mode:
            gray = cv2.cvtColor(canvas, cv2.COLOR_BGR2GRAY)
            canvas = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

        return canvas
