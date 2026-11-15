"use strict";
/**
 * @module physics/solarWindImpact
 * Earth-Moon cislunar CME / solar wind corridor impact and magnetospheric shielding predictor.
 *
 * Combines Stonyhurst heliographic source-region geometry, Parker spiral magnetic footpoint
 * connectivity (Gaussian sigma = 30 deg), Shue et al. (1998) empirical magnetopause standoff
 * compression in Earth radii (Re; GEO boundary = 6.6 Re), drag-adjusted CME transit timing,
 * and lunar magnetotail crossing geometry (Full Moon wake within +/-12 deg).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolarWindImpactPredictor = void 0;
const sepPrediction_1 = require("./sepPrediction");
const AU_KM = 149597870.7;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TARGET_CONFIGS = [
    {
        id: 'EARTH_MAGNETOSPHERE',
        label: 'Earth Magnetosphere (LEO / GEO)',
        isEarthProtected: true,
        isTailShieldable: false
    },
    {
        id: 'CISLUNAR_TRANSIT',
        label: 'Cislunar Transit Corridor (Orion / EUS)',
        isEarthProtected: false,
        isTailShieldable: false
    },
    {
        id: 'GATEWAY_NRHO',
        label: 'Lunar Gateway (NRHO / L2)',
        isEarthProtected: false,
        isTailShieldable: true
    },
    {
        id: 'LUNAR_SURFACE',
        label: 'Lunar South Pole (HLS / 86.8° S)',
        isEarthProtected: false,
        isTailShieldable: true
    }
];
/**
 * Evaluates spatial impact trajectories and shielding conditions across LEO/GEO, cislunar transit,
 * Lunar Gateway NRHO, and the Lunar South Pole.
 */
