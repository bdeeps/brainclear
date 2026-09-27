// Chapter 1: the brain itself. Two hemispheres of four lobes each, the cerebellum, the brainstem,
// and the deep structures you can see with X-ray: thalamus, hypothalamus, basal ganglia,
// hippocampus, amygdala, corpus callosum and the ventricles. Hover or click a part for its jobs.
import { THREE, canvasTexture, approach } from '../kit.js';
import { makeBrain, INFO, FACTS, board } from '../brain.js';

// A cross-section through the cortex: a 2–4 mm ribbon of grey matter (cell bodies) folded over
// white matter (myelinated axons). Fischl & Dale 2000 (PNAS 97:11050): average about 2.5 mm.
function drawCortex(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8eef8'; g.font = 'bold 26px sans-serif'; g.fillText('A slice through the cortex (zoomed in)', 24, 40);
  const top = (x) => 150 + 55 * Math.sin((x / w) * Math.PI * 5.2) + 12 * Math.sin((x / w) * 31);
  const Y0 = h - 40, thick = 42;                                   // 42 px ≈ 2.5 mm at this zoom
  // grey matter
  g.beginPath(); g.moveTo(0, Y0);
  for (let x = 0; x <= w; x += 4) g.lineTo(x, top(x));
  g.lineTo(w, Y0); g.closePath(); g.fillStyle = '#b98e86'; g.fill();
  // white matter below it
  g.beginPath(); g.moveTo(0, Y0);
  for (let x = 0; x <= w; x += 4) g.lineTo(x, top(x) + thick);
  g.lineTo(w, Y0); g.closePath(); g.fillStyle = '#f1e6d6'; g.fill();
  // a few neurons in the grey ribbon and axons running into the white
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
  for (let x = 40; x < w; x += 70) { const y = top(x) + thick * 0.45; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x + 6, y + thick + 40); g.stroke(); }
  g.font = 'bold 22px sans-serif';
  g.fillStyle = '#ffd166'; g.fillText('gyrus (ridge)', w * 0.06, top(w * 0.1) - 18);
  g.fillText('sulcus (groove)', w * 0.24, top(w * 0.29) + thick + 34);
  g.fillStyle = '#ffe3dc'; g.fillText('grey matter: 2–4 mm of cell bodies', w * 0.44, 92);
  g.fillStyle = '#3a2f28'; g.fillText('white matter: wires wrapped in fatty myelin', w * 0.3, Y0 - 16);
}

