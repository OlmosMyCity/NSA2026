import "dotenv/config";
import { createApp } from "./app.js";

const app = createApp();

// En Vercel Serverless/Fluid Compute se exporta `app` sin abrir un puerto TCP.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 4000;
  const server = app.listen(port, () => {
    console.log(`🚀 Artemis IV API escuchando en http://localhost:${port}/api`);
  });

  // Cierre limpio (Render/Railway envían SIGTERM al redesplegar)
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

export default app;
