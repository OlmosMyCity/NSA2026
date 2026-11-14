import { RadiationEngine } from './index';

async function main() {
  console.log('--- Testing RadiationEngine In-Memory ---');
  const engine = new RadiationEngine();

  console.log('\n1. Testing Live / Fallback State:');
  const state = await engine.getCurrentState();
  console.log('Timestamp:', state.timestamp);
  console.log('Simulated?:', state.isSimulated);
  console.log('Storm Scale:', state.currentTelemetry.stormScale);
  console.log('Latest X-Ray Class:', state.currentTelemetry.latestXray?.currentClass);
  console.log('Early Warning Active?:', state.earlyWarning.isWarningActive);
  console.log('Doses in Cabin:', state.biologicalDoses.CREW_CABIN_NOMINAL.doseRateMicroSvPerHour, 'µSv/h');
  console.log('Doses in Shelter:', state.biologicalDoses.STORM_SHELTER.doseRateMicroSvPerHour, 'µSv/h');

  console.log('\n2. Testing Scenario: FLARE_EARLY_WARNING:');
  engine.setSimulationScenario('FLARE_EARLY_WARNING');
  const flareState = await engine.getCurrentState();
  console.log('Trigger Event:', flareState.earlyWarning.triggerEvent);
  console.log('Estimated Proton Arrival:', flareState.earlyWarning.estimatedProtonArrivalMinutes, 'minutes');
  console.log('Predicted Storm Scale:', flareState.earlyWarning.predictedStormScale);
  console.log('Abort EVA?:', flareState.mitigation.abortEvaImmediately);
  console.log('Medical Actions:', flareState.mitigation.medicalCountermeasures[0]);

  console.log('\n3. Testing Scenario: PEAK_STORM_S4:');
  engine.setSimulationScenario('PEAK_STORM_S4');
  const stormState = await engine.getCurrentState();
  console.log('Storm Scale:', stormState.currentTelemetry.stormScale);
  console.log('EVA Suit Dose Rate:', stormState.biologicalDoses.EVA_SUIT.doseRateMicroSvPerHour, 'µSv/h');
  console.log('Storm Shelter Dose Rate:', stormState.biologicalDoses.STORM_SHELTER.doseRateMicroSvPerHour, 'µSv/h');
  console.log('Shelter Attenuation Ratio:', (stormState.biologicalDoses.STORM_SHELTER.doseRateMicroSvPerHour / stormState.biologicalDoses.EVA_SUIT.doseRateMicroSvPerHour).toFixed(4));
  console.log('Evacuate to Storm Shelter?:', stormState.mitigation.evacuateToStormShelter);

  console.log('\n✅ All In-Memory Engine Tests Completed Successfully!');
}

main().catch(console.error);
