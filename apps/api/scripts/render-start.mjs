import { spawn } from "node:child_process";

const DATABASE_URL = process.env.DATABASE_URL;
const prismaEnv = {
  ...process.env,
  ...(DATABASE_URL ? { DIRECT_URL: DATABASE_URL } : {}),
};

let shuttingDown = false;

function killChild(child, signal = "SIGTERM") {
  if (!child || child.killed) return;
  try {
    child.kill(signal);
  } catch {
    // ignore
  }
}

const server = spawn("node", ["dist/index.js"], {
  stdio: "inherit",
  env: process.env,
});

const prismaCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const prismaPush = spawn(prismaCmd, ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  env: prismaEnv,
});

const prismaTimeout = setTimeout(() => {
  console.warn("Prisma db push timed out; continuing with running API process.");
  killChild(prismaPush);
}, 60_000);

prismaPush.on("exit", (code) => {
  clearTimeout(prismaTimeout);
  if (code === 0) {
    console.log("Prisma db push completed.");
    return;
  }
  console.warn(`Prisma db push exited with code ${code ?? "unknown"}; API remains online.`);
});

server.on("exit", (code, signal) => {
  if (!shuttingDown) {
    shuttingDown = true;
    killChild(prismaPush);
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    killChild(prismaPush);
    killChild(server, signal);
    setTimeout(() => process.exit(0), 2_000).unref();
  });
}
