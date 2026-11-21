// r3: renderer + post-processing + iso camera helpers.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.4 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // teal-ish shadows, warm highlights
      col = mix(col, col * vec3(0.90, 1.02, 1.08), 1.0 - smoothstep(0.0, 0.5, l));
      col = mix(col, col * vec3(1.07, 1.0, 0.92), smoothstep(0.4, 1.3, l));
      // slight saturation lift
      col = mix(vec3(l), col, 1.12);
      // vignette
      float d = length(vUv - 0.5);
      float v = 1.0 - smoothstep(0.30, 0.95, d);
      col *= mix(1.0, v, uVignette);
      gl_FragColor = vec4(col, c.a);
    }`,
};

const SQ2 = Math.SQRT2;
const SQ6 = Math.sqrt(6);

export function createR3(glCanvas, opts = {}) {
  const isTouch = !!opts.isTouch;
  const dpr = window.devicePixelRatio || 1;
  const maxPR = Math.min(dpr, isTouch ? 1.5 : 2);

  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    antialias: dpr <= 1.5,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // applied by OutputPass
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0f1416, 1);

  let scene = null;
  let camera = null;
  let quality = 'high';
  let pixelRatio = maxPR;
  let cssW = 1;
  let cssH = 1;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.4, 0.85); // internally half-res
  const gradePass = new ShaderPass(GradeShader);
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(gradePass);
  composer.addPass(outputPass);

  function applyFrustum(cam) {
    if (!cam || !cam.isOrthographicCamera) return;
    const fit = cam.userData.fit || { needW: 11 * 1.15, needH: 11 };
    const aspect = cssW / Math.max(1, cssH);
    const H = Math.max(fit.needH, fit.needW / aspect);
    cam.top = H / 2;
    cam.bottom = -H / 2;
    cam.left = (-H * aspect) / 2;
    cam.right = (H * aspect) / 2;
    cam.updateProjectionMatrix();
  }

  function resize() {
    cssW = glCanvas.clientWidth || window.innerWidth || 1;
    cssH = glCanvas.clientHeight || window.innerHeight || 1;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssW, cssH, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(cssW, cssH);
    applyFrustum(camera);
  }

  function setQuality(q) {
    if (q === quality) return;
    quality = q;
    if (q === 'low') {
      bloomPass.enabled = false;
      pixelRatio = 1;
    } else {
      bloomPass.enabled = true;
      pixelRatio = maxPR;
    }
    resize();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  // auto quality: average fps < 40 over 3 s => low
  let fpsFrames = 0;
  let fpsTime = 0;
  let warm = 0;
  let last = performance.now();

  const r3 = {
    renderer,
    composer,
    get quality() { return quality; },
    set quality(q) { setQuality(q); },
    setQuality,
    get width() { return cssW; },
    get height() { return cssH; },
    resize,

    setView(s, c) {
      scene = s;
      camera = c;
      renderPass.scene = s;
      renderPass.camera = c;
      applyFrustum(c);
    },

    render(dt) {
      const now = performance.now();
      const real = Math.min(0.5, (now - last) / 1000);
      last = now;
      const frameDt = typeof dt === 'number' && dt > 0 ? dt : real;
      if (!scene || !camera) {
        renderer.setRenderTarget(null);
        renderer.clear();
        return;
      }
      // fps watchdog (ignore the first second: shader compiles; ignore hitches from hidden tabs)
      warm += real;
      if (warm > 1.0 && quality === 'high' && real < 0.5) {
        fpsFrames++;
        fpsTime += real;
        if (fpsTime >= 3) {
          const fps = fpsFrames / fpsTime;
          if (fps < 40) setQuality('low');
          fpsFrames = 0;
          fpsTime = 0;
        }
      }
      composer.render(frameDt);
    },

    /** Ortho iso camera: frustum height = viewTiles (portrait: width fitted instead). */
    makeIsoCamera(viewTiles = 11) {
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 140);
      cam.userData.fit = { needW: viewTiles * 1.15, needH: viewTiles };
      cam.userData.target = new THREE.Vector3();
      cam.position.set(20, 20, 20);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld(true);
      applyFrustum(cam);
      return cam;
    },

    /** Frame a room w x h tiles (grid units) centred on `center` (three world coords). */
    fitIso(cam, center, w, h, maxHeight = 2) {
      const needW = (w + h) / SQ2 + 1.6;
      const needH = (w + h) / SQ6 + (2 / SQ6) * maxHeight + 1.6;
      cam.userData.fit = { needW, needH };
      const target = (cam.userData.target || (cam.userData.target = new THREE.Vector3())).copy(center);
      target.y += 0.6;
      cam.position.set(target.x + 20, target.y + 20, target.z + 20);
      cam.lookAt(target);
      cam.updateMatrixWorld(true);
      applyFrustum(cam);
      return cam;
    },

    /** Raycast against objects (recursive). Returns the nearest intersection or null. */
    pick(clientX, clientY, objects) {
      if (!camera) return null;
      const rect = glCanvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      const ray = r3._ray || (r3._ray = new THREE.Raycaster());
      ray.setFromCamera({ x: nx, y: ny }, camera);
      const hits = ray.intersectObjects(objects, true);
      return hits.length ? hits[0] : null;
    },
  };
  return r3;
}
