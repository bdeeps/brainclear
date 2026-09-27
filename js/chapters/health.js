// Chapter 6: keeping the brain healthy, and what can go wrong. General facts only, never advice.
//  - Fuel: about 20% of the body's resting energy at about 2% of its weight, roughly 20 W
//    (Raichle & Gusnard 2002, PNAS 99:10237); blood flow about 750 mL/min, about 15% of the heart's
//    output (Guyton & Hall, Textbook of Medical Physiology, ch. 62); about 120 g of glucose a day
//    (Berg et al., Biochemistry, ch. 30).
//  - Stroke: a blocked (ischaemic, about 85%) or burst (haemorrhagic) artery. "Time is brain":
//    in a typical large-vessel ischaemic stroke about 1.9 million neurons are lost each minute it goes
//    untreated (Saver 2006, Stroke 37:263). Warning signs: BE-FAST (balance, eyes, face, arms,
//    speech, time), as taught by the American Stroke Association and many hospitals; the NHS teaches FAST.
//  - Concussion: the brain floats in cerebrospinal fluid; a sudden stop makes it hit the skull.
//    Peak deceleration for a constant-deceleration stop from speed v over distance d is a = v²/2d.
//    The helmet's crushable foam liner lengthens d. Helmet test limits for peak headform acceleration
//    are a few hundred g (for example about 275 g in UN ECE Regulation 22.06).
import { THREE, M, swarm, tube, canvasTexture, clamp, lerp, smooth, approach } from '../kit.js';
import { makeBrain, regionWeights, surfaceZ, board, tint } from '../brain.js';

const G = 9.81;
const V_IMPACT = 5.0;                 // m/s, roughly a fall from head height of about 1.3 m (v = √(2gh))
const D_BARE = 0.005, D_HELMET = 0.025;  // m of stopping distance: scalp and skull flex vs a helmet's foam liner (illustrative)
const LOSS_PER_MIN = 1.9e6;           // neurons per minute, Saver 2006

// the temporal lobe's outer surface (see brain.js temporalLobe), for arteries that run over it
function tempZ(side, x, y) {
  const ux = (x - 0.12) / 1.32, uy = (y + 0.52 - 0.26 * (x - 0.12) * 0.2) / 0.5;
  const q = 1 - ux * ux - uy * uy;
  return q > 0 ? side * (1.0 + 0.54 * Math.sqrt(q)) : 0;
}
const onSurf = (side, x, y, lift = 0.05) => { const a = surfaceZ(side, x, y), b = tempZ(side, x, y); const z = Math.abs(b) > Math.abs(a) ? b : a; return new THREE.Vector3(x, y, z + side * lift); };

function arteries(side) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z * side);
  const ica = [V(-0.38, -1.5, 0.36), V(-0.36, -1.0, 0.36), V(-0.32, -0.62, 0.34), V(-0.3, -0.45, 0.34)];
  const mcaStem = [V(-0.3, -0.45, 0.34), V(-0.33, -0.36, 0.7), V(-0.34, -0.26, 1.1), onSurf(side, -0.32, -0.16, 0.02)];
  const start = new THREE.Vector3(-0.32, -0.16, 0);
  const branch = (ex, ey) => { const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; const x = lerp(start.x, ex, t), y = lerp(start.y, ey, t) + Math.sin(t * Math.PI) * 0.12; pts.push(onSurf(side, x, y)); } return pts; };
  const mca = [[-1.35, 0.55], [-0.75, 1.15], [0.1, 1.3], [0.85, 0.95], [1.3, 0.25], [0.6, -0.55], [-0.4, -0.75]].map(([x, y]) => branch(x, y));
  const aca = [V(-0.3, -0.45, 0.12), V(-0.8, -0.3, 0.1), V(-1.25, 0.2, 0.09), V(-1.1, 0.95, 0.09), V(-0.3, 1.45, 0.09), V(0.6, 1.45, 0.09), V(1.2, 1.1, 0.09)];
  const vert = [V(0.62, -2.1, 0.14), V(0.45, -1.7, 0.14), V(0.15, -1.3, 0.06), V(0.02, -1.1, 0.0)];
  const pca = [V(0.0, -0.66, 0.02), V(0.2, -0.64, 0.3), V(0.6, -0.56, 0.62), V(1.2, -0.42, 0.78), V(1.8, -0.2, 0.72)];
  return { ica, mcaStem, mca, aca, vert, pca };
}

