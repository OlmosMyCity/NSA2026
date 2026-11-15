"""Sleep Quality, Drowsiness (PERCLOS/EAR/MAR), and Video Actigraphy Engine.

Tracks eye closure duration and PERCLOS (30 s sliding window, EAR < 0.21), blink cadence
(0.03-0.70 s closures), microsleep events (>= 1.5 s continuous closure), yawns (MAR >= 0.55
sustained >= 0.6 s), head-nodding pitch (>= 18 deg), and 96x72 grayscale inter-frame motion
energy (video actigraphy) across `CABIN_ACTIVE` and `SLEEP_POD` monitoring modes.
"""

from collections import deque
from typing import Deque, Optional, Tuple
import cv2
import numpy as np

from src.config import (
    EAR_BLINK_THRESHOLD,
    HEAD_NOD_PITCH_THRESHOLD_DEG,
    MAR_YAWN_THRESHOLD,
    MICROSLEEP_SECONDS_THRESHOLD,
    PERCLOS_WINDOW_SECONDS,
)
from src.schemas import MonitoringContext, SleepMetrics


class SleepQualityEngine:
    """Evaluates astronaut sleep quality (Sleep Pod mode) and drowsiness/fatigue (Cabin Active mode)."""

    def __init__(self, window_seconds: float = PERCLOS_WINDOW_SECONDS) -> None:
        self.window_seconds = window_seconds
        self._eye_history: Deque[Tuple[float, bool]] = deque()       # (timestamp, is_closed)
        self._blink_timestamps: Deque[float] = deque()               # timestamps of completed blinks
        self._motion_history: Deque[Tuple[float, float]] = deque()   # (timestamp, motion_score)
        self._eye_closed_since: Optional[float] = None
        self._was_eye_closed: bool = False
        self._yawn_active_since: Optional[float] = None
        self._yawn_counted_current: bool = False
        self.yawn_count: int = 0
        self.restlessness_events: int = 0
        self._last_restless_ts: float = -10.0
        self._prev_gray_small: Optional[np.ndarray] = None

    def reset(self) -> None:
        """Clears rolling PERCLOS, blink, yawn, and motion actigraphy history."""
        self._eye_history.clear()
        self._blink_timestamps.clear()
        self._motion_history.clear()
        self._eye_closed_since = None
        self._was_eye_closed = False
        self._yawn_active_since = None
        self._yawn_counted_current = False
        self.yawn_count = 0
        self.restlessness_events = 0
        self._last_restless_ts = -10.0
        self._prev_gray_small = None

    def update(
        self,
        timestamp: float,
        frame_bgr: np.ndarray,
        face_detected: bool,
        ear_left: float,
        ear_right: float,
        mar: float,
        head_pitch_deg: float,
        head_yaw_deg: float,
        head_roll_deg: float,
        context: MonitoringContext = MonitoringContext.CABIN_ACTIVE,
        bpm: float = 0.0,
    ) -> SleepMetrics:
        """Updates fatigue, PERCLOS, yawn, and sleep-stage actigraphy estimates for the current frame."""
        # 1. Compute video actigraphy (inter-frame optical motion energy)
        instant_motion = self._compute_frame_motion(frame_bgr)
        self._motion_history.append((timestamp, instant_motion))
        while self._motion_history and (timestamp - self._motion_history[0][0]) > self.window_seconds:
            self._motion_history.popleft()

        avg_motion = (
            float(np.mean([m for _, m in self._motion_history]))
            if self._motion_history
            else 0.0
        )
        if instant_motion > 32.0 and (timestamp - self._last_restless_ts) > 2.5:
            self.restlessness_events += 1
            self._last_restless_ts = timestamp

        ear_mean = 0.5 * (ear_left + ear_right) if face_detected else 0.28
        is_closed = face_detected and (ear_mean < EAR_BLINK_THRESHOLD)

        # 2. Track Eye Closure Duration, Blinks, and PERCLOS
        if is_closed:
            if not self._was_eye_closed:
                self._eye_closed_since = timestamp
            self._was_eye_closed = True
        else:
            if self._was_eye_closed and self._eye_closed_since is not None:
                closed_dur = timestamp - self._eye_closed_since
                # Standard blink duration window: 0.03s to 0.70s
                if 0.03 <= closed_dur <= 0.70:
                    self._blink_timestamps.append(timestamp)
            self._was_eye_closed = False
            self._eye_closed_since = None

        current_closed_duration = (
            (timestamp - self._eye_closed_since)
            if (is_closed and self._eye_closed_since is not None)
            else 0.0
        )
        microsleep_detected = current_closed_duration >= MICROSLEEP_SECONDS_THRESHOLD

        self._eye_history.append((timestamp, is_closed))
        while self._eye_history and (timestamp - self._eye_history[0][0]) > self.window_seconds:
            self._eye_history.popleft()

        while self._blink_timestamps and (timestamp - self._blink_timestamps[0]) > 60.0:
            self._blink_timestamps.popleft()

        # Calculate PERCLOS (% of window with eyes closed)
        if self._eye_history:
            closed_count = sum(1 for _, c in self._eye_history if c)
            perclos = (closed_count / len(self._eye_history)) * 100.0
        else:
            perclos = 0.0

        # Extrapolate blink rate per minute
        history_span = max(
            10.0,
            (self._eye_history[-1][0] - self._eye_history[0][0]) if len(self._eye_history) > 1 else 10.0,
        )
        blink_rate = len(self._blink_timestamps) * (60.0 / min(60.0, history_span))

        # 3. Track Yawning (sustained high MAR >= threshold for >= 0.6s)
        if face_detected and mar >= MAR_YAWN_THRESHOLD:
            if self._yawn_active_since is None:
                self._yawn_active_since = timestamp
                self._yawn_counted_current = False
            elif (timestamp - self._yawn_active_since) >= 0.6 and not self._yawn_counted_current:
                self.yawn_count += 1
                self._yawn_counted_current = True
        else:
            self._yawn_active_since = None
            self._yawn_counted_current = False

        # 4. Determine Sleep Stage, Fatigue Level, and Composite Sleep Quality Score
        head_nodding = abs(head_pitch_deg) >= HEAD_NOD_PITCH_THRESHOLD_DEG

        if context == MonitoringContext.SLEEP_POD or (perclos >= 75.0 and current_closed_duration >= 3.0):
            # Astronaut is in sleep/rest evaluation mode
            if perclos < 40.0:
                sleep_stage = "Awake"
                fatigue_level = "Awake in Sleep Pod"
            elif avg_motion <= 12.0:
                sleep_stage = "Deep Rest"
                fatigue_level = "Sleeping (Restorative)"
            else:
                sleep_stage = "Light/Restless Sleep"
                fatigue_level = "Sleeping (Restless)"

            # In Sleep Pod mode, quality is high when eyes are closed (high PERCLOS), motion is low, and HR is calm
            continuity_score = min(100.0, perclos * 1.15)
            calmness_score = max(0.0, 100.0 - avg_motion * 1.8)
            hr_bonus = 100.0 if (45.0 <= bpm <= 72.0 or bpm == 0.0) else max(40.0, 100.0 - (bpm - 72.0) * 1.5)
            sleep_quality_score = float(
                np.clip(0.45 * continuity_score + 0.40 * calmness_score + 0.15 * hr_bonus, 0.0, 100.0)
            )
        else:
            # Active cabin duty mode: measures readiness / lack of sleep debt & drowsiness
            sleep_stage = "Awake"
            drowsiness_penalty = (
                perclos * 1.25
                + min(25.0, self.yawn_count * 8.0)
                + (25.0 if microsleep_detected else 0.0)
                + (15.0 if head_nodding else 0.0)
            )
            sleep_quality_score = float(np.clip(100.0 - drowsiness_penalty, 0.0, 100.0))

            if microsleep_detected:
                fatigue_level = "Microsleep Alert"
            elif perclos >= 35.0 or (perclos >= 20.0 and head_nodding):
                fatigue_level = "High Drowsiness"
            elif perclos >= 16.0 or self.yawn_count >= 1 or head_nodding:
                fatigue_level = "Mild Fatigue"
            else:
                fatigue_level = "Nominal"

        return SleepMetrics(
            sleep_quality_score=round(sleep_quality_score, 1),
            fatigue_level=fatigue_level,
            sleep_stage_estimate=sleep_stage,
            ear_left=round(ear_left, 3),
            ear_right=round(ear_right, 3),
            ear_mean=round(ear_mean, 3),
            mar=round(mar, 3),
            perclos=round(perclos, 1),
            blink_rate_per_min=round(blink_rate, 1),
            yawn_count=self.yawn_count,
            microsleep_detected=microsleep_detected,
            head_pitch_deg=round(head_pitch_deg, 1),
            head_yaw_deg=round(head_yaw_deg, 1),
            head_roll_deg=round(head_roll_deg, 1),
            movement_index=round(avg_motion, 1),
            restlessness_events=self.restlessness_events,
        )

    def _compute_frame_motion(self, frame_bgr: np.ndarray) -> float:
        """Computes inter-frame grayscale pixel difference energy scaled to a 0-100 actigraphy index."""
        if frame_bgr is None or frame_bgr.size == 0:
            return 0.0
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (96, 72))
        small_blur = cv2.GaussianBlur(small, (5, 5), 0)
        if self._prev_gray_small is None:
            self._prev_gray_small = small_blur
            return 0.0
        diff = cv2.absdiff(small_blur, self._prev_gray_small)
        self._prev_gray_small = small_blur
        # Scale mean pixel difference into a 0-100 movement actigraphy index
        raw_motion = float(np.mean(diff))
        return float(np.clip(raw_motion * 6.5, 0.0, 100.0))
