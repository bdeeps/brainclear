// BrainClear's neurons: a 3D nerve cell, a simple but honest model of its electrical spike,
// and a synapse close-up.
//
// Numbers (Kandel et al., Principles of Neural Science, 5th ed., ch. 6–10 and 12–13;
// Hodgkin & Huxley 1952, J Physiol 117:500; Purves et al., Neuroscience, 6th ed., ch. 2–3):
//  - resting potential about −70 mV (−60 to −75 mV in most neurons);
//  - threshold about −55 mV, where voltage-gated Na⁺ channels open all at once;
//  - the spike (action potential) peaks at about +30 to +40 mV, lasts about 1–2 ms, and
//    undershoots to about −80 mV as K⁺ channels let potassium out;
//  - after each spike there is a short refractory period, which caps firing at a few hundred per second;
//  - conduction: thin unmyelinated fibres about 0.5–2 m/s; thick myelinated fibres up to about 120 m/s,
//    because the signal jumps between the nodes of Ranvier (saltatory conduction);
//  - a unitary excitatory postsynaptic potential (EPSP) at a central synapse is typically under
//    1 mV, so many inputs must add up (summation) to reach threshold.
import { THREE, M, tube, clamp, lerp, smooth } from './kit.js';
import { taper } from './brain.js';

export const EP = {
  rest: -70, thresh: -55, peak: 35, under: -80,
  tauM: 10,             // ms, membrane time constant (typical 10–20 ms)
  spikeMs: 1.5,         // ms from threshold to the bottom of the undershoot
  cvSlow: 1,            // m/s, unmyelinated
  cvFast: 120,          // m/s, the fastest myelinated fibres
  epsp: 0.8,            // mV, one excitatory synapse
  ipsp: -0.8,           // mV, one inhibitory synapse
};

// The spike's shape (mV) t ms after the membrane crosses threshold.
export function spikeV(t) {
  if (t < 0.45) { const k = smooth(t / 0.45); return lerp(EP.thresh, EP.peak, k); }
  if (t < EP.spikeMs) { const k = smooth((t - 0.45) / (EP.spikeMs - 0.45)); return lerp(EP.peak, EP.under, k); }
  return EP.under;
}

// A leaky integrate-and-fire neuron with a drawn spike. `drive` (mV) is how far a steady input
// would push the membrane above rest if there were no spike.
export class Cell {
  constructor() { this.V = EP.rest; this.sp = -1; this.base = EP.rest; }
  step(dt, drive) {                   // dt in ms
    let spiked = false;
    if (this.sp >= 0) {
      this.sp += dt;
      if (this.sp >= EP.spikeMs) { this.sp = -1; this.base = EP.under; }
      else { this.V = spikeV(this.sp); return false; }
    }
    const target = EP.rest + drive;
    this.base += (target - this.base) * (1 - Math.exp(-dt / EP.tauM));
    this.V = this.base;
    if (this.V >= EP.thresh) { this.sp = 0; spiked = true; this.V = EP.thresh; }
    return spiked;
  }
}
// Firing rate (spikes per second) for a steady drive, from the same model.
export function rateFor(drive) {
  const gap = EP.thresh - EP.rest;
  if (drive <= gap + 1e-6) return 0;
  const T = EP.tauM * Math.log((drive + (EP.rest - EP.under)) / (drive - gap)) + EP.spikeMs;
  return 1000 / T;
}

// ---------------------------------------------------------------- the 3D neuron
// Laid out along x: dendrites and soma on the left, axon to the right, terminals at the end.
export function makeNeuron() {
  const root = new THREE.Group();
  const cellMat = new THREE.MeshPhysicalMaterial({ color: 0xc7a2ff, roughness: 0.4, clearcoat: 0.5, emissive: 0x7040c0, emissiveIntensity: 0.15 });
  const soma = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 28), cellMat); soma.scale.set(1.1, 0.95, 0.95); soma.position.set(-3.1, 0, 0); root.add(soma);
  // dendrites: a branching tree from the soma
  const dend = new THREE.Group(); root.add(dend);
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const branch = (p, dir, len, r, depth) => {
    const q = p.clone().addScaledVector(dir, len);
    const mid = p.clone().lerp(q, 0.5).add(new THREE.Vector3((rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.2));
    dend.add(tube([p, mid, q], r, cellMat, false, 12));
    // little spines on the dendrites, where synapses land
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 8, 6), cellMat); s.position.copy(p).lerp(q, 0.3 + 0.25 * k).add(new THREE.Vector3(0, r * 1.4, 0)); dend.add(s); }
    if (depth > 0) for (const sgn of [-1, 1]) {
      const d2 = dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), sgn * (0.45 + rnd() * 0.3)).applyAxisAngle(new THREE.Vector3(1, 0, 0), (rnd() - 0.5) * 1.2).normalize();
      branch(q, d2, len * 0.72, r * 0.7, depth - 1);
    }
  };
  for (const a of [2.2, 2.75, 3.3, 3.9, 1.6]) branch(soma.position.clone(), new THREE.Vector3(Math.cos(a), Math.sin(a), (rnd() - 0.5) * 0.6).normalize().multiplyScalar(1), 0.7, 0.07, 2);
  // axon hillock and the axon
  const x0 = -2.72, x1 = 3.1;
  root.add(taper([-2.78, 0, 0], [x0 + 0.2, 0, 0], 0.16, 0.06, cellMat).rotateZ(0));
  const axonMat = new THREE.MeshPhysicalMaterial({ color: 0xc7a2ff, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: false });
  const axon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, x1 - x0, 20).rotateZ(-Math.PI / 2), axonMat); axon.position.x = (x0 + x1) / 2; root.add(axon);
  // myelin sheaths with gaps: the nodes of Ranvier
  const myelinMat = new THREE.MeshPhysicalMaterial({ color: 0xf6ecd8, roughness: 0.5, clearcoat: 0.6, transparent: true, opacity: 1 });
  const sheaths = [], nodes = [];
  const segL = 0.7, gap = 0.14, xs = x0 + 0.35;
  const N = Math.floor((x1 - 0.2 - xs) / (segL + gap));
  for (let i = 0; i < N; i++) {
    const a = xs + i * (segL + gap);
    const g = new THREE.CapsuleGeometry(0.15, segL - 0.3, 6, 20).rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(g, myelinMat); m.position.x = a + segL / 2; m.castShadow = true; root.add(m); sheaths.push(m);
    const nx = a + segL + gap / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 24).rotateY(Math.PI / 2), M.glow(0xffd166, { transparent: true, opacity: 0.35 }));
    ring.position.x = nx; root.add(ring); nodes.push({ x: nx, ring });
  }
  // axon terminals
  const terms = [];
  for (const [dy, dz] of [[0.55, 0.1], [0.15, -0.3], [-0.3, 0.25], [-0.6, -0.1]]) {
    const end = new THREE.Vector3(x1 + 0.7, dy, dz);
    root.add(tube([new THREE.Vector3(x1, 0, 0), new THREE.Vector3(x1 + 0.35, dy * 0.5, dz * 0.5), end], 0.035, cellMat, false, 16));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xc7a2ff, emissive: 0xffd166, emissiveIntensity: 0 }));
    b.position.copy(end); root.add(b); terms.push(b);
  }
  return { root, soma, axon, axonMat, sheaths, myelinMat, nodes, terms, x0, x1, dend, cellMat };
}

