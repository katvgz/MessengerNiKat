import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createCharacterScene } from './characterModel';

// Thumbnail renders share one context; only large previews animate continuously.
let thumbnailRenderer;
const thumbnails = new Map();
function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}
function thumbnail(options) {
  const key = JSON.stringify(options);
  if (thumbnails.has(key)) return thumbnails.get(key);
  thumbnailRenderer ||= createRenderer();
  thumbnailRenderer.setSize(128, 128, false);
  const { scene, camera, model } = createCharacterScene(options, true);
  thumbnailRenderer.render(scene, camera);
  const url = thumbnailRenderer.domElement.toDataURL();
  model.dispose();
  if (thumbnails.size >= 80) thumbnails.delete(thumbnails.keys().next().value);
  thumbnails.set(key, url);
  return url;
}

export default function Character3D({ value, portrait }) {
  const host = useRef(null);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState('');
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const { style, mood, skin, glasses } = value;

  useEffect(() => {
    const container = host.current;
    const options = { style, mood, skin, glasses };
    setFailed(false);
    if (!portrait) {
      try { setPreview(thumbnail(options)); } catch { setFailed(true); }
      return;
    }
    let renderer;
    try { renderer = createRenderer(); } catch { setFailed(true); return; }
    const { scene, camera, model } = createCharacterScene(options);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    renderer.domElement.dataset.characterCanvas = 'true';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { x: 0, y: 0 };
    let visible = true;
    let lastTime = 0;
    let elapsed = 0;
    let frame;
    let rect = container.getBoundingClientRect();
    function resize() {
      rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      // Keep the model's head and shoulders inside narrow preview panels.
      camera.position.z = Math.max(6.9, 3.45 / camera.aspect);
      camera.updateProjectionMatrix();
    }
    function track(event) {
      if (pauseRef.current || reducedMotion.matches) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height * .36;
      target.x = THREE.MathUtils.clamp((event.clientX - centerX) / (window.innerWidth * .4), -1, 1);
      target.y = THREE.MathUtils.clamp((event.clientY - centerY) / (window.innerHeight * .4), -1, 1);
    }
    function reset() { target.x = 0; target.y = 0; }
    function updateBounds() { rect = container.getBoundingClientRect(); }
    function contextLost(event) { event.preventDefault(); setFailed(true); }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
    intersection.observe(container);
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerdown', track, { passive: true });
    window.addEventListener('blur', reset);
    window.addEventListener('scroll', updateBounds, { passive: true, capture: true });
    document.documentElement.addEventListener('pointerleave', reset);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    resize();
    function animate(time) {
      frame = requestAnimationFrame(animate);
      const delta = Math.min((time - lastTime) / 1000 || 0, .05);
      lastTime = time;
      if (!visible || document.hidden || failed) return;
      const moving = !pauseRef.current && !reducedMotion.matches;
      if (moving) elapsed += delta;
      const x = moving ? target.x : 0;
      const y = moving ? target.y : 0;
      const smoothing = 1 - Math.exp(-8 * delta);
      model.head.rotation.y = THREE.MathUtils.lerp(model.head.rotation.y, x * .52, smoothing);
      model.head.rotation.x = THREE.MathUtils.lerp(model.head.rotation.x, y * .28, smoothing);
      model.head.rotation.z = moving ? Math.sin(elapsed * .7) * .018 : 0;
      model.body.rotation.y = model.head.rotation.y * .17;
      model.root.position.y = moving ? Math.sin(elapsed * 1.8) * .018 : 0;
      const blinkPhase = elapsed % 4.7;
      const blink = moving && blinkPhase > 4.48 ? Math.max(.06, Math.abs((blinkPhase - 4.59) / .11)) : 1;
      model.eyes.forEach(eye => { eye.scale.y = blink; });
      model.pupils.forEach(pupil => {
        pupil.position.x = THREE.MathUtils.lerp(pupil.position.x, x * .035, smoothing);
        pupil.position.y = THREE.MathUtils.lerp(pupil.position.y, -y * .026, smoothing);
      });
      renderer.render(scene, camera);
      // Useful for checking real geometry motion without relying on screenshots.
      renderer.domElement.dataset.headYaw = model.head.rotation.y.toFixed(3);
      renderer.domElement.dataset.headPitch = model.head.rotation.x.toFixed(3);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerdown', track);
      window.removeEventListener('blur', reset);
      window.removeEventListener('scroll', updateBounds, true);
      document.documentElement.removeEventListener('pointerleave', reset);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      model.dispose(); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [style, mood, skin, glasses, portrait]);

  return <span className="character-render" ref={host}>
    {failed ? <span className="character-fallback">✦{portrait && <small>3D needs WebGL.<br />Try enabling graphics acceleration.</small>}</span> : !portrait && preview ? <img src={preview} alt="" /> : null}
    {portrait && !failed && <button className="motion-toggle" type="button" aria-label={paused ? 'Resume character motion' : 'Pause character motion'} aria-pressed={paused} onClick={() => { pauseRef.current = !paused; setPaused(!paused); }}>{paused ? '▶' : 'Ⅱ'}</button>}
  </span>;
}
