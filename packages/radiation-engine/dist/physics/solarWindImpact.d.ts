/**
 * @module physics/solarWindImpact
 * Earth-Moon cislunar CME / solar wind corridor impact and magnetospheric shielding predictor.
 *
 * Combines Stonyhurst heliographic source-region geometry, Parker spiral magnetic footpoint
 * connectivity (Gaussian sigma = 30 deg), Shue et al. (1998) empirical magnetopause standoff
 * compression in Earth radii (Re; GEO boundary = 6.6 Re), drag-adjusted CME transit timing,
 * and lunar magnetotail crossing geometry (Full Moon wake within +/-12 deg).
 */
import { GeomagneticGScale, NOAAStormScale, SolarWindImpactPrediction, SolarWindReading } from '../types';
/** Input parameters describing a solar eruption, ambient solar wind, and lunar orbital phase. */
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
/**
 * Evaluates spatial impact trajectories and shielding conditions across LEO/GEO, cislunar transit,
 * Lunar Gateway NRHO, and the Lunar South Pole.
 */
export declare class SolarWindImpactPredictor {
    private sepEngine;
    /**
     * Parses Stonyhurst heliographic coordinates (e.g. "N14W42", "S18E72").
     * Convention: N = +lat, S = -lat, W = +lon (towards Parker spiral), E = -lon.
     *
     * @param sourceLocation - Stonyhurst coordinate string (defaults to N00W00 if unparseable).
     * @returns Signed latitude/longitude in degrees and normalized coordinate string.
     */
    parseSourceLocation(sourceLocation: string): {
        latDeg: number;
        lonDeg: number;
        normalized: string;
    };
    /**
     * Computes spherical angular separation (degrees) between the solar source region and the Sun-Earth line.
     *
     * @param latDeg - Stonyhurst latitude in degrees.
     * @param lonDeg - Stonyhurst longitude in degrees (+West / -East).
     * @returns Central angular offset psi in degrees.
     */
    calculateAngularOffsetDeg(latDeg: number, lonDeg: number): number;
    /**
     * Computes Shue et al. (1998) empirical subsolar magnetopause standoff distance in Earth radii (Re).
     *
     * Values <= 6.6 Re indicate magnetopause compression inside geostationary orbit (GEO).
     *
     * @param dynamicPressureNpa - Solar wind dynamic ram pressure P_dyn in nPa (floored at 0.2 nPa).
     * @param bzNt - Southward/northward IMF Bz GSM component in nT.
     * @returns Standoff radius r0 in Earth radii (clamped to [4.5, 16.0] Re).
     */
    calculateMagnetopauseStandoffRe(dynamicPressureNpa: number, bzNt: number): number;
    /**
     * Evaluates Parker spiral magnetic connectivity (0.0 to 1.0) from flare longitude to Earth-Moon at 1 AU.
     *
     * Uses a Gaussian kernel (sigma = 30 deg) centered on the Earth-connected solar footpoint longitude.
     *
     * @param sourceLonDeg - Solar source Stonyhurst longitude in degrees (+West / -East).
     * @param parkerFootpointLonDeg - Earth-connected Parker spiral footpoint longitude in degrees West.
     * @returns Normalized magnetic connectivity score (0.0 to 1.0).
     */
    calculateMagneticConnectionScore(sourceLonDeg: number, parkerFootpointLonDeg: number): number;
    /**
     * Classifies geomagnetic storm severity (NOAA G0-G5) from CME speed (km/s) and southward IMF Bz (nT).
     *
     * @param speedKmS - CME propagation speed in km/s.
     * @param bzNt - IMF Bz GSM component in nT (negative values drive reconnection).
     * @param hitsEarth - Whether the CME trajectory intersects or grazes Earth's magnetosphere.
     * @returns NOAA Geomagnetic Storm Scale (`G0` through `G5`).
     */
    evaluateGeomagneticScale(speedKmS: number, bzNt: number, hitsEarth: boolean): GeomagneticGScale;
    /**
     * Predicts where a solar flare / CME / solar wind stream will arrive across the Earth-Moon system.
     *
     * Evaluates direct hit vs. flank glancing blow vs. deep-space miss using cone half-angle geometry,
     * estimates drag-weighted 1 AU CME arrival time (`0.75 * v_cme + 0.25 * v_sw`), and derives
     * per-regime exposure status and dose multipliers.
     *
     * @param input - Eruption geometry, CME speed, solar wind telemetry, and lunar phase context.
     * @returns Full cislunar impact prediction and target-by-target exposure breakdown.
     */
    predictImpact(input: SolarWindImpactInput): SolarWindImpactPrediction;
    private buildTargetPrediction;
    private buildSummary;
}
