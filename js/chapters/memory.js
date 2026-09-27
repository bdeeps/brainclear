// Chapter 5: memory and sleep. The hippocampus tags new experiences while you are awake; during
// deep (N3) sleep and spindle-rich N2 it replays them to the cortex, which stores them for the long
// term (systems consolidation: Diekelmann & Born 2010, Nat Rev Neurosci 11:114). The board shows an
// idealised night's hypnogram (about 90-minute cycles, deep sleep early, more REM late: Carskadon &
// Dement, "Normal human sleep", in Principles and Practice of Sleep Medicine; NINDS "Brain Basics:
// Understanding Sleep") and a synthetic EEG with each stage's textbook features (AASM scoring manual):
// awake alpha 8–12 Hz, N1 theta 4–7 Hz, N2 spindles 11–16 Hz and K-complexes, N3 delta 0.5–2 Hz over
// 75 µV, REM low-voltage mixed waves with sawtooth waves.
import { THREE, M, swarm, canvasTexture, clamp, lerp, smooth, approach } from '../kit.js';
import { makeBrain, board, tint } from '../brain.js';

// [start minute, stage] for an idealised 8-hour night. Totals: N1 ~3%, N2 ~47%, N3 ~18%, REM ~25%.
const NIGHT = [[0, 'W'], [3, 'N1'], [10, 'N2'], [25, 'N3'], [65, 'N2'], [78, 'REM'], [90, 'N2'], [108, 'N3'], [140, 'N2'], [160, 'REM'], [180, 'N2'], [200, 'N3'], [215, 'N2'], [245, 'REM'], [270, 'N2'], [325, 'REM'], [355, 'N1'], [360, 'N2'], [400, 'REM'], [435, 'N2'], [470, 'W'], [480, 'W']];
const DEPTH = { W: 0, REM: 1, N1: 2, N2: 3, N3: 4 };
const NAME = { W: 'Awake', N1: 'N1: dozing off', N2: 'N2: light sleep', N3: 'N3: deep sleep', REM: 'REM: dreaming sleep' };
const WHAT = {
  W: 'Awake and learning. The hippocampus quickly tags what you see and hear as a new memory.',
  N1: 'Drifting off. Brain waves slow down. Easy to wake, and you may feel a sudden jerk.',
  N2: 'Light sleep. Bursts called sleep spindles help move new memories into the cortex.',
  N3: 'Deep, slow-wave sleep. Big slow waves sweep the cortex while the hippocampus replays the day.',
  REM: 'Dreaming sleep. The brain is nearly as active as awake, the eyes dart, and the body’s muscles go limp.',
};
export const stageAt = (min) => { if (min < 0) return 'W'; let s = 'W'; for (const [t, st] of NIGHT) { if (min >= t) s = st; else break; } return s; };

// Synthetic EEG (µV) at time t (s) for a stage. Deterministic: sums of sines with fixed phases.
function eeg(t, st) {
  const n = (f, p) => Math.sin(2 * Math.PI * f * t + p);
  const noise = 6 * n(23, 1) + 5 * n(31, 2) + 4 * n(17.3, 0.3);
  if (st === 'W') return 26 * n(10, 0) * (0.7 + 0.3 * n(0.4, 1)) + noise;
  if (st === 'N1') return 38 * n(5.5, 0.5) + 14 * n(3.3, 2) + noise * 0.8;
  if (st === 'N2') {
    const ph = t % 3.3, spindle = ph > 0.6 && ph < 1.6 ? Math.sin(Math.PI * (ph - 0.6)) : 0;
    const kc = t % 6.1, K = kc > 3.5 && kc < 4.3 ? -120 * Math.sin(Math.PI * (kc - 3.5) / 0.35) * (kc < 3.85 ? 1 : -0.6) : 0;
    return 28 * n(5, 0.2) + 12 * n(3, 1) + 40 * spindle * n(13, 0) + K + noise * 0.6;
  }
  if (st === 'N3') return 95 * n(1, 0.4) + 45 * n(1.7, 2) + 16 * n(4.5, 1) + noise * 0.5;
  // REM: low-voltage mixed frequency with sawtooth bursts
  const saw = (t % 5) < 1.6 ? 22 * (((t * 3.5) % 1) - 0.5) * 2 : 0;
  return 14 * n(6, 1) + 10 * n(9, 0.5) + saw + noise;
}

