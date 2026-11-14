// Modo embebido: permite que una página anfitriona (misma origen) controle el reloj
// del visor y reciba el instante actual. Se activa con ?embed=1.
//
// Anfitrión → visor: { source: "artemis-host", type: "seek", t } | { ..., type: "play" | "pause" }
// Visor → anfitrión: { source: "artemis-viewer", type: "ready", tEnd, phases, events }
//                    { source: "artemis-viewer", type: "time", t, phaseId, playing }

export const HOST = "artemis-host";
export const VIEWER = "artemis-viewer";

/** true si la URL pide el modo embebido. */
export function isEmbedded(search) {
  return new URLSearchParams(search).get("embed") === "1";
}

/** Valida un mensaje del anfitrión; devuelve el comando o null si no es válido. */
export function parseCommand(data) {
  if (!data || typeof data !== "object" || data.source !== HOST) return null;
  if (data.type === "play" || data.type === "pause") return { type: data.type };
  if (data.type === "seek" && typeof data.t === "number" && Number.isFinite(data.t)) {
    return { type: "seek", t: data.t };
  }
  return null;
}

/**
 * Informa el instante sin saturar al anfitrión: como mucho cada `minIntervalMs`,
 * salvo que cambie la fase o el estado de reproducción (eso se informa ya).
 */
export function createTimeReporter(post, minIntervalMs = 250) {
  let lastAt = -Infinity;
  let last = null;
  return function report(now, t, phaseId, playing) {
    const changed = !last || last.phaseId !== phaseId || last.playing !== playing;
    if (last && last.t === t && !changed) return false;
    if (!changed && now - lastAt < minIntervalMs) return false;
    lastAt = now;
    last = { t, phaseId, playing };
    post({ source: VIEWER, type: "time", t, phaseId, playing });
    return true;
  };
}

/**
 * Conecta el visor con la ventana anfitriona. Solo acepta mensajes de la misma
 * origen y solo publica hacia ella.
 */
export function createEmbedBridge(win, onCommand) {
  const origin = win.location.origin;
  const post = (msg) => win.parent.postMessage(msg, origin);
  win.addEventListener("message", (e) => {
    if (e.origin !== origin || e.source !== win.parent) return;
    const cmd = parseCommand(e.data);
    if (cmd) onCommand(cmd);
  });
  return { post, report: createTimeReporter(post) };
}
