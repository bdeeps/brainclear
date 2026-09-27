// BrainClear's 3D brain: a stylised but anatomically placed human brain.
//
// Axes of the brain group (one model unit is about 4 cm):
//   +x = towards the BACK of the head (posterior), −x = towards the forehead (anterior)
//   +y = up (towards the top of the head)
//   +z = the patient's LEFT side, −z = the patient's RIGHT side
// So the default camera, sitting at +z, looks at the LEFT hemisphere from the side (a "left
// lateral view", the classic atlas view), with the forehead on the viewer's left.
//
// Sizes and placement follow standard neuroanatomy (Kandel et al., Principles of Neural Science,
// 5th ed., ch. 15; Gray's Anatomy; NINDS "Brain Basics: Know Your Brain"):
//  - an adult brain is about 16–17 cm long, 14 cm wide and 9–10 cm tall, and weighs about 1.3–1.4 kg;
//  - four lobes per hemisphere: frontal (in front of the central sulcus), parietal (behind it),
//    occipital (at the back), temporal (below the lateral, or Sylvian, fissure);
//  - the cerebellum sits under the occipital lobes, behind the brainstem;
//  - the brainstem runs down from the midbrain through the pons to the medulla and the spinal cord;
//  - deep inside: thalamus, hypothalamus (with the pituitary below), basal ganglia (caudate and
//    lentiform nucleus), hippocampus and amygdala in the medial temporal lobe, the corpus callosum
//    bridging the hemispheres, and the fluid-filled ventricles.
import { THREE, M, tube, clamp, lerp, smooth } from './kit.js';

// ---------------------------------------------------------------- numbers (with sources)
export const FACTS = {
  neurons: 86e9,          // Azevedo et al. 2009 (Herculano-Houzel lab), J Comp Neurol 513:532: 86.1 ± 8.1 billion
  cortexNeurons: 16e9,    // same paper: 16.3 billion in the cerebral cortex
  cerebNeurons: 69e9,     // same paper: 69.0 billion in the cerebellum
  glia: 85e9,             // same paper: 84.6 billion non-neuronal cells
  synapses: 1e14,         // "about 100 trillion", an order-of-magnitude estimate (estimates range ~1e14 to 1e15)
  massKg: 1.35,           // NINDS: about 3 lb; adult brains typically 1.2–1.5 kg
  energyShare: 0.2,       // about 20% of the body's resting energy use (Raichle & Gusnard 2002, PNAS 99:10237)
  massShare: 0.02,        // at about 2% of body mass
  watts: 20,              // about 20 W (20% of a ~100 W resting metabolism)
  cortexMm: [2, 4],       // cerebral cortex is about 2–4 mm thick (Fischl & Dale 2000, PNAS 97:11050: mean ~2.5 mm)
  ccAxons: 200e6,         // corpus callosum: about 200 million axons (Aboitiz et al. 1992, Brain Res 598:143)
  csfMlDay: 500,          // CSF made at about 500 mL a day, about 150 mL present at any time
};

