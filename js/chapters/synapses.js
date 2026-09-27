// Chapter 3: the synapse. A close-up of one synapse replays its sequence (spike arrives, Ca²⁺ in,
// vesicles fuse, transmitter crosses, receptors open, ions flow) in slow motion, while the board
// adds up many synapses' inputs on one receiving neuron: spatial and temporal summation to threshold.
// EPSPs are modelled as difference-of-exponentials (rise 1 ms, decay 15 ms) of about 0.8 mV each
// (Kandel ch. 13: unitary central EPSPs are typically well under 1–2 mV, so dozens must coincide).
import { THREE, M, swarm, canvasTexture, clamp, lerp, smooth, approach } from '../kit.js';
import { EP, spikeV, makeSynapse, NT } from '../neuron.js';
import { board, tint } from '../brain.js';

const CYCLE = 3.4;          // on-screen seconds for one synaptic event (in life: about 1 ms)
const WIN = 200;            // ms on the board
const SLOW = 40;
const TR = 1, TD = 15;      // EPSP rise and decay (ms)
const PEAKN = (() => { const tp = (TR * TD) / (TD - TR) * Math.log(TD / TR); return 1 / (Math.exp(-tp / TD) - Math.exp(-tp / TR)); })();

function drawSum(g, w, h, st) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
  const L = 92, R = w - 24, T = 58, B = h - 50;
  const Y = (mv) => T + ((45 - mv) / 135) * (B - T);
  g.font = '18px sans-serif'; g.lineWidth = 1;
  for (const [mv, lab, col] of [[0, '0 mV', 'rgba(255,255,255,.3)'], [-55, 'threshold', '#ffd166'], [-70, 'rest −70', '#9fb3c8']]) {
    g.strokeStyle = col; g.setLineDash(mv === -55 ? [8, 6] : []); g.beginPath(); g.moveTo(L, Y(mv)); g.lineTo(R, Y(mv)); g.stroke();
    g.fillStyle = col; g.fillText(lab, 8, Y(mv) + 6);
  }
  g.setLineDash([]);
  const n = st.buf.length, X = (i) => L + ((i + (st.len - n)) / st.len) * (R - L);
  // input volleys as ticks along the bottom
  g.fillStyle = '#5ce1a9';
  st.ticks.forEach((t) => { const x = L + ((t - (st.now - WIN)) / WIN) * (R - L); if (x > L) g.fillRect(x - 2, B + 14, 4, 18); });
  g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('input volleys', R - 130, B + 44);
  g.strokeStyle = '#ffb86b'; g.lineWidth = 3.5; g.beginPath();
  for (let i = 0; i < n; i++) { const y = Y(st.buf[i]); i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); }
  g.stroke();
  g.fillStyle = '#e8eef8'; g.font = 'bold 24px sans-serif'; g.fillText('The receiving neuron adds up its inputs', L, 36);
}

