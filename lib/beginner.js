// Trial generator for the Assignment 3 study, whose participants have never used a DAW. Each trial is one job a
// producer really does, in a few steps that can each take several clicks: set up tracks to record a drum kit, make
// the vocal sit on top of the band, spread two guitars left and right, put the usual effects on each instrument,
// tidy the session. Settings follow common practice (reverb on vocals and strings, compression on drums, bass and
// vocals, backing vocals below the lead), every value is stated outright, instruments have everyday names and only
// three effects are used (Reverb, Delay, Compressor), so a beginner can reach the one correct result by mouse.
// A third of the trials are hard: one step needs reading the session (a track described rather than named, a value
// relative to another track, two tracks sharing a name, or a track the request itself creates).
import { applyCalls, diff, clone, rng, score } from './core.js';
import { session } from './dataset.js';
import { deviceDefaults } from './catalog.js';

// The starting tracks, in band order: name, the clip sound it plays, color, role.
const START = [
  ['Drums', 'kick', '#ff8f3d', 'rhythm'], ['Percussion', 'shaker', '#9bd96b', 'rhythm'], ['Bass', 'bass', '#3fd1a2', 'rhythm'],
  ['Guitar', 'arp', '#7f9cf5', 'band'], ['Piano', 'keys', '#47c1f0', 'band'], ['Organ', 'pad', '#8d8cf5', 'band'],
  ['Strings', 'pad', '#a08cf0', 'band'], ['Flute', 'lead', '#f59ad0', 'band'], ['Vocals', 'lead', '#f27ac6', 'vocal'], ['Backing Vocals', 'choir', '#d6a6f2', 'vocal'],
];
const ROLE = Object.fromEntries(START.map(([n, , , r]) => [n, r]));
// A drum kit recorded with a mic on each drum, as drums are usually mixed; it replaces the single Drums track.
const KIT = [['Kick Drum', 'kick', '#ff8f3d'], ['Snare Drum', 'snare', '#ffd23f'], ['Hi-Hat', 'hats', '#b8e05a'], ['Toms', 'perc', '#e0c35a'], ['Cymbals', 'clap', '#ffb35c']];
// What a producer adds to record a new part: what it is called in speech, the tracks, and the effect it usually gets.
const RECORD = [
  ['a drum kit', ['Kick Drum', 'Snare Drum', 'Hi-Hat', 'Cymbals', 'Toms'], ['Compressor', ['Kick Drum', 'Snare Drum']]],
  ['a choir', ['Soprano', 'Alto', 'Tenor', 'Bass Voice'], ['Reverb', null]],
  ['a horn section', ['Trumpet', 'Trombone', 'Saxophone'], ['Reverb', null]],
  ['a string quartet', ['Violin 1', 'Violin 2', 'Viola', 'Cello'], ['Reverb', null]],
  ['two guitars', ['Lead Guitar', 'Rhythm Guitar'], ['Delay', ['Lead Guitar']]],
];
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five'];

function tools(R) {
  const pick = a => a[Math.floor(R() * a.length)], int = (a, b) => a + Math.floor(R() * (b - a + 1)), chance = p => R() < p;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const list = a => (a.length === 1 ? a[0] : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);
  return { pick, int, chance, shuffle, list };
}
const call = (name, args) => ({ name, arguments: args });
const side = p => `${Math.abs(p)} ${p < 0 ? 'left' : 'right'}`;
// a step: plain and casual wording, the tool calls, and whether it is the hard step
const step = (plain, casual, calls, hard = false) => ({ text: [plain, casual], calls, hard });

