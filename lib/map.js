// The home page stage: a MapLibre map of Mahim that stays behind the whole scroll tour, with
// the tower's GLB rendered on its plot by a three.js custom layer (after the MapLibre "Add a
// 3D model using three.js" example). The tour drives the map camera with the same metre-based
// cam/look keyframes the three.js viewer used, converted through calculateCameraOptionsFromTo,
// so every section is demonstrated on the real plot with the Arabian Sea in view.
import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBuilding, CENTER } from './scene.js';

// 122/124 SVS Road (old Cadell Road), Mahim — centre of the plot on the seaward side of the road.
export const SITE = { lng: 72.839001, lat: 19.038245 };
// Compass bearing (deg, clockwise from north) of the model's +Z side (the curved glass bay).
// The plot runs back from the road (bearing ~12°) towards the sea, so the long axis (model X)
// lies along 102°/282° with +X pointing east to the road and the curved bay facing south-south-west.
export const MODEL_BEARING = 192;
// Compass bearing from the plot to the open water of Mahim Bay (camera presets).
export const SEA_BEARING = 282;
export const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SEA_POINT = [72.8360, 19.0390];   // a point in Mahim Bay for the "to the sea" line
const SEA_BLUE = '#86bde0';
const M_PER_DEG_LAT = 111320;

/** Camera presets for the Location panel chips (map camera options). */
export const VIEWS = {
  plot:   { label: 'The plot',      center: [SITE.lng - 0.0004, SITE.lat + 0.0002], zoom: 17.6, pitch: 64, bearing: SEA_BEARING + 25, note: 'On SVS Road, looking out to the water' },
  sea:    { label: 'From the sea',  center: [SITE.lng - 0.0009, SITE.lat + 0.0003], zoom: 17.2, pitch: 66, bearing: SEA_BEARING - 180 + 10, note: 'The tower runs back from SVS Road towards Mahim Bay' },
  shore:  { label: 'Shoreline',     center: [SITE.lng - 0.0012, SITE.lat - 0.0015], zoom: 16.2, pitch: 70, bearing: SEA_BEARING - 90 + 5, note: 'Along the Mahim shoreline' },
  area:   { label: 'Neighbourhood', center: [SITE.lng - 0.002, SITE.lat + 0.001], zoom: 15.2, pitch: 45, bearing: SEA_BEARING + 35, note: 'Mahim Bay, the causeway and Shivaji Park' },
  city:   { label: 'Mumbai',        center: [SITE.lng - 0.01, SITE.lat - 0.02], zoom: 12.3, pitch: 35, bearing: 0, note: 'Coastal Road, Sea Link, BKC and the airport within minutes' },
};

/** Brochure drive-time destinations (minutes from the panel), approximate coordinates. */
export const DESTINATIONS = {
  coastal:  { name: 'Coastal Road',     mins: 8,  lngLat: [72.8140, 19.0105] },
  worli:    { name: 'Worli Connector',  mins: 13, lngLat: [72.8170, 19.0300] },
  airport:  { name: 'CSMI Airport',     mins: 14, lngLat: [72.8745, 19.0975] },
  bkc:      { name: 'BKC',              mins: 15, lngLat: [72.8650, 19.0605] },
  versova:  { name: 'Versova',          mins: 20, lngLat: [72.8130, 19.1310] },
  atalsetu: { name: 'Atal Setu',        mins: 23, lngLat: [72.8650, 18.9990] },
  fort:     { name: 'Fort',             mins: 28, lngLat: [72.8360, 18.9340] },
  nariman:  { name: 'Nariman Point',    mins: 30, lngLat: [72.8235, 18.9265] },
};

/** Model-frame point (metres; same frame as the GLB and the tour keyframes) -> [lng, lat]. */
export function modelToLngLat(x, z) {
  // model +Z points at MODEL_BEARING, model +X at MODEL_BEARING - 90 (see the layer transform)
  const dx = x - CENTER.x, dz = z - CENTER.z;
  const bx = THREE.MathUtils.degToRad(MODEL_BEARING - 90), bz = THREE.MathUtils.degToRad(MODEL_BEARING);
  const east = dx * Math.sin(bx) + dz * Math.sin(bz);
  const north = dx * Math.cos(bx) + dz * Math.cos(bz);
  return [SITE.lng + east / (M_PER_DEG_LAT * Math.cos(SITE.lat * Math.PI / 180)), SITE.lat + north / M_PER_DEG_LAT];
}

