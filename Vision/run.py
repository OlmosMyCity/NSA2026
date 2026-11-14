"""Entrypoint to launch the OrbVital Astronaut Biometrics FastAPI server."""

import argparse
import uvicorn
from download_models import ensure_models


def main() -> None:
    parser = argparse.ArgumentParser(description="Run OrbVital Astronaut Vitals Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable hot reload")
    args = parser.parse_args()

    ensure_models()
    print(f"\n🚀 Iniciando OrbVital Astronaut Biometrics en http://localhost:{args.port}\n")
    uvicorn.run("src.api.app:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