// The starting session: 4-6 tracks of a band, with the mix settings of a random session and only the three study
// effects on them.
function startSession(R, need = [], kit = false) {
  const { int, shuffle } = tools(R);
  const s = session(R, 'random');
  const k = int(4, 6), rest = shuffle(START.filter(x => !need.includes(x[0]) && !(kit && ROLE[x[0]] === 'rhythm' && x[0] !== 'Bass')));
  let rows = [...START.filter(x => need.includes(x[0])), ...rest].slice(0, Math.max(k, need.length)).sort((a, b) => START.indexOf(a) - START.indexOf(b));
  if (kit) rows = [...KIT.slice(0, int(3, 5)), ...rows.slice(0, int(2, 3))];
  s.tracks = s.tracks.slice(0, rows.length);
  while (s.tracks.length < rows.length) s.tracks.push(clone(s.tracks[0]));
  s.tracks.forEach((t, i) => {
    const [name, sound, color] = rows[i];
    Object.assign(t, { id: `T${i + 1}`, name, color, on: true, solo: false, arm: false, devices: t.devices.filter(d => ['Compressor', 'Reverb', 'Delay'].includes(d.type)) });
    t.clips.forEach(c => Object.assign(c, { name, sound }));
  });
  s.transport = 'stopped';
  return s;
}
const has = (s, n) => s.tracks.find(t => t.name === n);
const fx = (t, type) => t.devices.some(d => d.type === type);

