// The home page stage: a full-screen three.js scene with the tower in its setting (lib/world.js)
// under a sun placed as in the brochure day render (low, warm, from the sea side). The tour
// (lib/tour.js) drives it with metre-based camera keyframes through lookFrom(); everything else
// (focus/slice of floors, night) is forwarded to the shared building from lib/scene.js.
// Renders on demand: a frame is drawn only while the camera moves or something changes.
import * as THREE from 'three';
import { createBuilding, CENTER, OUTLINE, LEVEL_Y } from './scene.js';
import { createWorld } from './world.js';

const SUN_DIR = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();   // from the west-south-west, ~25° up

export function createTowerStage(el, { narrow = false } = {}) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const shadows = !narrow;
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  el.appendChild(canvas);
  let pending = false, alive = true, active = true, last = 0, hooks = [], after = [];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const dprMax = narrow ? 1.75 : 1.6;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprMax));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd5e2ec, 420, 2600);
  const camera = new THREE.PerspectiveCamera(36.87, 1, 0.1, 6000);   // MapLibre's default lens, so cross-fades line up

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xcfe3f7, 0x8f826c, 0.6);
  const sun = new THREE.DirectionalLight(0xffdcb4, 3.1);
  sun.position.copy(SUN_DIR).multiplyScalar(220).add(CENTER);
  sun.target.position.set(CENTER.x, 20, CENTER.z);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 20, far: 520 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
  const fill = new THREE.DirectionalLight(0xbcd4ec, 0.5);
  fill.position.set(CENTER.x + 120, 80, CENTER.z - 90);
  // night: warm uplights washing the podium and a cool moon fill
  const uplight = new THREE.PointLight(0xffc98a, 0, 60, 1.6); uplight.position.set(CENTER.x, 2, CENTER.z + 14);
  scene.add(hemi, sun, sun.target, fill, uplight);
  // warm room lights for the furnished floor in view (positions from the interior's userData.lights)
  const roomLights = Array.from({ length: 8 }, () => { const l = new THREE.PointLight(0xffd7a8, 0, 9, 1.5); scene.add(l); return l; });
  function setRoomLights(level) {
    const pts = (level && b.interior(level)?.userData.lights) || [];
    const y = level ? LEVEL_Y[level] + 2.4 : 0;
    roomLights.forEach((l, i) => { const p = pts[i]; l.intensity = p ? 3.2 : 0; if (p) l.position.set(p[0], y, p[1]); });
  }

  // ---------- world + building ----------
  const world = createWorld({ narrow, shadows });
  scene.add(world.group);
  world.setSun(SUN_DIR);
  const b = createBuilding({ shadows, ghostOthers: false });
  scene.add(b.building);

  // focus marker: a glowing outline around the floor in view (the rest of the tower stays solid)
  const ring = (() => {
    const pts = OUTLINE.flatMap((fc) => fc.pts.map((p) => new THREE.Vector3(p.x + p.nx * 0.9, 0, p.z + p.nz * 0.9)));
    const g = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4d8dff, transparent: true, opacity: 0.95, depthTest: false });
    for (const y of [0.05, 3.0]) { const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map((p) => p.clone().setY(y))), lineMat); l.renderOrder = 5; g.add(l); }
    const pos = [], idx = [];
    pts.forEach((p, i) => { pos.push(p.x, 0.05, p.z, p.x, 3.0, p.z); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    const k = (pts.length - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0);
    const band = new THREE.BufferGeometry(); band.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); band.setIndex(idx);
    const bm = new THREE.Mesh(band, new THREE.MeshBasicMaterial({ color: 0x5b9bff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    bm.renderOrder = 4; g.add(bm);
    g.visible = false;
    scene.add(g);
    return g;
  })();
  b.onChange = () => { setRoomLights(b.state.focus); renderer.shadowMap.needsUpdate = true; requestRender(); };

  // reflections: the sky dome rendered into an environment map (day and night versions)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = world.sky.clone(); envSky.material = world.sky.material.clone(); envSky.material.uniforms = THREE.UniformsUtils.clone(world.sky.material.uniforms);
  envScene.add(envSky);
  envScene.add(new THREE.Mesh(new THREE.CircleGeometry(2000, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9a948a })));
  const envFor = (night) => { envSky.material.uniforms.night.value = night; envSky.material.uniforms.sunDir.value.copy(SUN_DIR); return pmrem.fromScene(envScene, 0, 1, 7000).texture; };
  const env = { day: envFor(0), night: envFor(1) };
  scene.environment = env.day;
  scene.environmentIntensity = 0.9;

  // ---------- camera control ----------
  const cam = new THREE.Vector3(CENTER.x + 120, 30, CENTER.z + 200), look = CENTER.clone();
  let shiftX = 0, shiftY = 0, walk = false, fovWant = 0;   // where the look point sits: fraction of width right of centre / of height below; fovWant = per-stop lens override
  /**
   * Look from `c` at `l` (model metres). `sx` moves the look point right of centre (fraction of
   * width), `sy` down. `w` = walk mode: eye level inside, dragging turns the head instead of orbiting.
   */
  function lookFrom(c, l, sx = 0, sy = 0, w = false, fovOverride = 0) {
    cam.set(c[0], c[1], c[2]); look.set(l[0], l[1], l[2]); shiftX = sx; shiftY = sy; walk = w; fovWant = fovOverride;
    requestRender();
  }
  // user orbit offset (drag): yaw and pitch around the look point, eased back to 0 by the tour
  const user = { yaw: 0, pitch: 0, zoom: 1 };
  const tmp = new THREE.Vector3(), sph = new THREE.Spherical();
  function placeCamera() {
    if (walk) {   // turn the head: rotate the view direction about the eye
      tmp.copy(look).sub(cam);
      sph.setFromVector3(tmp);
      sph.theta -= user.yaw;
      sph.phi = THREE.MathUtils.clamp(sph.phi + user.pitch, 0.3, Math.PI - 0.3);
      camera.position.copy(cam);
      camera.lookAt(tmp.setFromSpherical(sph).add(cam));
      return;
    }
    tmp.copy(cam).sub(look);
    sph.setFromVector3(tmp);
    sph.theta += user.yaw;
    sph.phi = THREE.MathUtils.clamp(sph.phi - user.pitch, 0.08, 2.2);   // street-level shots look up
    sph.radius *= user.zoom;
    tmp.setFromSpherical(sph).add(look);
    if (tmp.y < 1.4 && look.y < 20) tmp.y = 1.4;   // never under the street
    camera.position.copy(tmp);
    camera.lookAt(look);
  }

  let W = 1, H = 1;
  let fov = 36.87;
  function applyOffset(dt = 0.016) {
    // eye level inside gets a wider lens (like the interior renders); outside matches the map
    const want = fovWant || (walk ? (W / H < 1 ? 70 : 60) : 36.87);
    fov += (want - fov) * Math.min(1, dt * 4);
    if (Math.abs(want - fov) < .05) fov = want; else requestRender();
    camera.fov = fov;
    camera.aspect = W / H;
    if (Math.abs(shiftX) < 1e-4 && Math.abs(shiftY) < 1e-4) camera.clearViewOffset();
    else camera.setViewOffset(W, H, -shiftX * W, -shiftY * H, W, H);
    camera.updateProjectionMatrix();
  }
  function resize() {
    W = el.clientWidth || innerWidth; H = el.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // ---------- render loop (on demand) ----------
  let slow = 0, frames = 0, degraded = 0;
  function requestRender() { if (pending || !alive || !active) return; pending = true; requestAnimationFrame(frame); }
  function degrade() {
    degraded++;
    if (degraded === 1) renderer.setPixelRatio(Math.min(1.25, renderer.getPixelRatio()));
    if (degraded === 2) renderer.setPixelRatio(1);
    if (degraded === 3 && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); });
    }
    slow = 0;
  }
  function frame(now) {
    pending = false;
    const raw = last ? (now - last) / 1000 : 0.016, dt = Math.min(0.05, raw);
    last = now;
    if (++frames > 20 && raw > 0.04 && raw < 1) { if (++slow > 20 && degraded < 3) degrade(); } else if (slow > 0) slow--;
    let busy = false;
    for (const h of hooks) if (h(dt, now)) busy = true;
    world.tick(dt);
    applyOffset(dt);
    placeCamera();
    // interiors: calmer exposure under the room lights; outside: the day/night setting
    const ex = (walk ? 0.8 : 1) * baseExposure;
    renderer.toneMappingExposure += (ex - renderer.toneMappingExposure) * Math.min(1, dt * 4);
    if (Math.abs(ex - renderer.toneMappingExposure) > .002) busy = true;
    renderer.render(scene, camera);
    for (const h of after) h();
    if (busy) requestRender(); else last = 0;
  }

  // ---------- night ----------
  const lerp = (a, c, t) => a + (c - a) * t;
  let baseExposure = 0.95;
  function setNight(t) {
    world.setNight(t);
    b.setNight(t);
    hemi.intensity = lerp(0.6, 0.22, t); hemi.color.setHex(t > .5 ? 0x8fa6cf : 0xcfe3f7);
    sun.intensity = lerp(3.1, 0.25, t); sun.color.setHex(t > .5 ? 0x9fb4e0 : 0xffdcb4);
    fill.intensity = lerp(0.5, 0.15, t);
    uplight.intensity = t * 900;
    for (const g of b.glassMats) g.emissiveIntensity = t * g.userData.night * 2.2;
    scene.environment = t > 0.5 ? env.night : env.day;
    scene.environmentIntensity = lerp(0.9, 0.5, t);
    scene.fog.color.setRGB(lerp(0.835, 0.07, t), lerp(0.886, 0.1, t), lerp(0.925, 0.18, t));
    baseExposure = lerp(0.95, 1.15, t);
    renderer.shadowMap.needsUpdate = true;
    requestRender();
  }

  // ---------- context fade (neighbours, trees, cars) while a part of the tower is in focus ----------
  let ctxTarget = 1, ctx = 1;
  hooks.push((dt) => {
    if (Math.abs(ctx - ctxTarget) < 0.005) { if (ctx !== ctxTarget) { ctx = ctxTarget; world.setContext(ctx); } return false; }
    ctx += (ctxTarget - ctx) * (1 - Math.exp(-dt * 4));
    world.setContext(ctx);
    return true;
  });

  // ---------- drag to look around ----------
  let drag = null;
  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, yaw: user.yaw, pitch: user.pitch, id: e.pointerId, moved: false };
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      if (coarse && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // vertical swipe on a phone scrolls the page
      drag.moved = true; el.setPointerCapture?.(e.pointerId); el.classList.add('dragging');
      api.onUserMove?.();
    }
    user.yaw = drag.yaw - dx * 0.0065;
    user.pitch = THREE.MathUtils.clamp(drag.pitch + (coarse ? 0 : dy * 0.004), -0.5, 0.6);
    requestRender();
  };
  const onUp = (e) => { if (drag && e.pointerId === drag.id) { drag = null; el.classList.remove('dragging'); } };
  el.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);

  // ---------- screen projection for the callouts ----------
  const pv = new THREE.Vector3();
  /** Model point -> { x, y } in CSS pixels of the stage, plus whether it is in front of the camera. */
  function project(p) {
    pv.set(p[0], p[1], p[2]).project(camera);
    return { x: (pv.x * 0.5 + 0.5) * W, y: (-pv.y * 0.5 + 0.5) * H, visible: pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1 };
  }

  const api = {
    renderer, scene, camera, building: b, world, user,
    lookFrom, setNight, project, requestRender,
    addHook(fn) { hooks.push(fn); requestRender(); },
    /** Runs after every rendered frame (camera placed): screen-space overlays. */
    afterRender(fn) { after.push(fn); },
    get dragging() { return !!(drag && drag.moved); },
    load: b.load, loadDetail: b.loadDetail,
    setFocus(level, slice, open = false) {
      b.setFocus(level, slice, open);
      ring.visible = !!level && level !== 'T' && level !== 'G' && !walk && !!slice === false;
      if (ring.visible) ring.position.y = LEVEL_Y[level] + 0.25;
      setRoomLights(level);
      requestRender();
    },
    /** Pause rendering while the map stage is showing instead. */
    setActive(v) { if (v === active) return; active = v; if (v) requestRender(); },
    get active() { return active; },
    setContext(v) { ctxTarget = v ? 1 : 0.12; requestRender(); },
    onUserMove: null,
    dispose() {
      alive = false; ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
      b.dispose(); world.dispose(); env.day.dispose(); env.night.dispose(); pmrem.dispose(); renderer.dispose(); canvas.remove();
    },
  };
  return api;
}
