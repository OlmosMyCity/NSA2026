"""Real-time Facial Identity & Biometric Enrollment Engine (ONNX SFace + Craniofacial Hybrid)."""

from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional, Tuple
import cv2
import numpy as np

from src.config import FACE_EMBEDDING_DIM, FACE_MATCH_THRESHOLD, FACE_SMOOTHING_WINDOW, SFACE_ONNX_PATH
from src.schemas import BiometricExtractResponse, EnrolledCrewProfile, IdentityMetrics
from src.vision.face_tracker import FaceExtractionResult

# Canonical 112x112 5-point landmarks for standard ArcFace/SFace alignment
_CANONICAL_5PTS = np.array(
    [
        [38.2946, 51.6963],  # left eye
        [73.5318, 51.5014],  # right eye
        [56.0252, 71.7366],  # nose tip
        [41.5493, 92.3655],  # left mouth corner
        [70.7299, 92.2041],  # right mouth corner
    ],
    dtype=np.float32,
)

# MediaPipe landmark pairs for pose-invariant craniofacial ratios
_CRANIOFACIAL_PAIRS: List[Tuple[int, int]] = [
    (33, 263),   # outer eye span
    (133, 362),  # inner eye span (intercanthal)
    (33, 133),   # left eye width
    (362, 263),  # right eye width
    (10, 152),   # full face height (forehead to chin)
    (168, 1),    # nasal bridge length
    (98, 327),   # nasal alar width
    (61, 291),   # mouth width
    (1, 152),    # nose tip to chin
    (10, 168),   # forehead height
    (234, 454),  # bizygomatic cheekbone width
    (172, 397),  # bigonial jaw width
    (70, 300),   # outer brow span
    (107, 336),  # inner brow glabella span
    (33, 61),    # left eye to left mouth
    (263, 291),  # right eye to right mouth
    (1, 0),      # philtrum height
    (17, 152),   # chin height
    (105, 159),  # left brow to eye
    (334, 386),  # right brow to eye
    (127, 356),  # temple width
    (58, 288),   # lower jaw angle width
    (152, 234),  # chin to left cheekbone
    (152, 454),  # chin to right cheekbone
]


@dataclass
class _GalleryEntry:
    astronaut_id: str
    astronaut_name: str
    embeddings: np.ndarray  # shape (K, D), L2-normalized rows


