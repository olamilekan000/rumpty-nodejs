# Rumpty Node Docker Test

Small Node.js app for testing Rumpty Dockerfile deployments.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:8080.

## Docker

```bash
docker build -t rumpty-node:test .
docker run --rm -p 8080:8080 rumpty-node:test
```

## Rumpty

Create a deployment from this repository, choose `Dockerfile`, and set the backend readiness path to `/health`.
