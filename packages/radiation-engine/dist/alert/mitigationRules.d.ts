import { NOAAStormScale, RadiationMitigationProtocol } from '../types';
export declare class MitigationRulesEngine {
    /**
     * Determina la escala NOAA oficial S1-S5 según el flujo de protones > 10 MeV
     */
    evaluateStormScale(fluxPfu: number): NOAAStormScale;
    /**
     * Genera el protocolo de mitigación médica y operacional según la escala de radiación
     */
    generateProtocol(scale: NOAAStormScale): RadiationMitigationProtocol;
}
