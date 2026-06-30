import express from "express";
import lodash from "lodash";
import { readFileSync } from "node:fs";

const app = express();
const port = Number(process.env.PORT || 8080);
const startedAt = new Date().toISOString();
const workload = {
  enabled: process.env.WORKLOAD_ENABLED !== "false",
  cpuMs: numberFromEnv("WORKLOAD_CPU_MS", 180),
  memoryMb: numberFromEnv("WORKLOAD_MEMORY_MB", 96),
  networkKb: numberFromEnv("WORKLOAD_NETWORK_KB", 256),
  intervalMs: numberFromEnv("WORKLOAD_INTERVAL_MS", 1500),
  logIntervalMs: numberFromEnv("WORKLOAD_LOG_INTERVAL_MS", 5000),
  memoryHighWatermark: numberFromEnv("WORKLOAD_MEMORY_HIGH_WATERMARK", 0.82),
  memoryCooldownRuns: numberFromEnv("WORKLOAD_MEMORY_COOLDOWN_RUNS", 6),
};

const memoryStore = [];
let workloadRuns = 0;
let lastWorkloadAt = "";
let lastChecksum = 0;
let workloadPhase = "ramping";
let cooldownUntilRun = 0;
const memoryLimitBytes = detectMemoryLimitBytes();

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function burnCpu(durationMs) {
  const end = Date.now() + durationMs;
  let checksum = lastChecksum;
  while (Date.now() < end) {
    checksum += Math.sqrt((checksum % 100000) + Math.random() * 1000);
    if (checksum > Number.MAX_SAFE_INTEGER / 2) checksum = checksum % 100000;
  }
  lastChecksum = checksum;
}

function churnMemory(sizeMb) {
  if (shouldCoolDownMemory()) {
    releaseMemoryPressure();
    return;
  }
  if (workloadPhase === "cooling" && workloadRuns < cooldownUntilRun) {
    return;
  }
  if (workloadPhase === "cooling") {
    workloadPhase = "ramping";
    logWorkload("memory-ramp-resumed");
  }
  const bytes = Math.max(1, Math.floor(sizeMb)) * 1024 * 1024;
  const chunk = Buffer.alloc(bytes, workloadRuns % 255);
  memoryStore.push(chunk);
  while (memoryStore.length > 3) memoryStore.shift();
}

function makePayload(sizeKb) {
  const size = Math.max(1, Math.floor(sizeKb)) * 1024;
  return Buffer.alloc(size, "r").toString("base64");
}

function bytesToMb(value) {
  return Math.round((value / 1024 / 1024) * 100) / 100;
}

function detectMemoryLimitBytes() {
  const paths = [
    "/sys/fs/cgroup/memory.max",
    "/sys/fs/cgroup/memory/memory.limit_in_bytes",
  ];
  for (const path of paths) {
    try {
      const raw = readFileSync(path, "utf8").trim();
      if (!raw || raw === "max") continue;
      const value = Number(raw);
      if (Number.isFinite(value) && value > 0 && value < Number.MAX_SAFE_INTEGER) {
        return value;
      }
    } catch {
      // The file differs between cgroup versions; ignore missing paths.
    }
  }
  return 0;
}

function memoryUsageRatio() {
  if (!memoryLimitBytes) return 0;
  return process.memoryUsage().rss / memoryLimitBytes;
}

function shouldCoolDownMemory() {
  return memoryLimitBytes > 0 && memoryUsageRatio() >= workload.memoryHighWatermark;
}

function releaseMemoryPressure() {
  if (workloadPhase === "cooling") return;
  const before = process.memoryUsage().rss;
  memoryStore.splice(0, Math.max(0, memoryStore.length - 1));
  workloadPhase = "cooling";
  cooldownUntilRun = workloadRuns + workload.memoryCooldownRuns;
  logWorkload("memory-high-watermark");
  console.log(JSON.stringify({
    event: "memory-pressure-released",
    rss_before_mb: bytesToMb(before),
    rss_after_mb: bytesToMb(process.memoryUsage().rss),
    memory_limit_mb: memoryLimitBytes ? bytesToMb(memoryLimitBytes) : null,
    high_watermark: workload.memoryHighWatermark,
    cooldown_until_run: cooldownUntilRun,
  }));
}

function logWorkload(event) {
  const mem = process.memoryUsage();
  console.log(JSON.stringify({
    event,
    phase: workloadPhase,
    workload_runs: workloadRuns,
    cpu_burst_ms: workload.cpuMs,
    memory_target_mb: workload.memoryMb,
    memory_limit_mb: memoryLimitBytes ? bytesToMb(memoryLimitBytes) : null,
    memory_usage_percent: memoryLimitBytes ? Math.round(memoryUsageRatio() * 10000) / 100 : null,
    interval_ms: workload.intervalMs,
    rss_mb: bytesToMb(mem.rss),
    heap_used_mb: bytesToMb(mem.heapUsed),
    external_mb: bytesToMb(mem.external),
    last_workload_at: lastWorkloadAt,
    checksum: Math.round(lastChecksum),
  }));
}

