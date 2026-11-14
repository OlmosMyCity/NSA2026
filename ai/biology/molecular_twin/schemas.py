from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ShieldingType(str, Enum):
    EVA_SUIT = "EVA_SUIT"
    CREW_CABIN_NOMINAL = "CREW_CABIN_NOMINAL"
    STORM_SHELTER = "STORM_SHELTER"


class ScenarioId(str, Enum):
    NOMINAL = "NOMINAL"
    FLARE_EARLY_WARNING = "FLARE_EARLY_WARNING"
    PEAK_STORM_S4 = "PEAK_STORM_S4"


class KineticsPoint(BaseModel):
    timeHours: float
    doseRateMicroSvPerHour: float
    gammaH2axFociPerCell: float
    repairSaturationRatio: float
    tissueDamage: float
    blood8Ohdg: float
    urine8OhdgNgMg: float


class UrineSamplingWindow(BaseModel):
    startHour: float
    peakHour: float
    endHour: float
    peakUrine8OhdgNgMg: float
    guidance: str


class ShieldingKineticsResult(BaseModel):
    shieldingType: ShieldingType
    attenuationFactor: float
    peakDoseRateMicroSvPerHour: float
    peakGammaH2axFoci: float
    timeToPeakGammaH2axHours: float
    isRepairSaturated: bool
    maxRepairSaturationRatio: float
    urineSamplingWindow: UrineSamplingWindow
    curve: List[KineticsPoint]


class DockingComplexEntry(BaseModel):
    id: str
    title: str
    category: str
    targetProtein: str
    targetPdbId: str
    ligandName: str
    bindingAffinityKcalMol: float
    relativeEfficiencyPct: Optional[float] = None
    keyResidues: List[str]
    clinicalExplanation: str
    countermeasureLink: Optional[str] = None
    structureFile: str
    source: str = "precomputed_a100_catalog"


class BiophysicsScenarioResponse(BaseModel):
    scenario: ScenarioId
    description: str
    doseReductionShelterVsEvaPct: float
    gammaH2axReductionShelterVsEvaPct: float
    shieldingResults: dict[str, ShieldingKineticsResult]
    dockingEvidence: List[DockingComplexEntry]
    astronautTakeaway: str


class CustomKineticsRequest(BaseModel):
    peakFluxPfu: float = Field(default=14500.0, ge=0.0, le=200000.0)
    onsetDelayHours: float = Field(default=0.0, ge=0.0, le=24.0)
    stormDurationHours: float = Field(default=10.0, ge=0.5, le=72.0)
    horizonHours: float = Field(default=36.0, ge=4.0, le=96.0)
    shieldingType: ShieldingType = ShieldingType.EVA_SUIT
