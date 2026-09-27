// Chapter 4: who does what. Functional areas painted on the cortex, a "light up a task" set of
// buttons showing the typical regions an fMRI scan finds for each task, a sensory homunculus, and
// a whole-day replay that busts the "we only use 10% of our brain" myth.
// Area locations follow Kandel ch. 16–19 and Penfield & Rasmussen (1950). fMRI measures the
// blood-oxygen (BOLD) response, which peaks about 4–6 s after the neurons fire (Logothetis 2008,
// Nature 453:869), so the glow here rises and fades slowly on purpose.
import { THREE, M, approach, smooth, clamp } from '../kit.js';
import { makeBrain, regionWeights, paintRegions, tint } from '../brain.js';

const TASKS = {
  none: { label: 'Just the map', levels: {}, deep: null, say: 'The main areas, each with its own job.' },
  see: { label: 'See', levels: { visual: 1, visual2: 0.7 }, say: 'Vision lights the occipital lobe first, then streams forward into the temporal and parietal lobes.' },
  hear: { label: 'Hear', levels: { auditory: 1 }, say: 'Sounds reach the auditory cortex on the top of both temporal lobes.' },
  hand: { label: 'Move right hand', levels: { handL: 1, sensHandL: 0.6, cbR: 0.7 }, say: 'The LEFT motor strip moves the RIGHT hand. The cerebellum works on the same side as the hand.' },
  speak: { label: 'Speak', levels: { broca: 1, mouth: 0.85, auditory: 0.5, wernicke: 0.45 }, say: 'Broca’s area plans the words, the motor strip moves lips and tongue, and you hear yourself.' },
  remember: { label: 'Remember', levels: { prefrontal: 0.75, visual2: 0.35 }, deep: 'hippocampus', say: 'The hippocampus, deep inside, works with the prefrontal cortex to store and recall.' },
  day: { label: 'A whole day', levels: {}, say: '' },
};
const DAY = [['see', 'Reading this'], ['hear', 'Listening to a friend'], ['speak', 'Answering back'], ['hand', 'Writing a note'], ['remember', 'Recalling a phone number'], ['plan', 'Planning the weekend'], ['feel', 'Feeling the rain'], ['balance', 'Cycling home']];
const EXTRA = { plan: { prefrontal: 1 }, feel: { sensory: 1 }, balance: { cb: 1, motor: 0.6 } };

// A sensory homunculus: the body drawn with each part as big as its patch of touch cortex.
// Hands, lips and tongue are huge; the trunk and legs are small (Penfield & Rasmussen 1950).
function homunculus() {
  const g = new THREE.Group(), skin = new THREE.MeshPhysicalMaterial({ color: 0xf0a58f, roughness: 0.55, clearcoat: 0.3 });
  const sp = (r, p, s = [1, 1, 1]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), skin); m.position.set(...p); m.scale.set(...s); m.castShadow = true; g.add(m); return m; };
  const cap = (a, b, r) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, A.distanceTo(B), 6, 14), skin); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = true; g.add(m); return m; };
  cap([0, 0.35, 0], [0, 0.75, 0], 0.16);                  // small trunk
  cap([-0.08, 0.3, 0], [-0.14, -0.15, 0.02], 0.05); cap([0.08, 0.3, 0], [0.14, -0.15, 0.02], 0.05);   // thin legs
  sp(0.07, [-0.16, -0.2, 0.06], [1.2, 0.6, 1.6]); sp(0.07, [0.16, -0.2, 0.06], [1.2, 0.6, 1.6]);         // feet
  cap([-0.15, 0.78, 0], [-0.42, 0.5, 0.05], 0.05); cap([0.15, 0.78, 0], [0.42, 0.5, 0.05], 0.05);        // arms
  for (const sx of [-1, 1]) {                                                                                // huge hands
    sp(0.2, [sx * 0.55, 0.42, 0.08], [1, 1.1, 0.5]);
    for (let f = 0; f < 5; f++) { const a = (f - 2) * 0.32; cap([sx * (0.55 + Math.sin(a) * 0.14), 0.52 + Math.cos(a) * 0.12, 0.08], [sx * (0.55 + Math.sin(a) * 0.34), 0.52 + Math.cos(a) * 0.33, 0.1], f === 0 ? 0.07 : 0.055); }
  }
  sp(0.26, [0, 1.12, 0], [1, 1.05, 0.95]);                // head
  sp(0.05, [-0.1, 1.2, 0.22]); sp(0.05, [0.1, 1.2, 0.22]); // eyes
  const lips = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.07, 14, 28), new THREE.MeshPhysicalMaterial({ color: 0xe0556a, roughness: 0.4, clearcoat: 0.6 }));
  lips.position.set(0, 1.0, 0.25); lips.scale.set(1.3, 0.75, 1); g.add(lips);
  const tongue = sp(0.08, [0, 0.98, 0.3], [1.2, 0.5, 1]); tongue.material = new THREE.MeshPhysicalMaterial({ color: 0xff7f8f, roughness: 0.4 });
  return g;
}

