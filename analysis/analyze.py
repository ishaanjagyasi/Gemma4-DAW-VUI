"""Assignment 3 analysis: the 4 participants who completed both conditions (continuous study).

    python3 analysis/analyze.py

Reads analysis/data/P*.json (one study session each, names replaced by P1-P4) and
analysis/data/ai_only_gemma4-mixer.jsonl (the model alone on every study trial, from scripts/eval-study.js),
and writes analysis/out/: trials.csv (one row per request), participants.csv (one row per person and
condition), stats.csv (paired tests) and summary.md.
Conditions: 'noai' = Human only (GUI, by hand); 'ai' = Human + AI (voice interface). 'AI only' = the model's
result on the very same requests, typed as one line, with no person involved.
"""
import csv, glob, json, os, statistics as st
from scipy.stats import wilcoxon, binomtest

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
sessions = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(HERE, 'data', 'P*.json')))]
ai_only = {r['id']: r for r in map(json.loads, open(os.path.join(HERE, 'data', 'ai_only_gemma4-mixer.jsonl')))}
COND = {'noai': 'Human only (GUI)', 'ai': 'Human + AI (VUI)'}

# ---- one row per request ----
trials = []
for d in sessions:
    for c in ('noai', 'ai'):
        for t in d['blocks'][c]['trials']:
            r, a = t['rating'], ai_only[t['id']]
            reqs = [x for x in t['ai'] if x.get('type') == 'request']
            trials.append(dict(
                participant=d['name'], daw=d['final']['daw'], first=d['order'][0], condition=c, order=t['order'],
                pair=t['pair'], trial=t['id'], set=t['set'], n_required=t['n_required'],
                success=int(t['success']), change_acc=round(t['tp'] / t['n_required'], 3), extra_changes=sum(e['type'] == 'extra unrequested change' for e in t['errors']),
                time_s=round(t['ms'] / 1000, 1), seq=int(r['seq']), confidence=int(r.get('ai_confidence') or r.get('confidence')),
                redo=r.get('redo', ''), verify_time=r.get('verify_time', ''), n_voice_requests=len(reqs),
                model_s=round(sum(x.get('modelMs') or 0 for x in reqs) / 1000, 1),
                ai_only_success=int(a['success']), ai_only_change_acc=round(a['tp'] / a['n_required'], 3),
                error_types='; '.join(sorted({e['type'] for e in t['errors']})),
                transcripts=' || '.join(x['text'] for x in reqs)))