// Scenarios. Each takes the session (it may adjust it so the job makes sense, e.g. mute a track to bring back) and
// whether the trial is hard, and returns its steps, or null when the session doesn't suit it. challenge names the
// kind of hard step the scenario can provide.
function scenarios(R) {
  const { pick, int, chance, shuffle, list } = tools(R);
  return {
    // "Set the tempo to 100 and add tracks for a drum kit called ..., arm them, compress the kick and snare"
    recordingSetup: {
      challenge: 'refers to its own new track',
      make(s, hard) {
        const [what, all, [effect, on]] = pick(RECORD), names = all.slice(0, Math.min(hard ? 3 : 4, Math.max(2, all.length - int(0, 1))));
        if (names.some(n => has(s, n))) return null;
        const bpm = 5 * int(16, 28), k = NUM[names.length], steps = [];
        if (Math.abs(bpm - s.tempo) >= 5) steps.push(step(`Set tempo to ${bpm} BPM`, `change the tempo to ${bpm}`, [call('set_tempo', { bpm })]));
        steps.push(step(`add ${k} new tracks named ${list(names)}`, `add ${k} tracks for ${what}: ${list(names)}`, names.map(name => call('insert_track', { name }))));
        if (hard) {
          // the request refers to the new tracks by what they are, not by name
          const fxOn = names;
          steps.push(step(`add ${effect} to each new track`, `put a ${effect} on all the tracks you just made`, fxOn.map(track => call('add_effect', { track, effect })), true));
        } else if (on) {
          steps.push(step(`add ${effect} to ${list(on)}`, `put a ${effect} on ${list(on)}`, on.map(track => call('add_effect', { track, effect }))));
        } else {
          // an ensemble is panned the way it sits on stage: first part left, last part right
          const [l, r] = [names[0], names.at(-1)], p = pick([20, 30]);
          steps.push(step(`pan ${l} ${side(-p)} and ${r} ${side(p)}`, `spread them out like on stage, ${l} ${p} to the left and ${r} ${p} to the right`, [call('set_pan', { track: l, pan: -p }), call('set_pan', { track: r, pan: p })]));
        }
        if (!hard && names.length <= 3 && chance(0.6)) steps.push(step(`arm ${list(names)} for recording`, `get ${names.length > 2 ? 'all of them' : 'both'} ready to record`, names.map(track => call('set_arm', { track, armed: true }))));
        return steps;
      },
    },
    // "The vocal is getting lost: bring Vocals up, turn the Guitar down, put some Reverb on the vocal"
    vocalBalance: {
      challenge: 'relative to another track',
      make(s, hard) {
        const v = has(s, 'Vocals'), others = s.tracks.filter(t => ROLE[t.name] === 'band');
        if (!v || !others.length) return null;
        const o = pick(others), vv = pick([-4, -5, -6]), ov = pick([-12, -14, -16]), steps = [];
        v.vol = Math.min(v.vol, vv - 4); o.vol = Math.max(o.vol, ov + 4); // the vocal really is buried
        steps.push(step(`Set Vocals volume to ${vv} dB`, `the vocal is getting lost, bring Vocals up to ${vv} dB`, [call('set_volume', { track: 'Vocals', db: vv })]));
        steps.push(step(`set ${o.name} volume to ${ov} dB`, `pull ${o.name} down to ${ov} dB so it doesn't cover the voice`, [call('set_volume', { track: o.name, db: ov })]));
        const b = has(s, 'Backing Vocals');
        if (hard) {
          if (!b) return null;
          const d = pick([4, 6, 8]), bv = vv - d;
          if (Math.abs(b.vol - bv) < 2) b.vol = bv - 5;
          steps.push(step(`set Backing Vocals volume ${d} dB below the new Vocals volume`, `the backing vocals should sit ${d} dB under the lead vocal`, [call('set_volume', { track: 'Backing Vocals', db: bv })], true));
        }
        if (!fx(v, 'Reverb') && (!hard || chance(0.5))) steps.push(step('add Reverb to Vocals', 'put a Reverb on the vocal', [call('add_effect', { track: 'Vocals', effect: 'Reverb' })]));
        return steps;
      },
    },
    // "Spread the guitar and piano out: Guitar 30 left, Piano 30 right"
    stereoSpread: {
      challenge: 'relative to another track',
      make(s, hard) {
        const ts = shuffle(s.tracks.filter(t => !['Drums', 'Bass', 'Vocals'].includes(t.name)));
        if (ts.length < 2) return null;
        const [a, b] = ts.slice(0, 2).sort((x, y) => s.tracks.indexOf(x) - s.tracks.indexOf(y)), p = pick([20, 30, 40]), steps = [];
        a.pan = 0; b.pan = 0; // both start in the middle, fighting for space
        steps.push(step(`Pan ${a.name} ${side(-p)}`, `${a.name} and ${b.name} are on top of each other, move ${a.name} ${p} to the left`, [call('set_pan', { track: a.name, pan: -p })]));
        if (hard) steps.push(step(`pan ${b.name} the same amount to the right`, `put ${b.name} on the other side, same distance`, [call('set_pan', { track: b.name, pan: p })], true));
        else steps.push(step(`pan ${b.name} ${side(p)}`, `move ${b.name} ${p} to the right`, [call('set_pan', { track: b.name, pan: p })]));
        const bass = has(s, 'Bass') ?? has(s, 'Drums');
        if (bass && chance(0.6)) { bass.pan = pick([-20, 20]); steps.push(step(`center ${bass.name}`, `keep ${bass.name} in the middle`, [call('set_pan', { track: bass.name, pan: 0 })])); }
        return steps;
      },
    },
    // "Usual effects: compress the drums and bass, reverb on the strings, delay on the flute"
    effectsPass: {
      challenge: 'described track',
      make(s, hard) {
        const usual = { Drums: 'Compressor', Bass: 'Compressor', Vocals: 'Compressor', Strings: 'Reverb', Piano: 'Reverb', Organ: 'Reverb', 'Backing Vocals': 'Reverb', Guitar: 'Delay', Flute: 'Delay' };
        const want = shuffle(s.tracks.filter(t => usual[t.name] && !fx(t, usual[t.name])));
        if (want.length < 2) return null;
        const steps = [];
        if (hard) {
          // a track named by what is on it rather than by name
          const t = want.pop(), e = usual[t.name], later = want.slice(0, 2).map(o => usual[o.name]);
          const marks = ['Delay', 'Compressor', 'Reverb'].filter(x => x !== e && !later.includes(x));
          if (!marks.length) return null;
          const mark = pick(marks);
          s.tracks.forEach(o => (o.devices = o.devices.filter(d => d.type !== mark)));
          t.devices = [{ id: `hd${t.id}`, type: mark, on: true, params: deviceDefaults(mark) }];
          steps.push(step(`add ${e} to the track that has ${mark}`, `the track with the ${mark} needs a ${e} too`, [call('add_effect', { track: t.name, effect: e })], true));
        }
        const by = {};
        for (const t of want.slice(0, hard ? 2 : 3)) (by[usual[t.name]] ??= []).push(t.name);
        for (const [e, ns] of Object.entries(by)) steps.push(step(`add ${e} to ${list(ns)}`, `put a ${e} on ${list(ns)}`, ns.map(track => call('add_effect', { track, effect: e }))));
        steps[0].text = steps[0].text.map(x => x[0].toUpperCase() + x.slice(1));
        return steps;
      },
    },
    // "Mute the Organ for now, rename Guitar to Rhythm Guitar, delete the empty track"
    tidyUp: {
      challenge: 'described track',
      make(s, hard) {
        const core = ['Drums', 'Bass', 'Vocals', ...KIT.map(k => k[0])], extra = shuffle(s.tracks.filter(t => !core.includes(t.name))), steps = [];
        if (extra.length < 2 || s.tracks.length < 4) return null;
        const [m, d] = extra, rs = s.tracks.filter(t => t !== m && t !== d && ROLE[t.name]);
        if (!rs.length) return null;
        const r = pick(rs);
        if (hard) {
          d.clips = []; // the empty track, left over from an earlier take
          steps.push(step('Delete the track with no clips', 'get rid of the track that has nothing on it', [call('delete_track', { track: d.name })], true));
        } else steps.push(step(`Delete track ${d.name}`, `we're not using ${d.name}, delete it`, [call('delete_track', { track: d.name })]));
        m.on = true;
        steps.push(step(`mute ${m.name}`, `mute ${m.name} for now, it clashes with the rest`, [call('set_mute', { track: m.name, muted: true })]));
        const n = { Guitar: 'Rhythm Guitar', Piano: 'Grand Piano', Vocals: 'Lead Vocals', Drums: 'Drum Kit', Strings: 'Violins', Bass: 'Bass Guitar', Organ: 'Church Organ', Flute: 'Flute Solo', Percussion: 'Shaker', 'Backing Vocals': 'Harmonies' }[r.name];
        if (chance(0.7)) steps.push(step(`rename ${r.name} to ${n}`, `call ${r.name} "${n}" so it's clearer`, [call('rename_track', { track: r.name, name: n })]));
        return steps;
      },
    },
    // "Check the groove: solo Drums and Bass" plus a tempo change
    // "The drums need work: compress the kick and snare, the hi-hat is too loud, a little room on the snare"
    drumMix: {
      challenge: 'relative to another track',
      kit: true,
      make(s, hard) {
        const kick = has(s, 'Kick Drum'), snare = has(s, 'Snare Drum'), hat = has(s, 'Hi-Hat'), toms = has(s, 'Toms'), steps = [];
        [kick, snare].forEach(t => (t.devices = t.devices.filter(d => d.type !== 'Compressor')));
        steps.push(step('Add Compressor to Kick Drum and Snare Drum', 'The kick and snare need more punch, put a Compressor on Kick Drum and Snare Drum', [call('add_effect', { track: 'Kick Drum', effect: 'Compressor' }), call('add_effect', { track: 'Snare Drum', effect: 'Compressor' })]));
        if (hard) {
          // the hi-hat is set against the snare, not to a number
          const d = pick([6, 8, 10]), v = snare.vol - d;
          hat.vol = Math.max(hat.vol, v + 4);
          steps.push(step(`set Hi-Hat volume ${d} dB below Snare Drum`, `the hi-hat is too loud, it should sit ${d} dB under the snare`, [call('set_volume', { track: 'Hi-Hat', db: v })], true));
        } else {
          const v = pick([-14, -16, -18]);
          hat.vol = Math.max(hat.vol, v + 4);
          steps.push(step(`set Hi-Hat volume to ${v} dB`, `the hi-hat is too loud, bring it down to ${v} dB`, [call('set_volume', { track: 'Hi-Hat', db: v })]));
        }
        const p = pick([20, 30]);
        hat.pan = 0; if (toms) toms.pan = 0;
        if (chance(0.5)) steps.push(step(toms ? `pan Hi-Hat ${side(p)} and Toms ${side(-p)}` : `pan Hi-Hat ${side(p)}`, toms ? `spread the kit: Hi-Hat ${p} to the right, Toms ${p} to the left` : `move the Hi-Hat ${p} to the right, like where it sits on the kit`,
          [call('set_pan', { track: 'Hi-Hat', pan: p }), ...(toms ? [call('set_pan', { track: 'Toms', pan: -p })] : [])]));
        else if (!fx(snare, 'Reverb')) steps.push(step('add Reverb to Snare Drum', 'give the snare some room, put a Reverb on it', [call('add_effect', { track: 'Snare Drum', effect: 'Reverb' })]));
        return steps;
      },
    },
    // "Add a shaker and a tambourine on top of the drums, one on each side, quieter than the kit"
    percussionLayer: {
      challenge: 'relative to another track',
      kit: true,
      make(s, hard) {
        const kick = has(s, 'Kick Drum'), p = pick([30, 40]), steps = [];
        steps.push(step('Add two new tracks named Shaker and Tambourine', 'add two percussion tracks on top of the drums, Shaker and Tambourine', [call('insert_track', { name: 'Shaker' }), call('insert_track', { name: 'Tambourine' })]));
        steps.push(step(`pan Shaker ${side(-p)} and Tambourine ${side(p)}`, `put the Shaker ${p} to the left and the Tambourine ${p} to the right`, [call('set_pan', { track: 'Shaker', pan: -p }), call('set_pan', { track: 'Tambourine', pan: p })]));
        if (hard) {
          const d = pick([8, 10, 12]), v = kick.vol - d;
          steps.push(step(`set Shaker and Tambourine volume ${d} dB below Kick Drum`, `keep them ${d} dB under the kick so they don't take over`, [call('set_volume', { track: 'Shaker', db: v }), call('set_volume', { track: 'Tambourine', db: v })], true));
        } else {
          const v = pick([-12, -15, -18]);
          steps.push(step(`set Shaker and Tambourine volume to ${v} dB`, `turn them both down to ${v} dB so they stay in the background`, [call('set_volume', { track: 'Shaker', db: v }), call('set_volume', { track: 'Tambourine', db: v })]));
        }
        return steps;
      },
    },
    grooveCheck: {
      challenge: 'same-name tracks',
      make(s, hard) {
        const dr = has(s, 'Drums'), b = has(s, 'Bass');
        if (!dr || !b) return null;
        const steps = [];
        if (hard) {
          // a second, empty Bass track from an abandoned take
          const copy = { ...clone(b), id: `T${s.tracks.length + 1}`, clips: [] };
          s.tracks.splice(s.tracks.indexOf(b) + (chance(0.5) ? 1 : 0), 0, copy);
          const label = `Bass #${s.tracks.filter(t => t.name === 'Bass').indexOf(copy) + 1}`;
          steps.push(step('Delete the Bass track that has no clips', 'there are two Bass tracks, get rid of the empty one', [call('delete_track', { track: label })], true));
        }
        const bpm = 5 * Math.round(s.tempo / 5) + pick([-10, -5, 5, 10]);
        steps.push(step(`Set tempo to ${bpm} BPM`, `${hard ? 'try' : 'Try'} it at ${bpm} BPM`, [call('set_tempo', { bpm })]));
        steps.push(step('solo Drums and Bass', 'let me hear just the Drums and Bass together', [call('set_solo', { track: 'Drums', soloed: true }), call('set_solo', { track: 'Bass', soloed: true })]));
        return steps;
      },
    },
  };
}

