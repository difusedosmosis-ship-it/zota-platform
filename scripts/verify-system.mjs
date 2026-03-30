const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8080";

async function check(name, path) {
  const started = Date.now();
  try {
    const res = await fetch(`${API_BASE}${path}`);
    const text = await res.text();
    const durationMs = Date.now() - started;
    const body = text ? JSON.parse(text) : null;
    return {
      name,
      ok: res.ok,
      status: res.status,
      durationMs,
      body,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      body: { message: error instanceof Error ? error.message : "Network error" },
    };
  }
}

const checks = await Promise.all([
  check("health", "/health"),
  check("health_detailed", "/health/detailed"),
]);

for (const result of checks) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`${status} ${result.name} status=${result.status} durationMs=${result.durationMs}`);
  if (!result.ok) {
    console.log(JSON.stringify(result.body));
  }
}

if (checks.some((entry) => !entry.ok)) {
  process.exit(1);
}