export default {
  id: 'synapses',
  short: 'Synapses',
  title: 'Where neurons meet',
  subtitle: 'A spark becomes a chemical, crosses a gap, and becomes a spark again.',
  view: { pos: [0.9, 3.4, 9.6], target: [0.7, 3.15, 0] },
  learn: `<p>Neurons don’t quite touch. Where an axon terminal meets the next cell there is a gap about <b>20 nanometres</b> wide, the <b>synaptic cleft</b>. The whole junction is a <b>synapse</b>. Estimates put about <b>100 trillion</b> of them in your brain, though the true number is uncertain by a factor of several.</p>
    <p>When a spike arrives, <b>calcium (Ca²⁺)</b> gates open and calcium rushes in. That makes tiny bubbles, <b>vesicles</b>, fuse with the membrane and spill <b>neurotransmitter</b> into the gap. The molecules drift across in well under a millisecond and fit into <b>receptors</b> on the other side, which open to let ions through.</p>
    <p><b>Glutamate</b> is the main “go” signal: it lets Na⁺ in and nudges the next cell towards threshold (an <b>EPSP</b>). <b>GABA</b> is the main “stop” signal: it lets Cl⁻ in and holds the cell back (an <b>IPSP</b>). One synapse gives well under 1 mV, so the receiving neuron fires only when many inputs <b>add up</b>, arriving together (<b>spatial summation</b>) or in quick succession (<b>temporal summation</b>).</p>
    <p><b>Learning</b> changes synapses. When one cell repeatedly helps fire another, their synapse gets stronger, often by adding receptors. This <b>long-term potentiation (LTP)</b> is summed up as “cells that fire together wire together”. Many drugs act here too: <b>caffeine</b> blocks receptors for adenosine, a chemical that builds up and makes you sleepy; <b>nicotine</b> mimics acetylcholine; many antidepressants slow the clean-up of serotonin; <b>alcohol</b> boosts GABA’s braking effect. These are facts, not advice: medicines are for a doctor to decide.</p>
    <p class="tip"><b>Try it:</b> with 10 inputs the cell stays quiet. Add inputs, fire them closer together, or switch on LTP, and watch it reach threshold. Then add inhibition.</p>`,
  terms: [
    { t: 'Synapse', d: 'The junction where one neuron passes a signal to another, usually with a chemical.' },
    { t: 'Neurotransmitter', d: 'A chemical messenger released into the synaptic cleft, such as glutamate, GABA, dopamine or serotonin.' },
    { t: 'Vesicle', d: 'A tiny bubble inside the axon terminal, filled with thousands of neurotransmitter molecules.' },
    { t: 'Receptor', d: 'A protein on the receiving cell that opens or signals when the right transmitter binds to it.' },
    { t: 'EPSP and IPSP', d: 'Small voltage nudges towards (excitatory) or away from (inhibitory) the threshold.' },
    { t: 'Summation', d: 'Adding up many small inputs, in space and in time, to decide whether to fire.' },
    { t: 'LTP', d: 'Long-term potentiation: a lasting strengthening of a synapse after it is used together with its partner.' },
  ],
  defaults: { n: 10, inh: 0, gap: 40, ltp: false, nt: 'glu' },
  controls: [
    { key: 'n', type: 'range', label: 'Excitatory inputs firing together', min: 0, max: 30, step: 1, fmt: (v, s) => `${v} × ${(EP.epsp * (s.ltp ? 2 : 1)).toFixed(1)} mV` },
    { key: 'gap', type: 'range', label: 'Time between volleys', min: 5, max: 60, step: 1, ends: ['rapid', 'spaced out'], fmt: (v) => `${v} ms` },
    { key: 'inh', type: 'range', label: 'Inhibitory (GABA) inputs', min: 0, max: 20, step: 1, fmt: (v) => `${v} × ${Math.abs(EP.ipsp).toFixed(1)} mV` },
    { key: 'ltp', type: 'toggle', label: 'Strengthened by learning (LTP)', hint: 'Doubles each excitatory synapse’s effect.' },
    { key: 'nt', type: 'seg', label: 'Close-up synapse uses', options: [{ v: 'glu', label: 'Glutamate (go)' }, { v: 'gaba', label: 'GABA (stop)' }] },
  ],
  quiz: [
    { q: 'What makes vesicles release neurotransmitter?', options: ['Sodium leaving', 'Calcium rushing into the terminal', 'The receptor pulling them', 'Heat'], answer: 1, why: 'The arriving spike opens calcium channels, and Ca²⁺ triggers the vesicles to fuse and spill their contents.' },
    { q: 'Why does a neuron usually need many inputs to fire?', options: ['Each synapse gives well under 1 mV, but threshold is about 15 mV above rest', 'Synapses are broken', 'Only one input counts', 'Inputs cancel out'], answer: 0, why: 'Many small EPSPs must add up, together in space or quickly in time, to reach threshold.' },
    { q: 'What does “cells that fire together wire together” describe?', options: ['Neurons growing new heads', 'Synapses getting stronger when used together (LTP)', 'Brain cells joining into one', 'Electric wires in the skull'], answer: 1, why: 'When one cell repeatedly helps fire another, their synapse strengthens: a cellular basis of learning.' },
  ],
  reel: [
    { ms: 5800, caption: 'At a synapse, the spike releases chemicals that cross a gap 20 millionths of a millimetre wide.', set: { n: 10, gap: 40, inh: 0, ltp: false, nt: 'glu' }, spin: 0.25 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.set(2.6, 3.4, 0); root.scale.setScalar(0.66); stage.root.add(root);
    const syn = makeSynapse(); root.add(syn.root);
    const L = (t, p, cls) => tint(stage.label(t, p, root), cls);
    const labs = [L('Axon terminal', [2.3, 2.6, 0]), L('Vesicles', [2.4, 1.4, 0]), L('Synaptic cleft (~20 nm)', [3.4, 0.0, 0], 'gold'), L('Receptors', [2.3, -0.75, 0]), L('Receiving dendrite', [1.6, -4.3, 0])];
    const stepL = L('', [0, 4.6, 0], 'gold');
    // particles
    const NTN = 90, CAN = 24, ION = 30;
    const ntm = swarm(NTN, new THREE.SphereGeometry(0.045, 8, 6), M.glow(0x5ce1a9));
    const cam = swarm(CAN, new THREE.SphereGeometry(0.055, 8, 6), M.glow(0x7fffe0));
    const ionm = swarm(ION, new THREE.SphereGeometry(0.055, 8, 6), M.glow(0xffd166));
    root.add(ntm, cam, ionm);
    const rnd = (() => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const ntp = Array.from({ length: NTN }, () => ({ a: rnd() * 6.283, r: rnd(), d: rnd() }));
    const cap = Array.from({ length: CAN }, (_, i) => ({ c: i % 3, a: rnd() * 6.283, d: rnd() }));
    const iop = Array.from({ length: ION }, (_, i) => ({ rec: i % 14, a: rnd() * 6.283, d: rnd() }));
    // the summation board
    const st = { buf: [], len: WIN * 2, ticks: [], now: 0 };
    const chart = canvasTexture(1100, 420, (g, w, h) => drawSum(g, w, h, st));
    const bd = board(chart, 5.2, 1.98); bd.position.set(-1.95, 1.3, 0.6); stage.root.add(bd);
    let simT = 0, nextVolley = 0, xd = 0, xr = 0, sp = -1, ahp = 0, V = EP.rest, fired = [], acc = 0, sampleAcc = 0;
    let cyc = 0, ltpK = 0, glow = 0, step = '';
    const tmp = new THREE.Vector3();
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        // ---- summation model, at 0.1 ms steps
        let rem = (dt * 1000) / SLOW;
        while (rem > 1e-9) {
          const h = Math.min(0.1, rem); rem -= h; simT += h; sampleAcc += h;
          if (simT >= nextVolley) {
            nextVolley = simT + s.gap;
            const A = s.n * EP.epsp * (s.ltp ? 2 : 1) + s.inh * EP.ipsp;
            xd += A * PEAKN; xr += A * PEAKN;
            st.ticks.push(simT);
          }
          xd *= Math.exp(-h / TD); xr *= Math.exp(-h / TR); ahp *= Math.exp(-h / 8);
          if (sp >= 0) { sp += h; V = spikeV(sp); if (sp >= EP.spikeMs) { sp = -1; ahp = EP.under - EP.rest; xd = xr = 0; } }
          else { V = EP.rest + (xd - xr) + ahp; if (V >= EP.thresh) { sp = 0; fired.push(simT); V = EP.thresh; } }
          if (sampleAcc >= 0.5) { sampleAcc -= 0.5; st.buf.push(V); if (st.buf.length > st.len) st.buf.shift(); }
        }
        st.now = simT; st.ticks = st.ticks.filter((t) => simT - t < WIN); fired = fired.filter((t) => simT - t < 1000);
        acc += dt; if (acc > 1 / 30) { acc = 0; chart.redraw(); }

        // ---- the close-up synapse, in its own slow cycle
        cyc = (cyc + dt) % CYCLE;
        const t = cyc, nt = NT[s.nt];
        ltpK = approach(ltpK, s.ltp ? 1 : 0, 4, dt);
        const nRec = Math.round(7 + 7 * ltpK);
        syn.vesMat.color.set(nt.col); syn.vesMat.emissive.set(nt.col); ntm.material.color.set(nt.col); ionm.material.color.set(nt.ionCol);
        const ph = (a, b) => clamp((t - a) / (b - a), 0, 1);
        const arrive = ph(0, 0.45), caIn = ph(0.35, 0.9), fuse = ph(0.85, 1.25), cross = ph(1.15, 1.85), bind = ph(1.6, 2.0), flow = ph(1.85, 2.6), clear = ph(2.5, 3.3);
        syn.memPre.emissiveIntensity = 0.9 * (arrive < 1 ? arrive : 1 - caIn) ;
        syn.axon.material = syn.memPre;
        syn.chans.forEach((c) => { c.material.emissiveIntensity = caIn > 0 && caIn < 1 ? 1.2 : 0.1; });
        // Ca²⁺ in from outside the terminal, through the three channels
        for (let i = 0; i < CAN; i++) {
          const p = cap[i], ch = syn.chans[p.c].position, k = smooth(clamp(caIn * 1.3 - p.d * 0.3, 0, 1));
          const out = tmp.set(ch.x + Math.cos(p.a) * 0.5, ch.y - 0.45, ch.z + Math.sin(p.a) * 0.5);
          const inn = new THREE.Vector3(ch.x + Math.cos(p.a) * 0.25, ch.y + 0.35, ch.z + Math.sin(p.a) * 0.25);
          const P = out.clone().lerp(inn, k);
          cam.place(i, [P.x, P.y, P.z], null, caIn > 0 && fuse < 1 ? 1 : 0.001);
        }
        cam.done();
        // docked vesicles move down and fuse (shrink into the membrane), then are refilled
        syn.vesicles.forEach((v, i) => {
          if (!v.docked) { v.mesh.position.copy(v.home).add(tmp.set(0, 0.04 * Math.sin(t * 2 + i), 0)); return; }
          const d = smooth(fuse), gone = fuse >= 1 && clear < 0.6;
          v.mesh.position.copy(v.home).add(tmp.set(0, -0.16 * d, 0));
          v.mesh.scale.setScalar(gone ? 0.001 : clear >= 0.6 ? smooth((clear - 0.6) / 0.4) : 1 - 0.5 * d);
        });
        // transmitter spills out, crosses the cleft and binds, then is cleared to the sides
        for (let i = 0; i < NTN; i++) {
          const p = ntp[i], src = syn.vesicles[i % 3].home;
          const rec = syn.receptors[i % nRec].position;
          const kx = smooth(clamp(cross * 1.2 - p.d * 0.2, 0, 1));
          const start = tmp.set(src.x + Math.cos(p.a) * 0.1, 0.3, src.z + Math.sin(p.a) * 0.1);
          const end = new THREE.Vector3(rec.x + Math.cos(p.a) * 0.07, -0.16, rec.z + Math.sin(p.a) * 0.07);
          const P = start.clone().lerp(end, kx); P.y += Math.sin(kx * Math.PI) * 0.05 * (p.r - 0.5);
          if (clear > 0) { const out = new THREE.Vector3(Math.cos(p.a) * 2.2, 0.05, Math.sin(p.a) * 2.2); P.lerp(out, smooth(clear)); }
          ntm.place(i, [P.x, P.y, P.z], null, fuse > 0.5 && clear < 0.95 ? 1 : 0.001);
        }
        ntm.done();
        syn.receptors.forEach((r, i) => { r.visible = i < nRec; r.material.emissiveIntensity = bind > 0 && clear < 0.5 ? 0.3 + 1.2 * bind : 0.1; });
        // ions flow through the open receptors into the receiving side
        for (let i = 0; i < ION; i++) {
          const p = iop[i], rec = syn.receptors[p.rec % nRec].position, k = smooth(clamp(flow * 1.3 - p.d * 0.3, 0, 1));
          const P = tmp.set(rec.x + Math.cos(p.a) * 0.25, lerp(0.1, -0.9, k), rec.z + Math.sin(p.a) * 0.25);
          ionm.place(i, [P.x, P.y, P.z], null, flow > 0 && clear < 0.7 ? 1 : 0.001);
        }
        ionm.done();
        glow = flow > 0 && clear < 1 ? Math.sin(Math.PI * clamp((t - 1.85) / 1.4, 0, 1)) * (0.6 + 0.4 * ltpK) : 0;
        syn.memPost.emissive.set(nt.sign > 0 ? 0xffb86b : 0x6fa8ff); syn.memPost.emissiveIntensity = glow;
        step = t < 0.45 ? '1 · A spike arrives' : t < 0.9 ? '2 · Calcium rushes in' : t < 1.25 ? '3 · Vesicles fuse and release' : t < 1.85 ? `4 · ${nt.name} crosses the gap` : t < 2.6 ? `5 · Receptors open: ${nt.ion} flows in` : `6 · Transmitter cleared away`;
        stepL.element.innerHTML = `<b>${step}</b>`;
        const narrow = stage.host.clientWidth < 560;
        labs.forEach((l, i) => { l.visible = !narrow || i === 2; });
      },
      readout: (s) => {
        const A = s.n * EP.epsp * (s.ltp ? 2 : 1) + s.inh * EP.ipsp;
        const peak = A / (1 - Math.exp(-s.gap / TD));     // steady-state peak with repeated volleys
        const fires = peak >= EP.thresh - EP.rest || fired.length > 0 && st.now - fired[fired.length - 1] < 3 * s.gap;
        return `<div class="big">${fires ? 'Threshold reached: it fires!' : 'Stays below threshold'}</div>
          <div class="row"><span>One volley adds</span><b>${A >= 0 ? '+' : ''}${A.toFixed(1)} mV</b></div>
          <div class="row"><span>Built-up peak (with repeats)</span><b>${peak >= 0 ? '+' : ''}${peak.toFixed(1)} mV</b></div>
          <div class="row"><span>Needed to reach threshold</span><b>+15 mV</b></div>
          <small>Close-up: ${NT[s.nt].name}${s.nt === 'glu' ? ' excites' : ' inhibits'}. In life the whole sequence takes about a millisecond.</small>`;
      },
    };
  },
};