function sentence(R, texts, casual) {
  const { pick, chance } = tools(R);
  let body = texts.length === 1 ? texts[0] : pick(['list', 'then']) === 'then' ? texts.join(', then ') : `${texts.slice(0, -1).join(', ')} and ${texts.at(-1)}`;
  if (casual && chance(0.3)) body = `${pick(['Ok, ', 'Alright, '])}${START.some(([n]) => body.startsWith(n)) ? body[0] : body[0].toLowerCase()}${body.slice(1)}`; // a track name keeps its capital
  return `${body[0].toUpperCase()}${body.slice(1)}.`;
}

// One trial from the named scenario (hard or not). The steps run in order on the session; each must change it.
export function makeBeginnerTrial(R, id, name, hard = false) {
  const sc = scenarios(R)[name];
  const need = { vocalBalance: ['Vocals', ...(hard ? ['Backing Vocals'] : [])], grooveCheck: ['Drums', 'Bass'] }[name] ?? [];
  for (;;) {
    const s = startSession(R, need, sc.kit), work = clone(s), steps = sc.make(work, hard);
    if (!steps || steps.length < 2 || steps.length > 4 || (hard && !steps.some(x => x.hard))) continue;
    let cur = work, ok = true;
    for (const x of steps) {
      const { state, errors } = applyCalls(cur, x.calls);
      if (errors.length || !diff(cur, state).length) { ok = false; break; }
      cur = state;
    }
    if (!ok) continue;
    const casual = R() < 0.5, gt = steps.flatMap(x => x.calls);
    return {
      id, scenario: name, set: hard ? 'hard' : 'standard', challenge: hard ? sc.challenge : '', register: casual ? 'casual' : 'plain',
      n_steps: steps.length, n_calls: gt.length, instruction: sentence(R, steps.map(x => x.text[casual ? 1 : 0]), casual),
      tools: [...new Set(gt.map(c => c.name))].join('|'), initial: work, gt, target: cur,
    };
  }
}