// ---------------------------------------------------------------- the synapse close-up
// Presynaptic bouton on top, synaptic cleft, postsynaptic spine below. Not to scale: the real
// cleft is only about 20 nm wide, and a vesicle about 40 nm across.
export const NT = {
  glu: { name: 'Glutamate', col: 0x5ce1a9, ion: 'Na⁺', ionCol: 0xffd166, sign: 1 },
  gaba: { name: 'GABA', col: 0xff7a9a, ion: 'Cl⁻', ionCol: 0x7fd4ff, sign: -1 },
};
export function makeSynapse() {
  const root = new THREE.Group();
  const memPre = new THREE.MeshPhysicalMaterial({ color: 0xc7a2ff, roughness: 0.35, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, emissive: 0xffd166, emissiveIntensity: 0 });
  const memPost = new THREE.MeshPhysicalMaterial({ color: 0x8fb8ff, roughness: 0.35, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0 });
  const bouton = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), memPre); bouton.scale.set(1.45, 1.1, 1.45); bouton.position.y = 1.4; root.add(bouton);
  const axon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.2, 24, 1, true), memPre); axon.position.y = 3.3; root.add(axon);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), memPost); head.scale.set(1.35, 0.72, 1.35); head.position.y = -1.0; root.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 20, 1, true), memPost); neck.position.y = -2.1; root.add(neck);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 6, 32, 1, true).rotateZ(Math.PI / 2), memPost); shaft.position.y = -3.25; root.add(shaft);
  // vesicles: a few docked at the active zone, the rest in reserve
  const vesMat = new THREE.MeshPhysicalMaterial({ color: 0x5ce1a9, roughness: 0.3, clearcoat: 0.6, emissive: 0x5ce1a9, emissiveIntensity: 0.25 });
  const vesicles = [];
  const vr = () => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
  const r = vr();
  for (let i = 0; i < 16; i++) {
    const docked = i < 3;
    const a = r() * Math.PI * 2, rad = docked ? 0.35 * i : 0.2 + r() * 0.8;
    const p = docked ? new THREE.Vector3(-0.45 + 0.45 * i, 0.52, 0.1 * (i - 1)) : new THREE.Vector3(Math.cos(a) * rad, 1.2 + r() * 0.9, Math.sin(a) * rad);
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), vesMat); v.position.copy(p); root.add(v);
    vesicles.push({ mesh: v, home: p.clone(), docked });
  }
  // calcium channels in the presynaptic membrane, receptors on the postsynaptic side
  const chanMat = new THREE.MeshStandardMaterial({ color: 0x3fb6c9, emissive: 0x3fe0ff, emissiveIntensity: 0.1 });
  const chans = [-0.95, 0, 0.95].map((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 12), chanMat.clone()); c.position.set(x, 0.36, -0.2); root.add(c); return c; });
  const recMat = new THREE.MeshStandardMaterial({ color: 0xffb86b, emissive: 0xffb86b, emissiveIntensity: 0.1 });
  const receptors = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, rad = 0.2 + 0.075 * i;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 12), recMat.clone());
    c.position.set(Math.cos(a) * rad * 1.05, -0.3 - 0.05 * (rad / 1.2) ** 2, Math.sin(a) * rad * 0.8);
    root.add(c); receptors.push(c);
  }
  return { root, bouton, head, memPre, memPost, vesicles, vesMat, chans, receptors, axon };
}