function drawBeFast(g, w, h, st) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,12,18,.92)'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff5d73'; g.font = 'bold 40px sans-serif'; g.fillText('Spot a stroke: BE FAST', 28, 54);
  const rows = [['B', 'Balance', 'sudden loss of balance'], ['E', 'Eyes', 'sudden loss of vision'], ['F', 'Face', 'one side droops'], ['A', 'Arms', 'one arm weak or numb'], ['S', 'Speech', 'slurred or strange'], ['T', 'Time', 'call for help at once']];
  rows.forEach(([k, a, b], i) => {
    const y = 128 + i * 74, on = st.hl === i;
    g.fillStyle = on ? '#ff5d73' : '#ffd166'; g.font = 'bold 54px sans-serif'; g.fillText(k, 30, y + 14);
    g.fillStyle = '#e8eef8'; g.font = 'bold 32px sans-serif'; g.fillText(a, 96, y);
    g.fillStyle = 'rgba(232,238,248,.8)'; g.font = '28px sans-serif'; g.fillText(b, 96, y + 34);
  });
}

export default {
  id: 'health',
  short: 'Keeping it healthy',
  title: 'Fuel, flow and what goes wrong',
  subtitle: 'A hungry organ, a guarded supply line, and why minutes matter.',
  view: { pos: [-0.8, 3.7, 9.4], target: [-0.6, 3.25, 0] },
  learn: `<p>Your brain is about <b>2%</b> of your body weight but uses about <b>20%</b> of its energy at rest, roughly <b>20 watts</b>, like a dim light bulb (see <a href="/energyclear/">EnergyClear</a>). It burns mostly glucose and oxygen, delivered by about <b>750 mL of blood a minute</b>. It stores almost none, so even a few minutes without blood flow causes damage.</p>
    <p>Brain blood vessels are lined with tightly sealed cells, the <b>blood–brain barrier</b>. It lets in oxygen, glucose and a few other things and keeps out most germs and toxins, which also makes many medicines hard to get into the brain.</p>
    <p>A <b>stroke</b> happens when an artery to the brain is <b>blocked</b> by a clot (most strokes) or <b>bursts</b> and bleeds. The cells it feeds start dying within minutes: in a typical large stroke, about <b>1.9 million neurons</b> a minute. So doctors say <b>“time is brain”</b>. Learn <b>BE FAST</b>: Balance, Eyes, Face, Arms, Speech, Time. If you see these signs, call emergency services straight away. Treatments that dissolve or remove a clot work best in the first hours.</p>
    <p>A hard knock can shake the brain against the skull: a <b>concussion</b>. Headaches, confusion or memory gaps after a knock need a doctor’s check. Helmets spread the stop over a longer distance, cutting the force (see <a href="/motorcycleclear/">MotorcycleClear</a>).</p>
    <p>The brain keeps rewiring all your life: <b>neuroplasticity</b>. After an injury, other areas can sometimes take over lost jobs with practice. <b>Dementia</b>, most often <b>Alzheimer’s disease</b>, slowly damages memory and thinking, mostly in older age. Sleep, physical activity, not smoking, and treating high blood pressure are linked with healthier brains. This box gives general facts only: for any worry about your own health, <b>see a doctor</b>.</p>
    <p class="tip"><b>Try it:</b> start a stroke and watch the grey patch spread, then clear the clot. Then try the bump with and without a helmet.</p>`,
  terms: [
    { t: 'Blood–brain barrier', d: 'The tightly sealed lining of brain blood vessels that keeps most substances in the blood out of the brain.' },
    { t: 'Stroke', d: 'Brain damage from a blocked or burst artery that cuts off blood supply to part of the brain.' },
    { t: 'BE FAST', d: 'Stroke warning signs: Balance, Eyes, Face, Arms, Speech, and Time to call for help.' },
    { t: 'Concussion', d: 'A brain injury from a knock or jolt that shakes the brain inside the skull.' },
    { t: 'Neuroplasticity', d: 'The brain’s ability to change its wiring with learning, practice and recovery.' },
    { t: 'Dementia', d: 'A group of illnesses, most often Alzheimer’s disease, that steadily damage memory and thinking.' },
  ],
  defaults: { scene: 'fuel', min: 0, treated: false, running: true, helmet: false },
  controls: [
    { key: 'scene', type: 'seg', label: 'Show', options: [{ v: 'fuel', label: 'Fuel and blood' }, { v: 'stroke', label: 'A stroke' }, { v: 'bump', label: 'A bump to the head' }] },
    { key: 'actions', type: 'buttons', label: 'Stroke', items: [{ label: 'Start a stroke', act: (s) => { s.scene = 'stroke'; s.min = 0; s.treated = false; s.running = true; } }, { label: 'Clear the clot', act: (s) => { s.scene = 'stroke'; s.treated = true; } }] },
    { key: 'helmet', type: 'toggle', label: 'Wearing a helmet (for the bump)' },
  ],
  onChange(s, key) { if (key === 'scene' && s.scene === 'stroke') { s.min = 0; s.treated = false; s.running = true; } },
  quiz: [
    { q: 'About how much of the body’s energy does the brain use at rest?', options: ['2%', '20%', '50%', '80%'], answer: 1, why: 'About 20%, although it is only about 2% of body weight: roughly 20 W.' },
    { q: 'What does the T in BE FAST mean?', options: ['Temperature', 'Time: call emergency services at once', 'Tiredness', 'Try again later'], answer: 1, why: 'In a stroke, brain cells die by the minute, so getting emergency help fast matters most.' },
    { q: 'How does a helmet reduce the force of a hit?', options: ['By being heavy', 'Its foam crushes, stretching out the stopping distance', 'By warming the head', 'It doesn’t'], answer: 1, why: 'Deceleration is v²/2d: a longer stopping distance d means a smaller peak force on the brain.' },
  ],
  reel: [
    { ms: 5600, caption: 'A stroke blocks a brain artery. About 1.9 million neurons can die each minute: time is brain.', set: { scene: 'stroke', treated: false, running: false, helmet: false }, anim: { min: [0, 40] }, spin: 0 },
  ],

  build({ stage, s }) {
    const root = new THREE.Group(); root.position.set(0.5, 3.1, 0); stage.root.add(root);
    const head = new THREE.Group(); root.add(head);
    const brain = makeBrain(stage, { labels: false });
    head.add(brain.root);
    [...brain.cortex, brain.parts.cerebellum].forEach((m) => m.material.color.set(0xffffff));
    const BASE = [0.65, 0.32, 0.28];
    const W = regionWeights(brain, ['mcaTerritory']);
    // arteries (left side is the one we watch)
    const artMat = new THREE.MeshPhysicalMaterial({ color: 0xd8303f, roughness: 0.35, clearcoat: 0.6, emissive: 0x801018, emissiveIntensity: 0.3 });
    const deadMat = new THREE.MeshPhysicalMaterial({ color: 0x6a3a44, roughness: 0.6 });
    const curves = [];                                 // { curve, left MCA? }
    const mcaMeshes = [];
    for (const side of [1, -1]) {
      const a = arteries(side);
      const add = (pts, r, isMca) => { const m = tube(pts, r, artMat, false, 60); brain.root.add(m); curves.push({ c: new THREE.CatmullRomCurve3(pts), mca: isMca && side > 0 }); if (isMca && side > 0) mcaMeshes.push(m); return m; };
      add(a.ica, 0.05); add(a.mcaStem, 0.045, true); a.mca.forEach((p) => add(p, 0.028, true)); add(a.aca, 0.03); add(a.vert, 0.035); add(a.pca, 0.032);
    }
    brain.root.add(tube([[-0.55, -0.47, 0.12], [-0.33, -0.45, 0.33], [0.0, -0.64, 0.24], [0.0, -0.64, -0.24], [-0.33, -0.45, -0.33], [-0.55, -0.47, -0.12]], 0.025, artMat, true, 60));
    brain.root.add(tube([[0.02, -1.1, 0], [0.0, -0.66, 0]], 0.045, artMat, false, 10));
    const clot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: 0x2a0a10, roughness: 0.9 }));
    clot.position.set(-0.33, -0.36, 0.7); brain.root.add(clot);
    // blood flow particles
    const NB = 160;
    const blood = swarm(NB, new THREE.SphereGeometry(0.03, 8, 6), M.glow(0xff6b7a));
    brain.root.add(blood);
    const bp = Array.from({ length: NB }, (_, i) => ({ c: curves[i % curves.length], u: (i * 0.618) % 1 }));
    // skull, fluid and helmet for the bump
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), M.ghost(0xe8e0cc, 0.16)); skull.scale.set(2.45, 2.0, 2.05); skull.position.set(0, 0.05, 0); head.add(skull);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.62), M.clear(0x6fa8ff, 0.28)); helmet.scale.set(2.85, 2.5, 2.45); helmet.position.set(0, -0.1, 0); head.add(helmet);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 3.6), M.matte(0x3a4150, { transparent: true, opacity: 0.8 })); wall.position.set(-3.5, 0, 0); root.add(wall);
    // BE FAST board
    const bf = { hl: 0 };
    const chart = canvasTexture(560, 580, (g, w, h) => drawBeFast(g, w, h, bf));
    const bd = board(chart, 2.5, 2.6); bd.position.set(-3.0, 1.55, 0.8); stage.root.add(bd);
    const L = (t, p, cls) => tint(stage.label(t, p, root), cls);
    const clotL = L('Clot blocks the middle cerebral artery', [-0.9, -0.9, 1.4], '#ff5d73');
    const mcaL = L('Middle cerebral artery', [0.9, 1.5, 1.4], '#ff8f9a');
    const csfL = L('Skull and cushioning fluid', [1.7, 1.9, 0.6], 'side');
    let t = 0, bumpT = 0, dirty = true, lastF = -1, lastScene = '';
    return {
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        const stroke = s.scene === 'stroke', bump = s.scene === 'bump';
        if (stroke && s.running && !s.treated) s.min = Math.min(180, s.min + dt * 4);      // 4 minutes of stroke per second on screen
        // damage: the core of the artery's territory spreads outwards with time (illustrative)
        const f = stroke ? clamp(s.min / 90, 0, 1) : 0;
        if (Math.abs(f - lastF) > 0.004 || dirty || s.scene !== lastScene) {
          lastF = f; dirty = false; lastScene = s.scene;
          brain.surfaces.forEach((sf, si) => {
            const c = sf.col, w = W[si].mcaTerritory, n = sf.shade.length;
            for (let i = 0; i < n; i++) {
              const sh = sf.shade[i]; let r = sh * BASE[0], g = sh * BASE[1], b = sh * BASE[2];
              if (stroke && sf.side > 0 && w[i] > 0) {
                const dead = clamp((w[i] - (1 - 1.05 * f)) * 8, 0, 1), risk = s.treated ? 0 : clamp(w[i] * 3, 0, 1) * (1 - dead);
                r = lerp(lerp(r, 0.95 * sh, risk * 0.45), 0.1 * sh, dead); g = lerp(lerp(g, 0.5 * sh, risk * 0.45), 0.085 * sh, dead); b = lerp(lerp(b, 0.05 * sh, risk * 0.45), 0.08 * sh, dead);
              }
              c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
            }
            sf.geo.attributes.color.needsUpdate = true;
          });
        }
        const blocked = stroke && !s.treated;
        clot.visible = blocked; clotL.visible = blocked; mcaL.visible = s.scene === 'fuel';
        mcaMeshes.forEach((m) => { m.material = blocked ? deadMat : artMat; });
        // blood
        for (let i = 0; i < NB; i++) {
          const p = bp[i]; p.u = (p.u + dt * 0.35) % 1;
          const stop = p.c.mca && blocked;
          const P = p.c.c.getPointAt(p.u);
          blood.place(i, [P.x, P.y, P.z], null, stop || bump ? 0.001 : 1);
        }
        blood.done();
        // the bump: head moves forward, skull stops at the wall, brain lags then hits the front
        skull.visible = bump; helmet.visible = bump && s.helmet; wall.visible = bump; csfL.visible = bump;
        if (bump) {
          bumpT = (bumpT + dt) % 3.4;
          const hit = 1.2, dStop = s.helmet ? 0.3 : 0.06;       // the helmet stops the head over a longer distance (exaggerated to see)
          const contactX = -3.4 + (s.helmet ? 2.85 : 2.45);
          head.position.x = bumpT < hit ? lerp(contactX + 1.4, contactX, bumpT / hit) : contactX - dStop * smooth(clamp((bumpT - hit) / (s.helmet ? 0.28 : 0.07), 0, 1));
          // brain slosh inside the skull: forward hit (coup), then a rebound (contrecoup)
          const k = bumpT - hit;
          const amp = s.helmet ? 0.05 : 0.14;
          brain.root.position.x = k > 0 ? -amp * Math.exp(-k * 3) * Math.cos(k * 14) : 0;
        } else { head.position.x = 0; brain.root.position.x = 0; }
        const narrow = stage.host.clientWidth < 560;
        root.position.set(narrow ? -0.6 : 0.5, narrow ? 2.2 : 3.1, 0);
        bf.hl = Math.floor(t / 1.2) % 6;
        bd.visible = stroke && !narrow; if (narrow) clotL.visible = false;
        chart.redraw();
      },
      readout: (s) => {
        if (s.scene === 'stroke') {
          const lost = LOSS_PER_MIN * s.min;
          return `<div class="big">${s.treated ? 'Clot cleared: blood flows again' : `${Math.round(s.min)} min without blood flow`}</div>
            <div class="row"><span>Neurons lost (about 1.9 million a minute)</span><b>≈ ${(lost / 1e6).toFixed(0)} million</b></div>
            <div class="row"><span>Area at risk</span><b>${s.treated ? 'saved from further damage' : 'shrinking as cells die'}</b></div>
            <small>Illustrative, from Saver 2006. Every stroke is different. If you notice BE FAST signs, call emergency services at once.</small>`;
        }
        if (s.scene === 'bump') {
          const d = s.helmet ? D_HELMET : D_BARE, a = (V_IMPACT * V_IMPACT) / (2 * d);
          return `<div class="big">Peak about ${Math.round(a / G)} g</div>
            <div class="row"><span>Head speed at impact</span><b>${V_IMPACT} m/s</b></div>
            <div class="row"><span>Stop distance</span><b>${(d * 1000).toFixed(0)} mm ${s.helmet ? '(foam)' : '(bare)'}</b></div>
            <div class="row"><span>a = v² ÷ 2d</span><b>${Math.round(a)} m/s²</b></div>
            <small>Idealised steady stop. The brain floats in fluid, so a sudden stop sloshes it into the skull. After any head knock with symptoms, see a doctor.</small>`;
        }
        return `<div class="big">About 20 W, all day</div>
          <div class="row"><span>Share of body weight</span><b>about 2%</b></div>
          <div class="row"><span>Share of resting energy</span><b>about 20%</b></div>
          <div class="row"><span>Blood flow</span><b>about 750 mL a minute</b></div>
          <div class="row"><span>Glucose</span><b>about 120 g a day</b></div>`;
      },
    };
  },
};
