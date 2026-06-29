# Rumpty Node Docker Test

Small Node.js app for testing Rumpty Dockerfile deployments and runtime metrics.

The app runs a steady background workload so CPU and memory usage show up in Rumpty.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:8080.

Useful routes:

```bash
curl http://localhost:8080/status
curl http://localhost:8080/payload
```

Workload knobs:

```bash
WORKLOAD_ENABLED=true
WORKLOAD_CPU_MS=180
WORKLOAD_MEMORY_MB=96
WORKLOAD_NETWORK_KB=256
WORKLOAD_INTERVAL_MS=1500
```

## Docker

```bash
docker build -t rumpty-node:test .
docker run --rm -p 8080:8080 rumpty-node:test
```

## Rumpty

Create a deployment from this repository, choose `Dockerfile`, and set the backend readiness path to `/health`.
