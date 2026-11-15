"""Unified Astronaut Biometrics Pipeline orchestrating FaceTracker, rPPG, Sleep, and Mood engines."""

import base64
import time
from typing import List, Optional
import cv2
import numpy as np

from src.engines.mood_engine import MoodEngine
from src.engines.rppg_engine import RPPGEngine
from src.engines.sleep_engine import SleepQualityEngine
from src.schemas import (
    AstronautTelemetryFrame,
    CameraMode,
    HeartRateMetrics,
    MonitoringContext,
    MoodMetrics,
    SleepMetrics,
)
from src.vision.face_tracker import FaceExtractionResult, FaceTracker


class AstronautBiometricsPipeline:
    """Real-time contactless biometric monitor for astronauts."""

    def __init__(self) -> None:
        self.face_tracker = FaceTracker()
        self.rppg_engine = RPPGEngine()
        self.sleep_engine = SleepQualityEngine()
        self.mood_engine = MoodEngine()
        self.frame_index: int = 0
        self._last_ts: Optional[float] = None
        self._fps_ema: float = 30.0
        self.latest_telemetry: Optional[AstronautTelemetryFrame] = None

    def reset(self) -> None:
        self.rppg_engine.reset()
        self.sleep_engine.reset()
        self.mood_engine.reset()
        self.frame_index = 0
        self._last_ts = None

    def process_frame(
        self,
        frame_bgr: np.ndarray,
        timestamp: Optional[float] = None,
        camera_mode: CameraMode = CameraMode.RGB_POS,
        context: MonitoringContext = MonitoringContext.CABIN_ACTIVE,
        include_annotated_frame: bool = False,
    ) -> AstronautTelemetryFrame:
        now = timestamp if timestamp is not None else time.time()
        if self._last_ts is not None and now > self._last_ts:
            inst_fps = 1.0 / (now - self._last_ts)
            self._fps_ema = 0.85 * self._fps_ema + 0.15 * float(np.clip(inst_fps, 1.0, 120.0))
        self._last_ts = now
        self.frame_index += 1

        # 1. Extract facial landmarks, ROIs, and Action Units
        face_res: FaceExtractionResult = self.face_tracker.process_frame(frame_bgr)

        # 2. Update rPPG Heart Rate & HRV Engine
        hr_metrics: HeartRateMetrics = self.rppg_engine.update(
            timestamp=now,
            face_detected=face_res.face_detected,
            roi_rgb_means=face_res.roi_rgb_means,
            camera_mode=camera_mode,
        )

        # 3. Update Sleep Quality & Fatigue Engine
        sleep_metrics: SleepMetrics = self.sleep_engine.update(
            timestamp=now,
            frame_bgr=frame_bgr,
            face_detected=face_res.face_detected,
            ear_left=face_res.ear_left,
            ear_right=face_res.ear_right,
            mar=face_res.mar,
            head_pitch_deg=face_res.head_pitch_deg,
            head_yaw_deg=face_res.head_yaw_deg,
            head_roll_deg=face_res.head_roll_deg,
            context=context,
            bpm=hr_metrics.bpm,
        )

        # 4. Update Mood & Psychological Stress Engine
        mood_metrics: MoodMetrics = self.mood_engine.update(
            face_detected=face_res.face_detected,
            face_crop_gray=face_res.face_crop_gray,
            ear_mean=sleep_metrics.ear_mean,
            mar=sleep_metrics.mar,
            brow_furrow=face_res.brow_furrow,
            smile_ratio=face_res.smile_ratio,
            perclos=sleep_metrics.perclos,
            bpm=hr_metrics.bpm,
        )

        # 5. Compute Overall Health Index & Operational Alerts
        overall_health, alerts = self._evaluate_mission_health(
            face_res.face_detected, hr_metrics, sleep_metrics, mood_metrics, context
        )

        annotated_b64: Optional[str] = None
        if include_annotated_frame:
            annotated_bgr = self.draw_hud_overlay(
                frame_bgr, face_res, hr_metrics, sleep_metrics, mood_metrics, camera_mode
            )
            ok, buf = cv2.imencode(".jpg", annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ok:
                annotated_b64 = base64.b64encode(buf.tobytes()).decode("ascii")

        telemetry = AstronautTelemetryFrame(
            timestamp=round(now, 3),
            frame_index=self.frame_index,
            face_detected=face_res.face_detected,
            fps=round(self._fps_ema, 1),
            camera_mode=hr_metrics.camera_mode,
            context=context,
            overall_health_index=round(overall_health, 1),
            alerts=alerts,
            mood=mood_metrics,
            sleep=sleep_metrics,
            heart_rate=hr_metrics,
            annotated_frame_jpeg_b64=annotated_b64,
        )
        self.latest_telemetry = telemetry
        return telemetry

    @staticmethod
    def _evaluate_mission_health(
        face_detected: bool,
        hr: HeartRateMetrics,
        sleep: SleepMetrics,
        mood: MoodMetrics,
        context: MonitoringContext,
    ) -> tuple[float, List[str]]:
        alerts: List[str] = []
        if not face_detected:
            alerts.append("NO SUBJECT IN FIELD OF VIEW")
            return 0.0, alerts

        if sleep.microsleep_detected and context == MonitoringContext.CABIN_ACTIVE:
            alerts.append("CRITICAL: MICROSLEEP DETECTED ON DUTY")
        elif sleep.perclos >= 35.0 and context == MonitoringContext.CABIN_ACTIVE:
            alerts.append(f"HIGH DROWSINESS WARNING (PERCLOS {sleep.perclos:.0f}%)")

        if mood.stress_index >= 62.0:
            alerts.append(f"ELEVATED PSYCHOLOGICAL STRESS ({mood.stress_index:.0f}%)")

        if hr.bpm > 0.0:
            if hr.bpm >= 115.0:
                alerts.append(f"TACHYCARDIA ALERT ({hr.bpm:.0f} BPM)")
            elif hr.bpm <= 46.0:
                alerts.append(f"BRADYCARDIA ALERT ({hr.bpm:.0f} BPM)")

        if context == MonitoringContext.SLEEP_POD and sleep.movement_index >= 30.0:
            alerts.append("FRAGMENTED / RESTLESS SLEEP DETECTED")

        # Weighted health score
        calm_score = 100.0 - mood.stress_index * 0.75
        hr_score = 95.0
        if hr.bpm > 0.0:
            deviation = max(0.0, abs(hr.bpm - 70.0) - 12.0)
            hr_score = float(np.clip(100.0 - deviation * 1.4, 30.0, 100.0))

        health = 0.40 * sleep.sleep_quality_score + 0.35 * calm_score + 0.25 * hr_score
        return float(np.clip(health, 0.0, 100.0)), alerts

    @staticmethod
    def draw_hud_overlay(
        frame_bgr: np.ndarray,
        face_res: FaceExtractionResult,
        hr: HeartRateMetrics,
        sleep: SleepMetrics,
        mood: MoodMetrics,
        camera_mode: CameraMode,
    ) -> np.ndarray:
        vis = frame_bgr.copy()
        h, w = vis.shape[:2]

        # If NIR mode requested on RGB frame, render monochrome green/cyan night-vision HUD look
        if camera_mode == CameraMode.NIR_IR:
            gray = cv2.cvtColor(vis, cv2.COLOR_BGR2GRAY)
            vis = cv2.merge([gray, np.clip(gray * 1.08, 0, 255).astype(np.uint8), gray])

        if face_res.face_detected and face_res.bbox is not None:
            x, y, fw, fh = face_res.bbox
            hud_color = (210, 240, 60) if sleep.fatigue_level == "Nominal" else (60, 165, 255)
            if sleep.microsleep_detected:
                hud_color = (60, 60, 255)

            # Corner brackets around astronaut face
            clen = max(14, int(0.12 * min(fw, fh)))
            for cx_corner, cy_corner, sx, sy in [
                (x, y, 1, 1),
                (x + fw, y, -1, 1),
                (x, y + fh, 1, -1),
                (x + fw, y + fh, -1, -1),
            ]:
                cv2.line(vis, (cx_corner, cy_corner), (cx_corner + sx * clen, cy_corner), hud_color, 2)
                cv2.line(vis, (cx_corner, cy_corner), (cx_corner, cy_corner + sy * clen), hud_color, 2)

            # Draw rPPG ROI polygons (Forehead & Cheeks)
            overlay = vis.copy()
            for name, poly in face_res.roi_polygons.items():
                roi_col = (120, 255, 140) if name == "forehead" else (255, 210, 80)
                cv2.fillPoly(overlay, [poly], roi_col)
                cv2.polylines(vis, [poly], True, roi_col, 1, cv2.LINE_AA)
            cv2.addWeighted(overlay, 0.22, vis, 0.78, 0, vis)

            # Draw sparse facial mesh landmarks if available
            if face_res.landmarks_2d is not None:
                for pt in face_res.landmarks_2d[::6]:
                    cv2.circle(vis, (int(pt[0]), int(pt[1])), 1, (220, 220, 120), -1)

        # Top telemetry bar
        cv2.rectangle(vis, (0, 0), (w, 34), (18, 16, 14), -1)
        bpm_str = f"{hr.bpm:.1f} BPM" if hr.bpm > 0 else "CALIBRATING"
        hud_text = (
            f"ORBVITAL | HR: {bpm_str} "
            f"| MOOD: {mood.dominant_mood.upper()} | PERCLOS: {sleep.perclos:.0f}%"
        )
        cv2.putText(
            vis,
            hud_text,
            (12, 22),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.46,
            (220, 245, 255),
            1,
            cv2.LINE_AA,
        )
        return vis