export function createMapStage(el, { interactive = false, onView } = {}) {
  const narrow = matchMedia('(max-width: 820px)').matches || el.clientWidth < 640;
  const map = new maplibregl.Map({
    container: el,
    style: STYLE,
    ...VIEWS.plot,
    maxPitch: 85,
    minZoom: 10,
    centerClampedToGround: false,   // keyframes look at points up the tower
    attributionControl: { compact: true },
    interactive,
    cooperativeGestures: interactive,   // inside a scrolling page: ctrl/two-finger to zoom, the wheel keeps scrolling
    dragRotate: interactive,
    canvasContextAttributes: { antialias: true },
    fadeDuration: 0,
  });
  if (typeof window !== 'undefined') window.__locmap = map;   // debugging aid

  // ---------- model transform (as in the MapLibre example) ----------
  const mc = maplibregl.MercatorCoordinate.fromLngLat([SITE.lng, SITE.lat], 0);
  const modelTransform = {
    translateX: mc.x, translateY: mc.y, translateZ: mc.z,
    rotateX: Math.PI / 2,                                      // glTF Y-up -> map up
    rotateY: THREE.MathUtils.degToRad(180 - MODEL_BEARING),    // +Z (curved bay) -> MODEL_BEARING, +X -> the road
    rotateZ: 0,
    scale: mc.meterInMercatorCoordinateUnits(),
  };

  const b = createBuilding({ shadows: false, ghostOthers: false });
  const root = new THREE.Group();
  root.position.set(-CENTER.x, 0, -CENTER.z);   // building centroid on the plot, ground slab at street level
  root.add(b.building);
  let renderer, scene, camera, hemi, sun, fill, pmrem, loaded = false;
  const invert = new THREE.Matrix4();
  b.onChange = () => { loaded = b.building.children.length > 0; map.triggerRepaint(); };

  const layer = {
    id: 'sahil-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(m, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      hemi = new THREE.HemisphereLight(0xdbe8f5, 0xcbbfa8, 0.7);
      sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
      sun.position.set(0.55, 1, 0.65);
      fill = new THREE.DirectionalLight(0xbfd7ee, 0.45);
      fill.position.set(-0.7, 0.4, -0.6);
      scene.add(hemi, sun, fill, root);

      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.55;
      renderer.resetState();
      setNight(b.state.night);
    },
    render(gl, args) {
      if (!loaded) return;
      const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), modelTransform.rotateX);
      const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 1, 0), modelTransform.rotateY);
      const rotationZ = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 0, 1), modelTransform.rotateZ);
      const mtx = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const l = new THREE.Matrix4()
        .makeTranslation(modelTransform.translateX, modelTransform.translateY, modelTransform.translateZ)
        .scale(new THREE.Vector3(modelTransform.scale, -modelTransform.scale, modelTransform.scale))
        .multiply(rotationX).multiply(rotationY).multiply(rotationZ);
      const m = mtx.multiply(l);   // model metres -> clip
      // Split it into view (camera translation) and projection so three.js shades with the real
      // eye position: reflections and specular need the view direction, which an identity view
      // matrix would place at the building's centre. The eye comes from MapLibre's camera, taken
      // into model metres through the (well-conditioned) model transform.
      const tr = map.transform;
      const eye = maplibregl.MercatorCoordinate.fromLngLat(tr.getCameraLngLat(), tr.getCameraAltitude());
      camera.position.set(eye.x, eye.y, eye.z).applyMatrix4(invert.copy(l).invert());
      camera.updateMatrixWorld(true);
      camera.projectionMatrix.copy(m).multiply(new THREE.Matrix4().makeTranslation(camera.position.x, camera.position.y, camera.position.z));
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() { pmrem?.dispose(); renderer?.dispose(); },
  };

  // ---------- overlays ----------
  let marker, destMarker = null, pinVisible = true;
  const line = (coords) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} });
  const ready = new Promise((resolve) => map.on('load', () => {
    try {
      map.setPaintProperty('water', 'fill-color', SEA_BLUE);
      if (map.getLayer('building-3d')) map.removeLayer('building-3d');   // extruded neighbours overlap the tower
      map.setPaintProperty('building', 'fill-opacity-transition', { duration: 700, delay: 0 });
      for (const id of poiLayers()) {
        map.setPaintProperty(id, 'icon-opacity-transition', { duration: 500, delay: 0 });
        map.setPaintProperty(id, 'text-opacity-transition', { duration: 500, delay: 0 });
      }
    } catch (e) { /* style ids differ: keep defaults */ }
    // the existing building's POI pin on the plot would sit on the tower: drop POIs within ~25 m
    const plot = { type: 'Polygon', coordinates: [Array.from({ length: 13 }, (_, i) => modelToLngLat(CENTER.x + 25 * Math.cos(i * Math.PI / 6), CENTER.z + 25 * Math.sin(i * Math.PI / 6)))] };
    for (const id of poiLayers()) {
      try { const f = map.getFilter(id); map.setFilter(id, f ? ['all', f, ['!', ['within', plot]]] : ['!', ['within', plot]]); } catch (e) { /* legacy filter syntax: leave it */ }
    }
    styleReady = true;
    setNeighbours(neighboursVisible);
    map.addSource('sahil-sea', { type: 'geojson', data: { ...line([[SITE.lng, SITE.lat], SEA_POINT]), properties: { name: 'Arabian Sea · Mahim Bay' } } });
    map.addLayer({ id: 'sahil-sea-line', type: 'line', source: 'sahil-sea', paint: { 'line-color': '#1f3d6b', 'line-width': 2, 'line-dasharray': [1, 2], 'line-opacity': 0.8 } });
    map.addLayer({ id: 'sahil-sea-label', type: 'symbol', source: 'sahil-sea', layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, -1] }, paint: { 'text-color': '#1f3d6b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 } });
    map.addSource('sahil-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'sahil-route-line', type: 'line', source: 'sahil-route', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#2d6ae0', 'line-width': 3, 'line-opacity': 0.85 } });
    const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
    // flat neighbour footprints at street zooms (the style's own building fill stops at z14)
    if (map.getSource('openmaptiles')) {
      map.addLayer({ id: 'sahil-footprints', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-color': '#e6dfd3', 'fill-outline-color': '#cbc1b1', 'fill-opacity': neighboursVisible ? 1 : 0, 'fill-opacity-transition': { duration: 700, delay: 0 } } }, firstLabel);
    }
    map.addLayer(layer, firstLabel);   // above the footprints, under the labels

    const pin = document.createElement('div');
    pin.className = 'map-pin';
    pin.innerHTML = '<b>The Sahil</b><span>122/124 SVS Road · Mahim</span>';
    marker = new maplibregl.Marker({ element: pin, anchor: 'bottom-right', offset: [-14, -36] }).setLngLat([SITE.lng, SITE.lat]).addTo(map);
    setPin(pinVisible);
    resolve();
  }));

  function setPin(v) { pinVisible = v; marker?.getElement().classList.toggle('hidden', !v); }

  // Neighbouring buildings and POI pins fade out while one part of the tower is in focus, so
  // the close-up reads cleanly; roads, water and the plot stay.
  let neighboursVisible = true, styleReady = false;
  const poiLayers = () => map.getStyle().layers.filter((l) => l.type === 'symbol' && /^poi/.test(l.id)).map((l) => l.id);
  function setNeighbours(v) {
    neighboursVisible = v;
    if (!styleReady) return;
    try {
      map.setPaintProperty('building', 'fill-opacity', v ? 1 : 0);
      if (map.getLayer('sahil-footprints')) map.setPaintProperty('sahil-footprints', 'fill-opacity', v ? 1 : 0);
      for (const id of poiLayers()) {
        map.setPaintProperty(id, 'icon-opacity', v ? 1 : 0);
        map.setPaintProperty(id, 'text-opacity', v ? 1 : 0);
      }
    } catch (e) { /* style ids differ */ }
  }

  // ---------- camera from the tour's metre-based keyframes ----------
  let padding = { top: 0, right: 0, bottom: 0, left: 0 };
  /** Look from `cam` at `look` (model metres, Y up). `shift` moves the look point right of centre. */
  function lookFrom(cam, look, shift = 0) {
    const w = el.clientWidth || 1;
    const from = modelToLngLat(cam[0], cam[2]);
    const to = modelToLngLat(look[0], look[2]);
    const camY = Math.max(cam[1], look[1] + 0.5);   // never look up past the horizontal
    let opts;
    try { opts = map.calculateCameraOptionsFromTo(from, camY, to, Math.max(0, look[1])); } catch (e) { return; }
    const left = Math.max(0, Math.min(w * 0.8, 2 * shift * w));
    if (left !== padding.left) padding = { ...padding, left };
    map.jumpTo({ ...opts, padding });
  }

  // ---------- night ----------
  const lerp = (a, c, t) => a + (c - a) * t;
  function setNight(t) {
    b.setNight(t);
    if (hemi) {
      hemi.intensity = lerp(0.7, 0.3, t); sun.intensity = lerp(2.4, 0.3, t); fill.intensity = lerp(0.45, 0.35, t);
      if (t > 0.5) { sun.color.setHex(0x9fb4e0); fill.color.setHex(0xffc98a); } else { sun.color.setHex(0xfff1dc); fill.color.setHex(0xbfd7ee); }
      scene.environmentIntensity = lerp(0.55, 0.16, t);
      for (const g of b.glassMats) g.emissiveIntensity = t * g.userData.night * 9;   // windows glow against the dimmed map (the CSS filter below darkens the model too)
    }
    // the basemap itself dims through a CSS filter on the container (same canvas as the model)
    // (no hue rotation: it would turn the sea brown and the lit windows violet)
    el.style.filter = t < 0.01 ? '' : `brightness(${lerp(1, 0.48, t).toFixed(3)}) saturate(${lerp(1, 0.7, t).toFixed(3)}) contrast(${lerp(1, 1.08, t).toFixed(3)})`;
    map.triggerRepaint();
  }

  // ---------- named views / destinations (Location panel) ----------
  let current = null;
  function clearDest() {
    if (map.getSource('sahil-route')) map.getSource('sahil-route').setData({ type: 'FeatureCollection', features: [] });
    destMarker?.remove(); destMarker = null;
  }
  function go(id) {
    const v = VIEWS[id]; if (!v) return;
    clearDest(); current = id;
    map.easeTo({ center: v.center, zoom: v.zoom - (narrow ? 0.6 : 0), pitch: v.pitch, bearing: v.bearing, elevation: 0, padding, duration: 1600, essential: true });
    onView?.(id, v);
  }
  function flyTo(id) {
    const d = DESTINATIONS[id]; if (!d) return;
    clearDest(); current = 'dest:' + id;
    map.getSource('sahil-route')?.setData(line([[SITE.lng, SITE.lat], d.lngLat]));
    const pin = document.createElement('div');
    pin.className = 'map-pin dest';
    pin.innerHTML = `<b>${d.name}</b><span>${d.mins} mins</span>`;
    destMarker = new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat(d.lngLat).addTo(map);
    // fit plot + destination into the padded area (fitBounds refuses while the centre is elevated)
    const pad = narrow ? { top: 70, bottom: 60, left: 50, right: 50 } : { top: 120, bottom: 80, left: padding.left + 200, right: 100 };   // room for the plot label left of the plot
    const a = maplibregl.MercatorCoordinate.fromLngLat([SITE.lng, SITE.lat]), c = maplibregl.MercatorCoordinate.fromLngLat(d.lngLat);
    const W = Math.max(50, el.clientWidth - pad.left - pad.right), H = Math.max(50, el.clientHeight - pad.top - pad.bottom);
    const dx = Math.max(1e-7, Math.abs(a.x - c.x)), dy = Math.max(1e-7, Math.abs(a.y - c.y));
    const zoom = Math.min(15, Math.log2(Math.min(W / (dx * 512), H / (dy * 512))) - 0.1);
    const mid = new maplibregl.MercatorCoordinate((a.x + c.x) / 2, (a.y + c.y) / 2, 0).toLngLat();
    map.easeTo({ center: mid, zoom, pitch: 0, bearing: 0, elevation: 0, padding: pad, duration: 1800, essential: true });
    onView?.(current, d);
  }

  return {
    map, building: b, ready, lookFrom, setNight, setPin, setNeighbours, go, flyTo, clearDest,
    get current() { return current; },
    load: b.load, loadDetail: b.loadDetail,
    setFocus: b.setFocus,
    dispose() { marker?.remove(); destMarker?.remove(); b.dispose(); map.remove(); },
  };
}
