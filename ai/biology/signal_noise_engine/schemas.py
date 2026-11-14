from enum import Enum
from typing import Any, Dict, List
from pydantic import BaseModel, Field


class ShieldingType(str, Enum):
    EVA_SUIT = "EVA_SUIT"
    CREW_CABIN_NOMINAL = "CREW_CABIN_NOMINAL"
    STORM_SHELTER = "STORM_SHELTER"


class PrimaryCause(str, Enum):
    NOMINAL = "NOMINAL"
    IONIZING_RADIATION = "IONIZING_RADIATION"
    MICROGRAVITY_STRESS = "MICROGRAVITY_STRESS"
    SLEEP_PSYCH_STRESS = "SLEEP_PSYCH_STRESS"


class BiodosimetryInput(BaseModel):
    # Physical telemetry from NSA2026/radiation-engine
    doseRateMicroSvPerHour: float = Field(default=25.0, ge=0.0, le=1_000_000.0)
    stormScaleLevel: int = Field(default=0, ge=0, le=5)
    shieldingType: ShieldingType = ShieldingType.CREW_CABIN_NOMINAL

    # Astronaut vitals matching HealthReading in artemis-iv-backend
    heartRateBpm: float = Field(default=72.0, ge=30.0, le=220.0)
    systolicMmHg: float = Field(default=118.0, ge=60.0, le=240.0)
    diastolicMmHg: float = Field(default=76.0, ge=40.0, le=150.0)
    glucoseMgDl: float = Field(default=95.0, ge=40.0, le=400.0)
    temperatureC: float = Field(default=36.8, ge=33.0, le=42.0)
    spo2Pct: float = Field(default=98.0, ge=60.0, le=100.0)
    sleepHours: float = Field(default=7.5, ge=0.0, le=16.0)
    mood: int = Field(default=4, ge=1, le=5)

    # Molecular biomarkers (in-situ blood/urine assays)
    gammaH2axFociPerCell: float = Field(
        default=0.8,
        ge=0.0,
        le=50.0,
        description="Double-strand break foci per lymphocyte (baseline ~0.5-1.2; acute radiation >3.0)",
    )
    urine8OhdgNgMg: float = Field(
        default=12.0,
        ge=0.0,
        le=200.0,
        description="Urinary 8-OHdG normalized to creatinine (ng/mg; baseline ~8-15; stress >22)",
    )
    fdxrFoldChange: float = Field(
        default=1.0,
        ge=0.1,
        le=30.0,
        description="FDXR transcriptomic fold-change (p53 radiation response; baseline ~1.0; radiation >2.5)",
    )


class AttributionBreakdown(BaseModel):
    nominalPct: float
    ionizingRadiationPct: float
    microgravityStressPct: float
    sleepPsychStressPct: float


class BiodosimetryResponse(BaseModel):
    primaryCause: PrimaryCause
    confidence: float
    falsePositiveFiltered: bool
    oxidativeStressDetected: bool
    attribution: AttributionBreakdown
    clinicalGuidance: List[str]
    explanation: str


class EngineTriageRequest(BaseModel):
    shieldingType: ShieldingType = ShieldingType.CREW_CABIN_NOMINAL
    healthReading: Dict[str, Any]
    radiationState: Dict[str, Any]
