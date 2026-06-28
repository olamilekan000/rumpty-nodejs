import express from "express";

const app = express();
const port = Number(process.env.PORT || 8080);
const startedAt = new Date().toISOString();

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
      <h1>Rumpty Node</h1>
      <p>This app is intentionally small and should test the Dockerfile build path, not Auto detection. It listens on <code>PORT</code> and exposes a health endpoint.</p>
      <dl>
        <dt>Started</dt><dd>${startedAt}</dd>
        <dt>Node</dt><dd>${process.version}</dd>
        <dt>Port</dt><dd>${port}</dd>
      </dl>
    </main>
  </body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, started_at: startedAt });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`rumpty-node listening on ${port}`);
});