function runWorkload() {
  if (!workload.enabled) return;
  workloadRuns += 1;
  lastWorkloadAt = new Date().toISOString();
  burnCpu(workload.cpuMs);
  churnMemory(workload.memoryMb);
  if (workloadRuns === 1 || workloadRuns % 10 === 0) {
    logWorkload("workload-cycle");
  }
}

if (workload.enabled) {
  runWorkload();
  setInterval(runWorkload, workload.intervalMs).unref();
  setInterval(() => logWorkload("workload-heartbeat"), workload.logIntervalMs).unref();
}

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Rumpty Node Docker Test</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4efe2; color: #201d18; }
      main { width: min(720px, calc(100vw - 32px)); border: 1px solid #ded4bf; border-radius: 8px; background: #fffaf0; padding: 32px; box-shadow: 0 18px 40px rgba(32, 29, 24, 0.08); }
      .badge { display: inline-flex; gap: 8px; align-items: center; border: 1px solid #9be3c5; color: #0d7a4f; background: #eafff5; border-radius: 999px; padding: 6px 10px; font: 700 12px ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }
      h1 { margin: 18px 0 10px; font-size: clamp(32px, 6vw, 56px); line-height: 1; letter-spacing: 0; }
      p { color: #6d6253; font-size: 16px; line-height: 1.7; }
      code { background: #efe6d4; border: 1px solid #ded4bf; border-radius: 6px; padding: 3px 6px; }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 16px; margin-top: 24px; font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; }
      dt { color: #827667; text-transform: uppercase; }
      dd { margin: 0; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>
      <span class="badge">Dockerfile build online</span>
      <h1>Rumpty Node v1</h1>
      <p>This app runs a steady background workload so Rumpty deployment metrics have visible CPU and memory activity. It also pins an intentionally vulnerable dependency so Rumpty security scans have something to report.</p>
      <dl>
        <dt>Started</dt><dd>${startedAt}</dd>
        <dt>Node</dt><dd>${process.version}</dd>
        <dt>Port</dt><dd>${port}</dd>
        <dt>Workload</dt><dd>${workload.enabled ? "enabled" : "disabled"}</dd>
        <dt>Runs</dt><dd>${workloadRuns}</dd>
        <dt>Memory target</dt><dd>${workload.memoryMb} MB</dd>
        <dt>Memory limit</dt><dd>${memoryLimitBytes ? `${bytesToMb(memoryLimitBytes)} MB` : "not detected"}</dd>
        <dt>Phase</dt><dd>${workloadPhase}</dd>
        <dt>CPU burst</dt><dd>${workload.cpuMs} ms every ${workload.intervalMs} ms</dd>
        <dt>Scan demo</dt><dd><code>lodash ${lodash.VERSION}</code></dd>
      </dl>
    </main>
  </body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, started_at: startedAt });
});

app.get("/status", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    started_at: startedAt,
    workload,
    workload_runs: workloadRuns,
    last_workload_at: lastWorkloadAt,
    workload_phase: workloadPhase,
    memory_limit_bytes: memoryLimitBytes,
    memory_usage_percent: memoryLimitBytes ? Math.round(memoryUsageRatio() * 10000) / 100 : null,
    checksum: Math.round(lastChecksum),
    memory: {
      rss: mem.rss,
      heap_used: mem.heapUsed,
      external: mem.external,
    },
  });
});

app.get("/payload", (_req, res) => {
  console.log(JSON.stringify({
    event: "payload-generated",
    size_kb: workload.networkKb,
    workload_runs: workloadRuns,
    generated_at: new Date().toISOString(),
  }));
  res.json({
    generated_at: new Date().toISOString(),
    size_kb: workload.networkKb,
    payload: makePayload(workload.networkKb),
  });
});

app.get("/vulnerable-demo", (_req, res) => {
  const sample = lodash.defaultsDeep(
    { app: { name: "rumpty-node", scan_demo: true } },
    { app: { dependency: "lodash", version: lodash.VERSION } },
  );
  console.log(JSON.stringify({
    event: "vulnerable-demo-requested",
    dependency: "lodash",
    version: lodash.VERSION,
    generated_at: new Date().toISOString(),
  }));
  res.json({
    message: "This endpoint intentionally loads an old lodash version so vulnerability scans can be tested.",
    dependency: {
      name: "lodash",
      version: lodash.VERSION,
      intentionally_vulnerable: true,
    },
    sample,
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`rumpty-node listening on ${port}`);
  console.log(`workload ${workload.enabled ? "enabled" : "disabled"}: cpu=${workload.cpuMs}ms memory=${workload.memoryMb}MB interval=${workload.intervalMs}ms`);
  logWorkload("server-started");
});
