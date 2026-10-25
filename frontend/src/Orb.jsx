import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Orb() {
  const host = useRef(null);
  useEffect(() => {
    const element = host.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { return; } // The CSS halo remains visible if WebGL is unavailable.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.z = 5.8;
    const group = new THREE.Group();
    scene.add(group);
    const geometry = new THREE.IcosahedronGeometry(1.12, 3);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x86d9b2, wireframe: true, transparent: true, opacity: 0.18 }));
    group.add(mesh);
    const positions = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const y = 1 - (i / 899) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      positions.set([Math.cos(angle) * radius * 1.14, y * 1.14, Math.sin(angle) * radius * 1.14], i * 3);
    }
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    group.add(new THREE.Points(pointsGeometry, new THREE.PointsMaterial({ color: 0xc9ffe0, size: 0.017, transparent: true, opacity: 0.8 })));
    [1.5, 1.75].forEach((radius, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.004, 6, 160), new THREE.MeshBasicMaterial({ color: 0xb4efcb, transparent: true, opacity: 0.35 }));
      ring.rotation.set(1.03 + i * 0.45, i * 0.6, -0.45);
      group.add(ring);
    });
    const resize = new ResizeObserver(() => {
      renderer.setSize(element.clientWidth, element.clientHeight);
      camera.aspect = element.clientWidth / element.clientHeight;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    });
    resize.observe(element);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame;
    const animate = () => {
      if (!document.hidden && !reduced.matches) { group.rotation.y += 0.002; group.rotation.z = Math.sin(performance.now() * 0.0002) * 0.08; }
      renderer.render(scene, camera);
      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(animate);
    };
    const resume = () => { cancelAnimationFrame(frame); animate(); };
    document.addEventListener('visibilitychange', resume);
    reduced.addEventListener('change', resume);
    animate();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      document.removeEventListener('visibilitychange', resume); reduced.removeEventListener('change', resume);
      scene.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className="orb" ref={host} aria-hidden="true"><div className="orb-halo" /></div>;
}
