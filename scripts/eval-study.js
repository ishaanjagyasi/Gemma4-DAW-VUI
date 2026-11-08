// AI-only baseline for the Assignment 3 trial pool: sends each request in data/study.json (both versions of every
// pair) to the model, as the app
// does, applies its tool calls and scores the result as a participant's would be (lib/beginner.js scoreBeginner).
// Usage: node scripts/eval-study.js [--model gemma4-mixer] [--host http://127.0.0.1:11434]
// Writes results/ai-study/<model>.jsonl (one line per trial) and prints success by scenario and by set.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { TOOLS, applyCalls } from '../lib/core.js';
import { messages, readReply } from '../lib/prompt.js';
import { scoreBeginner } from '../lib/beginner.js';

process.chdir(new URL('..', import.meta.url).pathname); // paths below are relative to the repo root

const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = opt('model', 'gemma4-mixer'), HOST = opt('host', process.env.OLLAMA || 'http://127.0.0.1:11434');
const pool = JSON.parse(readFileSync('data/study.json', 'utf8')).flatMap(p => p.versions), rows = [];

for (const t of pool) {
  const t0 = Date.now();
  const res = await fetch(`${HOST}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: messages(t.initial, t.instruction), tools: TOOLS, stream: false, think: false, keep_alive: '30m', options: { temperature: 0, num_ctx: 8192 } }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const { calls, content, parseError } = readReply((await res.json()).message);
  const { state, errors: callErrors } = applyCalls(t.initial, calls), s = scoreBeginner(t, state);
  rows.push({ id: t.id, scenario: t.scenario, set: t.set, challenge: t.challenge, instruction: t.instruction, calls, content, parseError, callErrors, ms: Date.now() - t0, success: s.success, tp: s.tp, n_required: s.n_required, errors: s.errors });
  console.log(`${t.id} ${s.success ? 'ok  ' : 'FAIL'} ${t.scenario}${t.set === 'hard' ? ' (hard)' : ''}${s.success ? '' : `: ${s.errors.map(e => `${e.type} ${e.key ?? e.detail ?? ''}`).join('; ')}`}`);
}

mkdirSync('results/ai-study', { recursive: true });
writeFileSync(`results/ai-study/${MODEL.replace(/[^\w.-]/g, '_')}.jsonl`, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
const rate = rs => `${rs.filter(r => r.success).length}/${rs.length} (${Math.round((100 * rs.filter(r => r.success).length) / rs.length)}%)`;
console.log(`\n${MODEL}: ${rate(rows)} exact success`);
for (const k of ['set', 'scenario']) for (const v of [...new Set(rows.map(r => r[k]))]) console.log(`  ${k} ${v}: ${rate(rows.filter(r => r[k] === v))}`);
