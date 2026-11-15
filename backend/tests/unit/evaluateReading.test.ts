import { describe, it, expect } from "vitest";
import { evaluateReading, type HealthReadingInput } from "../../src/service/health/evaluateReading.js";

describe("evaluateReading - Motor Clínico de Salud NASA Artemis", () => {
  const nominalReading: HealthReadingInput = {
    heartRateBpm: 72,
    systolicMmHg: 118,
    diastolicMmHg: 78,
    glucoseMgDl: 95,
    temperatureC: 36.6,
    spo2Pct: 98,
    sleepHours: 7.5,
    mood: 5,
  };

  it("debe calificar OK y sin alertas para métricas nominales perfectas", () => {
    const result = evaluateReading(nominalReading);

    expect(result.status).toBe("OK");
    expect(result.alerts).toHaveLength(0);
    expect(result.recommendation).toContain("nominales");
  });

  describe("Frecuencia Cardiaca", () => {
    it("debe emitir WARNING si la FC está entre 91 y 100 lpm", () => {
      const result = evaluateReading({ ...nominalReading, heartRateBpm: 95 });
      expect(result.status).toBe("WARNING");
      expect(result.alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ indicator: "heartRate", level: "WARNING" }),
        ])
      );
    });

    it("debe emitir CRITICAL si la FC supera 100 lpm (taquicardia)", () => {
      const result = evaluateReading({ ...nominalReading, heartRateBpm: 115 });
      expect(result.status).toBe("CRITICAL");
      expect(result.alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ indicator: "heartRate", level: "CRITICAL" }),
        ])
      );
    });

    it("debe emitir CRITICAL si la FC es menor a 40 lpm (bradicardia extrema)", () => {
      const result = evaluateReading({ ...nominalReading, heartRateBpm: 38 });
      expect(result.status).toBe("CRITICAL");
    });
  });

  describe("Presión Arterial", () => {
    it("debe emitir WARNING para hipertensión leve (135/82)", () => {
      const result = evaluateReading({ ...nominalReading, systolicMmHg: 135 });
      expect(result.status).toBe("WARNING");
      expect(result.alerts[0].indicator).toBe("bloodPressure");
    });

    it("debe emitir CRITICAL para hipertensión severa (>=140 sistólica o >=90 diastólica)", () => {
      const result = evaluateReading({ ...nominalReading, diastolicMmHg: 92 });
      expect(result.status).toBe("CRITICAL");
    });

    it("debe emitir CRITICAL para hipotensión severa (<90 sistólica)", () => {
      const result = evaluateReading({ ...nominalReading, systolicMmHg: 85 });
      expect(result.status).toBe("CRITICAL");
    });
  });

  describe("Glucosa en Sangre", () => {
    it("debe emitir WARNING si está entre 141 y 180 mg/dL", () => {
      const result = evaluateReading({ ...nominalReading, glucoseMgDl: 155 });
      expect(result.status).toBe("WARNING");
      expect(result.alerts[0].indicator).toBe("glucose");
    });

    it("debe emitir CRITICAL si es < 70 (hipoglucemia) o > 180", () => {
      const resultLow = evaluateReading({ ...nominalReading, glucoseMgDl: 65 });
      expect(resultLow.status).toBe("CRITICAL");

      const resultHigh = evaluateReading({ ...nominalReading, glucoseMgDl: 195 });
      expect(resultHigh.status).toBe("CRITICAL");
    });
  });

  describe("Temperatura Corporal", () => {
    it("debe emitir WARNING para febrícula (37.8 °C)", () => {
      const result = evaluateReading({ ...nominalReading, temperatureC: 37.8 });
      expect(result.status).toBe("WARNING");
      expect(result.alerts[0].indicator).toBe("temperature");
    });

    it("debe emitir CRITICAL para fiebre alta (>38.0 °C) o hipotermia (<35.5 °C)", () => {
      const resultFever = evaluateReading({ ...nominalReading, temperatureC: 38.4 });
      expect(resultFever.status).toBe("CRITICAL");

      const resultHypo = evaluateReading({ ...nominalReading, temperatureC: 35.1 });
      expect(resultHypo.status).toBe("CRITICAL");
    });
  });

  describe("Saturación de Oxígeno (SpO2)", () => {
    it("debe emitir WARNING si está entre 92% y 94%", () => {
      const result = evaluateReading({ ...nominalReading, spo2Pct: 93 });
      expect(result.status).toBe("WARNING");
      expect(result.alerts[0].indicator).toBe("spo2");
    });

    it("debe emitir CRITICAL si está por debajo de 92% (hipoxia en cabina)", () => {
      const result = evaluateReading({ ...nominalReading, spo2Pct: 89 });
      expect(result.status).toBe("CRITICAL");
      expect(result.recommendation).toContain("Cirujano de Vuelo");
    });
  });

  describe("Sueño y Estado de Ánimo", () => {
    it("debe emitir WARNING con 6.5h de sueño y ánimo 3", () => {
      const result = evaluateReading({
        ...nominalReading,
        sleepHours: 6.5,
        mood: 3,
      });
      expect(result.status).toBe("WARNING");
      expect(result.alerts).toHaveLength(2);
    });

    it("debe emitir CRITICAL con privación de sueño (<6h) y bajo ánimo (<=2)", () => {
      const result = evaluateReading({
        ...nominalReading,
        sleepHours: 4.5,
        mood: 2,
      });
      expect(result.status).toBe("CRITICAL");
      expect(result.alerts).toHaveLength(2);
    });
  });

  it("debe prevalecer CRITICAL si hay una métrica crítica aunque las demás sean warning u ok", () => {
    const mixedReading: HealthReadingInput = {
      ...nominalReading,
      heartRateBpm: 95, // WARNING
      temperatureC: 37.7, // WARNING
      spo2Pct: 90, // CRITICAL
    };

    const result = evaluateReading(mixedReading);
    expect(result.status).toBe("CRITICAL");
    expect(result.protocolId).toBe("PROTO_HYPOXIA");
    expect(result.alerts).toHaveLength(3);
    expect(result.recommendation).toContain("ALERTA CRÍTICA");
    expect(result.recommendation).toContain("PROTO_HYPOXIA");
  });

  it("asigna protocolId específico por indicador crítico (hipoglucemia, fiebre, crisis hipertensiva)", () => {
    expect(evaluateReading({ ...nominalReading, glucoseMgDl: 60 }).protocolId).toBe("PROTO_HYPOGLYCEMIA");
    expect(evaluateReading({ ...nominalReading, temperatureC: 38.6 }).protocolId).toBe("PROTO_FEVER");
    expect(evaluateReading({ ...nominalReading, systolicMmHg: 150 }).protocolId).toBe("PROTO_HYPERTENSIVE_CRISIS");
    expect(evaluateReading({ ...nominalReading, spo2Pct: 88 }).protocolId).toBe("PROTO_HYPOXIA");
    expect(evaluateReading(nominalReading).protocolId).toBe("PROTO_NOMINAL");
  });
});