class SolarWindImpactPredictor {
    sepEngine = new sepPrediction_1.SepPredictionEngine();
    /**
     * Parses Stonyhurst heliographic coordinates (e.g. "N14W42", "S18E72").
     * Convention: N = +lat, S = -lat, W = +lon (towards Parker spiral), E = -lon.
     *
     * @param sourceLocation - Stonyhurst coordinate string (defaults to N00W00 if unparseable).
     * @returns Signed latitude/longitude in degrees and normalized coordinate string.
     */
    parseSourceLocation(sourceLocation) {
        const match = sourceLocation.trim().toUpperCase().match(/^([NS])(\d{1,2})([EW])(\d{1,3})$/);
        if (!match) {
            return { latDeg: 0, lonDeg: 0, normalized: sourceLocation || 'N00W00' };
        }
        const [, ns, latStr, ew, lonStr] = match;
        const latDeg = (ns === 'N' ? 1 : -1) * Math.min(90, Number(latStr));
        const lonDeg = (ew === 'W' ? 1 : -1) * Math.min(90, Number(lonStr));
        return { latDeg, lonDeg, normalized: `${ns}${latStr}${ew}${lonStr}` };
    }
    /**
     * Computes spherical angular separation (degrees) between the solar source region and the Sun-Earth line.
     *
     * @param latDeg - Stonyhurst latitude in degrees.
     * @param lonDeg - Stonyhurst longitude in degrees (+West / -East).
     * @returns Central angular offset psi in degrees.
     */
    calculateAngularOffsetDeg(latDeg, lonDeg) {
        const cosPsi = Math.max(-1, Math.min(1, Math.cos(latDeg * DEG_TO_RAD) * Math.cos(lonDeg * DEG_TO_RAD)));
        return Number((Math.acos(cosPsi) * RAD_TO_DEG).toFixed(1));
    }
    /**
     * Computes Shue et al. (1998) empirical subsolar magnetopause standoff distance in Earth radii (Re).
     *
     * Values <= 6.6 Re indicate magnetopause compression inside geostationary orbit (GEO).
     *
     * @param dynamicPressureNpa - Solar wind dynamic ram pressure P_dyn in nPa (floored at 0.2 nPa).
     * @param bzNt - Southward/northward IMF Bz GSM component in nT.
     * @returns Standoff radius r0 in Earth radii (clamped to [4.5, 16.0] Re).
     */
    calculateMagnetopauseStandoffRe(dynamicPressureNpa, bzNt) {
        const pDyn = Math.max(0.2, dynamicPressureNpa);
        const r0 = (10.22 + 1.29 * Math.tanh(0.184 * (bzNt + 8.14))) * Math.pow(pDyn, -1 / 6.6);
        return Number(Math.max(4.5, Math.min(16.0, r0)).toFixed(2));
    }
    /**
     * Evaluates Parker spiral magnetic connectivity (0.0 to 1.0) from flare longitude to Earth-Moon at 1 AU.
     *
     * Uses a Gaussian kernel (sigma = 30 deg) centered on the Earth-connected solar footpoint longitude.
     *
     * @param sourceLonDeg - Solar source Stonyhurst longitude in degrees (+West / -East).
     * @param parkerFootpointLonDeg - Earth-connected Parker spiral footpoint longitude in degrees West.
     * @returns Normalized magnetic connectivity score (0.0 to 1.0).
     */
    calculateMagneticConnectionScore(sourceLonDeg, parkerFootpointLonDeg) {
        const deltaLon = Math.abs(sourceLonDeg - parkerFootpointLonDeg);
        const score = Math.exp(-(deltaLon * deltaLon) / (2 * 30 * 30));
        return Number(score.toFixed(2));
    }
    /**
     * Classifies geomagnetic storm severity (NOAA G0-G5) from CME speed (km/s) and southward IMF Bz (nT).
     *
     * @param speedKmS - CME propagation speed in km/s.
     * @param bzNt - IMF Bz GSM component in nT (negative values drive reconnection).
     * @param hitsEarth - Whether the CME trajectory intersects or grazes Earth's magnetosphere.
     * @returns NOAA Geomagnetic Storm Scale (`G0` through `G5`).
     */
    evaluateGeomagneticScale(speedKmS, bzNt, hitsEarth) {
        if (!hitsEarth)
            return 'G0';
        if (bzNt <= -22 && speedKmS >= 1000)
            return 'G5';
        if (bzNt <= -16 && speedKmS >= 800)
            return 'G4';
        if (bzNt <= -12 && speedKmS >= 650)
            return 'G3';
        if (bzNt <= -8 && speedKmS >= 520)
            return 'G2';
        if (bzNt <= -5 || speedKmS >= 500)
            return 'G1';
        return 'G0';
    }
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
    predictImpact(input) {
        const { latDeg, lonDeg, normalized } = this.parseSourceLocation(input.sourceLocation);
        const angularOffset = this.calculateAngularOffsetDeg(latDeg, lonDeg);
        const halfAngle = Math.max(10, Math.min(90, input.coneHalfAngleDeg));
        const cmeSpeed = Math.max(250, input.cmeSpeedKmS);
        const moonPhase = (((input.moonPhaseAngleDeg ?? 90) % 360) + 360) % 360;
        const inMagnetotail = moonPhase < 12 || moonPhase > 348;
        const magnetopauseStandoffRe = this.calculateMagnetopauseStandoffRe(input.solarWind.dynamicPressureNpa, input.solarWind.bzNt);
        const magneticConnectionScore = this.calculateMagneticConnectionScore(lonDeg, input.solarWind.parkerFootpointLonDeg);
        let primaryImpactZone = 'DEEP_SPACE_MISS';
        if (angularOffset <= halfAngle) {
            primaryImpactZone = 'CISLUNAR_AND_EARTH_DIRECT';
        }
        else if (angularOffset <= halfAngle + 15) {
            primaryImpactZone = 'FLANK_GLANCING_BLOW';
        }
        const hitsEarth = primaryImpactZone !== 'DEEP_SPACE_MISS';
        const geomagneticGScale = this.evaluateGeomagneticScale(cmeSpeed, input.solarWind.bzNt, hitsEarth);
        // Effective CME transit speed accounts for solar wind drag
        const effectiveSpeedKmS = 0.75 * cmeSpeed + 0.25 * input.solarWind.speedKmS;
        const cmeArrivalHours = Number((AU_KM / effectiveSpeedKmS / 3600).toFixed(1));
        const sepMinutes = input.sepArrivalMinutes ??
            Math.round(this.sepEngine.calculateTransitTimeMinutes(100, 1.25, 2.0));
        const targets = TARGET_CONFIGS.map((cfg) => this.buildTargetPrediction(cfg, {
            primaryImpactZone,
            angularOffset,
            halfAngle,
            magneticConnectionScore,
            magnetopauseStandoffRe,
            inMagnetotail,
            sepMinutes,
            cmeArrivalHours
        }));
        const summary = this.buildSummary(normalized, primaryImpactZone, magneticConnectionScore, cmeArrivalHours, geomagneticGScale);
        return {
            sourceLocation: normalized,
            sourceLatDeg: latDeg,
            sourceLonDeg: lonDeg,
            coneHalfAngleDeg: halfAngle,
            cmeSpeedKmS: cmeSpeed,
            angularOffsetFromEarthDeg: angularOffset,
            parkerFootpointLonDeg: input.solarWind.parkerFootpointLonDeg,
            magneticConnectionScore,
            magnetopauseStandoffRe,
            primaryImpactZone,
            predictedStormScale: hitsEarth ? input.predictedStormScale : 'S0_NOMINAL',
            geomagneticGScale,
            targets,
            summary
        };
    }
    buildTargetPrediction(cfg, ctx) {
        if (ctx.primaryImpactZone === 'DEEP_SPACE_MISS') {
            // Even if the CME misses, well-connected West flares can send a weak SEP scatter
            const sepScatterPct = Math.round(ctx.magneticConnectionScore * 20);
            return {
                target: cfg.id,
                label: cfg.label,
                status: 'MISS',
                impactProbabilityPct: sepScatterPct,
                estimatedArrivalMinutes: sepScatterPct >= 10 ? ctx.sepMinutes : null,
                cmeArrivalHours: null,
                expectedDoseMultiplier: 1.0,
                notes: `CME cone (${ctx.halfAngle}°) misses Earth-Moon axis (offset ${ctx.angularOffset}°).`
            };
        }
        const isDirect = ctx.primaryImpactZone === 'CISLUNAR_AND_EARTH_DIRECT';
        let status = isDirect ? 'DIRECT_HIT' : 'GLANCING_BLOW';
        let probPct = isDirect
            ? Math.round(78 + 20 * ctx.magneticConnectionScore)
            : Math.round(35 + 30 * ctx.magneticConnectionScore);
        let doseMultiplier = isDirect ? 1.0 : 0.45;
        let notes = isDirect
            ? `Direct CME & solar wind corridor impact. CME shock ETA ~${ctx.cmeArrivalHours}h.`
            : `Flank glancing blow (offset ${ctx.angularOffset}° vs cone ${ctx.halfAngle}°).`;
        if (cfg.isEarthProtected) {
            const geoCompressed = ctx.magnetopauseStandoffRe <= 6.6;
            status = geoCompressed ? (isDirect ? 'DIRECT_HIT' : 'GLANCING_BLOW') : 'MAGNETOSPHERE_SHIELDED';
            doseMultiplier = geoCompressed ? 0.65 : 0.15;
            notes = geoCompressed
                ? `Magnetopause compressed to ${ctx.magnetopauseStandoffRe} Re (inside GEO); polar/outer belts exposed.`
                : `Shielded by Earth's magnetosphere (standoff ${ctx.magnetopauseStandoffRe} Re).`;
        }
        else if (cfg.isTailShieldable && ctx.inMagnetotail) {
            status = 'MAGNETOSPHERE_SHIELDED';
            probPct = Math.round(probPct * 0.5);
            doseMultiplier = 0.35;
            notes = 'Moon/Gateway currently inside Earth magnetotail (Full Moon wake); plasma attenuated.';
        }
        return {
            target: cfg.id,
            label: cfg.label,
            status,
            impactProbabilityPct: Math.min(99, Math.max(5, probPct)),
            estimatedArrivalMinutes: ctx.sepMinutes,
            cmeArrivalHours: ctx.cmeArrivalHours,
            expectedDoseMultiplier: doseMultiplier,
            notes
        };
    }
    buildSummary(sourceLocation, zone, connectionScore, cmeArrivalHours, gScale) {
        if (zone === 'CISLUNAR_AND_EARTH_DIRECT') {
            return `Source ${sourceLocation} (Parker conn. ${Math.round(connectionScore * 100)}%) targets Earth–Moon corridor. Cislunar/NRHO/Lunar South Pole: DIRECT HIT. CME shock ETA ${cmeArrivalHours}h (${gScale}).`;
        }
        if (zone === 'FLANK_GLANCING_BLOW') {
            return `Source ${sourceLocation} delivers a flank glancing blow to the cislunar system. CME shock ETA ${cmeArrivalHours}h (${gScale}).`;
        }
        return `Source ${sourceLocation} is aimed away from the Sun–Earth–Moon axis. Deep space miss; cislunar corridor remains nominal.`;
    }
}
exports.SolarWindImpactPredictor = SolarWindImpactPredictor;
