import { createDaw } from './daw.js';
import { TOOLS } from '../lib/core.js';
import { messages, readReply } from '../lib/prompt.js';
import { startStudy } from './study.js';

const $ = s => document.querySelector(s);
// the study (study.js) listens here: every DAW edit, every assistant request and undo, and a reset per trial
const hooks = { event: () => {}, assistant: () => {}, reset: null };
const daw = createDaw({ onEvent: (type, data) => hooks.event(type, data) });
window.daw = daw;

// The app opens on the study; ?free opens it on the first Assignment 3 request instead, for trying things out
if (!new URLSearchParams(location.search).has('free')) startStudy({ daw, hooks });
else {
  const pairs = await fetch('data/study.json').then(r => (r.ok ? r.json() : [])).catch(() => []);
  if (pairs[0]) daw.setState(pairs[0].versions[0].initial);
}

// ---------- assistant: a request goes to the model with a fresh snapshot of the session, the tool calls it returns
// are applied as one undoable step, and the resulting changes are listed for the person to check ----------
const pill = (text, cls = '') => { $('#aiState').textContent = text; $('#aiState').className = `pill ${cls}`; };
const say = text => { $('#answer').hidden = !text; $('#answer').textContent = text ?? ''; };
const li = (text, cls = '') => Object.assign(document.createElement('li'), { textContent: text, className: cls });
hooks.reset = () => { $('#transcript').textContent = '—'; $('#plan').replaceChildren(); $('#undoBtn').disabled = true; say(''); $('#typed').value = ''; pill('Ready'); };

async function ask(text, via) {
  const input = $('#typed'), t0 = performance.now();
  input.disabled = true; pill('Thinking…', 'thinking'); say('');
  $('#transcript').textContent = text; $('#plan').replaceChildren(); $('#undoBtn').disabled = true;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: $('#model').value.trim(), messages: messages(daw.session(), text), tools: TOOLS, stream: false, think: false, keep_alive: '30m', options: { temperature: 0, num_ctx: 8192 } }),
    });
    const r = await res.json();
    if (!res.ok || r.error) throw new Error(r.error ?? `HTTP ${res.status}`);
    const { calls, content, parseError } = readReply(r.message), modelMs = Math.round(performance.now() - t0);
    // the changes are made one by one on screen, each listed as it happens
    pill('Making changes…', 'thinking');
    const { errors, changes } = await daw.applyCallsStepwise(calls, {
      onStep: (done, failed) => { $('#plan').append(...done.map(c => li(c)), ...failed.map(e => li(`Could not do: ${e}`, 'err'))); $('#plan').lastElementChild?.scrollIntoView({ block: 'nearest' }); },
    });
    if (!changes.length && !errors.length) $('#plan').append(li('Nothing changed.', 'err'));
    if (parseError) say(`The model's answer could not be read: ${content}`);
    else if (!calls.length && content.trim()) say(content.trim());
    $('#undoBtn').disabled = !changes.length;
    pill('Ready');
    hooks.assistant({ type: 'request', text, via, ms: Math.round(performance.now() - t0), modelMs, calls, changes, errors, content, parseError });
  } catch (e) {
    pill('Error', 'error'); say(`Could not reach the model: ${e.message}`);
    hooks.assistant({ type: 'error', text, via, error: e.message });
  } finally {
    input.disabled = false; input.focus();
  }
}

$('#typed').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.value.trim() || e.target.readOnly) return; // read-only in the study: spoken requests only
  ask(e.target.value.trim(), $('#typed').dataset.via || 'typed'); e.target.value = ''; delete $('#typed').dataset.via;
});
$('#undoBtn').onclick = () => { daw.undo(); $('#undoBtn').disabled = true; $('#plan').append(li('Undone.', 'err')); hooks.assistant({ type: 'undo' }); };

// ---------- speaking a request: the browser's speech recognition fills the box as the person speaks. Listening goes
// on through pauses (the browser ends a recognition session after a pause, so a new one is started, adding to the text
// so far) until the mic is clicked again, which sends the request. ✕ clears it and keeps listening, to start over;
// Enter sends it at once ----------
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Speech) {
  const mic = $('#micBtn'), cancel = $('#micCancel'), box = $('#typed'), rec = new Speech();
  rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
  let want = false, send = false, base = ''; // listening wanted; send when this session ends; text from earlier sessions
  const join = (a, b) => (a && b ? `${a.trimEnd()} ${b.trimStart()}` : a || b);
  const listen = () => { base = box.value; try { rec.start(); } catch {} };
  const show = on => { want = on; mic.classList.toggle('on', on); cancel.hidden = !on; };
  mic.hidden = false;
  mic.onclick = () => {
    if (!want) { show(true); box.value = ''; listen(); mic.classList.remove('pulse'); hooks.assistant({ type: 'mic', action: 'start' }); }
    else { show(false); send = true; rec.stop(); } // the last words arrive before the session ends, then it is sent
  };
  cancel.onclick = () => { box.value = ''; base = ''; rec.abort(); hooks.assistant({ type: 'mic', action: 'start over' }); }; // still wanted: onend listens again
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && want && !box.readOnly) { show(false); rec.abort(); } }, true);
  rec.onend = () => {
    if (want) return listen();
    if (send && box.value.trim()) { const text = box.value.trim(); box.value = ''; delete box.dataset.via; ask(text, 'voice'); }
    else box.focus();
    send = false;
  };
  rec.onresult = e => { box.value = join(base, [...e.results].map(r => r[0].transcript).join('')); box.dataset.via = 'voice'; };
  // a failure that listening again won't fix is shown and stops it: a blocked microphone, none found, or no
  // connection to the browser's speech service. Silence just keeps listening.
  const why = { 'not-allowed': 'The microphone is blocked. Click the icon at the left of the address bar to allow it (on a Mac, Chrome also needs it in System Settings > Privacy & Security > Microphone).',
    'service-not-allowed': 'The browser does not allow speech recognition here.', 'audio-capture': 'No microphone was found.', network: 'Speech recognition needs an internet connection to Google and could not reach it.' };
  rec.onerror = e => {
    hooks.assistant({ type: 'mic error', error: e.error });
    if (!why[e.error]) return;
    show(false); send = false; say(`Voice input stopped: ${why[e.error]}`);
  };
}
