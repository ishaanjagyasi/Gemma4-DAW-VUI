# Assignment 3 analysis

Reproduce every number in the report:

```
pip install scipy
python3 analysis/analyze.py
```

## Data (`analysis/data/`)

- `P1_*.json` … `P4_*.json`: the four participants who completed both conditions of the continuous study (16–20 Nov 2026). Names are replaced by P1–P4; the suffix is the session id. One file per participant, written by the study app (`app/study.js`) after every step:
  - `order`: which condition came first (`noai` = by hand / GUI, `ai` = voice + AI).
  - `blocks.<condition>.practice[]`: untimed practice attempts.
  - `blocks.<condition>.trials[]`: the 3 timed requests. Each has the request text (`instruction`), its score against the expected session (`success`, `tp` correct changes of `n_required`, `errors[]`), time in ms, every GUI action (`events`), every assistant exchange (`ai`: transcript, tool calls, applied changes, model time, undo, mic events), the final session, and the per-request ratings (`rating`).
  - `blocks.<condition>.survey`: NASA-TLX items, control, UMUX-Lite items and (voice condition) two items about the assistant, all 1–7.
  - `final`: preference (1 = by hand, 7 = AI), DAW experience, comment.
- `ai_only_gemma4-mixer.jsonl`: the model alone on every study request, typed as one line (`node scripts/eval-study.js`).

## Output (`analysis/out/`)

- `trials.csv`: one row per request (24), with the AI-only result for the same request.
- `participants.csv`: one row per participant and condition (8).
- `stats.csv`: paired tests (exact two-sided Wilcoxon signed-rank per measure; exact McNemar on matched request success).
- `summary.md`: the tables used in the report.