function drawSleep(g, w, h, st) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
  const L = 110, R = w - 24;
  // hypnogram
  const T = 60, H = 170, X = (m) => L + (m / 480) * (R - L), Y = (s) => T + (DEPTH[s] / 4) * H;
  g.fillStyle = '#e8eef8'; g.font = 'bold 24px sans-serif'; g.fillText('One night of sleep: about five 90-minute cycles', L, 36);
  g.font = '17px sans-serif';
  for (const s of ['W', 'REM', 'N1', 'N2', 'N3']) { g.fillStyle = s === 'REM' ? '#ff8fc4' : s === 'N3' ? '#6fa8ff' : 'rgba(255,255,255,.6)'; g.fillText(s === 'W' ? 'Awake' : s, 16, Y(s) + 6); g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(L, Y(s)); g.lineTo(R, Y(s)); g.stroke(); }
  for (let hr = 0; hr <= 8; hr++) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillText(hr + 'h', X(hr * 60) - 8, T + H + 24); }
  g.lineWidth = 4;
  for (let i = 0; i < NIGHT.length - 1; i++) {
    const [a, s] = NIGHT[i], b = NIGHT[i + 1][0];
    g.strokeStyle = s === 'REM' ? '#ff8fc4' : s === 'N3' ? '#6fa8ff' : '#9fb3c8';
    g.beginPath(); g.moveTo(X(a), Y(s)); g.lineTo(X(b), Y(s)); if (i < NIGHT.length - 2) g.lineTo(X(b), Y(NIGHT[i + 1][1])); g.stroke();
  }
  const cm = clamp(st.min, 0, 480);
  g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(cm), T - 10); g.lineTo(X(cm), T + H + 6); g.stroke();
  // EEG
  const E0 = T + H + 60, EH = h - E0 - 20, mid = E0 + EH / 2;
  g.fillStyle = '#e8eef8'; g.font = 'bold 22px sans-serif'; g.fillText(`Brain waves (EEG), 10 seconds: ${NAME[st.stage]}`, L, E0 - 8);
  g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.beginPath(); g.moveTo(L, mid); g.lineTo(R, mid); g.stroke();
  g.strokeStyle = st.stage === 'REM' ? '#ff8fc4' : st.stage === 'N3' ? '#6fa8ff' : '#5ce1a9'; g.lineWidth = 2.2; g.beginPath();
  for (let i = 0; i <= 900; i++) { const x = L + (i / 900) * (R - L), tt = st.t0 + (i / 900) * 10; const y = mid - eeg(tt, st.stage) * (EH / 360); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  // 100 µV scale bar
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(60, mid - 50 * (EH / 360)); g.lineTo(60, mid + 50 * (EH / 360)); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '15px sans-serif'; g.fillText('100 µV', 14, mid + 50 * (EH / 360) + 18);
}