def _l2_normalize(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    if norm < 1e-8:
        return np.zeros_like(vec, dtype=np.float32)
    return (vec / norm).astype(np.float32)


class FaceIdentityEngine:
    """Extracts 128D L2-normalized facial biometric embeddings and matches against mission crew."""

    def __init__(self) -> None:
        self._onnx_session = None
        self._input_name: Optional[str] = None
        self._backend_name: str = "craniofacial_hybrid_128d"
        self._init_onnx()
        self._gallery: Dict[str, _GalleryEntry] = {}
        self._score_history: Deque[Dict[str, float]] = deque(maxlen=FACE_SMOOTHING_WINDOW)
        self._clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))

    def _init_onnx(self) -> None:
        if not SFACE_ONNX_PATH.exists():
            return
        try:
            import onnxruntime as ort

            sess_opts = ort.SessionOptions()
            sess_opts.intra_op_num_threads = 2
            self._onnx_session = ort.InferenceSession(
                str(SFACE_ONNX_PATH),
                sess_options=sess_opts,
                providers=["CPUExecutionProvider"],
            )
            self._input_name = self._onnx_session.get_inputs()[0].name
            self._backend_name = "sface_onnx_128d"
        except Exception:
            self._onnx_session = None

    def reset(self) -> None:
        self._score_history.clear()

    def set_gallery(self, profiles: List[EnrolledCrewProfile]) -> int:
        """Load enrolled crew biometric vectors into memory."""
        new_gallery: Dict[str, _GalleryEntry] = {}
        for prof in profiles:
            valid_vecs = []
            for raw in prof.embeddings:
                arr = np.asarray(raw, dtype=np.float32).flatten()
                if arr.size == FACE_EMBEDDING_DIM and np.all(np.isfinite(arr)):
                    normed = _l2_normalize(arr)
                    if float(np.linalg.norm(normed)) > 0.5:
                        valid_vecs.append(normed)
            if valid_vecs:
                new_gallery[prof.astronaut_id] = _GalleryEntry(
                    astronaut_id=prof.astronaut_id,
                    astronaut_name=prof.astronaut_name,
                    embeddings=np.vstack(valid_vecs),
                )
        self._gallery = new_gallery
        self._score_history.clear()
        return len(self._gallery)

    def enrolled_count(self) -> int:
        return len(self._gallery)

    @staticmethod
    def compute_bbox_norm(
        bbox: Optional[Tuple[int, int, int, int]], frame_shape: Tuple[int, ...]
    ) -> Optional[List[float]]:
        if bbox is None or len(frame_shape) < 2:
            return None
        h, w = frame_shape[:2]
        if h <= 0 or w <= 0:
            return None
        x, y, fw, fh = bbox
        return [
            round(float(np.clip(x / w, 0.0, 1.0)), 4),
            round(float(np.clip(y / h, 0.0, 1.0)), 4),
            round(float(np.clip(fw / w, 0.01, 1.0)), 4),
            round(float(np.clip(fh / h, 0.01, 1.0)), 4),
        ]

    def _align_face_112(
        self, frame_bgr: np.ndarray, face_res: FaceExtractionResult
    ) -> np.ndarray:
        """Align face to 112x112 canonical coordinates using landmarks or bounding box."""
        if face_res.landmarks_2d is not None and len(face_res.landmarks_2d) >= 455:
            pts = face_res.landmarks_2d
            l_eye = 0.5 * (pts[33] + pts[133])
            r_eye = 0.5 * (pts[362] + pts[263])
            nose = pts[1]
            l_mouth = pts[61]
            r_mouth = pts[291]
            src_5pts = np.array([l_eye, r_eye, nose, l_mouth, r_mouth], dtype=np.float32)
            mat, _ = cv2.estimateAffinePartial2D(src_5pts, _CANONICAL_5PTS, method=cv2.LMEDS)
            if mat is not None:
                return cv2.warpAffine(frame_bgr, mat, (112, 112), borderMode=cv2.BORDER_REPLICATE)

        h, w = frame_bgr.shape[:2]
        x, y, fw, fh = face_res.bbox or (0, 0, w, h)
        crop = frame_bgr[max(0, y) : min(h, y + fh), max(0, x) : min(w, x + fw)]
        if crop.size == 0:
            return np.zeros((112, 112, 3), dtype=np.uint8)
        return cv2.resize(crop, (112, 112), interpolation=cv2.INTER_AREA)

    def extract_embedding_from_result(
        self, frame_bgr: np.ndarray, face_res: FaceExtractionResult
    ) -> Tuple[np.ndarray, float]:
        """Extract 128D L2-normalized embedding and quality score (0-100)."""
        if not face_res.face_detected or face_res.bbox is None:
            return np.zeros(FACE_EMBEDDING_DIM, dtype=np.float32), 0.0

        aligned_bgr = self._align_face_112(frame_bgr, face_res)
        aligned_gray = cv2.cvtColor(aligned_bgr, cv2.COLOR_BGR2GRAY)

        # Compute biometric sample quality (sharpness + exposure + frontal pose)
        lap_var = float(cv2.Laplacian(aligned_gray, cv2.CV_64F).var())
        sharpness_score = float(np.clip(lap_var / 90.0, 0.25, 1.0))
        mean_lum = float(np.mean(aligned_gray))
        exposure_score = float(np.clip(1.0 - abs(mean_lum - 125.0) / 135.0, 0.25, 1.0))
        pose_penalty = (abs(face_res.head_yaw_deg) + abs(face_res.head_pitch_deg)) / 90.0
        pose_score = float(np.clip(1.0 - 0.5 * pose_penalty, 0.3, 1.0))
        quality_score = round(100.0 * (0.4 * sharpness_score + 0.3 * exposure_score + 0.3 * pose_score), 1)

        if self._onnx_session is not None and self._input_name is not None:
            try:
                blob = aligned_bgr.astype(np.float32).transpose(2, 0, 1)[np.newaxis, ...]
                out = self._onnx_session.run(None, {self._input_name: blob})[0].flatten()
                if out.size >= FACE_EMBEDDING_DIM:
                    return _l2_normalize(out[:FACE_EMBEDDING_DIM]), quality_score
            except Exception:
                pass

        # Hybrid craniofacial geometry + CLAHE multi-scale appearance descriptor (128D)
        eq_gray = self._clahe.apply(aligned_gray)

        # 1) 24D pose-invariant craniofacial ratios from MediaPipe landmarks (or spatial moments fallback)
        geom_feats = np.zeros(24, dtype=np.float32)
        if face_res.landmarks_2d is not None and len(face_res.landmarks_2d) >= 455:
            pts = face_res.landmarks_2d
            ref_scale = max(
                1.0,
                0.5
                * (
                    float(np.linalg.norm(pts[33] - pts[263]))
                    + float(np.linalg.norm(pts[10] - pts[152]))
                ),
            )
            for idx, (i1, i2) in enumerate(_CRANIOFACIAL_PAIRS):
                geom_feats[idx] = float(np.linalg.norm(pts[i1] - pts[i2])) / ref_scale
            geom_feats = _l2_normalize(geom_feats - np.mean(geom_feats))
        else:
            small_g = cv2.resize(eq_gray, (6, 4), interpolation=cv2.INTER_AREA).astype(np.float32).flatten()
            geom_feats = _l2_normalize(small_g - np.mean(small_g))

        # 2) 64D illumination-invariant normalized spatial patch appearance (8x8 grid on aligned face)
        patch_8x8 = cv2.resize(eq_gray, (8, 8), interpolation=cv2.INTER_AREA).astype(np.float32).flatten()
        patch_feats = _l2_normalize(patch_8x8 - np.mean(patch_8x8))

        # 3) 40D directional Sobel gradient + LAB skin/feature chromaticity signature
        gx = cv2.Sobel(eq_gray, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(eq_gray, cv2.CV_32F, 0, 1, ksize=3)
        grad_mag = np.hypot(gx, gy)
        grad_5x5 = cv2.resize(grad_mag, (5, 5), interpolation=cv2.INTER_AREA).flatten()
        grad_feats = _l2_normalize(grad_5x5 - np.mean(grad_5x5))  # 25D

        lab = cv2.cvtColor(aligned_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
        a_grid = cv2.resize(lab[:, :, 1], (3, 3), interpolation=cv2.INTER_AREA).flatten()  # 9D
        b_grid = cv2.resize(lab[:, :, 2], (3, 2), interpolation=cv2.INTER_AREA).flatten()  # 6D
        chroma_feats = _l2_normalize(np.concatenate([a_grid - 128.0, b_grid - 128.0]))     # 15D

        combined = np.concatenate(
            [
                geom_feats * 0.45,
                patch_feats * 0.65,
                grad_feats * 0.45,
                chroma_feats * 0.35,
            ]
        )
        return _l2_normalize(combined), quality_score

    def extract_biometric_sample(
        self, frame_bgr: np.ndarray, face_res: FaceExtractionResult
    ) -> BiometricExtractResponse:
        bbox_norm = self.compute_bbox_norm(face_res.bbox, frame_bgr.shape)
        if not face_res.face_detected or face_res.bbox is None:
            return BiometricExtractResponse(
                face_detected=False,
                embedding=[],
                quality_score=0.0,
                bbox_norm=None,
                backend=self._backend_name,
            )
        emb, quality = self.extract_embedding_from_result(frame_bgr, face_res)
        return BiometricExtractResponse(
            face_detected=True,
            embedding=[round(float(x), 6) for x in emb.tolist()],
            quality_score=quality,
            bbox_norm=bbox_norm,
            backend=self._backend_name,
        )

    def update(
        self, frame_bgr: np.ndarray, face_res: FaceExtractionResult
    ) -> IdentityMetrics:
        """Match current frame against enrolled gallery with temporal smoothing."""
        enrolled_total = len(self._gallery)
        bbox_norm = self.compute_bbox_norm(face_res.bbox, frame_bgr.shape)

        if not face_res.face_detected or face_res.bbox is None:
            self._score_history.clear()
            return IdentityMetrics(
                recognized=False,
                enrolled_count=enrolled_total,
                status="no_face",
                bbox_norm=None,
            )

        if enrolled_total == 0:
            return IdentityMetrics(
                recognized=False,
                enrolled_count=0,
                status="empty_gallery",
                bbox_norm=bbox_norm,
            )

        emb, _ = self.extract_embedding_from_result(frame_bgr, face_res)
        if float(np.linalg.norm(emb)) < 0.5:
            return IdentityMetrics(
                recognized=False,
                enrolled_count=enrolled_total,
                status="unknown",
                bbox_norm=bbox_norm,
            )

        instant_scores: Dict[str, float] = {}
        for astro_id, entry in self._gallery.items():
            # Max cosine similarity across the 1..5 enrolled photos of this astronaut
            sims = np.dot(entry.embeddings, emb)
            instant_scores[astro_id] = float(np.max(sims))

        self._score_history.append(instant_scores)

        # Temporal smoothing over recent frames
        smoothed_scores: Dict[str, float] = {}
        for astro_id in self._gallery:
            vals = [frame_map.get(astro_id, 0.0) for frame_map in self._score_history]
            smoothed_scores[astro_id] = float(np.mean(vals)) if vals else 0.0

        best_id, best_sim = max(smoothed_scores.items(), key=lambda kv: kv[1])
        best_sim_clamped = float(np.clip(best_sim, 0.0, 1.0))

        if best_sim >= FACE_MATCH_THRESHOLD:
            entry = self._gallery[best_id]
            # Map similarity [threshold .. 1.0] to a clear mission HUD confidence [75% .. 99.5%]
            rel = (best_sim_clamped - FACE_MATCH_THRESHOLD) / max(1e-4, 1.0 - FACE_MATCH_THRESHOLD)
            confidence = round(float(np.clip(75.0 + rel * 24.5, 75.0, 99.8)), 1)
            return IdentityMetrics(
                recognized=True,
                astronaut_id=entry.astronaut_id,
                astronaut_name=entry.astronaut_name,
                confidence=confidence,
                similarity=round(best_sim_clamped, 4),
                enrolled_count=enrolled_total,
                status="recognized",
                bbox_norm=bbox_norm,
            )

        confidence = round(float(np.clip((best_sim_clamped / max(1e-4, FACE_MATCH_THRESHOLD)) * 65.0, 0.0, 69.0)), 1)
        return IdentityMetrics(
            recognized=False,
            astronaut_id=None,
            astronaut_name=None,
            confidence=confidence,
            similarity=round(best_sim_clamped, 4),
            enrolled_count=enrolled_total,
            status="unknown",
            bbox_norm=bbox_norm,
        )