with open(os.path.join(OUT, 'trials.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=trials[0].keys()); w.writeheader(); w.writerows(trials)

# ---- one row per person and condition ----
TLX = ['mental', 'physical', 'temporal', 'effort', 'frustration']
people = []
for d in sessions:
    for c in ('noai', 'ai'):
        T = [t for t in trials if t['participant'] == d['name'] and t['condition'] == c]
        s = d['blocks'][c]['survey']
        tlx = [int(s[k]) for k in TLX] + [8 - int(s['performance'])]  # performance flipped so that high = worse, like the rest
        people.append(dict(
            participant=d['name'], daw=d['final']['daw'], condition=c,
            success_n=sum(t['success'] for t in T), success_rate=round(st.mean(t['success'] for t in T), 3),
            change_acc=round(st.mean(t['change_acc'] for t in T), 3), ai_only_success_rate=round(st.mean(t['ai_only_success'] for t in T), 3),
            ai_only_change_acc=round(st.mean(t['ai_only_change_acc'] for t in T), 3),
            total_time_s=round(sum(t['time_s'] for t in T), 1), practice_s=round(sum(p['ms'] for p in d['blocks'][c]['practice']) / 1000),
            seq_mean=round(st.mean(t['seq'] for t in T), 2), confidence_mean=round(st.mean(t['confidence'] for t in T), 2),
            tlx_raw=round(st.mean(tlx), 2), **{f'tlx_{k}': int(s[k]) for k in TLX}, tlx_performance=int(s['performance']),
            control=int(s['control']), umux_lite=round((int(s['umux_capabilities']) - 1 + int(s['umux_easy']) - 1) / 12 * 100, 1),
            did_asked=s.get('did_asked', ''), check_easy=s.get('check_easy', ''),
            prefer=d['final']['prefer'], comment=d['final']['comment']))
with open(os.path.join(OUT, 'participants.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=people[0].keys()); w.writeheader(); w.writerows(people)

# ---- paired tests: Wilcoxon signed-rank (exact, two-sided) per measure; McNemar (exact) on request success ----
MEASURES = [('change_acc', 'Share of required changes made'), ('success_rate', 'Requests fully correct'), ('total_time_s', 'Total time, 3 requests (s)'),
            ('seq_mean', 'Difficulty, SEQ (1-7, 7 = hardest)'), ('confidence_mean', 'Confidence the result is right (1-7)'), ('tlx_raw', 'Raw NASA-TLX (1-7)'),
            ('tlx_mental', 'TLX mental demand'), ('tlx_physical', 'TLX physical demand'), ('tlx_frustration', 'TLX frustration'),
            ('control', 'Sense of control (1-7)'), ('umux_lite', 'UMUX-Lite (0-100)')]
by = {(p['participant'], p['condition']): p for p in people}
ids = sorted({p['participant'] for p in people})
stats = []
for key, label in MEASURES:
    h = [by[(i, 'noai')][key] for i in ids]; a = [by[(i, 'ai')][key] for i in ids]
    diffs = [y - x for x, y in zip(h, a)]
    nz = [x for x in diffs if x != 0]
    p = wilcoxon(a, h, method='exact').pvalue if len(nz) > 0 and len(set(map(abs, nz))) == len(nz) else (wilcoxon(a, h).pvalue if nz else 1.0)
    stats.append(dict(measure=label, test='Wilcoxon signed-rank (paired, two-sided)', n=len(ids),
                      human_only_mean=round(st.mean(h), 2), human_ai_mean=round(st.mean(a), 2),
                      ai_higher=sum(x > 0 for x in diffs), ai_lower=sum(x < 0 for x in diffs), ties=sum(x == 0 for x in diffs), p=round(p, 3)))
# McNemar on matched requests: the two versions of a pair done by the same person (one per condition)
pairs = {}
for t in trials: pairs.setdefault((t['participant'], t['pair']), {})[t['condition']] = t['success']
b = sum(v['noai'] == 1 and v['ai'] == 0 for v in pairs.values()); c = sum(v['noai'] == 0 and v['ai'] == 1 for v in pairs.values())
stats.append(dict(measure='Request fully correct (matched pairs)', test='McNemar exact (binomial on discordant pairs)', n=len(pairs),
                  human_only_mean=round(st.mean(v['noai'] for v in pairs.values()), 2), human_ai_mean=round(st.mean(v['ai'] for v in pairs.values()), 2),
                  ai_higher=c, ai_lower=b, ties=len(pairs) - b - c, p=round(binomtest(b, b + c, 0.5).pvalue, 3) if b + c else 1.0))
with open(os.path.join(OUT, 'stats.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=stats[0].keys()); w.writeheader(); w.writerows(stats)

# ---- summary ----
def rate(rows, k): return f"{sum(r[k] for r in rows)}/{len(rows)} ({100 * st.mean(r[k] for r in rows):.0f}%)"
H = [t for t in trials if t['condition'] == 'noai']; A = [t for t in trials if t['condition'] == 'ai']
lines = ['# A3 summary (4 participants, 12 requests per condition)', '',
         '| | Requests fully correct | Mean share of changes made |', '| --- | --- | --- |',
         f"| Human only (GUI) | {rate(H, 'success')} | {100 * st.mean(t['change_acc'] for t in H):.0f}% |",
         f"| Human + AI (VUI) | {rate(A, 'success')} | {100 * st.mean(t['change_acc'] for t in A):.0f}% |",
         f"| AI only (same 24 requests) | {rate(trials, 'ai_only_success')} | {100 * st.mean(t['ai_only_change_acc'] for t in trials):.0f}% |", '',
         '| Measure | Test | Human only | Human + AI | AI higher / lower / tie | p |', '| --- | --- | --- | --- | --- | --- |']
lines += [f"| {s['measure']} | {s['test']} | {s['human_only_mean']} | {s['human_ai_mean']} | {s['ai_higher']} / {s['ai_lower']} / {s['ties']} | {s['p']} |" for s in stats]
open(os.path.join(OUT, 'summary.md'), 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