// ---------------------------------------------------------------- what each part does
export const INFO = {
  frontal: { name: 'Frontal lobe', jobs: 'Planning, decisions, attention and self-control. Its back strip, the motor cortex, moves your body. On the left, Broca’s area helps you speak.', col: 0x6fa8ff },
  parietal: { name: 'Parietal lobe', jobs: 'Touch, pain, temperature and body position. It works out where things are around you, and helps with reading and maths.', col: 0xffd166 },
  temporal: { name: 'Temporal lobe', jobs: 'Hearing, understanding words (Wernicke’s area, usually on the left), recognising faces. Deep inside sit memory and emotion centres.', col: 0x5ce1a9 },
  occipital: { name: 'Occipital lobe', jobs: 'Vision. Signals from your eyes arrive here, via the thalamus, and are turned into edges, colours and motion.', col: 0xff8fc4 },
  cerebellum: { name: 'Cerebellum', jobs: 'Balance, coordination and smooth, accurate movement. It learns skills like cycling. About 69 of the 86 billion neurons are here.', col: 0xffa24a },
  midbrain: { name: 'Midbrain', jobs: 'Eye movements and quick reflexes to sights and sounds. Its substantia nigra makes dopamine for movement.', col: 0xb7a6ff },
  pons: { name: 'Pons', jobs: 'A bridge carrying signals between the cerebrum and the cerebellum. Helps set breathing rhythm and sleep, including REM.', col: 0xb7a6ff },
  medulla: { name: 'Medulla', jobs: 'Automatic life support: heartbeat, blood pressure, breathing, swallowing, coughing. Most movement nerves cross sides here.', col: 0xb7a6ff },
  cord: { name: 'Spinal cord', jobs: 'The cable to and from the body, carrying movement commands down and sensations up. It runs its own quick reflexes too.', col: 0xb7a6ff },
  thalamus: { name: 'Thalamus', jobs: 'The relay hub. Every sense except smell passes through it on the way to the cortex. It also helps keep you awake and alert.', col: 0xffb86b },
  hypothalamus: { name: 'Hypothalamus', jobs: 'The body’s thermostat and clock: temperature, hunger, thirst, sleep and hormones, through the pituitary gland below it.', col: 0xff7a59 },
  pituitary: { name: 'Pituitary gland', jobs: 'A pea-sized gland that releases hormones for growth, stress, water balance and more, on orders from the hypothalamus.', col: 0xff7a59 },
  hippocampus: { name: 'Hippocampus', jobs: 'Turns today’s experiences into lasting memories, and builds your inner map of places. Named after its seahorse shape.', col: 0xffe066 },
  amygdala: { name: 'Amygdala', jobs: 'An almond-shaped alarm for emotion, especially fear. It makes emotional moments easier to remember.', col: 0xff5d73 },
  basal: { name: 'Basal ganglia', jobs: 'Help choose and start movements and form habits. In Parkinson’s disease, their dopamine supply fades.', col: 0x7fd4ff },
  callosum: { name: 'Corpus callosum', jobs: 'A thick bridge of about 200 million nerve fibres that lets the two hemispheres share information.', col: 0xf2f2f2 },
  ventricles: { name: 'Ventricles', jobs: 'Four linked chambers of cerebrospinal fluid. The fluid cushions the brain and carries away waste. About 500 mL is made a day.', col: 0x6cc9ff },
};

export const CORTEX = 0xd39a90;     // a stylised living-cortex pink-grey
export const WHITE = 0xf3e7da;      // white matter, fatty myelin
const LEFT = 1, RIGHT = -1;

// ---------------------------------------------------------------- Perlin noise (Ken Perlin's improved noise, 2002)
const P = new Uint8Array(512);
{ let s = 1234567; const a = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } for (let i = 0; i < 512; i++) P[i] = a[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
export function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(lerp(lerp(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u), lerp(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
    lerp(lerp(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u), lerp(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v), w);
}

// ---------------------------------------------------------------- landmarks (brain space)
// The central sulcus: runs from the top, a little behind the middle, down and forwards to the
// lateral fissure. Frontal lobe in front of it, parietal behind.
export const xCentral = (y) => -0.32 + 0.52 * clamp((y + 0.1) / 1.5, 0, 1.2) + 0.035 * Math.sin(y * 7);
// The parieto-occipital boundary (parieto-occipital sulcus on the inside, preoccipital notch outside).
export const xOccip = (y) => 1.32 + 0.12 * y;
const HEMI = { cx: 0, cy: 0.25, cz: 0.42, rxF: 2.02, rxB: 2.1, ryU: 1.36, ryD: 0.6, rzOut: 1.3, rzIn: 0.36 };

// The lateral surface of a hemisphere at (x, y): used to put arteries and regions on the outside.
export function surfaceZ(side, x, y) {
  const ux = x / (x < 0 ? HEMI.rxF : HEMI.rxB), uy = (y - HEMI.cy) / (y > HEMI.cy ? HEMI.ryU : HEMI.ryD);
  const q = Math.max(0, 1 - ux * ux - uy * uy);
  return side * (HEMI.cz + HEMI.rzOut * (1 + 0.1 * ux) * Math.sqrt(q));
}

// A tapered cylinder between two points.
export function taper(a, b, r0, r1, mat, seg = 24) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r1, r0, A.distanceTo(B), seg);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = true;
  return m;
}

// Bake a mesh's transform into its geometry, so every part shares brain space.
function bake(geo, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl));
  geo.applyMatrix4(m);
  return geo;
}
export function ellipsoid(c, r, seg = 32, rot) { return bake(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), c, rot, r); }

const cortexMat = () => new THREE.MeshPhysicalMaterial({ color: CORTEX, vertexColors: true, roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.5, transparent: true, opacity: 1, side: THREE.DoubleSide });

