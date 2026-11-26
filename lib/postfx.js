// Image finishing for the showroom's real look, built on three's own passes (no extra dependency):
// multisampled HDR render, ground-truth ambient occlusion (desktop only), bloom for lamps and lit
// windows, tone mapping, then a light grade and vignette. Quality comes in tiers; the stage drops a
// tier when frames run slow, and phones start on the light one.
//   high: MSAA 4x + GTAO + bloom + grade     mid: MSAA 4x + bloom + grade
//   low:  MSAA 2x + bloom (after dark only) + grade     off: plain renderer.render
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const TIERS = ['off', 'low', 'mid', 'high'];
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uContrast: { value: 1.05 }, uSat: { value: 1.07 }, uVig: { value: 0.2 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uContrast; uniform float uSat; uniform float uVig; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = (c.rgb - 0.5) * uContrast + 0.5;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      vec2 d = vUv - 0.5;
      col *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(d, d) * 2.0);
      // a hair of noise hides banding in the sky gradient
      col += (fract(sin(dot(vUv * 1000.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
      gl_FragColor = vec4(col, c.a);
    }`,
};

export function createPost(renderer, scene, camera, { tier = 'high', hideFromAO = [], onTier = null } = {}) {
  let cur = TIERS.includes(tier) ? tier : 'high';
  let composer = null, gtao = null, bloom = null, lit = 0, w = 1, h = 1;
  function build() {
    composer?.dispose(); composer = null; gtao = null; bloom = null;
    if (cur === 'off') return;
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.max(1, w * pr), Math.max(1, h * pr), { type: THREE.HalfFloatType, samples: cur === 'low' ? 2 : 4 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    if (cur === 'high') {
      gtao = new GTAOPass(scene, camera, w, h);
      gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12, screenSpaceRadius: false });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      gtao.blendIntensity = 0.85;
      // glow cards, sprites and outlines are not solid: keep them out of the occlusion pre-pass
      const render = gtao.render.bind(gtao);
      gtao.render = (...a) => {
        const vis = hideFromAO.map((o) => o.visible); hideFromAO.forEach((o) => { o.visible = false; });
        render(...a);
        hideFromAO.forEach((o, i) => { o.visible = vis[i]; });
      };
      composer.addPass(gtao);
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(w * (cur === 'low' ? 0.5 : 1), h * (cur === 'low' ? 0.5 : 1)), 0.2, 0.55, 1.35);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composer.addPass(new ShaderPass(GradeShader));
    applyLit();
  }
  function applyLit() {
    if (!bloom) return;
    bloom.strength = 0.1 + 0.5 * lit;
    bloom.enabled = cur !== 'low' || lit > 0.05;   // phones pay for bloom only after dark
  }
  // frame pacing: when the stage is rendering every frame (orbiting, time-lapse), watch the cadence
  let last = 0; const dts = [];
  function pace() {
    const now = performance.now(), dt = now - last; last = now;
    if (dt > 120) { dts.length = 0; return; }   // not consecutive frames
    dts.push(dt);
    if (dts.length < 45) return;
    const sorted = [...dts].sort((a, b) => a - b), med = sorted[sorted.length >> 1]; dts.length = 0;
    const limit = cur === 'low' ? 45 : 30;      // ms: phones may run at 30 fps, desktops should hold more
    if (med > limit && cur !== 'off') { cur = TIERS[TIERS.indexOf(cur) - 1]; build(); onTier?.(cur); }
  }
  build();
  return {
    get tier() { return cur; },
    setTier(t) { if (TIERS.includes(t) && t !== cur) { cur = t; build(); onTier?.(cur); } },
    setLit(v) { lit = v; applyLit(); },
    setSize(nw, nh) { w = nw; h = nh; if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); gtao?.setSize(w, h); } },
    render() { pace(); if (composer) composer.render(); else renderer.render(scene, camera); },
    dispose() { composer?.dispose(); },
  };
}
