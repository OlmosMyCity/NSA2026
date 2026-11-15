"""Utility to download lightweight open-source ONNX and MediaPipe models."""

import urllib.request
from pathlib import Path
from src.config import (
    FERPLUS_ONNX_PATH,
    FERPLUS_ONNX_URL,
    MEDIAPIPE_FACE_LANDMARKER_PATH,
    MEDIAPIPE_FACE_LANDMARKER_URL,
    MODELS_DIR,
)


def download_file(url: str, dest: Path, description: str) -> bool:
    if dest.exists() and dest.stat().st_size > 1024:
        print(f"[OK] {description} ya disponible en {dest} ({dest.stat().st_size / 1024:.1f} KB)")
        return True
    try:
        print(f"[INFO] Descargando {description} desde {url} ...")
        req = urllib.request.Request(url, headers={"User-Agent": "OrbVital-AstronautVitals/0.1"})
        with urllib.request.urlopen(req, timeout=20) as response, open(dest, "wb") as out_file:
            out_file.write(response.read())
        print(f"[OK] Guardado en {dest} ({dest.stat().st_size / 1024:.1f} KB)")
        return True
    except Exception as exc:
        print(f"[WARN] No se pudo descargar {description}: {exc}. Se usará el fallback integrado en CPU.")
        return False


def ensure_models() -> dict:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    fer_ok = download_file(FERPLUS_ONNX_URL, FERPLUS_ONNX_PATH, "ONNX Emotion FERPlus-8 Model")
    mp_ok = download_file(
        MEDIAPIPE_FACE_LANDMARKER_URL,
        MEDIAPIPE_FACE_LANDMARKER_PATH,
        "MediaPipe Face Landmarker Task",
    )
    return {"ferplus_onnx": fer_ok, "mediapipe_landmarker": mp_ok}


if __name__ == "__main__":
    ensure_models()
