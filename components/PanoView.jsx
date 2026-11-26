'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// 360° still of a room (equirectangular image on the inside of a sphere). Drag to look around,
// pinch or scroll to zoom. heading: degrees to turn the image so its centre column faces forward.
export default function PanoView({ src, label, heading = 0, onClose }) {
  const el = useRef(null);
  useEffect(() => {
    const box = el.current; if (!box) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    box.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(72, 1, 0.1, 100);
    const geo = new THREE.SphereGeometry(10, 64, 32); geo.scale(-1, 1, 1);
    const tex = new THREE.TextureLoader().load(src, () => { box.classList.add('ready'); draw(); });
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
    mesh.rotation.y = (heading * Math.PI) / 180; scene.add(mesh);
    let yaw = 0, pitch = 0, fov = 72, alive = true;
    function draw() {
      if (!alive) return;
      camera.fov = fov; camera.updateProjectionMatrix();
      camera.rotation.set(pitch, yaw, 0, 'YXZ'); renderer.render(scene, camera);
    }
    const size = () => { const w = box.clientWidth || 1, h = box.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; draw(); };
    const ro = new ResizeObserver(size); ro.observe(box); size();
    const pts = new Map(); let pinch0 = 0, fov0 = fov;
    const down = (e) => { box.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); fov0 = fov; } };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { yaw += (e.clientX - p[0]) * 0.0022 * (fov / 72); pitch = Math.max(-1.3, Math.min(1.3, pitch + (e.clientY - p[1]) * 0.0022 * (fov / 72))); }
      else if (pts.size === 2) { const [a, b] = [...pts.values()]; fov = Math.max(35, Math.min(90, fov0 * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])))); }
      draw();
    };
    const up = (e) => { pts.delete(e.pointerId); };
    const wheel = (e) => { e.preventDefault(); fov = Math.max(35, Math.min(90, fov + e.deltaY * 0.03)); draw(); };
    const key = (e) => { if (e.key === 'Escape') onClose?.(); else if (e.key === 'ArrowLeft') { yaw += 0.12; draw(); } else if (e.key === 'ArrowRight') { yaw -= 0.12; draw(); } };
    box.addEventListener('pointerdown', down); box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', wheel, { passive: false }); addEventListener('keydown', key);
    return () => { alive = false; ro.disconnect(); removeEventListener('keydown', key); geo.dispose(); tex.dispose(); mesh.material.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [src, heading, onClose]);
  return (
    <div className="sr-pano" role="dialog" aria-label={`360° view: ${label}`}>
      <div ref={el} className="cv" />
      <div className="cap"><b>{label}</b><small>360° still · drag to look around</small></div>
      <button type="button" className="x" onClick={onClose} aria-label="Close the 360° view">×</button>
    </div>
  );
}