// ---------------------------------------------------------------- cortex geometry
// A sphere reshaped into one hemisphere, then wrinkled into gyri (ridges) and sulci (grooves).
// The sulci are the zero lines of a smooth noise field, stretched in each lobe so the gyri run
// roughly the right way: front-to-back in the frontal and temporal lobes, up-and-down either side
// of the central sulcus (the precentral and postcentral gyri).
function wrinkle(p, lobe, side) {
  const s = side * 3.1;
  let n;
  if (lobe === 'frontal') n = noise(p.x * 1.3 + 11, p.y * 2.9, p.z * 2.9 + s);
  else if (lobe === 'temporal') n = noise(p.x * 1.2 + 5, p.y * 3.4, p.z * 2.8 + s);
  else n = noise(p.x * 2.6 + 17, p.y * 2.6, p.z * 2.6 + s);
  n += 0.4 * noise(p.x * 5.3, p.y * 5.3 + 7, p.z * 5.3 + s);
  return smooth(Math.abs(n) / 0.17);                // 0 in a sulcus, 1 on top of a gyrus
}

function hemisphere(side) {
  const g = new THREE.SphereGeometry(1, 240, 160);
  g.rotateY(-side * Math.PI / 2);                 // put the sphere's seam on the hidden medial face
  const pos = g.attributes.position, n = pos.count;
  const shade = new Float32Array(n), lobe = new Array(n);
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const lat = uz * side > 0;
    let x = ux * (ux < 0 ? HEMI.rxF : HEMI.rxB);
    const ryD = lerp(0.56, 0.98, smooth((x + 0.6) / 1.1));                    // the back half reaches lower, down to the cerebellum
    let y = HEMI.cy + uy * (uy > 0 ? HEMI.ryU : ryD);
    if (ux > 0.55 && uy < 0) y += (ux - 0.55) * 0.35 * uy;                       // occipital pole a little lower and narrower underneath
    if (ux < -0.4 && uy < 0) y += (-ux - 0.4) * 0.3 * smooth(-uy / 0.25);                              // flatter orbital (under-)surface of the frontal lobe
    const z = side * HEMI.cz + uz * (lat ? HEMI.rzOut * (1 + 0.1 * ux) : HEMI.rzIn);
    v.set(x, y, z);
    // which lobe (by the undeformed position)
    const L = x < xCentral(Math.max(y, -0.1)) ? 'frontal' : x > xOccip(y) ? 'occipital' : 'parietal';
    lobe[i] = L;
    // gyri and sulci, plus the named sulci as deeper grooves
    let h = wrinkle(v, L, side);
    const dc = x - xCentral(y);
    const band = Math.abs(dc) < 0.36 && y > -0.15;
    if (band) {                                                                   // pre- and postcentral gyri: clean vertical strips
      const w = 0.03 * Math.sin(y * 9 + z * 3);
      const g3 = Math.min(Math.abs(dc), Math.abs(dc + 0.3 + w), Math.abs(dc - 0.3 - w));
      h = Math.min(h * 0.3 + 0.7, smooth(g3 / 0.07));
    }
    const medial = !lat && Math.abs(uz) > 0.5;
    const depth = (band && Math.abs(dc) < 0.07 ? 0.12 : 0.08) * (medial ? 0.6 : 1);
    c.set(0, HEMI.cy, side * HEMI.cz);
    const dir = v.clone().sub(c).normalize();
    v.addScaledVector(dir, -(1 - h) * depth);
    pos.setXYZ(i, v.x, v.y, v.z);
    shade[i] = 0.42 + 0.58 * h;
  }
  g.computeVertexNormals();
  return { g, shade, lobe };
}

function temporalLobe(side) {
  const g = new THREE.SphereGeometry(1, 170, 100);
  g.rotateY(-side * Math.PI / 2);
  const pos = g.attributes.position, n = pos.count;
  const shade = new Float32Array(n);
  const rot = new THREE.Euler(0, 0, 0.26), v = new THREE.Vector3(), c = new THREE.Vector3(0.12, -0.52, side * 1.0);
  for (let i = 0; i < n; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const k = 1 - 0.32 * Math.max(0, -ux) ** 1.5;                                  // the temporal pole narrows at the front
    v.set(ux * 1.32, uy * 0.5 * k, uz * 0.54 * k * (uz * side < 0 ? 0.8 : 1)).applyEuler(rot).add(c);
    const h = wrinkle(v, 'temporal', side);
    const dir = v.clone().sub(c).normalize();
    v.addScaledVector(dir, -(1 - h) * 0.07);
    pos.setXYZ(i, v.x, v.y, v.z);
    shade[i] = 0.42 + 0.58 * h;
  }
  g.computeVertexNormals();
  return { g, shade };
}

