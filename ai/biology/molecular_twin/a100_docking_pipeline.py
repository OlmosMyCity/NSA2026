"""Offline A100 docking preparation & execution script for Plan B.

Run this on your GPU/A100 environment (requires internet + optional smina/vina + obabel):
    python a100_docking_pipeline.py

It downloads:
- RCSB PDB 1JEY (Human Ku70/Ku80 heterodimer bound to DNA)
- RCSB PDB 4IQK (Human Keap1 Kelch domain)
- PubChem 3D SDFs for N-acetylcysteine (CID 12035), L-Ascorbic acid (CID 54670067),
  and Alpha-Tocopherol (CID 14985).
And runs smina/vina if installed to generate docked poses in structures/.
"""

import shutil
import subprocess
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).parent
STRUCTURES_DIR = BASE_DIR / "structures"

PDB_TARGETS = {
    "1JEY": "https://files.rcsb.org/download/1JEY.pdb",
    "4IQK": "https://files.rcsb.org/download/4IQK.pdb",
}

PUBCHEM_LIGANDS = {
    "nac": "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/12035/SDF?record_type=3d",
    "ascorbate": "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/54670067/SDF?record_type=3d",
    "tocopherol": "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/14985/SDF?record_type=3d",
}


def download_assets() -> None:
    STRUCTURES_DIR.mkdir(parents=True, exist_ok=True)
    for pdb_id, url in PDB_TARGETS.items():
        dest = STRUCTURES_DIR / f"{pdb_id}.pdb"
        if not dest.exists():
            print(f"Downloading {pdb_id} -> {dest}")
            urllib.request.urlretrieve(url, dest)
    for name, url in PUBCHEM_LIGANDS.items():
        dest = STRUCTURES_DIR / f"{name}.sdf"
        if not dest.exists():
            print(f"Downloading ligand {name} -> {dest}")
            urllib.request.urlretrieve(url, dest)


def run_smina_docking() -> None:
    smina = shutil.which("smina") or shutil.which("vina")
    if not smina:
        print("smina/vina not found in PATH. Downloaded structures are ready for docking.")
        return

    receptor = STRUCTURES_DIR / "4IQK.pdb"
    for lig in ("nac", "ascorbate", "tocopherol"):
        ligand_sdf = STRUCTURES_DIR / f"{lig}.sdf"
        out_sdf = STRUCTURES_DIR / f"4IQK_keap1_{lig}_docked.sdf"
        cmd = [
            smina,
            "-r",
            str(receptor),
            "-l",
            str(ligand_sdf),
            "--autobox_ligand",
            str(receptor),
            "--exhaustiveness",
            "16",
            "-o",
            str(out_sdf),
        ]
        print("Running:", " ".join(cmd))
        subprocess.run(cmd, check=True)


if __name__ == "__main__":
    download_assets()
    run_smina_docking()