export default {
  id: 'map',
  short: 'Who does what',
  title: 'Who does what',
  subtitle: 'Areas with jobs, a body map with giant hands, and no silent 90%.',
  view: { pos: [-0.1, 3.5, 8.6], target: [0.25, 2.75, 0] },
  learn: `<p>Different patches of cortex have different main jobs. At the back, the <b>visual cortex</b> in the occipital lobe handles what you see (see <a href="/eyeclear/">EyeClear</a>). On top of the temporal lobe, the <b>auditory cortex</b> handles sound (see <a href="/earclear/">EarClear</a>). The <b>prefrontal cortex</b> behind your forehead plans, decides and holds back impulses. The <b>cerebellum</b> smooths every movement, and the <b>hippocampus</b> helps you remember.</p>
    <p>Just in front of the central sulcus runs the <b>motor strip</b>, which moves the body, and just behind it the <b>touch strip</b>. Each has a map of the body, the <b>homunculus</b> (“little man”). Hands, lips and tongue get huge areas because they are so skilled and sensitive. The maps are crossed: your <b>left</b> hemisphere moves and feels your <b>right</b> side.</p>
    <p>In most people, language leans left: <b>Broca’s area</b> helps produce speech and <b>Wernicke’s area</b> helps understand it. But “left-brained” logical and “right-brained” creative <b>personalities are a myth</b>. A 2013 study of over 1,000 brain scans found no sign of people being more left- or right-brained overall. Both halves work together all the time.</p>
    <p>And the <b>“we only use 10% of our brain” myth</b>? Also false. Brain scans show activity all over the brain, and over a day every region gets busy. Damage to almost any small area causes problems. The brain is far too hungry for energy to carry 90% dead weight. Real scans, like fMRI (see <a href="/mriclear/">MRIClear</a>), show the <b>extra</b> activity a task adds on top of a brain that is always working.</p>
    <p class="tip"><b>Try it:</b> press each task, then press “A whole day” and watch the whole cortex light up, one activity at a time.</p>`,
  terms: [
    { t: 'Motor cortex', d: 'The strip in front of the central sulcus that sends movement commands to the muscles.' },
    { t: 'Somatosensory cortex', d: 'The strip behind the central sulcus that receives touch, pain, temperature and body position.' },
    { t: 'Homunculus', d: 'The body map on the motor and touch strips, drawn as a figure with each part sized by its brain area.' },
    { t: 'Broca’s area', d: 'A region of the left frontal lobe that helps produce speech. Named after Paul Broca (1861).' },
    { t: 'Wernicke’s area', d: 'A region of the left temporal lobe that helps understand language. Named after Carl Wernicke (1874).' },
    { t: 'fMRI', d: 'Functional MRI: a scan that tracks changes in blood oxygen, a sign of where neurons are working harder.' },
    { t: 'Contralateral', d: 'On the opposite side. Each hemisphere mainly controls and feels the other side of the body.' },
  ],
  defaults: { task: 'none', homunculus: true },
  controls: [
    { key: 'task', type: 'seg', label: 'Light up a task', options: Object.entries(TASKS).map(([v, t]) => ({ v, label: t.label })), fmt: (v) => (v === 'none' ? '' : 'typical fMRI-style result') },
    { key: 'homunculus', type: 'toggle', label: 'Show the homunculus' },
  ],
  quiz: [
    { q: 'Which hemisphere mainly moves your right hand?', options: ['The right', 'The left', 'Both equally', 'Neither: the spinal cord does'], answer: 1, why: 'Movement and touch are crossed: the left motor strip controls the right side of the body.' },
    { q: 'Why are the homunculus’s hands and lips so big?', options: ['They are heavy', 'They have the most brain area, for fine control and touch', 'Babies have big hands', 'It is a cartoon joke'], answer: 1, why: 'Each body part is drawn as big as its patch of cortex. Hands, lips and tongue are the most skilled and sensitive.' },
    { q: 'Do we only use 10% of our brain?', options: ['Yes, the rest is spare', 'No: scans show activity all over the brain, and every area has jobs', 'Only geniuses use more', 'Only when asleep'], answer: 1, why: 'It is a myth. Over a day every region is active, and damage to almost any area causes problems.' },
  ],
  reel: [
    { ms: 5400, caption: 'Each patch of cortex has main jobs: move your right hand, and your LEFT motor strip lights up.', set: { task: 'hand', homunculus: true }, spin: 0 },
    { ms: 5800, caption: 'The 10% myth is false: across a day, every part of the brain gets busy.', set: { task: 'day', homunculus: false }, act: (s, inst) => inst?.restartDay?.(), spin: 0.35 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.set(0.3, 3.0, 0); stage.root.add(root);
    const brain = makeBrain(stage, { labels: false });
    root.add(brain.root);
    [...brain.cortex, brain.parts.cerebellum].forEach((m) => m.material.color.set(0xffffff));
    const BASE = [0.65, 0.32, 0.28];                              // the cortex colour (linear RGB), now carried in the vertex colours
    const W = regionWeights(brain, ['motor', 'sensory', 'handL', 'sensHandL', 'mouth', 'visual', 'visual2', 'auditory', 'broca', 'wernicke', 'prefrontal', 'cb', 'cbR', 'all']);
    // the base map: strips and areas in soft colours
    const MAPC = { motor: [0.12, 0.3, 1.0], sensory: [1.0, 0.62, 0.05], visual: [1.0, 0.2, 0.55], auditory: [0.08, 0.75, 0.35], broca: [0.45, 0.15, 1.0], wernicke: [0.05, 0.55, 1.0], prefrontal: [0.25, 0.4, 0.85] };
    const baseMap = (s, i, r, g, b) => {
      let best = 0, col = null;
      for (const k of Object.keys(MAPC)) { const w = W[brain.surfaces.indexOf(s)][k][i]; if (w > best) { best = w; col = MAPC[k]; } }
      if (!col) return [r, g, b];
      const sh = s.shade[i], k = 0.7 * best * mapK;
      return [r + (col[0] * sh - r) * k, g + (col[1] * sh - g) * k, b + (col[2] * sh - b) * k];
    };
    const hom = homunculus(); hom.position.set(3.25, 3.1, 0.8); hom.rotation.y = -0.35; hom.scale.setScalar(1.25); stage.root.add(hom);
    const homL = tint(stage.label('Sensory homunculus', [3.25, 5.05, 0.8]), 'gold');
    const L = (t, p, cls) => tint(stage.label(t, p, root), cls);
    const areaL = {
      motor: L('Motor strip', [-0.75, 1.2, 1.5], '#8fb0ff'), sensory: L('Touch strip', [0.75, 1.25, 1.5], '#ffd166'),
      visual: L('Vision', [2.25, 0.2, 0.9], '#ff8fc4'), auditory: L('Hearing', [0.2, -0.95, 1.7], '#5ce1a9'),
      broca: L('Broca’s area', [-1.45, -0.45, 1.6], '#b58cff'), wernicke: L('Wernicke’s area', [1.35, -0.75, 1.5], '#7fd4ff'),
      prefrontal: L('Prefrontal cortex', [-2.0, 0.9, 1.0], '#9fb3ff'), cb: L('Cerebellum', [1.7, -1.35, 1.0], '#ffa24a'),
      hippo: L('Hippocampus (deep)', [0.3, -0.8, 0.9], '#ffe066'),
    };
    const stripL = [L('leg', [0.15, 1.75, 0.4], 'side'), L('hand', [-0.75, 0.85, 1.6], 'side'), L('face', [-0.85, 0.4, 1.7], 'side'), L('lips, tongue', [-0.95, 0.1, 1.75], 'side')];
    const lv = {}, target = {};
    let mapK = 1, dayT = 0, dayIdx = -1, dayDone = false, now = '', xr = 0, hip = 0, dirty = true, prevTask = '';
    const inst = {
      restartDay() { dayT = 0; dayIdx = -1; dayDone = false; for (const k of Object.keys(lv)) lv[k] = 0; },
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.task !== prevTask) { if (s.task === 'day') inst.restartDay(); prevTask = s.task; }
        for (const k of Object.keys(target)) target[k] = 0;
        let deep = null;
        if (s.task === 'day') {
          dayT += dt;
          const i = Math.min(DAY.length - 1, Math.floor(dayT / 0.75));
          if (dayT > DAY.length * 0.75) dayDone = true;
          const [task, what] = DAY[i]; now = dayDone ? 'By bedtime: every region has had work to do.' : what;
          // everything used so far stays faintly lit
          for (let j = 0; j <= i; j++) { const lv0 = TASKS[DAY[j][0]]?.levels || EXTRA[DAY[j][0]]; for (const [k, v] of Object.entries(lv0)) target[k] = Math.max(target[k] || 0, j === i && !dayDone ? v : 0.5 * v); }
          if (task === 'remember' && !dayDone) deep = 'hippocampus';
          if (dayDone) target.all = 0.45;
        } else {
          for (const [k, v] of Object.entries(TASKS[s.task].levels)) target[k] = v;
          deep = TASKS[s.task].deep || null; now = TASKS[s.task].say;
        }
        const rate = s.task === 'day' ? 5 : 1.8;                   // slow like a real BOLD response, faster in the day replay
        for (const k of new Set([...Object.keys(target), ...Object.keys(lv)])) {
          const a = lv[k] || 0, b = target[k] || 0, c = approach(a, b, rate, dt);
          if (Math.abs(c - a) > 1e-4) dirty = true;
          lv[k] = c;
        }
        const mk = approach(mapK, s.task === 'none' ? 1 : 0, 3, dt);
        if (Math.abs(mk - mapK) > 1e-4) dirty = true;
        mapK = mk;
        if (dirty) { paintRegions(brain, W, lv, [1.0, 0.2, 0.0], mapK > 0.01 ? baseMap : null, BASE); dirty = false; }
        // X-ray a little to show the hippocampus when remembering
        xr = approach(xr, deep ? 0.75 : 0, 3, dt); hip = approach(hip, deep ? 1 : 0, 3, dt);
        brain.setXray(xr); brain.highlight(hip > 0.05 ? 'hippocampus' : null, hip);
        brain.deep.visible = xr > 0.05;
        hom.visible = s.homunculus; homL.visible = s.homunculus;
        const show = s.task === 'none' ? Object.keys(areaL).filter((k) => k !== 'hippo') : Object.keys(target).filter((k) => target[k] > 0.3).map((k) => ({ visual2: 'visual', handL: 'motor', sensHandL: 'sensory', mouth: 'motor', cbR: 'cb' }[k] || k));
        if (deep) show.push('hippo');
        const narrow = stage.host.clientWidth < 560;
        root.position.set(narrow ? -0.25 : 0.3, narrow ? 2.5 : 3.0, 0); hom.visible = s.homunculus && !narrow; homL.visible = hom.visible;
        for (const [k, l] of Object.entries(areaL)) l.visible = show.includes(k) && s.task !== 'day' && (!narrow || ['motor', 'visual', 'auditory', 'prefrontal', 'hippo'].includes(k));
        stripL.forEach((l) => { l.visible = (s.task === 'hand' || s.task === 'speak') && !narrow; });
      },
      readout: (s) => {
        const t = TASKS[s.task];
        if (s.task === 'none') return `<div class="big">A map of main jobs</div><small style="display:block;max-width:300px">${t.say} Press a task to see what lights up.</small>`;
        if (s.task === 'day') return `<div class="big">${dayDone ? 'The whole brain, used' : now}</div><small style="display:block;max-width:300px">${dayDone ? 'The “10% of the brain” idea is a myth. Different tasks use different mixes, and over a day, all of it works.' : 'Each activity lights its own areas. Earlier ones stay faintly lit.'}</small>`;
        return `<div class="big">${t.label}</div><small style="display:block;max-width:300px">${t.say} The glow is the extra activity on top of a brain that is always busy. fMRI sees it about 5 s later, through blood flow.</small>`;
      },
    };
    return inst;
  },
};
