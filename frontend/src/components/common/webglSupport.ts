/**
 * Lightweight WebGL capability and context-loss helpers shared by 3D R3F canvases.
 */

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/**
 * Prevents the browser's permanent WebGL context loss default and notifies callbacks
 * when the GPU context is lost or restored. Returns a cleanup function.
 */
export function attachContextLossHandlers(
  domElement: HTMLCanvasElement,
  onLost: () => void,
  onRestored: () => void,
): () => void {
  const handleLost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  const handleRestored = () => {
    onRestored();
  };

  domElement.addEventListener('webglcontextlost', handleLost, false);
  domElement.addEventListener('webglcontextrestored', handleRestored, false);

  return () => {
    domElement.removeEventListener('webglcontextlost', handleLost, false);
    domElement.removeEventListener('webglcontextrestored', handleRestored, false);
  };
}
