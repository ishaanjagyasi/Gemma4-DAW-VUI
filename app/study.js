// The Assignment 3 study, one continuous session: welcome and consent, then two rounds in random order, by hand and
// with the assistant. Each round has a guided practice, 3 timed requests, each followed by ratings (SEQ and confidence;
// in the AI round, confidence in the assistant, what had to be redone and how long checking took), and a questionnaire (NASA-TLX, sense of control and UMUX-Lite, plus two items on the assistant in the AI round).
// The requests come from data/study.json as matched pairs: each pair's
// two versions ask for the same kinds and number of changes, one is done in each round. Then a preference question,
// and thanks.
// Everything the participant does is logged and saved through /save after every step, as <pid>.json.
import { scoreBeginner } from '../lib/beginner.js';
import { deviceDefaults } from '../lib/catalog.js';

const $ = s => document.querySelector(s);
const h = (tag, props = {}, ...kids) => { const el = Object.assign(document.createElement(tag), props); el.append(...kids.flat()); return el; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The practice exercises, in the same order for everyone: the first is the guided practice of each round, the others
// are what "Practice again" gives, each with its own tracks and changes. Each has its starting tracks (name, clip sound,
// color, volume) and its steps: the command, how to do it by mouse and a check on the session. The AI round practises
// the same commands through the assistant.
const practiceStart = rows => ({
  tempo: 110, metronome: false, transport: 'stopped', marker: 0, loop: { on: false, start: 4, end: 12 }, main: { vol: 0 }, nextId: 1,
  tracks: rows.map(([name, sound, color, vol], i) => ({
    id: `T${i + 1}`, name, color, group: 'other', vol, pan: 0, on: true, solo: false, arm: false, sends: { A: -70, B: -70 }, devices: [],
    clips: [{ id: `pc${i}`, name, start: 0, len: 16, offset: 0, sound, on: true }],
  })),
  returns: [
    { id: 'A', name: 'A Reverb', color: '#92a7ff', vol: 0, pan: 0, on: true, solo: false, devices: [{ id: 'pr', type: 'Reverb', on: true, params: { ...deviceDefaults('Reverb'), 'Dry/Wet': 100, Decay: 2.5 } }] },
    { id: 'B', name: 'B Delay', color: '#5cffe8', vol: 0, pan: 0, on: true, solo: false, devices: [{ id: 'pd', type: 'Delay', on: true, params: { ...deviceDefaults('Delay'), 'Dry/Wet': 100 } }] },
  ],
});
const track = (s, n) => s.tracks.find(t => t.name.trim().toLowerCase() === n.toLowerCase());
const near = (v, want, tol) => Math.abs((v ?? 999) - want) <= tol;
const hasFx = (s, n, type) => !!track(s, n)?.devices.some(d => d.type === type);
const stepVol = (n, db) => [`Set ${n} volume to ${db} dB`, `Each track has a volume number (in dB) next to its name. Click it on ${n}, type ${db} and press Enter. You can also drag it up or down.`, s => near(track(s, n)?.vol, db, 0.25)];
const stepPan = (n, p) => [`Pan ${n} ${Math.abs(p)} ${p < 0 ? 'left' : 'right'}`, `Next to the volume is the pan (C means center). Click it on ${n}, type ${Math.abs(p)}${p < 0 ? 'L' : 'R'} and press Enter.`, s => near(track(s, n)?.pan, p, 1)];
const stepAdd = n => [`Add a new track named ${n}`, `Right-click a track name and choose "Insert Audio Track" (or press Ctrl+T). Then double-click the new track's name, type ${n} and press Enter.`, s => !!track(s, n)];
const stepFx = (type, n) => [`Add ${type} to ${n}`, `Click the ${n} track to select it. In the Browser on the left, find ${type} under Audio Effects and double-click it (or drag it onto the track).`, s => hasFx(s, n, type)];
const stepMute = n => [`Mute ${n}`, `The numbered yellow button on each track is its on/off switch. Click it on ${n} so it turns grey.`, s => track(s, n)?.on === false];
const stepTempo = bpm => [`Set tempo to ${bpm} BPM`, `Click the number at the top left (BPM), type ${bpm} and press Enter.`, s => near(s.tempo, bpm, 0.5)];
const stepRename = (n, to) => [`Rename ${n} to ${to}`, `Double-click the name ${n}, type ${to} and press Enter.`, s => !!track(s, to) && !track(s, n)];
const stepSolo = n => [`Solo ${n}`, `Click the S button on ${n}: only soloed tracks play.`, s => track(s, n)?.solo === true];
const stepArm = n => [`Arm ${n} for recording`, `Click the round button next to S on ${n} so it turns red.`, s => track(s, n)?.arm === true];
const stepDelete = n => [`Delete track ${n}`, `Right-click the name ${n} and choose Delete.`, s => !track(s, n)];
const PRACTICE = [
  { tracks: [['Drums', 'kick', '#ff8f3d', -8], ['Bass', 'bass', '#3fd1a2', -10], ['Piano', 'keys', '#47c1f0', -6], ['Vocals', 'lead', '#f27ac6', -9]],
    steps: [stepVol('Piano', -12), stepPan('Piano', -20), stepAdd('Guitar'), stepFx('Reverb', 'Vocals'), stepMute('Bass')] },
  { tracks: [['Percussion', 'shaker', '#9bd96b', -11], ['Guitar', 'arp', '#7f9cf5', -7], ['Organ', 'pad', '#8d8cf5', -9], ['Flute', 'lead', '#f59ad0', -8]],
    steps: [stepTempo(95), stepRename('Organ', 'Church Organ'), stepSolo('Guitar'), stepFx('Delay', 'Flute'), stepDelete('Percussion')] },
  { tracks: [['Kick Drum', 'kick', '#ff8f3d', -6], ['Snare Drum', 'snare', '#ffd23f', -9], ['Strings', 'pad', '#a08cf0', -10], ['Backing Vocals', 'choir', '#d6a6f2', -12]],
    steps: [stepVol('Strings', -18), stepPan('Snare Drum', 30), stepFx('Compressor', 'Kick Drum'), stepArm('Backing Vocals'), stepAdd('Trumpet')] },
  { tracks: [['Violin', 'pad', '#47c1f0', -9], ['Cello', 'bass', '#3fd1a2', -11], ['Harp', 'arp', '#7f9cf5', -7], ['Choir', 'choir', '#f27ac6', -10]],
    steps: [stepMute('Harp'), stepTempo(130), stepRename('Choir', 'Harmonies'), stepPan('Cello', -40), stepFx('Reverb', 'Violin')] },
];
// What the cheat sheet says during the trials.
const HOWTO = [
  ['Volume', 'Click the dB number next to a track name, type a value (e.g. -12) and press Enter.'],
  ['Pan (left/right)', 'Click the pan value (C = center), type e.g. 20L or 30R and press Enter. C puts it back in the middle.'],
  ['Mute', 'Click the track\'s numbered yellow button: grey means muted. Click again to unmute.'],
  ['Solo', 'Click the S button: only soloed tracks play.'],
  ['Arm for recording', 'Click the round button next to S: red means armed.'],
  ['Add a track', 'Right-click a track name > Insert Audio Track (or Ctrl+T).'],
  ['Rename a track', 'Double-click its name, type the new name, press Enter.'],
  ['Delete a track', 'Right-click its name > Delete.'],
  ['Add an effect', 'Select the track, then double-click the effect (Reverb, Delay, Compressor) in the Browser on the left.'],
  ['Tempo', 'Click the number at the top left (BPM), type the new tempo, press Enter.'],
  ['Undo a mistake', 'Cmd+Z (Mac) or Ctrl+Z (Windows).'],
];

// NASA-TLX: key, title, question, the two ends and, where the AI round differs, its [question, ends]
const TLX = [
  ['mental', 'Mental demand', 'How mentally demanding was the task?', 'Very low', 'Very high'],
  ['physical', 'Physical demand', 'How physically demanding was the task (clicking, typing)?', 'Very low', 'Very high', ['How physically demanding was the task (speaking, clicking around, looking over the changes)?', 'Very low', 'Very high']],
  // reworded from standard NASA-TLX (time pressure) in both rounds: participants judge how long each way of working felt
  ['temporal', 'Temporal demand', 'How much time did the task take, including making the changes and checking that everything was done right?', 'Very little', 'A lot', ['How much time did the task take, including speaking your request and checking that everything was done right?', 'Very little', 'A lot']],
  // standard NASA-TLX runs Perfect to Failure; flipped because participants read 7 as good
  ['performance', 'Performance', 'How successful were you in doing what you were asked?', 'Failure (all wrong)', 'Perfect (all right)'],
  ['effort', 'Effort', 'How hard did you have to work to reach your level of performance?', 'Very low', 'Very high'],
  ['frustration', 'Frustration', 'How frustrated did you feel during the task?', 'Very low', 'Very high'],
];

export async function startStudy({ daw, hooks }) {
  const q = new URLSearchParams(location.search);
  const pairs = await fetch('data/study.json').then(r => r.json());
  const pid = q.get('pid') || Math.random().toString(36).slice(2, 8).toUpperCase();
  // which version comes first: random, or set with ?first=ai / ?first=noai to balance the groups by hand
  const first = ['ai', 'noai'].includes(q.get('first')) ? q.get('first') : Math.random() < 0.5 ? 'ai' : 'noai';
  const order = first === 'ai' ? ['ai', 'noai'] : ['noai', 'ai'];
  // 3 matched pairs (2 standard, 1 hard, different jobs); of each pair one version is done with the assistant and the
  // other by hand, which one at random
  const used = new Set(), pickPair = set => { const p = shuffle(pairs.filter(x => x.set === set && !used.has(x.scenario)))[0] ?? shuffle(pairs.filter(x => x.set === set && !chosenIds.has(x.id)))[0]; used.add(p.scenario); chosenIds.add(p.id); return p; }, chosenIds = new Set();
  const chosen = [pickPair('standard'), pickPair('standard'), pickPair('hard')].map(p => { const [a, b] = shuffle([...p.versions]); return { pair: p.id, ai: a, noai: b }; });
  const rec = { pid, name: '', order, started: new Date().toISOString(), userAgent: navigator.userAgent, blocks: {}, final: null, finished: null };
  let cur = null; // the step being timed: { events, ai, t0 }
  hooks.event = (type, data) => cur?.events.push({ t: Math.round(performance.now() - cur.t0), type, data });
  hooks.assistant = entry => cur?.ai.push({ t: Math.round(performance.now() - cur.t0), ...entry });

  document.body.classList.add('study');
  const save = () => fetch('/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: `${pid}.json`, content: JSON.stringify(rec, null, 1) }) })
    .catch(e => console.error('save failed', e));
  // any script error is kept in the record (and saved), so a session that stalls can be traced afterwards
  rec.errors = [];
  const fail = (msg, stack) => { rec.errors.push({ at: new Date().toISOString(), where: $('#trialNum').textContent, msg: String(msg), stack: String(stack ?? '') }); save(); };
  addEventListener('error', e => fail(e.message, e.error?.stack));
  addEventListener('unhandledrejection', e => fail(e.reason?.message ?? e.reason, e.reason?.stack));

  // ---------- screens ----------
  const overlay = $('#studyOverlay'), card = $('#studyCard');
  const show = (...kids) => { card.replaceChildren(...kids); overlay.hidden = false; card.scrollTop = 0; };
  const hide = () => (overlay.hidden = true);
  const button = (text, onclick, cls = 'tbtn primary') => h('button', { className: cls, textContent: text, onclick });
  const screen = (...kids) => new Promise(res => show(...kids, h('div', { className: 'row' }, button('Continue', () => { hide(); res(); }))));

  // the request bar above the DAW, and the step list in the practice
  const bar = $('#trialBar'), stepsEl = $('#guide');
  function load(state, label, instruction) {
    daw.stop(); daw.setState(structuredClone(state));
    $('#trialNum').textContent = label; $('#trialText').textContent = instruction; bar.hidden = false;
    hooks.reset?.();
    cur = { events: [], ai: [], t0: performance.now() };
  }
  function finish() {
    commitTyping();
    const ms = Math.round(performance.now() - cur.t0), out = { ms, events: cur.events, ai: cur.ai, final: daw.session() };
    cur = null; daw.stop(); bar.hidden = true;
    return out;
  }
  // a name or value still being typed is entered first: otherwise it lands, by track id, on the next request's session
  const commitTyping = () => document.querySelectorAll('input.rin, input.vin').forEach(i => i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })));
  const waitDone = () => new Promise(res => ($('#doneBtn').onclick = () => { commitTyping(); if (confirm('Are you finished with this request? You cannot come back to it.')) res(); }));
  const scale = (name, left, right) => h('div', { className: 'scale' }, h('span', { textContent: left }),
    ...Array.from({ length: 7 }, (_, k) => h('label', {}, h('input', { type: 'radio', name, value: k + 1, required: true }), h('i', { textContent: k + 1 }))), h('span', { textContent: right }));
  const question = (name, title, text, left, right) => h('fieldset', {}, h('legend', { innerHTML: `<b>${title}</b> ${text}` }), scale(name, left, right));
  const choice = (name, title, options) => h('fieldset', {}, h('legend', { innerHTML: title }),
    h('div', { className: 'opts' }, ...options.map(v => h('label', {}, h('input', { type: 'radio', name, value: v, required: true }), ` ${v}`))));
  const form = kids => new Promise(res => {
    const f = h('form', {}, ...kids, h('div', { className: 'row' }, h('button', { className: 'tbtn primary', textContent: 'Continue', type: 'submit' })));
    f.onsubmit = e => { e.preventDefault(); hide(); res(Object.fromEntries(new FormData(f))); };
    show(f);
  });
  const LIKERT = ['Strongly disagree', 'Strongly agree'];

  // ---------- 1. welcome and consent ----------
  await new Promise(res => {
    const name = h('input', { className: 'field', placeholder: 'Your name or initials', required: true });
    const agree = h('input', { type: 'checkbox' }), go = button('Start', () => {
      if (!name.value.trim()) return name.focus();
      rec.name = name.value.trim(); hide(); res();
    });
    go.disabled = true; agree.onchange = () => (go.disabled = !agree.checked);
    show(
      h('h2', { textContent: 'Music mixing study' }),
      h('p', { textContent: 'You will use a simple music app (like the ones producers use) to carry out requests from a music producer, such as turning instruments down or adding effects. No music knowledge is needed: a short practice shows you everything first.' }),
      h('p', { innerHTML: `There are two rounds: one where you make every change <b>by hand</b>, and one where an <b>AI assistant</b> can make the changes for you. Each round has a practice, ${chosen.length} timed requests and a few questions. It takes about 25 minutes in all.` }),
      h('p', { textContent: 'Work accurately: a request counts as done when every change is exactly right and nothing else changed.' }),
      h('p', { className: 'small', textContent: 'We record your actions in the app, your time, your answers and (with the assistant) what you asked it and what it did. Your name is only used to tell participants apart and is not published. You can stop at any time by closing the page.' }),
      h('label', { className: 'stack' }, 'Name or initials', name),
      h('label', { className: 'check' }, agree, ' I agree to take part'),
      h('div', { className: 'row' }, go),
      h('p', { className: 'small dim', textContent: `Participant ${pid}` }),
    );
  });
  save();

  // ---------- 2. the two rounds ----------
  for (const [round, condition] of order.entries()) {
    const ai = condition === 'ai', block = (rec.blocks[condition] = { round: round + 1, practice: [], trials: [], survey: null });
    document.body.classList.remove('cond-ai', 'cond-noai'); document.body.classList.add(`cond-${condition}`);
    hooks.reset?.();

    // guided practice
    await screen(
      h('h2', { textContent: `Round ${round + 1} of 2: ${ai ? 'with the AI assistant' : 'by hand'}` }),
      ...(ai ? [
        h('p', { textContent: 'In this round an AI assistant (the panel on the right) makes the changes for you. First a practice request, not timed. Every request works the same way:' }),
        h('ol', { className: 'steps' },
          h('li', { innerHTML: '<b>Read the request</b> in the blue bar at the top.' }),
          h('li', { innerHTML: '<b>Tell the assistant</b> in the box at the top right: type it in your own words and press Enter, or click 🎤, say it, and click 🎤 again to send it (✕ starts over). You can ask for everything at once.' }),
          h('li', { innerHTML: '<b>Watch and check</b>: the assistant makes the changes one by one and lists each under <b>Changes made</b>. If something is wrong, click <b>Undo</b> and ask again, or fix it by hand.' }),
          h('li', { innerHTML: 'Click <b>Done</b> at the top right.' })),
      ] : [h('p', { textContent: 'In this round you make every change yourself with the mouse and keyboard. First a practice request, not timed: the request is in the bar at the top, and a checklist on the right shows each part with how to do it. Each part gets a ✓ when it is done.' })]),
      h('p', { textContent: 'Hover over anything in the app to see what it does in the Info box at the bottom left.' }),
    );
    // each "Practice again" is a different exercise, until they run out; every attempt is kept in block.practice
    for (let next = 0, again = true; again;) {
      const exercise = next++, { tracks, steps } = PRACTICE[exercise], more = next < PRACTICE.length;
      load(practiceStart(tracks), 'Practice', steps.map(([what], k) => `${k + 1}. ${what}`).join('\n'));
      // by hand: each part with how to do it; with the assistant: how to ask, then the parts to check, how-tos folded away
      const items = steps.map(([what, how]) => h('li', {}, h('b', { textContent: what }), ai ? '' : h('p', { textContent: how })));
      if (ai) stepsEl.replaceChildren(
        h('h3', { textContent: 'Practice' }),
        h('p', { innerHTML: '↑ Type the request in the box above and press Enter, or click 🎤, say it and click 🎤 again to send. Then check <b>Changes made</b>.' }),
        h('h3', { textContent: 'Parts of the request (✓ when right)' }), h('ol', {}, items),
        h('details', {}, h('summary', { textContent: 'Fix it yourself' }), h('ol', {}, steps.map(([what, how]) => h('li', {}, h('b', { textContent: what }), h('p', { textContent: how }))))));
      else stepsEl.replaceChildren(h('h3', { textContent: 'Practice checklist' }), h('ol', {}, items));
      stepsEl.hidden = false;
      if (ai) { $('#typed').classList.add('pulse'); $('#typed').addEventListener('focus', () => $('#typed').classList.remove('pulse'), { once: true }); }
      const tick = setInterval(() => {
        const s = daw.session();
        steps.forEach(([, , ok], i) => items[i].classList.toggle('done', ok(s)));
        $('#doneBtn').disabled = !steps.every(([, , ok]) => ok(s));
      }, 300);
      $('#doneBtn').disabled = true;
      await new Promise(res => ($('#doneBtn').onclick = res));
      clearInterval(tick); $('#doneBtn').disabled = false;
      block.practice.push({ exercise: exercise + 1, ...finish() });
      $('#typed').classList.remove('pulse');
      save();
      again = await new Promise(res => show(
        h('h2', { textContent: 'Well done!' }),
        ...(more ? [h('p', { textContent: 'Would you like to practice again? You will get a different exercise, and it is not timed.' })] : []),
        h('p', { textContent: `Next come ${chosen.length} requests, timed. Each one asks for several changes at once. Work at your normal pace and aim to get every change exactly right. When you think a request is done, click Done (you can't go back).` }),
        h('p', { textContent: ai ? 'Use the assistant for each request, and check its changes before clicking Done.' : 'The "How to…" tips stay on the right if you need them.' }),
        h('div', { className: 'row' },
          ...(more ? [button('Practice again', () => { hide(); res(true); }, 'tbtn primary alt')] : []),
          button('Start the timed requests', () => { hide(); res(false); })),
      ));
    }
    const howto = h('dl', {}, HOWTO.flatMap(([k, v]) => [h('dt', { textContent: k }), h('dd', { textContent: v })]));
    stepsEl.replaceChildren(h('details', { open: !ai }, h('summary', { textContent: ai ? 'Fix it yourself' : 'How to…' }), howto));

    // timed requests, in a new random order each round
    for (const [i, c] of shuffle([...chosen]).entries()) {
      const t = c[condition];
      load(t.initial, `Request ${i + 1} of ${chosen.length}`, t.instruction);
      await waitDone();
      const out = finish(), sc = scoreBeginner(t, out.final);
      block.trials.push({ order: i + 1, pair: c.pair, id: t.id, scenario: t.scenario, set: t.set, challenge: t.challenge, instruction: t.instruction, n_calls: t.n_calls,
        success: sc.success, tp: sc.tp, n_required: sc.n_required, n_changed: sc.n_changed, errors: sc.errors, ...out });
      save();
      block.trials.at(-1).rating = await form([
        h('h2', { textContent: `Request ${i + 1}: ${ai ? 'a few' : 'two'} quick questions` }),
        question('seq', 'Difficulty', 'Overall, how easy or difficult was this request?', 'Very easy', 'Very difficult'), // flipped from standard SEQ: here 7 is hardest
        ...(ai ? [
          question('ai_confidence', 'Confidence', 'How confident are you that the assistant got this request right?', 'Not at all', 'Completely'),
          choice('redo', '<b>Redoing</b> Did you have to redo or fix anything?', ['No', 'Yes, I asked the assistant again', 'Yes, I fixed it by hand', 'Yes, both']),
          choice('verify_time', '<b>Checking</b> About how long did it take you to check the changes?', ['A few seconds', 'Under 30 seconds', '30 to 60 seconds', 'Over a minute', 'I did not check']),
        ] : [question('confidence', 'Confidence', 'How confident are you that this request is exactly right?', 'Not at all', 'Completely')]),
      ]);
      save();
    }

    // questions about this round
    stepsEl.hidden = true;
    block.survey = await form([
      h('h2', { textContent: `Round ${round + 1}: a few questions` }),
      h('p', { className: 'small', textContent: `About the requests you just did ${ai ? 'with the AI assistant' : 'by hand'} (not the practice).` }),
      ...TLX.map(([k, title, text, l, r, alt]) => question(k, title, ...(ai && alt ? alt : [text, l, r]))),
      question('control', 'Control', 'I felt in control of what happened in the session.', ...LIKERT),
      // adapted from UMUX-Lite (a two-item usability score): participants are given the tasks, so "my requirements" became "the needs of these tasks"
      question('umux_capabilities', 'Usability', 'This system\'s capabilities meet the needs of these tasks.', ...LIKERT),
      question('umux_easy', 'Usability', 'This system is easy to use.', ...LIKERT),
      ...(ai ? [question('did_asked', 'The assistant', 'The assistant did what I asked.', ...LIKERT),
        question('check_easy', 'Checking', 'Checking the assistant\'s results was easy.', ...LIKERT)] : []),
    ]);
    save();
    if (round === 0) await screen(h('h2', { textContent: 'Round 1 done' }), h('p', { innerHTML: `Next, the same kind of requests ${order[1] === 'ai' ? '<b>with the AI assistant</b>' : '<b>by hand</b>, without the assistant'}.` }));
  }

  // ---------- 3. final questions ----------
  rec.final = await form([
    h('h2', { textContent: 'Last questions' }),
    question('prefer', 'Preference', 'Which way of working would you prefer for these requests? (4 = no preference)', 'Strongly prefer by hand', 'Strongly prefer the AI assistant'),
    choice('daw', '<b>Experience</b> Have you used music production software (a DAW, e.g. GarageBand, Ableton) before?', ['Never', 'A few times', 'Regularly']),
    h('label', { className: 'stack' }, 'Anything else you\'d like to tell us? (optional)', h('textarea', { name: 'comment', className: 'field', rows: 3 })),
  ]);

  // ---------- 4. thanks ----------
  rec.finished = new Date().toISOString();
  await save();
  show(h('h2', { textContent: 'Thank you!' }), h('p', { innerHTML: `That's everything. Your answers are saved (participant <b>${pid}</b>). You can close this page.` }));
}