export default {
  id: 'anatomy',
  short: 'The map of parts',
  title: 'Inside the human brain',
  subtitle: 'Two wrinkled halves, four lobes each, and a busy core.',
  view: { pos: [-1.3, 3.4, 7.2], target: [-0.95, 2.75, 0] },
  learn: `<p>Your brain weighs about <b>1.3 to 1.4 kg</b>, roughly as much as a small pineapple, and it is soft, about like firm tofu. The biggest part is the <b>cerebrum</b>: two halves, the left and right <b>hemispheres</b>, split by a deep groove down the middle. We are looking at the patient’s <b>left</b> side, with the forehead on your left.</p>
    <p>Each hemisphere has four <b>lobes</b>. The <b>frontal</b> lobe plans and decides, the <b>parietal</b> lobe feels touch and knows where you are, the <b>temporal</b> lobe hears and helps you remember, and the <b>occipital</b> lobe at the back sees. The <b>central sulcus</b> separates frontal from parietal, and the <b>lateral fissure</b> tucks the temporal lobe underneath.</p>
    <p>The surface is folded into ridges, <b>gyri</b>, and grooves, <b>sulci</b>. The outer layer, the <b>cortex</b>, is <b>grey matter</b> only 2 to 4 mm thick. Folding packs a sheet about the size of a large pillowcase into your skull. Under it lies <b>white matter</b>: billions of wires wrapped in fatty insulation.</p>
    <p>Under the back sits the <b>cerebellum</b> (“little brain”), which keeps you balanced. The <b>brainstem</b> (midbrain, pons and medulla) runs your breathing and heartbeat and joins the spinal cord. Deep inside, turn on X-ray to find the <b>thalamus</b>, <b>hypothalamus</b>, <b>hippocampus</b>, <b>amygdala</b>, <b>basal ganglia</b>, the <b>corpus callosum</b> bridge, and fluid-filled <b>ventricles</b>.</p>
    <p class="tip"><b>Try it:</b> hover or click any part to see its jobs. Turn on X-ray and take the brain apart to find the seahorse-shaped hippocampus.</p>`,
  terms: [
    { t: 'Hemisphere', d: 'One half of the cerebrum. The left hemisphere mostly controls and feels the right side of the body, and the other way round.' },
    { t: 'Lobe', d: 'One of the four big regions of each hemisphere: frontal, parietal, temporal and occipital.' },
    { t: 'Gyrus and sulcus', d: 'A ridge (gyrus) and a groove (sulcus) in the folded surface of the brain.' },
    { t: 'Cortex', d: 'The outer 2–4 mm of the cerebrum: grey matter, packed with nerve cell bodies.' },
    { t: 'White matter', d: 'The inner bulk of the cerebrum: nerve fibres wrapped in pale, fatty myelin.' },
    { t: 'Brainstem', d: 'The stalk joining brain to spinal cord: midbrain, pons and medulla. It keeps you breathing.' },
    { t: 'Corpus callosum', d: 'A thick band of about 200 million fibres that links the two hemispheres.' },
  ],
  defaults: { explode: 0, xray: false, lobes: true, labels: true, cortex: false, sel: '' },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'apart'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'xray', type: 'toggle', label: 'X-ray: see the deep parts' },
    { key: 'lobes', type: 'toggle', label: 'Colour the lobes' },
    { key: 'cortex', type: 'toggle', label: 'Zoom into the cortex' },
    { key: 'labels', type: 'toggle', label: 'Labels' },
    { key: 'sel', type: 'seg', label: 'Show me', options: [{ v: 'frontal', label: 'Frontal' }, { v: 'parietal', label: 'Parietal' }, { v: 'temporal', label: 'Temporal' }, { v: 'occipital', label: 'Occipital' }, { v: 'cerebellum', label: 'Cerebellum' }, { v: 'medulla', label: 'Brainstem' }, { v: 'hippocampus', label: 'Hippocampus' }, { v: 'thalamus', label: 'Thalamus' }], fmt: (v) => INFO[v]?.name || 'or click the model' },
  ],
  onChange(s, key) { if (key === 'sel' && ['hippocampus', 'thalamus', 'amygdala'].includes(s.sel)) s.xray = true; },
  quiz: [
    { q: 'Which lobe is mainly for vision?', options: ['Frontal', 'Temporal', 'Occipital', 'Parietal'], answer: 2, why: 'The occipital lobe at the back of the head holds the visual cortex, where signals from the eyes arrive.' },
    { q: 'How thick is the grey-matter cortex?', options: ['About 2–4 mm', 'About 2–4 cm', 'About 0.1 mm', 'Half the brain'], answer: 0, why: 'The cortex is a thin sheet, only millimetres thick. Folding into gyri and sulci packs a large area into the skull.' },
    { q: 'What does the corpus callosum do?', options: ['Makes cerebrospinal fluid', 'Links the left and right hemispheres', 'Controls breathing', 'Stores memories'], answer: 1, why: 'It is a bridge of about 200 million nerve fibres that lets the two halves share information.' },
  ],
  reel: [
    { ms: 5200, caption: 'Your brain: about 1.4 kg of soft tissue, folded so a pillowcase-sized sheet fits in your skull.', set: { explode: 0, xray: false, lobes: false, labels: false, cortex: false, sel: '' }, view: { pos: [0.3, 3.7, 7.4], target: [0.2, 2.95, 0] }, spin: 0.5 },
    { ms: 5600, caption: 'Four lobes on each side, a cerebellum for balance, and a brainstem that keeps you breathing.', set: { xray: false, lobes: true, labels: true, cortex: false, sel: '' }, anim: { explode: [0, 0.7] }, view: { pos: [0.6, 3.9, 8.6], target: [0.3, 2.85, 0] }, spin: 0.3 },
  ],

  build({ stage, s }) {
    const root = new THREE.Group(); root.position.set(0, 3.0, 0); stage.root.add(root);
    const brain = makeBrain(stage);
    root.add(brain.root);
    const cx = canvasTexture(1000, 560, drawCortex);
    const cb = board(cx, 3.6, 2.0); cb.position.set(3.1, 5.35, 0.2); stage.root.add(cb);
    let xr = 0, lob = 1, cbk = 0, hover = '';
    // Hover: show the part under the pointer; click (pick) locks it in.
    const ray = new THREE.Raycaster(), v = new THREE.Vector2(), el = stage.renderer.domElement;
    const hits = () => (xr > 0.5 ? [...brain.deepPickables, ...brain.stem.children, brain.parts.cerebellum] : brain.pickables);
    const onMove = (e) => {
      if (e.buttons) return;
      const b = el.getBoundingClientRect();
      v.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(v, stage.camera);
      const h = ray.intersectObjects(hits(), false)[0];
      hover = h ? h.object.userData.id : '';
    };
    el.addEventListener('pointermove', onMove);
    const fmtB = (n) => (n / 1e9).toFixed(0) + ' billion';
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        xr = approach(xr, s.xray ? 1 : 0, 6, dt);
        lob = approach(lob, s.lobes ? 1 : 0, 6, dt);
        cbk = approach(cbk, s.cortex ? 1 : 0, 6, dt);
        brain.setXray(xr); brain.setLobeColours(lob); brain.setExplode(s.explode);
        stage.pickables = hits();
        brain.highlight(hover || s.sel);
        cb.visible = cbk > 0.02; cb.material.opacity = cbk; cb.scale.setScalar(0.6 + 0.4 * cbk);
        const narrow = stage.host.clientWidth < 560;
        root.position.set(narrow ? -0.95 : 0, narrow ? 2.15 : 3.0, 0);          // on phones the readout sits over the top: centre the brain lower
        brain.showLabels({ lobe: s.labels && xr < 0.5, deep: s.labels && xr >= 0.5 && !narrow, side: s.labels, stem: s.labels && s.explode > 0.35 && xr < 0.5, narrow });
      },
      pick(o) { s.sel = o.userData.id; },
      readout: (s) => {
        const id = hover || s.sel, info = INFO[id];
        if (info) return `<div class="big">${info.name}</div><small style="display:block;max-width:300px">${info.jobs}</small>`;
        return `<div class="big">About ${fmtB(FACTS.neurons)} neurons</div>
          <div class="row"><span>Cerebellum</span><b>about ${fmtB(FACTS.cerebNeurons)}</b></div>
          <div class="row"><span>Cerebral cortex</span><b>about ${fmtB(FACTS.cortexNeurons)}</b></div>
          <small>Counts: Azevedo, Herculano-Houzel et al., 2009. Hover or click a part.</small>`;
      },
      dispose() { el.removeEventListener('pointermove', onMove); },
    };
  },
};