// A study request: two producer jobs given at once (a batch of 5-9 changes), on one session, worded as a numbered list
// of commands. The hard job (if any)
// comes first, so what it describes ("the empty track", "the track with the Reverb") is read off the starting session.
// The two jobs touch different tracks and at most one of them sets the tempo.
const KIT_JOBS = ['drumMix', 'percussionLayer'];
const touched = steps => steps.flatMap(x => x.calls.map(c => c.arguments.track ?? c.arguments.name ?? (c.name === 'set_tempo' ? '#tempo' : '')));
export function makeStudyTrial(R, id, [a, b], hard = false, want = null) {
  const sc = scenarios(R), kit = KIT_JOBS.includes(a);
  const need = [...new Set([a, b].flatMap(n => ({ vocalBalance: ['Vocals', ...(hard && n === a ? ['Backing Vocals'] : [])], grooveCheck: ['Drums', 'Bass'] })[n] ?? []))];
  for (let tries = 0; tries < 20000; tries++) {
    const s = startSession(R, need, kit), work = clone(s), sa = sc[a].make(work, hard), sb = sa && sc[b].make(work, false);
    if (!sa || !sb || (hard && !sa.some(x => x.hard))) continue;
    const ta = touched(sa), tb = touched(sb);
    if (ta.some(x => tb.includes(x))) continue;
    const steps = [...sa, ...sb], gt = steps.flatMap(x => x.calls);
    if (gt.length < 5 || gt.length > 9 || steps.length > 6) continue;
    const tools = gt.map(c => c.name).sort().join('|');
    if (want && tools !== want) continue; // a matched version: the same kinds and number of changes
    let cur = work, ok = true;
    for (const x of steps) {
      const { state, errors } = applyCalls(cur, x.calls);
      if (errors.length || !diff(cur, state).length) { ok = false; break; }
      cur = state;
    }
    if (!ok) continue;
    return {
      id, scenario: `${a}+${b}`, set: hard ? 'hard' : 'standard', challenge: hard ? sc[a].challenge : '', register: 'mechanical',
      n_steps: steps.length, n_calls: gt.length, instruction: steps.map((x, i) => `${i + 1}. ${x.text[0][0].toUpperCase()}${x.text[0].slice(1)}`).join('\n'),
      tools, initial: work, gt, target: cur,
    };
  }
  return null;
}
// Job pairs that make sense together: a drum-kit job with another job on the same session, or two band jobs that don't
// trip over each other (a request that deletes "the empty track" next to one that adds new, empty tracks would be
// ambiguous).
const BAND_JOBS = ['recordingSetup', 'vocalBalance', 'stereoSpread', 'effectsPass', 'tidyUp', 'grooveCheck'];
const KIT_PAIRS = [['drumMix', 'percussionLayer'], ['drumMix', 'effectsPass'], ['percussionLayer', 'tidyUp'], ['drumMix', 'stereoSpread'], ['percussionLayer', 'drumMix'], ['drumMix', 'tidyUp']];
const PAIRS = [...KIT_PAIRS,
  ...BAND_JOBS.flatMap(a => BAND_JOBS.filter(b => b !== a).map(b => [a, b]))
    .filter(([a, b]) => !(a === 'tidyUp' && b === 'recordingSetup') && !(a === 'recordingSetup' && b === 'grooveCheck') && !(a === 'grooveCheck' && b === 'recordingSetup'))];
