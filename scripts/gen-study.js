// Generates the Assignment 3 trial pool, data/study.json: matched pairs of realistic requests for participants who
// have never used a DAW (see lib/beginner.js generateStudy). Each participant gets 3 pairs, one version of each with
// the assistant and the other by hand (app/study.js).
// Usage: node scripts/gen-study.js [n=24] [seed=3033]
import { writeFileSync } from 'node:fs';
import { generateStudy, scoreBeginner } from '../lib/beginner.js';

process.chdir(new URL('..', import.meta.url).pathname); // paths below are relative to the repo root

const [n = 24, seed = 3033] = process.argv.slice(2).map(Number);
const pairs = generateStudy(n, seed), trials = pairs.flatMap(p => p.versions);
// every target must score as a success against itself, or the scoring would fail people who did it right
const bad = trials.filter(t => !scoreBeginner(t, t.target).success);
if (bad.length) throw new Error(`targets that don't score as correct: ${bad.map(t => t.id).join(', ')}`);
writeFileSync('data/study.json', JSON.stringify(pairs));
const by = k => Object.entries(pairs.reduce((m, t) => ((m[t[k]] = (m[t[k]] || 0) + 1), m), {})).map(([v, c]) => `${v}:${c}`).join('  ');
console.log(`data/study.json: ${pairs.length} pairs\n  jobs     ${by('scenario')}\n  set      ${by('set')}\n  changes  ${by('n_calls')}`);
for (const p of pairs.slice(0, 3)) for (const t of p.versions) console.log(`${t.id}: ${t.instruction}`);
