// Chapter 2: one neuron and its spike. A leaky integrate-and-fire membrane (neuron.js) turns a
// steady input into spikes: nothing below threshold, full-size spikes above it, and more of them
// the harder you push (rate coding). Each spike runs down the axon, smoothly without myelin and
// jumping node to node with it.
import { THREE, M, swarm, canvasTexture, clamp, approach } from '../kit.js';
import { EP, Cell, rateFor, makeNeuron } from '../neuron.js';
import { board, tint } from '../brain.js';

const SLOW = 40;            // the model runs 40 times slower than life: 1 s on screen = 25 ms
const WIN = 100;            // ms of membrane voltage shown on the board

function drawTrace(g, w, h, st) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
  const L = 92, R = w - 24, T = 58, B = h - 44;
  const Y = (mv) => T + ((45 - mv) / 135) * (B - T);        // +45 mV at the top, −90 mV at the bottom
  g.font = '18px sans-serif'; g.lineWidth = 1;
  for (const [mv, lab, col] of [[40, '+40', 'rgba(255,255,255,.35)'], [0, '0 mV', 'rgba(255,255,255,.35)'], [-55, 'threshold −55', '#ffd166'], [-70, 'rest −70', '#9fb3c8']]) {
    g.strokeStyle = col; g.setLineDash(mv === -55 ? [8, 6] : []); g.beginPath(); g.moveTo(L, Y(mv)); g.lineTo(R, Y(mv)); g.stroke();
    g.fillStyle = col; g.fillText(lab, 8, Y(mv) + 6);
  }
  g.setLineDash([]);
  const buf = st.buf, n = buf.length;
  g.strokeStyle = '#5ce1a9'; g.lineWidth = 3.5; g.beginPath();
  for (let i = 0; i < n; i++) { const x = L + ((i + (st.len - n)) / st.len) * (R - L); const y = Y(buf[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = '#e8eef8'; g.font = 'bold 24px sans-serif';
  g.fillText('Voltage inside the cell body', L, 36);
  g.font = '18px sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(`last ${WIN} ms  ·  slowed ${SLOW}×`, R - 230, 36);
}

export default {
  id: 'neurons',
  short: 'Neurons and spikes',
  title: 'A neuron fires',
  subtitle: 'Tiny batteries, a trigger point, and a spike that races down a wire.',
  view: { pos: [0.5, 3.1, 9.4], target: [0.2, 3.3, 0] },
  learn: `<p>Your brain has about <b>86 billion neurons</b>, nerve cells that talk with electricity and chemicals. A neuron has branching <b>dendrites</b> that collect messages, a <b>cell body</b> (soma) that adds them up, and one long <b>axon</b> that sends the answer, sometimes over a metre, to its <b>axon terminals</b>.</p>
    <p>At rest, the inside of a neuron is about <b>−70 mV</b> compared with the outside, like a tiny battery. Pumps keep extra sodium (<b>Na⁺</b>) outside and potassium (<b>K⁺</b>) inside. When inputs nudge the voltage up to the <b>threshold</b>, about <b>−55 mV</b>, sodium gates snap open, Na⁺ floods in and the voltage shoots to about <b>+35 mV</b>. Then potassium gates open, K⁺ flows out, and the cell resets. That 1 to 2 millisecond blip is an <b>action potential</b>, or spike. For how voltage and current work, see <a href="/ohmslawclear/">OhmsLawClear</a>.</p>
    <p>Spikes are <b>all-or-nothing</b>: a weak push that misses threshold does nothing, and a strong push gives the same-sized spike. So how does a neuron say “strong”? It fires <b>more often</b>. That is <b>rate coding</b>.</p>
    <p>Many axons are wrapped in <b>myelin</b>, a fatty insulation with small gaps called <b>nodes of Ranvier</b>. The spike jumps from node to node (<b>saltatory conduction</b>), reaching up to about <b>120 m/s</b>. Bare axons manage about <b>1 m/s</b>. In multiple sclerosis, the immune system damages myelin, which is why signals slow or fail.</p>
    <p class="tip"><b>Try it:</b> slide the input slowly up from zero. Nothing, nothing, then a full spike. Push harder and watch the spikes crowd together, but never grow taller. Then switch myelin off.</p>`,
  terms: [
    { t: 'Neuron', d: 'A nerve cell. It receives signals on its dendrites and sends them along its axon.' },
    { t: 'Resting potential', d: 'The voltage inside a quiet neuron, about −70 mV, kept up by ion pumps.' },
    { t: 'Threshold', d: 'The voltage, about −55 mV, at which a neuron fires a spike.' },
    { t: 'Action potential', d: 'A spike: a 1–2 ms flip of the membrane voltage to about +35 mV and back, as Na⁺ rushes in and K⁺ flows out.' },
    { t: 'Rate coding', d: 'Signalling “more” by firing spikes more often, since each spike is the same size.' },
    { t: 'Myelin', d: 'Fatty insulation wrapped round many axons. It makes spikes travel up to about 100 times faster.' },
    { t: 'Node of Ranvier', d: 'A tiny gap in the myelin where the spike is regenerated before jumping to the next node.' },
  ],
  defaults: { stim: 22, myelin: true },
  controls: [
    { key: 'stim', type: 'range', label: 'Input strength', min: 0, max: 32, step: 0.5, ends: ['none', 'strong'], fmt: (v) => (v <= EP.thresh - EP.rest ? `+${v.toFixed(1)} mV: below threshold` : `+${v.toFixed(1)} mV: ${Math.round(rateFor(v))} spikes/s`) },
    { key: 'myelin', type: 'toggle', label: 'Myelin wrapping' },
  ],
  quiz: [
    { q: 'What happens if the input only pushes a neuron to −60 mV?', options: ['A small spike', 'Nothing: it is below the −55 mV threshold', 'A spike twice as big', 'The neuron dies'], answer: 1, why: 'Spikes are all-or-nothing. Below threshold there is no spike at all.' },
    { q: 'How does a neuron signal a stronger stimulus?', options: ['Taller spikes', 'Fires spikes more often', 'Uses a different ion', 'Changes colour'], answer: 1, why: 'Every spike is the same size, so strength is coded in how often it fires: rate coding.' },
    { q: 'Why does myelin speed up signals?', options: ['It adds more sodium', 'The spike jumps between gaps in it, the nodes of Ranvier', 'It makes the axon shorter', 'It cools the axon'], answer: 1, why: 'Insulated stretches carry the charge quickly and the spike is only rebuilt at the nodes: saltatory conduction, up to about 120 m/s.' },
  ],
  reel: [
    { ms: 5600, caption: 'A neuron rests at −70 mV. Push it past −55 mV and it fires an all-or-nothing spike.', set: { myelin: true }, anim: { stim: [14, 18] }, spin: 0 },
    { ms: 5200, caption: 'A stronger push means more spikes, not bigger ones, racing down a myelin-wrapped axon.', set: { myelin: true }, anim: { stim: [18, 31] }, view: { pos: [2.6, 3.4, 6.6], target: [1.7, 2.6, 0] }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.set(1.0, 3.05, 0); stage.root.add(root);
    const n = makeNeuron(); root.add(n.root);
    const L = (t, p, cls) => tint(stage.label(t, p, root), cls);
    const labs = [
      L('Dendrites: inputs', [-5.0, -0.3, 0]), L('Cell body', [-3.1, -0.75, 0]), L('Axon', [-1.1, -0.45, 0]),
      L('Myelin', [0.7, 0.45, 0]), L('Node of Ranvier', [2.0, -0.45, 0], 'gold'), L('Axon terminals', [3.8, 0.95, 0]),
    ];
    const ionLab = L('', [-2.0, 0.6, 0], 'gold');
    // ions at the start of the axon: Na⁺ (yellow) rushes in, K⁺ (violet) flows out
    const NI = 36, ax = -2.45;
    const na = swarm(NI, new THREE.SphereGeometry(0.045, 8, 6), M.glow(0xffd166));
    const k = swarm(NI, new THREE.SphereGeometry(0.045, 8, 6), M.glow(0xb58cff));
    root.add(na, k);
    const ang = Array.from({ length: NI }, (_, i) => [((i * 2.39996) % (Math.PI * 2)), ((i * 0.37) % 1) - 0.5]);
    // pulses on the axon
    const pulses = [];
    const pulseGeo = new THREE.SphereGeometry(0.16, 16, 12);
    const pulseMeshes = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(pulseGeo, M.glow(0xfff0a0, { transparent: true, opacity: 0.9 })); m.visible = false; root.add(m); return m; });
    // the voltage board
    const cell = new Cell();
    const st = { buf: [], len: WIN * 4 };                // 0.25 ms per sample
    const chart = canvasTexture(1100, 400, (g, w, h) => drawTrace(g, w, h, st));
    const bd = board(chart, 6.6, 2.4); bd.position.set(0.9, 1.0, 0.3); stage.root.add(bd);
    let simT = 0, lastSpike = -1e9, acc = 0, my = 1, spikes = [], sampleAcc = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        my = approach(my, s.myelin ? 1 : 0, 6, dt);
        n.myelinMat.opacity = my; n.sheaths.forEach((m) => { m.visible = my > 0.03; m.scale.setScalar(0.6 + 0.4 * my); });
        // run the membrane at 0.05 ms steps
        const simDt = (dt * 1000) / SLOW;
        let rem = simDt;
        while (rem > 1e-9) {
          const h = Math.min(0.05, rem); rem -= h; simT += h; sampleAcc += h;
          if (cell.step(h, s.stim)) { lastSpike = simT; spikes.push(simT); pulses.push({ age: 0 }); }
          if (sampleAcc >= 0.25) { sampleAcc -= 0.25; st.buf.push(cell.V); if (st.buf.length > st.len) st.buf.shift(); }
        }
        spikes = spikes.filter((t) => simT - t < 1000);
        // pulses travel down the axon (on-screen seconds): smooth and slow without myelin, jumping with it
        const travel = my > 0.5 ? 0.55 : 2.6;
        pulses.forEach((p) => { p.age += dt; });
        while (pulses.length && pulses[0].age > travel + 0.3) pulses.shift();
        const len = n.x1 - n.x0;
        n.nodes.forEach((nd) => { nd.ring.material.opacity = 0.3; nd.ring.scale.setScalar(1); nd.ring.visible = my > 0.5; });
        let termGlow = 0;
        pulseMeshes.forEach((m, i) => {
          const p = pulses[pulses.length - 1 - i];
          if (!p) { m.visible = false; return; }
          const u = p.age / travel;
          if (u > 1) { m.visible = false; termGlow = Math.max(termGlow, 1 - (p.age - travel) / 0.3); return; }
          let x = n.x0 + u * len;
          if (my > 0.5) {
            const idx = Math.floor(u * n.nodes.length);
            const nd = n.nodes[Math.min(n.nodes.length - 1, idx)];
            x = idx === 0 && u * n.nodes.length < 0.3 ? n.x0 : nd.x;
            nd.ring.material.opacity = 1; nd.ring.scale.setScalar(1.8);
          }
          m.visible = true; m.position.set(x, 0, 0);
        });
        n.terms.forEach((t) => { t.material.emissiveIntensity = 1.4 * termGlow; });
        // soma glows with depolarisation
        const since = simT - lastSpike;
        n.cellMat.emissiveIntensity = 0.15 + 0.9 * clamp((cell.V - EP.rest) / 100, 0, 1);
        // ions
        const naIn = since < 0.45 ? since / 0.45 : since < 8 ? 1 - (since - 0.45) / 7.55 : 0;
        const kOut = since < 0.45 ? 0 : since < 1.5 ? (since - 0.45) / 1.05 : since < 9 ? 1 - (since - 1.5) / 7.5 : 0;
        for (let i = 0; i < NI; i++) {
          const [a, dx] = ang[i];
          const rN = 0.5 - 0.44 * naIn * (0.6 + 0.4 * ((i * 7) % 5) / 4);
          const rK = 0.1 + 0.42 * kOut * (0.6 + 0.4 * ((i * 3) % 5) / 4);
          na.place(i, [ax + dx * 0.6, Math.cos(a) * rN, Math.sin(a) * rN]);
          k.place(i, [ax + dx * 0.6 + 0.02, Math.cos(a + 0.5) * rK, Math.sin(a + 0.5) * rK]);
        }
        na.done(); k.done();
        ionLab.element.innerHTML = since < 0.5 ? '<b>Na⁺ rushes in</b>' : since < 1.6 ? '<b>K⁺ flows out</b>' : since < 8 ? 'Resetting' : cell.V > EP.rest + 1 ? 'Charging up…' : 'Resting';
        const narrow = stage.host.clientWidth < 560;
        labs.forEach((l, i) => { l.visible = !narrow || i % 2 === 0; });
        labs[3].visible = my > 0.5 && labs[3].visible; labs[4].visible = my > 0.5 && labs[4].visible;
        acc += dt; if (acc > 1 / 30) { acc = 0; chart.redraw(); }
      },
      readout: (s) => {
        const r = rateFor(s.stim), sub = s.stim <= EP.thresh - EP.rest;
        const t1m = s.myelin ? 1 / EP.cvFast : 1 / EP.cvSlow;
        return `<div class="big">${sub ? 'Below threshold: silent' : `${Math.round(r)} spikes a second`}</div>
          <div class="row"><span>Resting · threshold · peak</span><b>−70 · −55 · +35 mV</b></div>
          <div class="row"><span>Signal speed</span><b>${s.myelin ? 'up to 120 m/s' : 'about 1 m/s'}</b></div>
          <div class="row"><span>Time to travel 1 m</span><b>${t1m < 0.1 ? (t1m * 1000).toFixed(0) + ' ms' : t1m.toFixed(0) + ' s'}</b></div>
          <small>Slowed ${SLOW}× and squeezed to fit. Real myelinated axons are up to 100 times faster than bare ones.</small>`;
      },
    };
  },
};
