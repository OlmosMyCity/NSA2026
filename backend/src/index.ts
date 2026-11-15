/**
 * @module index
 * Backend server entrypoint. Starts an HTTP listener with graceful SIGINT/SIGTERM shutdown
 * in persistent environments, or exports the configured Express app directly on Vercel Serverless.
 */

import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();

// On Vercel Serverless / Fluid Compute, export `app` without binding a TCP port.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 4000;
  const server = app.listen(port, () => {
    console.log(`🚀 Artemis IV API escuchando en http://localhost:${port}/api`);
  });

  // Graceful shutdown (Render/Railway send SIGTERM on redeploy).
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

export default app;
