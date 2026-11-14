"""Loader for curated / A100-computed molecular docking evidence."""

import json
from pathlib import Path
from typing import List, Optional

from schemas import DockingComplexEntry

CATALOG_PATH = Path(__file__).parent / "data" / "docking_catalog.json"


def load_docking_catalog(category: Optional[str] = None) -> List[DockingComplexEntry]:
    raw = json.loads(CATALOG_PATH.read_text())
    entries = [DockingComplexEntry(**item) for item in raw]
    if category:
        entries = [e for e in entries if e.category == category]
    return entries
