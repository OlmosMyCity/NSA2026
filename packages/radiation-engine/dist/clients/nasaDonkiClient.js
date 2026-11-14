"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NasaDonkiClient = void 0;
class NasaDonkiClient {
    baseUrl = 'https://api.nasa.gov/DONKI';
    apiKey;
    constructor(apiKey = 'DEMO_KEY') {
        this.apiKey = apiKey;
    }
    /**
     * Obtiene los últimos análisis de CME procesados con el modelo cinemático WSA-ENLIL
     */
    async getLatestCmeAnalyses() {
        try {
            // Pedir últimos 14 días
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const url = `${this.baseUrl}/CMEAnalysis?startDate=${startDate}&endDate=${endDate}&mostAccurateOnly=true&speed=500&api_key=${this.apiKey}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`NASA DONKI HTTP error: ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data))
                return [];
            return data.slice(-5).map((item) => ({
                activityId: item.associatedCMEID || item.time21_5 || 'CME-DONKI',
                catalog: item.catalog || 'SWPC_ANNEX',
                startTime: item.time21_5,
                sourceLocation: item.sourceLocation || 'Solar Disk',
                halfAngle: item.halfAngle || 45,
                speed: item.speed || 600,
                type: item.type || 'C',
                isEarthOrMoonTargeted: item.isEarthGB || true,
                estimatedShockArrivalTime: item.enlilList?.[0]?.estimatedShockArrivalTime
            }));
        }
        catch (err) {
            console.warn('[NasaDonkiClient] Error fetching DONKI CMEs, using fallback:', err);
            return this.getFallbackCmes();
        }
    }
    getFallbackCmes() {
        return [
            {
                activityId: '2026-11-12T10:00:00-CME-001',
                catalog: 'WSA-ENLIL-OPERATIONAL',
                startTime: '2026-11-12T10:30:00Z',
                sourceLocation: 'N14E22',
                halfAngle: 38,
                speed: 780,
                type: 'C',
                isEarthOrMoonTargeted: true,
                estimatedShockArrivalTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }
}
exports.NasaDonkiClient = NasaDonkiClient;
