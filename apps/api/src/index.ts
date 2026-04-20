import http from "http";
import { env } from "./env.js";
import { buildServer } from "./server.js";
import { initWebSockets } from "./realtime/ws.js";
import { ensureRuntimeSchema } from "./bootstrap/runtime-schema.js";

const app = buildServer();
const server = http.createServer(app);

// Attach WebSockets
initWebSockets(server);

server.listen(env.PORT, () => {
  console.log(`✅ BeautifulMind Backend running on http://localhost:${env.PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${env.PORT}/ws`);
  void ensureRuntimeSchema()
    .then(() => {
      console.log("✅ Runtime chat schema ensured");
    })
    .catch((error) => {
      console.error("Runtime chat schema ensure failed", error);
    });
});