// Cerebellum: finely folded in thin transverse folia, with a notch at the midline (the vermis).
function cerebellumGeo() {
  const g = new THREE.SphereGeometry(1, 160, 100);
  const pos = g.attributes.position, n = pos.count, shade = new Float32Array(n);
  const c = new THREE.Vector3(1.3, -0.98, 0), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const notch = 1 - 0.18 * Math.exp(-((uz / 0.12) ** 2)) * (ux > 0 ? 1 : 0.3);
    v.set(ux * 0.72 * notch, uy * 0.46 * (uy > 0 ? 1 : 0.95), uz * 1.18);
    const a = Math.atan2(v.y, v.x);
    const f = 0.5 + 0.5 * Math.sin(a * 34 + 0.6 * Math.sin(uz * 3));
    const deep = Math.abs(Math.sin(a * 2.5 + 0.8)) < 0.08 ? 0.05 : 0;              // the horizontal fissure
    const r = v.length();
    v.multiplyScalar((r - 0.022 * (1 - f) - deep) / r).add(c);
    pos.setXYZ(i, v.x, v.y, v.z);
    shade[i] = 0.7 + 0.3 * f - (deep ? 0.25 : 0);
  }
  g.computeVertexNormals();
  return { g, shade };
}

// Sub-geometry that shares the parent's vertex attributes but only draws some triangles.
function subset(g, keep) {
  const idx = g.index.array, out = [];
  for (let t = 0; t < idx.length; t += 3) if (keep(idx[t], idx[t + 1], idx[t + 2])) out.push(idx[t], idx[t + 1], idx[t + 2]);
  const s = new THREE.BufferGeometry();
  for (const k of Object.keys(g.attributes)) s.setAttribute(k, g.attributes[k]);
  s.setIndex(out);
  s.computeBoundingSphere();
  return s;
}

function addColor(g, shade) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade[i];
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return col;
}

// ---------------------------------------------------------------- labels
const TINT = { side: '#9fb3c8', gold: '#ffd166', deep: '#ffb86b', blue: '#6fa8ff' };
export function tint(l, cls) { const c = TINT[cls] || cls; if (c) { l.element.style.borderColor = c; l.element.style.color = c; } return l; }

