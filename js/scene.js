import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { MeshoptDecoder } from 'meshoptimizer';

const phaseModels = ['earth', 'earth', 'astronaut', 'astronaut', 'mars', 'mars', 'mars'];
const composition = [
  [0, .07, 4.4], [-.48, .18, 5.3], [.18, .05, 4.9], [-.35, .15, 5.2],
  [.24, .17, 4.7], [.1, -.05, 3.9], [-.22, .36, 5.15],
];
const modelUrl = (name) => new URL('../models/' + name + '-scene.glb', import.meta.url);

function release(root) {
  const resources = new Set();
  const bitmaps = new Set();
  root.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    if (object.skeleton?.boneTexture) resources.add(object.skeleton.boneTexture);
    for (const material of [object.material].flat().filter(Boolean)) {
      resources.add(material);
      for (const value of Object.values(material)) {
        if (!value?.isTexture) continue;
        resources.add(value);
        if (typeof value.image?.close === 'function') bitmaps.add(value.image);
      }
    }
  });
  resources.forEach((resource) => resource.dispose());
  bitmaps.forEach((bitmap) => bitmap.close());
}

function normalized(model, diameter) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const factor = diameter / Math.max(size.x, size.y, size.z, .01);
  const center = bounds.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(factor);
  model.position.sub(center);
  return wrapper;
}

function spacecraft(dish) {
  const object = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xaab9c8, roughness: .6, metalness: .3 });
  const solar = new THREE.MeshStandardMaterial({ color: 0x3b70a8, roughness: .48 });
  function piece(geometry, material, x, y, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    object.add(mesh);
    return mesh;
  }
  piece(new THREE.BoxGeometry(.13, .24, .15), metal, 0, 0);
  piece(new THREE.CylinderGeometry(.012, .012, .62, 8), metal, 0, .02).rotation.z = Math.PI / 2;
  if (dish) {
    piece(new THREE.SphereGeometry(.19, 20, 10, 0, Math.PI * 2, 0, Math.PI * .38), metal, 0, .04).rotation.z = .35;
  } else {
    for (const side of [-1, 1]) {
      piece(new THREE.BoxGeometry(.22, .11, .025), solar, side * .25, .02);
    }
  }
  object.rotation.set(.3, -.35, -.35);
  return object;
}

export function createViewer({ canvas, viewport, reducedMotion, pending, ready, failed, lost }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .05, 40);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const sun = new THREE.DirectionalLight(0xffedda, 2);
  sun.position.set(-3, 3, 4);
  scene.add(sun, new THREE.HemisphereLight(0xb7d8ff, 0x3d3347, .72));

  const exhibit = new THREE.Group();
  const satellite = spacecraft(false);
  satellite.position.set(.99, .47, .45);
  const voyager = spacecraft(true);
  voyager.position.set(.78, -.32, .62);
  scene.add(exhibit, satellite, voyager);

  let phase = 0;
  let progress = 0;
  let current;
  let primary;
  let moon;
  let mixer;
  let moonRequest;
  let loading;
  let visible = false;
  let disposed = false;
  let frame = 0;
  let last = 0;

  function request() {
    if (!frame && visible && primary && !disposed) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    const [x, y, z] = composition[phase];
    const shift = reducedMotion.matches ? 0 : (progress - .5) * .55;
    camera.position.set(x + shift, y, z * Math.max(1, .92 / camera.aspect));
    camera.lookAt(0, 0, 0);
    exhibit.rotation.y = phase * .34 + shift;
    satellite.visible = phase === 1;
    voyager.visible = phase === 3;
    if (moon) moon.visible = phase === 1;
    if (mixer && !reducedMotion.matches) mixer.update(last ? Math.min(.05, (now - last) / 1000) : 0);
    last = now;
    renderer.render(scene, camera);
    if (mixer && !reducedMotion.matches) request();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = viewport;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(850000 / (width * height))));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    request();
  }

  async function load(name, signal) {
    const url = modelUrl(name);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Model fetch failed');
    const data = await response.arrayBuffer();
    signal.throwIfAborted();
    const gltf = await new Promise((resolve, reject) => loader.parse(data, new URL('.', url).href, resolve, reject));
    if (signal.aborted) {
      release(gltf.scene);
      signal.throwIfAborted();
    }
    return gltf;
  }

  function clear() {
    if (mixer) {
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    }
    mixer = undefined;
    loading?.abort();
    moonRequest?.abort();
    for (const child of [...exhibit.children]) {
      exhibit.remove(child);
      release(child);
    }
    primary = moon = moonRequest = undefined;
  }

  async function show(index) {
    if (disposed) return;
    phase = index;
    progress = 0;
    const name = phaseModels[index];
    if (current !== name) {
      clear();
      current = name;
      pending();
      const controller = new AbortController();
      loading = controller;
      try {
        const gltf = await load(name, controller.signal);
        primary = normalized(gltf.scene, name === 'astronaut' ? 1.7 : 2.4);
        exhibit.add(primary);
        if (name === 'astronaut' && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          mixer.clipAction(gltf.animations[0]).play();
          mixer.setTime(Math.min(1, gltf.animations[0].duration / 4));
        }
        ready();
      } catch {
        if (!controller.signal.aborted) {
          current = undefined;
          failed();
        }
        return;
      }
    }
    if (phase === 1 && current === 'earth' && !moonRequest) {
      const controller = new AbortController();
      moonRequest = controller;
      load('moon', controller.signal).then(({ scene: model }) => {
        moon = normalized(model, .38);
        moon.position.set(-1.36, .55, -.35);
        exhibit.add(moon);
        request();
      }).catch(() => {});
    }
    request();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  const contextLost = (event) => {
    event.preventDefault();
    lost();
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  reducedMotion.addEventListener('change', request);
  resize();

  return {
    show,
    position(value) {
      if (Math.abs(progress - value) < .004) return;
      progress = value;
      request();
    },
    setVisible(value) {
      visible = value;
      if (!value) {
        cancelAnimationFrame(frame);
        frame = last = 0;
      } else request();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      reducedMotion.removeEventListener('change', request);
      clear();
      release(scene);
      renderer.dispose();
    },
  };
}