export default {
  id: 'memory',
  short: 'Memory and sleep',
  title: 'How memories are made',
  subtitle: 'A seahorse-shaped sorter by day, a replay machine by night.',
  view: { pos: [0.6, 3.6, 9.4], target: [0.3, 2.9, 0] },
  learn: `<p><b>Short-term memory</b> holds only a handful of things, about four to seven, for seconds, like a phone number you are about to dial. <b>Long-term memory</b> can last a lifetime. Getting from one to the other depends on the <b>hippocampus</b>, a curved strip deep in each temporal lobe.</p>
    <p>We know this partly thanks to one man. In <b>1953</b>, <b>Henry Molaison</b>, known for decades only as <b>“H.M.”</b>, had surgery to treat severe epilepsy. Surgeons removed much of both hippocampi. His seizures eased, but he could no longer form new long-term memories of events and facts. He could still chat, remember his childhood and even learn new skills, such as drawing in a mirror, without remembering the lessons. The psychologist <b>Brenda Milner</b> and others studied him with his cooperation for over 50 years. His case showed that memory has separate systems, and that the hippocampus is key to making new ones.</p>
    <p>Much of this work happens while you <b>sleep</b>. A night runs in cycles of about <b>90 minutes</b>: light <b>N1</b> and <b>N2</b>, deep slow-wave <b>N3</b>, then dreaming <b>REM</b> sleep. Deep sleep comes mostly early in the night and REM mostly late. During N3 and the <b>sleep spindles</b> of N2, the hippocampus <b>replays</b> the day and the cortex files it away. That is why a good night’s sleep after studying helps you remember.</p>
    <p class="tip"><b>Try it:</b> press play and watch memories flow into the hippocampus in the evening, then back out to the cortex in deep sleep. Compare the EEG of deep sleep and REM.</p>`,
  terms: [
    { t: 'Short-term memory', d: 'Holding a few items in mind for seconds, like a number you are about to dial.' },
    { t: 'Long-term memory', d: 'Memories stored for days to a lifetime, spread across the cortex.' },
    { t: 'Consolidation', d: 'The process, much of it during sleep, that turns a fragile new memory into a lasting one.' },
    { t: 'EEG', d: 'Electroencephalogram: brain waves recorded from electrodes on the scalp.' },
    { t: 'Slow-wave sleep', d: 'Deep N3 sleep, with big slow brain waves of about 0.5–2 per second.' },
    { t: 'REM sleep', d: 'Rapid eye movement sleep: the brain is busy and vivid dreams are common, while the body’s muscles are relaxed.' },
  ],
  defaults: { hour: -0.6, play: true },
  controls: [
    { key: 'hour', type: 'range', label: 'Time of night', min: -1, max: 8, step: 0.01, ends: ['evening', '8 hours'], fmt: (v) => (v < 0 ? 'evening, awake' : `${Math.floor(v)} h ${String(Math.round((v % 1) * 60)).padStart(2, '0')} min asleep`) },
    { key: 'play', type: 'toggle', label: 'Play the night' },
  ],
  quiz: [
    { q: 'What happened to H.M. after his hippocampi were removed?', options: ['He lost all his old memories', 'He could not form new long-term memories of events', 'He could not speak', 'He could not see'], answer: 1, why: 'His old memories and skills stayed, but new events and facts faded within minutes. It showed the hippocampus is key for making new memories.' },
    { q: 'How long is one sleep cycle, roughly?', options: ['10 minutes', '90 minutes', '4 hours', 'The whole night'], answer: 1, why: 'A night has about four to six cycles of roughly 90 minutes, each passing through light, deep and REM sleep.' },
    { q: 'When is most deep (N3) sleep?', options: ['Early in the night', 'Just before waking', 'Evenly all night', 'Only in naps'], answer: 0, why: 'Deep slow-wave sleep dominates the first cycles; REM grows longer towards morning.' },
  ],
  reel: [
    { ms: 5600, caption: 'Awake, the hippocampus tags new memories. In deep sleep, it replays them to the cortex.', set: { play: false }, anim: { hour: [-0.8, 0.7] }, spin: 0.2 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.set(1.7, 3.55, 0); root.scale.setScalar(0.9); stage.root.add(root);
    const brain = makeBrain(stage, { labels: false });
    root.add(brain.root);
    brain.setXray(0.85); brain.highlight('hippocampus', 1.4);
    brain.deepParts.forEach((m) => { if (m.userData.id !== 'hippocampus' && m.userData.id !== 'callosum') { m.material.transparent = true; m.material.opacity = 0.28; m.material.depthWrite = false; } });
    const L = (t, p, cls) => tint(stage.label(t, p, root), cls);
    const hipL = L('Hippocampus', [0.45, -0.95, 1.2], '#ffe066');
    const stL = L('', [0.2, 2.2, 0], 'gold');
    // memory "packets" moving between cortex and hippocampus
    const CORT = [[1.9, 0.2, 1.1], [0.1, -0.35, 1.6], [-1.4, 0.9, 1.1], [0.6, 1.3, 1.2], [-0.6, 1.4, 0.9], [1.3, 0.9, 1.1]].map((p) => new THREE.Vector3(...p));
    const HIP = new THREE.Vector3(0.3, -0.55, 0.65);
    const paths = CORT.map((c) => new THREE.QuadraticBezierCurve3(c, c.clone().lerp(HIP, 0.5).add(new THREE.Vector3(0, 0.5, 0)), HIP));
    const NP = 60;
    const dots = swarm(NP, new THREE.SphereGeometry(0.055, 10, 8), M.glow(0xffe066));
    root.add(dots);
    const st = { min: 0, stage: 'W', t0: 0 };
    const chart = canvasTexture(1100, 520, (g, w, h) => drawSleep(g, w, h, st));
    const bd = board(chart, 5.0, 2.36); bd.position.set(-2.0, 1.45, 0.5); stage.root.add(bd);
    let acc = 0, eegT = 0, flowT = 0, dir = 1, amt = 1;
    const tmp = new THREE.Vector3();
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.play) { s.hour += dt / 3.2; if (s.hour > 8) s.hour = -1; }     // one hour of night every 3.2 s
        const min = s.hour * 60, sg = stageAt(min);
        st.min = min; st.stage = sg;
        eegT += dt * 0.6; st.t0 = eegT;
        // direction and strength of the memory flow
        const want = sg === 'W' ? (s.hour < 0 ? 1 : 0.3) : sg === 'N3' ? 1 : sg === 'N2' ? 0.6 : sg === 'REM' ? 0.25 : 0.1;
        dir = sg === 'W' ? 1 : -1;                                              // +1 cortex → hippocampus (encoding), −1 back out (replay)
        amt = approach(amt, want, 3, dt);
        flowT += dt * (sg === 'N3' ? 0.5 : 0.35);
        for (let i = 0; i < NP; i++) {
          const p = paths[i % paths.length];
          let u = ((flowT + i * 0.137) % 1);
          if (dir < 0) u = 1 - u;
          p.getPoint(u, tmp);
          const vis = ((i * 7) % 10) / 10 < amt;
          dots.place(i, [tmp.x, tmp.y, tmp.z], null, vis ? 1 : 0.001);
        }
        dots.done();
        dots.material.color.set(sg === 'REM' ? 0xff8fc4 : sg === 'W' ? 0xffe066 : 0x8fb8ff);
        // slow waves: the whole cortex pulses gently in N3
        brain.highlight('hippocampus', 1 + (sg === 'N3' ? 0.5 * Math.sin(eegT * 2 * Math.PI * 0.6) : 0));
        stL.element.innerHTML = `<b>${NAME[sg]}</b>`;
        const narrow = stage.host.clientWidth < 560; hipL.visible = true; stL.visible = !narrow;
        root.position.set(narrow ? 0.3 : 1.7, narrow ? 3.0 : 3.55, 0); root.scale.setScalar(narrow ? 0.75 : 0.9);   // phones: stack the brain above the board
        bd.position.set(narrow ? 0.3 : -2.0, narrow ? 1.05 : 1.45, 0.5); bd.scale.setScalar(narrow ? 0.85 : 1);
        acc += dt; if (acc > 1 / 20) { acc = 0; chart.redraw(); }
      },
      readout: (s) => {
        const sg = stageAt(s.hour * 60), cyc = s.hour < 0 ? '' : ` · cycle ${Math.min(5, Math.floor((s.hour * 60) / 90) + 1)}`;
        return `<div class="big">${NAME[sg]}${cyc}</div><small style="display:block;max-width:310px">${WHAT[sg]}</small>
          <div class="row"><span>Cycle length</span><b>about 90 min</b></div>
          <div class="row"><span>Adults need</span><b>about 7–9 hours</b></div>`;
      },
    };
  },
};