// ---------------------------------------------------------------- the brain
// opts: { deep: true, labels: true, arteries: false }
export function makeBrain(stage, opts = {}) {
  const o = { deep: true, labels: true, ...opts };
  const root = new THREE.Group();
  const cortex = [], all = [], surfaces = [];               // surfaces: { mesh, col, shade, pos, side, part }
  const parts = {};
  const mk = (geo, mat, id, side) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.userData = { id, side };
    root.add(m); all.push(m);
    return m;
  };

  // ---- the two cerebral hemispheres, split into lobes
  for (const side of [LEFT, RIGHT]) {
    const S = side === LEFT ? 'L' : 'R';
    const h = hemisphere(side), col = addColor(h.g, h.shade);
    for (const lobe of ['frontal', 'parietal', 'occipital']) {
      const geo = subset(h.g, (a, b, c) => { const k = [a, b, c].filter((i) => h.lobe[i] === lobe).length; return k >= 2; });
      const m = mk(geo, cortexMat(), lobe, side);
      parts[lobe + S] = m; cortex.push(m);
    }
    surfaces.push({ geo: h.g, col, shade: h.shade, side, part: 'hemi' });
    const t = temporalLobe(side), tcol = addColor(t.g, t.shade);
    const tm = mk(t.g, cortexMat(), 'temporal', side);
    parts['temporal' + S] = tm; cortex.push(tm);
    surfaces.push({ geo: t.g, col: tcol, shade: t.shade, side, part: 'temporal' });
  }

  // ---- cerebellum
  const cb = cerebellumGeo(), cbCol = addColor(cb.g, cb.shade);
  const cbMat = cortexMat(); cbMat.color.set(0xd9a49a);
  parts.cerebellum = mk(cb.g, cbMat, 'cerebellum', 0);
  surfaces.push({ geo: cb.g, col: cbCol, shade: cb.shade, side: 0, part: 'cerebellum' });

  // ---- brainstem: midbrain, pons, medulla, top of the spinal cord
  const stemMat = () => new THREE.MeshPhysicalMaterial({ color: 0xd8b2a6, roughness: 0.5, clearcoat: 0.3, transparent: true, opacity: 1 });
  const stem = new THREE.Group(); root.add(stem);
  const addStem = (m, id) => { m.userData = { id, side: 0 }; stem.add(m); all.push(m); parts[id] = m; return m; };
  addStem(taper([0.2, -0.28, 0], [0.36, -0.74, 0], 0.27, 0.24, stemMat()), 'midbrain');
  addStem(new THREE.Mesh(ellipsoid([0.26, -0.98, 0], [0.3, 0.29, 0.38], 40), stemMat()), 'pons');
  addStem(taper([0.4, -1.2, 0], [0.52, -1.68, 0], 0.21, 0.15, stemMat()), 'medulla');
  addStem(taper([0.52, -1.68, 0], [0.56, -2.1, 0], 0.14, 0.12, stemMat()), 'cord');

  // ---- deep structures (visible with X-ray or when the brain is taken apart)
  const deep = new THREE.Group(); root.add(deep);
  const deepParts = [];
  const dm = (hex, op = 1) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.45, clearcoat: 0.4, transparent: op < 1, opacity: op, emissive: hex, emissiveIntensity: 0.12 });
  const addDeep = (m, id, side = 0) => { m.userData = { id, side }; m.castShadow = true; deep.add(m); deepParts.push(m); all.push(m); return m; };
  if (o.deep) {
    parts.hippocampus = []; parts.amygdala = []; parts.basal = []; parts.ventricles = []; parts.thalamus = [];
    const cc = tube([[-0.9, 0.12, 0], [-1.0, 0.38, 0], [-0.78, 0.6, 0], [-0.2, 0.68, 0], [0.55, 0.64, 0], [0.98, 0.44, 0], [0.86, 0.28, 0]], 0.075, dm(WHITE), false, 90);
    cc.scale.z = 5; addDeep(cc, 'callosum'); parts.callosum = cc;
    for (const side of [LEFT, RIGHT]) {
      const z = (a) => a * side;
      // lateral ventricle: frontal horn, body, atrium, occipital horn, temporal horn
      const vpts = [[-0.9, 0.22, z(0.2)], [-0.55, 0.36, z(0.22)], [0.05, 0.42, z(0.24)], [0.62, 0.36, z(0.28)], [0.95, 0.12, z(0.36)], [0.95, -0.14, z(0.5)], [0.68, -0.38, z(0.62)], [0.25, -0.52, z(0.7)], [-0.2, -0.56, z(0.72)]];
      parts.ventricles.push(addDeep(tube(vpts, 0.07, dm(0x6cc9ff, 0.85), false, 80), 'ventricles', side));
      parts.ventricles.push(addDeep(tube([[0.95, 0.12, z(0.36)], [1.3, 0.06, z(0.34)], [1.5, 0.02, z(0.3)]], 0.05, dm(0x6cc9ff, 0.85), false, 20), 'ventricles', side));
      parts.thalamus.push(addDeep(new THREE.Mesh(ellipsoid([0.32, -0.02, z(0.19)], [0.32, 0.2, 0.16]), dm(0xffb86b)), 'thalamus', side));
      // caudate nucleus hugging the ventricle, and the lentiform nucleus (putamen + globus pallidus)
      parts.basal.push(addDeep(new THREE.Mesh(ellipsoid([-0.62, 0.18, z(0.38)], [0.28, 0.2, 0.14]), dm(0x7fd4ff)), 'basal', side));
      parts.basal.push(addDeep(tube([[-0.45, 0.28, z(0.38)], [0.1, 0.36, z(0.4)], [0.62, 0.26, z(0.44)], [0.86, 0.0, z(0.56)], [0.66, -0.3, z(0.72)], [0.3, -0.42, z(0.8)]], 0.055, dm(0x7fd4ff), false, 60), 'basal', side));
      parts.basal.push(addDeep(new THREE.Mesh(ellipsoid([-0.12, -0.04, z(0.62)], [0.44, 0.27, 0.13], 32, [0, 0, -0.1]), dm(0x4fb3e8)), 'basal', side));
      // hippocampus curving back and up through the medial temporal lobe, with the amygdala at its front
      parts.hippocampus.push(addDeep(tube([[-0.3, -0.62, z(0.68)], [0.08, -0.6, z(0.68)], [0.52, -0.48, z(0.6)], [0.82, -0.22, z(0.46)]], 0.095, dm(0xffe066), false, 50), 'hippocampus', side));
      parts.hippocampus.push(addDeep(tube([[0.82, -0.22, z(0.46)], [0.72, 0.12, z(0.2)], [0.3, 0.26, z(0.08)], [-0.2, 0.14, z(0.05)]], 0.03, dm(0xffe066), false, 40), 'hippocampus', side));   // fornix
      parts.amygdala.push(addDeep(new THREE.Mesh(ellipsoid([-0.42, -0.6, z(0.66)], [0.14, 0.12, 0.12]), dm(0xff5d73)), 'amygdala', side));
    }
    parts.ventricles.push(addDeep(new THREE.Mesh(ellipsoid([0.28, -0.14, 0], [0.26, 0.2, 0.035]), dm(0x6cc9ff, 0.85)), 'ventricles'));           // third ventricle
    parts.ventricles.push(addDeep(new THREE.Mesh(ellipsoid([0.58, -0.98, 0], [0.1, 0.2, 0.16]), dm(0x6cc9ff, 0.85)), 'ventricles'));            // fourth ventricle
    parts.hypothalamus = addDeep(new THREE.Mesh(ellipsoid([-0.08, -0.3, 0], [0.16, 0.12, 0.14]), dm(0xff7a59)), 'hypothalamus');
    parts.pituitary = addDeep(new THREE.Mesh(ellipsoid([-0.2, -0.6, 0], [0.08, 0.065, 0.08]), dm(0xff7a59)), 'pituitary');
    addDeep(taper([-0.12, -0.4, 0], [-0.19, -0.55, 0], 0.025, 0.025, dm(0xff7a59)), 'pituitary');
  }

  // ---- labels
  const labels = { lobe: [], deep: [], side: [], stem: [] };
  const L = (html, pos, parent, group, cls) => { const l = stage.label(html, pos, parent); if (cls) tint(l, cls); labels[group].push(l); return l; };
  if (o.labels) {
    L('Frontal lobe', [-1.3, 0.65, 1.8], parts.frontalL, 'lobe');
    L('Parietal lobe', [0.8, 0.75, 1.75], parts.parietalL, 'lobe');
    L('Occipital lobe', [1.95, 0.25, 1.1], parts.occipitalL, 'lobe');
    L('Temporal lobe', [-0.1, -0.85, 1.65], parts.temporalL, 'lobe');
    L('Central sulcus', [-0.12, 0.45, 1.8], parts.frontalL, 'lobe', 'gold');
    L('Lateral fissure', [-0.95, -0.12, 1.7], parts.frontalL, 'lobe', 'gold');
    L('Cerebellum', [1.7, -1.3, 1.0], parts.cerebellum, 'lobe');
    L('Pons', [0.0, -1.0, 0.45], parts.pons, 'stem');
    L('Medulla', [0.2, -1.5, 0.35], parts.medulla, 'stem');
    L('Midbrain', [0.0, -0.55, 0.4], parts.midbrain, 'stem');
    if (o.deep) {
      L('Thalamus', [0.5, -0.12, 0.3], parts.thalamus[0], 'deep', 'deep');
      L('Hypothalamus', [-0.3, -0.42, 0.15], parts.hypothalamus, 'deep', 'deep');
      L('Hippocampus', [0.45, -0.75, 0.8], parts.hippocampus[0], 'deep', 'deep');
      L('Amygdala', [-0.8, -0.8, 0.8], parts.amygdala[0], 'deep', 'deep');
      L('Basal ganglia', [-0.8, 0.45, 0.55], parts.basal[0], 'deep', 'deep');
      L('Corpus callosum', [-0.1, 0.84, 0], parts.callosum, 'deep', 'deep');
      L('Ventricles (fluid)', [1.5, 0.22, 0.3], parts.ventricles[0], 'deep', 'deep');
    }
    L("Patient's LEFT hemisphere (near side)", [-0.2, -1.45, 1.6], parts.temporalL, 'side', 'side');
    L("Patient's RIGHT hemisphere (far side)", [0.7, 1.85, -1.3], parts.parietalR, 'side', 'side');
    L('← Forehead', [-2.45, -0.2, 0.3], root, 'side', 'side');
    L('Back of head →', [2.3, 0.8, 0.3], root, 'side', 'side');
  }

  // ---- explode
  const home = new Map(all.map((m) => [m, m.position.clone()]));
  const OFF = {
    frontal: [-0.4, 0.15, 0.95], parietal: [0.15, 0.5, 0.95], occipital: [0.55, 0.15, 0.95], temporal: [-0.05, -0.5, 1.35],
    cerebellum: [1.0, -0.55, 0], midbrain: [0, -0.9, 0], pons: [0, -0.9, 0], medulla: [0, -0.9, 0], cord: [0, -0.9, 0],
  };

  // ---- materials by group
  const cortexMats = [...cortex.map((m) => m.material), cbMat];
  const stemMats = stem.children.map((m) => m.material);
  const tmp = new THREE.Color(), base = new THREE.Color(CORTEX);
  let lobeK = -1;

  const api = {
    root, parts, cortex, deep, deepParts, stem, labels, all, surfaces,
    pickables: [...cortex, parts.cerebellum, ...stem.children],
    deepPickables: deepParts,
    setExplode(k) {
      const e = smooth(k);
      for (const m of all) {
        const h = home.get(m), id = m.userData.id, off = OFF[id];
        if (!off) continue;
        const sz = id === 'cerebellum' || stem.children.includes(m) ? 1 : m.userData.side;
        m.position.set(h.x + off[0] * e, h.y + off[1] * e, h.z + off[2] * e * sz);
      }
    },
    // 0 = solid, 1 = see-through cortex so the deep parts show
    setXray(k) {
      const op = lerp(1, 0.1, k);
      cortexMats.forEach((m) => { m.opacity = op; m.depthWrite = op > 0.95; });
      stemMats.forEach((m) => { m.opacity = lerp(1, 0.35, k); m.depthWrite = k < 0.05; });
    },
    // blend each lobe towards its own colour (k = 0 natural, 1 fully tinted)
    setLobeColours(k) {
      if (Math.abs(k - lobeK) < 1e-3) return; lobeK = k;
      for (const m of [...cortex, parts.cerebellum, ...stem.children]) {
        const info = INFO[m.userData.id];
        const b = m.userData.id === 'cerebellum' ? 0xd9a49a : stem.children.includes(m) ? 0xd8b2a6 : CORTEX;
        m.material.color.set(b).lerp(tmp.set(info.col), k * 0.75);
      }
    },
    // glow one part (by id) and dim nothing else
    highlight(id, amt = 1) {
      for (const m of all) {
        const on = id && m.userData.id === id;
        if (!m.material.emissive) continue;
        if (!m.userData.baseEm) m.userData.baseEm = { c: m.material.emissive.getHex(), i: m.material.emissiveIntensity };
        if (on) { m.material.emissive.set(INFO[id]?.col ?? 0xffffff); m.material.emissiveIntensity = 0.55 * amt; }
        else { m.material.emissive.setHex(m.userData.baseEm.c); m.material.emissiveIntensity = m.userData.baseEm.i; }
      }
    },
    // repaint the cortex surfaces: fn(x, y, z, side, part) → [r, g, b] multiplier or null for plain shading
    paint(fn) {
      for (const s of surfaces) {
        const p = s.geo.attributes.position, c = s.col;
        for (let i = 0; i < p.count; i++) {
          const r = fn(p.getX(i), p.getY(i), p.getZ(i), s.side, s.part, s.shade[i]);
          const sh = s.shade[i];
          if (r) { c[i * 3] = r[0]; c[i * 3 + 1] = r[1]; c[i * 3 + 2] = r[2]; } else c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = sh;
        }
        s.geo.attributes.color.needsUpdate = true;
      }
    },
    showLabels({ lobe = true, deep = false, side = true, stem = true, narrow = false } = {}) {
      labels.lobe.forEach((l) => { l.visible = lobe; });
      labels.stem.forEach((l) => { l.visible = stem && !narrow; });
      labels.deep.forEach((l) => { l.visible = deep; });
      labels.side.forEach((l, i) => { l.visible = side && (!narrow || i === 0); });
      if (narrow) labels.lobe.slice(4, 6).forEach((l) => { l.visible = false; });
      if (narrow) labels.deep.slice(4).forEach((l) => { l.visible = false; });
    },
  };
  api.setLobeColours(0);
  return api;
}

