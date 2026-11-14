import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 4000;

const server = createApp().listen(port, () => {
  console.log(`🚀 Artemis IV API escuchando en http://localhost:${port}/api`);
});

// Cierre limpio (Render/Railway envían SIGTERM al redesplegar)
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
