"""Lightweight CPU Face & Landmark Tracker (MediaPipe + OpenCV hybrid)."""

from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple
import cv2
import numpy as np

from src.config import MEDIAPIPE_FACE_LANDMARKER_PATH

# Standard MediaPipe 468/478 landmark indices
LEFT_EYE_IDXS = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_IDXS = [362, 385, 387, 263, 373, 380]
MOUTH_IDXS = [61, 39, 0, 269, 291, 405, 17, 181]
FOREHEAD_IDXS = [10, 338, 297, 332, 284, 251, 389, 356, 103, 67, 109]
LEFT_CHEEK_IDXS = [116, 117, 118, 101, 36, 205, 187, 123]
RIGHT_CHEEK_IDXS = [345, 346, 347, 330, 266, 425, 411, 352]

# Module-level cached detectors so multiple pipelines don't re-initialize C++ graphs
_SHARED_MP_FACE_MESH = None
_SHARED_MP_LANDMARKER = None
_SHARED_MP_MODE: Optional[str] = None
_SHARED_HAAR = None


@dataclass
class FaceExtractionResult:
    face_detected: bool
    bbox: Optional[Tuple[int, int, int, int]] = None  # (x, y, w, h)
    landmarks_2d: Optional[np.ndarray] = None         # shape (N, 2) in pixel coords
    ear_left: float = 0.30
    ear_right: float = 0.30
    mar: float = 0.15
    brow_furrow: float = 0.15
    smile_ratio: float = 0.20
    head_pitch_deg: float = 0.0
    head_yaw_deg: float = 0.0
    head_roll_deg: float = 0.0
    roi_rgb_means: Dict[str, np.ndarray] = field(default_factory=dict)
    roi_polygons: Dict[str, np.ndarray] = field(default_factory=dict)
    face_crop_gray: Optional[np.ndarray] = None       # 64x64 aligned grayscale crop for ONNX FER
    backend_used: str = "none"


def _compute_ear(eye_pts: np.ndarray) -> float:
    """Compute Eye Aspect Ratio (Soukupová and Čech, 2016) from 6 (x,y) points."""
    p1, p2, p3, p4, p5, p6 = eye_pts
    vert1 = np.linalg.norm(p2 - p6)
    vert2 = np.linalg.norm(p3 - p5)
    horiz = np.linalg.norm(p1 - p4)
    if horiz < 1e-5:
        return 0.30
    return float((vert1 + vert2) / (2.0 * horiz))


def _compute_mar(mouth_pts: np.ndarray) -> float:
    """Compute Mouth Aspect Ratio from 8 perimeter points."""
    v1 = np.linalg.norm(mouth_pts[1] - mouth_pts[7])
    v2 = np.linalg.norm(mouth_pts[2] - mouth_pts[6])
    v3 = np.linalg.norm(mouth_pts[3] - mouth_pts[5])
    horiz = np.linalg.norm(mouth_pts[0] - mouth_pts[4])
    if horiz < 1e-5:
        return 0.10
    return float((v1 + v2 + v3) / (3.0 * horiz))