// The Assignment 3 study set: matched pairs of requests. Both requests of a pair combine the same two jobs, are
// equally hard and need the same kinds and number of changes, but use other tracks, names and values; a participant
// does one with the assistant and the other by hand. Every third pair is hard.
const MAX_SHARED = 2;
const commands = t => t.instruction.split('\n').map(l => l.replace(/^\d+\. /, ''));
const sharedLines = (a, b) => { const other = new Set(commands(b)); return commands(a).filter(l => other.has(l)).length; };
export function generateStudy(n = 24, seed = 3033) {
  const R = rng(seed), out = [], { shuffle } = tools(R);
  // every fourth pair is a drum-kit pair; the rest cycle through the band pairs in a shuffled order
  const band = shuffle(PAIRS.filter(([a]) => !KIT_JOBS.includes(a)));
  const order = Array.from({ length: n }, (_, i) => (i % 4 === 1 ? KIT_PAIRS[Math.floor(i / 4) % KIT_PAIRS.length] : band[i % band.length]));
  for (let i = 0; out.length < n; i++) {
    const jobs = order[out.length] ?? PAIRS[Math.floor(R() * PAIRS.length)], hard = out.length % 3 === 2, pid = `P${String(out.length + 1).padStart(2, '0')}`;
    // the two versions may share at most MAX_SHARED lines, so a participant isn't doing nearly the same task twice
    let A = null, B = null;
    for (let k = 0; k < 300 && !(B && sharedLines(A, B) <= MAX_SHARED); k++) {
      if (k % 30 === 0) A = makeStudyTrial(R, `${pid}a`, jobs, hard);
      B = A && makeStudyTrial(R, `${pid}b`, jobs, hard, A.tools);
    }
    if (!B || sharedLines(A, B) > MAX_SHARED) { order[out.length] = PAIRS[Math.floor(R() * PAIRS.length)]; continue; }
    out.push({ id: pid, scenario: A.scenario, set: A.set, n_calls: A.n_calls, versions: [A, B] });
  }
  return out;
}

