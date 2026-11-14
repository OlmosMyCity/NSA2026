import { GeomagneticGScale, NOAAStormScale, SolarWindImpactPrediction, SolarWindReading } from '../types';
export interface SolarWindImpactInput {
    sourceLocation: string;
    coneHalfAngleDeg: number;
    cmeSpeedKmS: number;
    solarWind: SolarWindReading;
    predictedStormScale: NOAAStormScale;
    sepArrivalMinutes: number | null;
    /** Lunar phase angle relative to Sun-Earth anti-sunward line: 0 = Full Moon (magnetotail), 180 = New Moon */
    moonPhaseAngleDeg?: number;
}
export declare class SolarWindImpactPredictor {
    private sepEngine;
    /**
     * Parses Stonyhurst heliographic coordinates (e.g. "N14W42", "S18E72").
     * Convention: N = +lat, S = -lat, W = +lon (towards Parker spiral), E = -lon.
     */
    parseSourceLocation(sourceLocation: string): {
        latDeg: number;
        lonDeg: number;
        normalized: string;
    };
    /**
     * Spherical angular separation between the solar source region and the Sun-Earth line.
     */
    calculateAngularOffsetDeg(latDeg: number, lonDeg: number): number;
    /**
     * Shue et al. (1998) empirical magnetopause standoff distance in Earth radii (Re).
     */
    calculateMagnetopauseStandoffRe(dynamicPressureNpa: number, bzNt: number): number;
    /**
     * Evaluates Parker spiral magnetic connectivity (0..1) from flare longitude to Earth-Moon at 1 AU.
     */
    calculateMagneticConnectionScore(sourceLonDeg: number, parkerFootpointLonDeg: number): number;
    evaluateGeomagneticScale(speedKmS: number, bzNt: number, hitsEarth: boolean): GeomagneticGScale;
    /**
     * Predicts where a solar flare / CME / solar wind stream will arrive across the Earth-Moon system.
     */
    predictImpact(input: SolarWindImpactInput): SolarWindImpactPrediction;
    private buildTargetPrediction;
    private buildSummary;
}