// ---------------------------------------------------------------- functional regions on the cortex
// Weight 0..1 of a point (brain space) belonging to a named area. Positions follow standard
// maps (Kandel ch. 15–16; Penfield & Rasmussen 1950 for the motor and sensory strips).
const bump = (d, r) => Math.max(0, 1 - (d / r) ** 2);
export function region(name, x, y, z, side, part) {
  const lat = z * side > 0.9 || part === 'temporal';
  const dc = x - xCentral(y);
  switch (name) {
    case 'motor': return part === 'hemi' && dc < 0 && dc > -0.3 && y > -0.12 ? 1 : 0;                         // precentral gyrus
    case 'sensory': return part === 'hemi' && dc > 0 && dc < 0.3 && y > -0.12 ? 1 : 0;                         // postcentral gyrus
    case 'hand': return part === 'hemi' && dc < 0 && dc > -0.3 && y > 0.55 && y < 1.1 && Math.abs(z) > 0.9 ? 1 : 0;   // hand knob of the motor strip
    case 'mouth': return part === 'hemi' && dc < 0.02 && dc > -0.34 && y > -0.12 && y < 0.35 && Math.abs(z) > 1.0 ? 1 : 0;
    case 'visual': return part === 'hemi' ? smooth((x - 1.4) / 0.3) * (y < 0.9 ? 1 : 0) : 0;                 // primary visual cortex at the pole
    case 'visual2': return part === 'temporal' ? smooth((x - 0.7) / 0.4) * (y < -0.6 ? 1 : 0.4) : part === 'hemi' ? smooth((x - 1.25) / 0.3) * 0.6 * (y < 0.9 ? 1 : 0) : 0;
    case 'auditory': return part === 'temporal' ? bump(Math.hypot(x - 0.12, y + 0.1), 0.55) : 0;              // superior temporal gyrus, Heschl's gyrus
    case 'broca': return part === 'hemi' && side > 0 && lat ? bump(Math.hypot(x + 0.85, y - 0.05), 0.42) : 0;  // left inferior frontal gyrus
    case 'wernicke': return part === 'temporal' && side > 0 ? bump(Math.hypot(x - 0.8, y + 0.05), 0.45) : 0;  // left posterior superior temporal gyrus
    case 'prefrontal': return part === 'hemi' ? smooth((-x - 1.05) / 0.4) : 0;
    case 'handL': return side > 0 ? region('hand', x, y, z, side, part) : 0;
    case 'sensHandL': return part === 'hemi' && side > 0 && dc > 0 && dc < 0.3 && y > 0.55 && y < 1.1 && Math.abs(z) > 0.9 ? 1 : 0;
    case 'cb': return part === 'cerebellum' ? 1 : 0;
    case 'cbR': return part === 'cerebellum' && z < 0.05 ? 1 : 0;                                            // the cerebellum works the same side of the body
    case 'all': return 1;
    case 'mcaTerritory': {                                                                                      // lateral surface fed by the middle cerebral artery,
      const mask = part === 'hemi' ? (lat && y < 1.15 && x > -1.6 && x < 1.5 ? smooth((z * side - 0.9) / 0.4) : 0) : part === 'temporal' ? smooth((z * side - 0.7) / 0.3) : 0;
      return mask * clamp(1 - Math.hypot(x + 0.15, (y - 0.1) * 1.2) / 1.75, 0, 1);                             // weighted so damage spreads out from the core
    }
    default: return 0;
  }
}

