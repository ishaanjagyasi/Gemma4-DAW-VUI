// Static server for the app (localhost is needed for the mic), forwards chat requests to Ollama and saves participant
// logs, to results/ locally or, when RESULTS_REPO and HF_TOKEN are set (the Hugging Face Space), to a private dataset.
import { createServer, request } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = +(process.env.PORT || 8000), HOST = process.env.HOST || '127.0.0.1';
const OLLAMA = process.env.OLLAMA || 'http://127.0.0.1:11434';
const { RESULTS_REPO, HF_TOKEN } = process.env;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.csv': 'text/csv' };
const root = import.meta.dirname;

// One commit per saved file, through the Hub's commit API (small files go inline as base64).
async function saveToHub(name, content) {
  const lines = [
    { key: 'header', value: { summary: `Add ${name}` } },
    { key: 'file', value: { path: `sessions/${name}`, content: Buffer.from(content).toString('base64'), encoding: 'base64' } },
  ];
  const res = await fetch(`https://huggingface.co/api/datasets/${RESULTS_REPO}/commit/main`, {
    method: 'POST',
    headers: { authorization: `Bearer ${HF_TOKEN}`, 'content-type': 'application/x-ndjson' },
    body: lines.map(l => JSON.stringify(l)).join('\n'),
  });
  if (!res.ok) throw new Error(`Hub commit failed: ${res.status} ${await res.text()}`);
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  // only chat is forwarded, so the rest of Ollama's API (pull, delete, ...) stays private
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    const up = request(OLLAMA + url.pathname, { method: 'POST', headers: { 'content-type': 'application/json' } }, r => {
      res.writeHead(r.statusCode, { 'content-type': r.headers['content-type'] || 'application/json' });
      r.pipe(res);
    });
    up.on('error', e => { if (!res.headersSent) { res.writeHead(502); res.end(JSON.stringify({ error: `Ollama not reachable: ${e.message}` })); } });
    // if the browser goes away, stop Ollama generating a reply nobody will read
    res.on('close', () => up.destroy());
    return req.pipe(up);
  }
  if (url.pathname === '/save' && req.method === 'POST') {
    let body = '';
    for await (const c of req) if ((body += c).length > 2e7) return res.writeHead(413).end('too large');
    try {
      const { name, content } = JSON.parse(body);
      const file = String(name).replace(/[^\w.-]/g, '_');
      if (RESULTS_REPO && HF_TOKEN) await saveToHub(file, content);
      else {
        await mkdir(join(root, 'results'), { recursive: true });
        await writeFile(join(root, 'results', file), content);
      }
      return res.end('ok');
    } catch (e) {
      console.error(e);
      return res.writeHead(500).end('save failed');
    }
  }
  // The app lives in app/ and is served at /; the shared code (lib/) and the datasets (data/) keep their own paths.
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  const path = normalize(join(root, /^\/(lib|data)\//.test(p) ? '' : 'app', p));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404).end('not found'); }
}).listen(PORT, HOST, () => console.log(`http://localhost:${PORT}`));