export const SCENARIOS = ['recordingSetup', 'drumMix', 'vocalBalance', 'stereoSpread', 'percussionLayer', 'effectsPass', 'tidyUp', 'grooveCheck'];
// The study set: n trials, scenarios in rotation, every third trial hard.
export function generateBeginner(n = 60, seed = 3033) {
  const R = rng(seed);
  return Array.from({ length: n }, (_, i) => makeBeginnerTrial(R, `B${String(i + 1).padStart(3, '0')}`, SCENARIOS[i % SCENARIOS.length], Math.floor(i / SCENARIOS.length) % 3 === 2));
}

// Scores a participant's final session against the trial's target. What no request asks about (transport, playhead,
// loop, metronome, main volume, the colour of new tracks, track order, effect order) is taken from the target.
// Tracks that were in the session from the start keep their id in the app, so they are matched by id (a missed
// rename is one wrong name); tracks the participant added are matched to the requested new tracks by name, so adding
// them in another order or position is not an error.
export function scoreBeginner(t, final) {
  const fxSorted = s => { const c = clone(s); c.tracks.forEach(x => x.devices.sort((a, b) => a.type.localeCompare(b.type))); return c; };
  const target = fxSorted(t.target), initial = fxSorted(t.initial), p = fxSorted(final);
  Object.assign(p, { transport: target.transport, marker: target.marker, loop: clone(target.loop), metronome: target.metronome, main: clone(target.main) });
  const old = new Set(initial.tracks.map(x => x.id)), key = x => x.name.trim().toLowerCase();
  const wanted = target.tracks.filter(x => !old.has(x.id));
  let n = 0;
  for (const tr of p.tracks) {
    if (old.has(tr.id)) continue;
    const i = wanted.findIndex(x => key(x) === key(tr));
    if (i < 0) { tr.id = `X${++n}`; continue; }
    const want = wanted.splice(i, 1)[0];
    Object.assign(tr, { id: want.id, color: want.color }); // a new track's colour isn't part of the request
  }
  // track order is not part of any request: put the tracks in the target's order, anything else after
  const at = id => { const i = target.tracks.findIndex(x => x.id === id); return i < 0 ? Infinity : i; };
  p.tracks.sort((a, b) => at(a.id) - at(b.id));
  return score(initial, target, p, t.gt);
}