class FaceTracker:
    """Extracts facial landmarks, geometric Action Units, and skin ROIs for rPPG."""

    def __init__(self) -> None:
        global _SHARED_MP_FACE_MESH, _SHARED_MP_LANDMARKER, _SHARED_MP_MODE, _SHARED_HAAR
        if _SHARED_MP_MODE is None:
            self._init_shared_mediapipe()
        self._mp_face_mesh = _SHARED_MP_FACE_MESH
        self._mp_landmarker = _SHARED_MP_LANDMARKER
        self._mp_mode = _SHARED_MP_MODE or "opencv_fallback"

        if _SHARED_HAAR is None:
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            _SHARED_HAAR = cv2.CascadeClassifier(cascade_path)
        self._haar_face = _SHARED_HAAR

    @staticmethod
    def _init_shared_mediapipe() -> None:
        global _SHARED_MP_FACE_MESH, _SHARED_MP_LANDMARKER, _SHARED_MP_MODE
        try:
            import mediapipe as mp
            if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_mesh"):
                _SHARED_MP_FACE_MESH = mp.solutions.face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                _SHARED_MP_MODE = "solutions_face_mesh"
                return
            if hasattr(mp, "tasks") and MEDIAPIPE_FACE_LANDMARKER_PATH.exists():
                from mediapipe.tasks import python as mp_python
                from mediapipe.tasks.python import vision as mp_vision

                base_options = mp_python.BaseOptions(
                    model_asset_path=str(MEDIAPIPE_FACE_LANDMARKER_PATH)
                )
                options = mp_vision.FaceLandmarkerOptions(
                    base_options=base_options,
                    running_mode=mp_vision.RunningMode.IMAGE,
                    num_faces=1,
                    min_face_detection_confidence=0.45,
                )
                _SHARED_MP_LANDMARKER = mp_vision.FaceLandmarker.create_from_options(options)
                _SHARED_MP_MODE = "tasks_landmarker"
                return
        except Exception:
            pass
        _SHARED_MP_MODE = "opencv_fallback"

    def process_frame(self, frame_bgr: np.ndarray) -> FaceExtractionResult:
        if frame_bgr is None or frame_bgr.size == 0:
            return FaceExtractionResult(face_detected=False)

        h, w = frame_bgr.shape[:2]
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

        # 1. Try MediaPipe 468/478 3D Face Mesh
        pts_3d = self._extract_mediapipe_landmarks(frame_rgb, w, h)
        if pts_3d is not None:
            return self._build_from_dense_landmarks(frame_bgr, frame_rgb, pts_3d)

        # 2. Fallback: OpenCV Haar / Synthetic Avatar Contour analyzer
        return self._extract_fallback_landmarks(frame_bgr, frame_rgb)

    def _extract_mediapipe_landmarks(
        self, frame_rgb: np.ndarray, w: int, h: int
    ) -> Optional[np.ndarray]:
        if self._mp_mode == "solutions_face_mesh" and self._mp_face_mesh is not None:
            res = self._mp_face_mesh.process(frame_rgb)
            if res.multi_face_landmarks:
                lm = res.multi_face_landmarks[0].landmark
                return np.array([[p.x * w, p.y * h, p.z * w] for p in lm], dtype=np.float32)
        elif self._mp_mode == "tasks_landmarker" and self._mp_landmarker is not None:
            import mediapipe as mp

            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
            res = self._mp_landmarker.detect(mp_img)
            if res.face_landmarks:
                lm = res.face_landmarks[0]
                return np.array([[p.x * w, p.y * h, p.z * w] for p in lm], dtype=np.float32)
        return None

    def _build_from_dense_landmarks(
        self, frame_bgr: np.ndarray, frame_rgb: np.ndarray, pts_3d: np.ndarray
    ) -> FaceExtractionResult:
        h, w = frame_bgr.shape[:2]
        pts_2d = pts_3d[:, :2]

        x_min = max(0, int(np.min(pts_2d[:, 0])))
        y_min = max(0, int(np.min(pts_2d[:, 1])))
        x_max = min(w - 1, int(np.max(pts_2d[:, 0])))
        y_max = min(h - 1, int(np.max(pts_2d[:, 1])))
        bbox = (x_min, y_min, max(1, x_max - x_min), max(1, y_max - y_min))

        ear_l_lm = _compute_ear(pts_2d[LEFT_EYE_IDXS])
        ear_r_lm = _compute_ear(pts_2d[RIGHT_EYE_IDXS])
        mar_lm = _compute_mar(pts_2d[MOUTH_IDXS])

        # Also extract pixel-patch measurements around landmarks so closed eyelids / furrowed brows
        # in low-contrast IR or synthetic streams are never missed
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        l_eye_c = np.mean(pts_2d[LEFT_EYE_IDXS], axis=0)
        r_eye_c = np.mean(pts_2d[RIGHT_EYE_IDXS], axis=0)
        eye_span = max(12.0, float(np.linalg.norm(pts_2d[33] - pts_2d[133])))
        ehw = int(0.75 * eye_span)
        ehh = int(0.65 * eye_span)

        l_eye_roi = gray[
            max(0, int(l_eye_c[1]) - ehh) : min(h, int(l_eye_c[1]) + ehh),
            max(0, int(l_eye_c[0]) - ehw) : min(w, int(l_eye_c[0]) + ehw),
        ]
        r_eye_roi = gray[
            max(0, int(r_eye_c[1]) - ehh) : min(h, int(r_eye_c[1]) + ehh),
            max(0, int(r_eye_c[0]) - ehw) : min(w, int(r_eye_c[0]) + ehw),
        ]

        mouth_c = np.mean(pts_2d[MOUTH_IDXS], axis=0)
        mouth_span = max(18.0, float(np.linalg.norm(pts_2d[61] - pts_2d[291])))
        mhw = int(0.65 * mouth_span)
        mhh = int(0.55 * mouth_span)
        mouth_roi = gray[
            max(0, int(mouth_c[1]) - mhh) : min(h, int(mouth_c[1]) + mhh),
            max(0, int(mouth_c[0]) - mhw) : min(w, int(mouth_c[0]) + mhw),
        ]

        glabella_c = 0.5 * (pts_2d[107] + pts_2d[336])
        ghw = int(0.45 * eye_span)
        ghh = int(0.45 * eye_span)
        brow_roi = gray[
            max(0, int(glabella_c[1]) - ghh) : min(h, int(glabella_c[1]) + ghh),
            max(0, int(glabella_c[0]) - ghw) : min(w, int(glabella_c[0]) + ghw),
        ]

        ear_l_px = self._estimate_ear_from_patch(l_eye_roi)
        ear_r_px = self._estimate_ear_from_patch(r_eye_roi)
        mar_px = self._estimate_mar_from_patch(mouth_roi)
        brow_px, smile_px = self._estimate_expression_from_patches(brow_roi, mouth_roi)

        ear_l = min(ear_l_lm, ear_l_px)
        ear_r = min(ear_r_lm, ear_r_px)
        mar = max(mar_lm, mar_px)

        # Geometric Action Units for Mood/Stress
        face_width = max(1.0, float(np.linalg.norm(pts_2d[234] - pts_2d[454])))
        face_height = max(1.0, float(np.linalg.norm(pts_2d[10] - pts_2d[152])))

        inner_brow_dist = float(np.linalg.norm(pts_2d[107] - pts_2d[336])) / face_width
        brow_eye_dist = (
            float(np.linalg.norm(pts_2d[105] - pts_2d[159]))
            + float(np.linalg.norm(pts_2d[334] - pts_2d[386]))
        ) / (2.0 * face_height)
        brow_lm = float(np.clip((0.26 - inner_brow_dist) * 4.5 + (0.095 - brow_eye_dist) * 8.0, 0.0, 1.0))
        brow_furrow = max(brow_lm, brow_px)

        mouth_width = float(np.linalg.norm(pts_2d[61] - pts_2d[291])) / face_width
        mouth_center_y = 0.5 * (pts_2d[0, 1] + pts_2d[17, 1])
        corner_y = 0.5 * (pts_2d[61, 1] + pts_2d[291, 1])
        corner_lift = (mouth_center_y - corner_y) / face_height
        smile_lm = float(np.clip((mouth_width - 0.34) * 3.5 + corner_lift * 8.5, 0.0, 1.0))
        smile_ratio = max(smile_lm, smile_px)

        pitch, yaw, roll = self._estimate_head_pose(pts_2d, w, h)

        forehead_poly = pts_2d[FOREHEAD_IDXS].astype(np.int32)
        l_cheek_poly = pts_2d[LEFT_CHEEK_IDXS].astype(np.int32)
        r_cheek_poly = pts_2d[RIGHT_CHEEK_IDXS].astype(np.int32)

        roi_polygons = {
            "forehead": forehead_poly,
            "left_cheek": l_cheek_poly,
            "right_cheek": r_cheek_poly,
        }
        roi_means = self._compute_polygon_rgb_means(frame_rgb, roi_polygons)

        crop = gray[y_min:y_max, x_min:x_max]
        face_crop_64 = cv2.resize(crop, (64, 64)) if crop.size > 0 else np.zeros((64, 64), dtype=np.uint8)

        return FaceExtractionResult(
            face_detected=True,
            bbox=bbox,
            landmarks_2d=pts_2d,
            ear_left=ear_l,
            ear_right=ear_r,
            mar=mar,
            brow_furrow=brow_furrow,
            smile_ratio=smile_ratio,
            head_pitch_deg=pitch,
            head_yaw_deg=yaw,
            head_roll_deg=roll,
            roi_rgb_means=roi_means,
            roi_polygons=roi_polygons,
            face_crop_gray=face_crop_64,
            backend_used=self._mp_mode,
        )

    def _estimate_head_pose(self, pts_2d: np.ndarray, w: int, h: int) -> Tuple[float, float, float]:
        eye_mid = 0.5 * (pts_2d[33] + pts_2d[263])
        mouth_mid = 0.5 * (pts_2d[61] + pts_2d[291])
        nose = pts_2d[1]
        face_w = max(1.0, float(np.linalg.norm(pts_2d[33] - pts_2d[263])))

        dy_eye = float(pts_2d[263, 1] - pts_2d[33, 1])
        dx_eye = float(pts_2d[263, 0] - pts_2d[33, 0])
        roll = float(np.degrees(np.arctan2(dy_eye, max(1e-5, dx_eye))))
        yaw = float(np.clip(((nose[0] - eye_mid[0]) / face_w) * 90.0, -60.0, 60.0))

        eye_to_mouth = max(1.0, float(mouth_mid[1] - eye_mid[1]))
        nose_ratio = float(nose[1] - eye_mid[1]) / eye_to_mouth
        pitch = float(np.clip((nose_ratio - 0.58) * 110.0, -50.0, 50.0))
        return pitch, yaw, roll

    def _compute_polygon_rgb_means(
        self, frame_rgb: np.ndarray, polygons: Dict[str, np.ndarray]
    ) -> Dict[str, np.ndarray]:
        h, w = frame_rgb.shape[:2]
        means: Dict[str, np.ndarray] = {}
        combined_pixels = []
        for name, poly in polygons.items():
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.fillPoly(mask, [poly], 255)
            pixels = frame_rgb[mask == 255]
            if pixels.size > 0:
                means[name] = np.mean(pixels, axis=0).astype(np.float64)
                combined_pixels.append(pixels)
            else:
                means[name] = np.zeros(3, dtype=np.float64)
        if combined_pixels:
            all_px = np.vstack(combined_pixels)
            means["combined"] = np.mean(all_px, axis=0).astype(np.float64)
        else:
            means["combined"] = np.zeros(3, dtype=np.float64)
        return means

    def _extract_fallback_landmarks(
        self, frame_bgr: np.ndarray, frame_rgb: np.ndarray
    ) -> FaceExtractionResult:
        """Fallback face & sub-feature detector for synthetic/IR frames or when MediaPipe isn't triggered."""
        h, w = frame_bgr.shape[:2]
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)

        faces = self._haar_face.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=4, minSize=(60, 60)
        )
        bbox: Optional[Tuple[int, int, int, int]] = None
        if len(faces) > 0:
            areas = [fw * fh for (_, _, fw, fh) in faces]
            idx = int(np.argmax(areas))
            x, y, fw, fh = [int(v) for v in faces[idx]]
            bbox = (x, y, fw, fh)
        else:
            center_crop = gray[int(h * 0.15) : int(h * 0.85), int(w * 0.25) : int(w * 0.75)]
            if center_crop.size > 0 and float(np.std(center_crop)) > 12.0 and float(np.mean(center_crop)) > 25.0:
                bbox = (int(w * 0.28), int(h * 0.14), int(w * 0.44), int(h * 0.72))

        if bbox is None:
            return FaceExtractionResult(face_detected=False)

        x, y, fw, fh = bbox
        forehead_poly = np.array(
            [
                [x + int(0.28 * fw), y + int(0.10 * fh)],
                [x + int(0.72 * fw), y + int(0.10 * fh)],
                [x + int(0.72 * fw), y + int(0.24 * fh)],
                [x + int(0.28 * fw), y + int(0.24 * fh)],
            ],
            dtype=np.int32,
        )
        l_cheek_poly = np.array(
            [
                [x + int(0.16 * fw), y + int(0.48 * fh)],
                [x + int(0.38 * fw), y + int(0.48 * fh)],
                [x + int(0.38 * fw), y + int(0.65 * fh)],
                [x + int(0.16 * fw), y + int(0.65 * fh)],
            ],
            dtype=np.int32,
        )
        r_cheek_poly = np.array(
            [
                [x + int(0.62 * fw), y + int(0.48 * fh)],
                [x + int(0.84 * fw), y + int(0.48 * fh)],
                [x + int(0.84 * fw), y + int(0.65 * fh)],
                [x + int(0.62 * fw), y + int(0.65 * fh)],
            ],
            dtype=np.int32,
        )
        roi_polygons = {
            "forehead": forehead_poly,
            "left_cheek": l_cheek_poly,
            "right_cheek": r_cheek_poly,
        }
        roi_means = self._compute_polygon_rgb_means(frame_rgb, roi_polygons)

        l_eye_roi = gray[
            y + int(0.30 * fh) : y + int(0.44 * fh),
            x + int(0.20 * fw) : x + int(0.44 * fw),
        ]
        r_eye_roi = gray[
            y + int(0.30 * fh) : y + int(0.44 * fh),
            x + int(0.56 * fw) : x + int(0.80 * fw),
        ]
        mouth_roi = gray[
            y + int(0.66 * fh) : y + int(0.88 * fh),
            x + int(0.30 * fw) : x + int(0.70 * fw),
        ]
        brow_roi = gray[
            y + int(0.22 * fh) : y + int(0.32 * fh),
            x + int(0.40 * fw) : x + int(0.60 * fw),
        ]

        ear_l = self._estimate_ear_from_patch(l_eye_roi)
        ear_r = self._estimate_ear_from_patch(r_eye_roi)
        mar = self._estimate_mar_from_patch(mouth_roi)
        brow_furrow, smile_ratio = self._estimate_expression_from_patches(brow_roi, mouth_roi)

        face_cy = y + 0.5 * fh
        pitch = float(np.clip(((face_cy / h) - 0.50) * 95.0, -45.0, 45.0))
        yaw = float(np.clip((((x + 0.5 * fw) / w) - 0.50) * 80.0, -45.0, 45.0))

        crop = gray[max(0, y) : min(h, y + fh), max(0, x) : min(w, x + fw)]
        face_crop_64 = cv2.resize(crop, (64, 64)) if crop.size > 0 else np.zeros((64, 64), dtype=np.uint8)

        return FaceExtractionResult(
            face_detected=True,
            bbox=bbox,
            landmarks_2d=None,
            ear_left=ear_l,
            ear_right=ear_r,
            mar=mar,
            brow_furrow=brow_furrow,
            smile_ratio=smile_ratio,
            head_pitch_deg=pitch,
            head_yaw_deg=yaw,
            head_roll_deg=0.0,
            roi_rgb_means=roi_means,
            roi_polygons=roi_polygons,
            face_crop_gray=face_crop_64,
            backend_used="opencv_hybrid",
        )

    @staticmethod
    def _estimate_ear_from_patch(patch: np.ndarray) -> float:
        if patch.size == 0:
            return 0.28
        dark_mask = (patch < 65).astype(np.uint8)
        col_heights = np.sum(dark_mask, axis=0)
        max_h = float(np.percentile(col_heights, 85)) if col_heights.size > 0 else 0.0
        ear = (max_h / max(1.0, float(patch.shape[1]))) * 1.15
        return float(np.clip(ear, 0.12, 0.38))

    @staticmethod
    def _estimate_mar_from_patch(patch: np.ndarray) -> float:
        if patch.size == 0:
            return 0.15
        dark_mask = (patch < 55).astype(np.uint8)
        col_heights = np.sum(dark_mask, axis=0)
        max_h = float(np.percentile(col_heights, 85)) if col_heights.size > 0 else 0.0
        mar = (max_h / max(1.0, float(patch.shape[1]))) * 1.35
        return float(np.clip(mar, 0.08, 0.90))

    @staticmethod
    def _estimate_expression_from_patches(
        brow_patch: np.ndarray, mouth_patch: np.ndarray
    ) -> Tuple[float, float]:
        brow_furrow = 0.10
        if brow_patch.size > 0:
            dark_frac = float(np.mean(brow_patch < 75))
            brow_furrow = float(np.clip(dark_frac * 3.0, 0.0, 1.0))

        smile_ratio = 0.15
        if mouth_patch.size > 0:
            mh, mw = mouth_patch.shape[:2]
            left_corner = mouth_patch[: int(mh * 0.48), : int(mw * 0.28)]
            right_corner = mouth_patch[: int(mh * 0.48), int(mw * 0.72) :]
            if left_corner.size > 0 and right_corner.size > 0:
                corner_darkness = 0.5 * (
                    float(np.mean(left_corner < 85)) + float(np.mean(right_corner < 85))
                )
                smile_ratio = float(np.clip(corner_darkness * 3.2, 0.0, 1.0))
        return brow_furrow, smile_ratio
