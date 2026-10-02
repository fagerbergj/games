import { startGameServer } from "./server";

const port = Number(process.env.PORT ?? 3001);
const server = startGameServer({ port });
console.log(`game-server listening on :${port}`);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => void server.close().then(() => process.exit(0)));
}
