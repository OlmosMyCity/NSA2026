(() => {
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/telemetry`;

  const connPill = document.getElementById("conn-pill");
  const fpsPill = document.getElementById("fps-pill");
  const healthPill = document.getElementById("health-pill");
  const alertsBanner = document.getElementById("alerts-banner");
  const hudImage = document.getElementById("hud-image");
  const webcamVideo = document.getElementById("local-webcam");
  const captureCanvas = document.getElementById("capture-canvas");
  const captureCtx = captureCanvas.getContext("2d");

  const sourceSelect = document.getElementById("source-select");
  const cameraModeSelect = document.getElementById("camera-mode-select");
  const contextSelect = document.getElementById("context-select");
  const simControlsBox = document.getElementById("sim-controls-box");
  const simBpmSlider = document.getElementById("sim-bpm-slider");
  const simBpmLabel = document.getElementById("sim-bpm-label");
  const resetBtn = document.getElementById("reset-btn");
  const stateBtns = document.querySelectorAll(".state-btn");

  const bvpCanvas = document.getElementById("bvp-canvas");
  const bvpCtx = bvpCanvas.getContext("2d");
  const psdCanvas = document.getElementById("psd-canvas");
  const psdCtx = psdCanvas.getContext("2d");

  let ws = null;
  let simState = "nominal";
  let simBpm = 72;
  let webcamStream = null;
  let loopTimer = null;
  let awaitingResponse = false;

  function connectWebSocket() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      connPill.textContent = "WS: EN LÍNEA";
      connPill.style.color = "#22c55e";
      awaitingResponse = false;
      startStreamingLoop();
    };
    ws.onmessage = (event) => {
      awaitingResponse = false;
      const data = JSON.parse(event.data);
      if (data.type === "ack" || data.type === "error") return;
      renderTelemetry(data);
    };
    ws.onclose = () => {
      connPill.textContent = "WS: RECONECTANDO...";
      connPill.style.color = "#f59e0b";
      setTimeout(connectWebSocket, 1500);
    };
  }

  function startStreamingLoop() {
    if (loopTimer) clearInterval(loopTimer);
    loopTimer = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN || awaitingResponse) return;

      const source = sourceSelect.value;
      const cameraMode = cameraModeSelect.value;
      const context = contextSelect.value;

      if (source === "simulator") {
        awaitingResponse = true;
        ws.send(
          JSON.stringify({
            type: "tick",
            camera_mode: cameraMode,
            context: context,
            sim_bpm: simBpm,
            sim_state: simState,
          })
        );
      } else if (source === "webcam" && webcamVideo.readyState >= 2) {
        captureCtx.drawImage(webcamVideo, 0, 0, captureCanvas.width, captureCanvas.height);
        const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.75);
        awaitingResponse = true;
        ws.send(
          JSON.stringify({
            type: "frame",
            image_b64: dataUrl,
            timestamp: performance.now() / 1000.0,
            camera_mode: cameraMode,
            context: context,
            include_hud: true,
          })
        );
      }
    }, 65);
  }

  async function toggleSource() {
    const source = sourceSelect.value;
    if (source === "webcam") {
      simControlsBox.hidden = true;
      try {
        webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: { ideal: 30 } },
          audio: false,
        });
        webcamVideo.srcObject = webcamStream;
      } catch (err) {
        alert("No se pudo acceder a la cámara web local. Volviendo al modo Simulador.");
        sourceSelect.value = "simulator";
        simControlsBox.hidden = false;
      }
    } else {
      simControlsBox.hidden = false;
      if (webcamStream) {
        webcamStream.getTracks().forEach((t) => t.stop());
        webcamStream = null;
      }
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "reset" }));
    }
  }

  sourceSelect.addEventListener("change", toggleSource);

  simBpmSlider.addEventListener("input", () => {
    simBpm = Number(simBpmSlider.value);
    simBpmLabel.textContent = `${simBpm} BPM`;
  });

  stateBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      stateBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      simState = btn.dataset.state;
      if (simState.startsWith("sleeping")) {
        contextSelect.value = "sleep_pod";
      } else {
        contextSelect.value = "cabin_active";
      }
    });
  });

  resetBtn.addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "reset" }));
    }
  });

  function renderTelemetry(t) {
    if (t.annotated_frame_jpeg_b64) {
      hudImage.src = `data:image/jpeg;base64,${t.annotated_frame_jpeg_b64}`;
    }
    fpsPill.textContent = `FPS: ${t.fps.toFixed(1)}`;
    healthPill.textContent = `SALUD GLOBAL: ${t.overall_health_index.toFixed(0)}%`;

    if (t.alerts && t.alerts.length > 0) {
      alertsBanner.hidden = false;
      alertsBanner.textContent = `⚠ ALERTAS DE MISIÓN: ${t.alerts.join("  |  ")}`;
    } else {
      alertsBanner.hidden = true;
    }

    // 1. Heart Rate & rPPG
    const hr = t.heart_rate;
    document.getElementById("bpm-value").textContent = hr.bpm > 0 ? hr.bpm.toFixed(1) : "--";
    document.getElementById("hrv-rmssd").textContent = `${hr.hrv_rmssd_ms.toFixed(1)} ms`;
    document.getElementById("hrv-sdnn").textContent = `${hr.hrv_sdnn_ms.toFixed(1)} ms`;
    document.getElementById("resp-rpm").textContent = `${hr.respiration_rpm.toFixed(1)} RPM`;
    document.getElementById("sqi-value").textContent = `${hr.signal_quality.toFixed(0)}%`;
    document.getElementById("buffer-bar").style.width = `${hr.buffer_fill_pct}%`;
    document.getElementById("buffer-pct").textContent = `${hr.buffer_fill_pct.toFixed(0)}%`;
    document.getElementById("hr-status-tag").textContent = hr.status.toUpperCase();

    drawWaveform(bvpCtx, bvpCanvas.width, bvpCanvas.height, hr.bvp_waveform, "#38bdf8");
    drawSpectrum(
      psdCtx,
      psdCanvas.width,
      psdCanvas.height,
      hr.spectrum_freqs_bpm,
      hr.spectrum_power,
      hr.bpm
    );

    // 2. Mood & Stress
    const mood = t.mood;
    document.getElementById("dominant-mood").textContent = mood.dominant_mood;
    document.getElementById("raw-emotion").textContent = mood.raw_emotion;
    document.getElementById("mood-valence").textContent = mood.mood_valence.toFixed(2);
    document.getElementById("mood-backend-tag").textContent = mood.model_backend;
    document.getElementById("stress-val").textContent = `${mood.stress_index.toFixed(0)}%`;
    document.getElementById("stress-bar").style.width = `${mood.stress_index}%`;
    document.getElementById("alertness-val").textContent = `${mood.alertness_score.toFixed(0)}%`;
    document.getElementById("alertness-bar").style.width = `${mood.alertness_score}%`;

    const probsContainer = document.getElementById("emotion-probs");
    probsContainer.replaceChildren();
    Object.entries(mood.emotion_probabilities || {}).forEach(([emo, prob]) => {
      const chip = document.createElement("div");
      chip.className = "prob-chip";
      const label = document.createElement("span");
      label.textContent = String(emo);
      const value = document.createElement("strong");
      value.textContent = `${(prob * 100).toFixed(0)}%`;
      chip.append(label, value);
      probsContainer.appendChild(chip);
    });

    // 3. Sleep & Fatigue
    const sl = t.sleep;
    document.getElementById("sleep-score").textContent = sl.sleep_quality_score.toFixed(0);
    document.getElementById("sleep-stage").textContent = `Fase: ${sl.sleep_stage_estimate}`;
    document.getElementById("fatigue-tag").textContent = sl.fatigue_level.toUpperCase();
    document.getElementById("perclos-val").textContent = `${sl.perclos.toFixed(1)}%`;
    document.getElementById("ear-val").textContent = sl.ear_mean.toFixed(3);
    document.getElementById("mar-val").textContent = sl.mar.toFixed(3);
    document.getElementById("blink-val").textContent = sl.blink_rate_per_min.toFixed(1);
    document.getElementById("yawn-val").textContent = String(sl.yawn_count);
    document.getElementById("motion-val").textContent = `${sl.movement_index.toFixed(1)}%`;
    document.getElementById("pose-val").textContent = `${sl.head_pitch_deg.toFixed(0)}° / ${sl.head_yaw_deg.toFixed(0)}°`;
    document.getElementById("restless-val").textContent = String(sl.restlessness_events);
  }

  function drawWaveform(ctx, w, h, samples, color) {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (!samples || samples.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const step = w / (samples.length - 1);
    for (let i = 0; i < samples.length; i++) {
      const x = i * step;
      const y = h / 2 - (samples[i] / 3.2) * (h * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawSpectrum(ctx, w, h, freqsBpm, power, peakBpm) {
    ctx.clearRect(0, 0, w, h);
    if (!freqsBpm || freqsBpm.length < 2) return;
    const barW = Math.max(2, w / freqsBpm.length - 1);
    for (let i = 0; i < freqsBpm.length; i++) {
      const x = (i / freqsBpm.length) * w;
      const barH = power[i] * (h - 16);
      const isPeak = Math.abs(freqsBpm[i] - peakBpm) < 5.0;
      ctx.fillStyle = isPeak ? "#22c55e" : "#38bdf8";
      ctx.fillRect(x, h - barH - 12, barW, barH);
    }
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px sans-serif";
    ctx.fillText("45 BPM", 4, h - 2);
    ctx.fillText("180 BPM", w - 48, h - 2);
  }

  // Video file upload handler
  const uploadForm = document.getElementById("video-upload-form");
  const reportOutput = document.getElementById("video-report-output");
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("video-file-input");
    if (!fileInput.files || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("camera_mode", cameraModeSelect.value);
    formData.append("context", contextSelect.value);

    reportOutput.hidden = false;
    reportOutput.textContent = "Procesando video cuadro a cuadro en CPU...";
    try {
      const res = await fetch("/api/analyze/video", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        reportOutput.textContent = `Error: ${data.detail || "Fallo al procesar"}`;
        return;
      }
      const s = data.summary;
      const heading = document.createElement("strong");
      heading.textContent = `Reporte de Sesión (${data.duration_seconds}s / ${data.frames_processed} cuadros):`;

      const appendLine = (label, text) => {
        reportOutput.appendChild(document.createElement("br"));
        reportOutput.appendChild(document.createTextNode("• "));
        const bold = document.createElement("b");
        bold.textContent = label;
        reportOutput.appendChild(bold);
        reportOutput.appendChild(document.createTextNode(` ${text}`));
      };

      reportOutput.replaceChildren(heading);
      appendLine(
        "Pulso Promedio:",
        `${s.mean_bpm} BPM (Final: ${s.final_bpm} BPM | HRV RMSSD: ${s.hrv_rmssd_ms} ms)`
      );
      appendLine(
        "Estado de Ánimo Dominante:",
        `${s.dominant_mood} (Estrés medio: ${s.mean_stress_index}%)`
      );
      appendLine(
        "Calidad de Sueño/Alerta:",
        `${s.mean_sleep_quality_score}/100 | PERCLOS: ${s.final_perclos}% | Bostezos: ${s.yawn_count}`
      );
    } catch (err) {
      reportOutput.textContent = `Error de red: ${err}`;
    }
  });

  connectWebSocket();
})();