// Precompute region weights for every vertex of every surface.
export function regionWeights(brain, names) {
  return brain.surfaces.map((s) => {
    const p = s.geo.attributes.position, out = {};
    for (const n of names) {
      const w = new Float32Array(p.count);
      for (let i = 0; i < p.count; i++) w[i] = region(n, p.getX(i), p.getY(i), p.getZ(i), s.side, s.part);
      out[n] = w;
    }
    return out;
  });
}

// Recolour surfaces from region weights and levels: colour = shade × base, blended to `hot`.
export function paintRegions(brain, weights, levels, hot = [1.0, 0.62, 0.12], extra, base = [1, 1, 1]) {
  const names = Object.keys(levels);
  brain.surfaces.forEach((s, si) => {
    const c = s.col, W = weights[si], n = s.shade.length;
    for (let i = 0; i < n; i++) {
      let a = 0;
      for (const k of names) { const w = W[k]; if (w && levels[k]) a = Math.max(a, w[i] * levels[k]); }
      const sh = s.shade[i];
      const B = s.part === 'cerebellum' ? [base[0] * 0.98, base[1] * 1.02, base[2] * 1.03] : base;
      let r = sh * B[0], g = sh * B[1], b = sh * B[2];
      if (a > 0) {
        const hh = hot, gl = 1 + 1.8 * a;             // warm glow like an fMRI overlay
        r = lerp(r, hh[0] * gl, a); g = lerp(g, hh[1] * gl * (0.75 + 0.25 * a), a); b = lerp(b, hh[2] * gl, a);
      }
      if (extra) [r, g, b] = extra(s, i, r, g, b);
      c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
    }
    s.geo.attributes.color.needsUpdate = true;
  });
}

// A board: a canvas drawn every frame and shown as a flat panel in the scene.
export function board(canvasTex, w, h) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: canvasTex.tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
}

export { M };
