import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { byId, objects, SOLAR_DISTANCE_SCALE, STAR_DISTANCE_SCALE, GALAXY_DISTANCE_SCALE } from './data.js';

const GALAXY_PITCH = { milkyway: 0.24, andromeda: 0.25, whirlpool: 0.34, triangulum: 0.44, pinwheel: 0.4, ngc1300: 0.36, 'black-eye': 0.22 };
const GALAXY_TILT = { andromeda: [1.2, -0.62], sombrero: [1.47, 0.12], cigar: [1.4, -0.42], 'centaurus-a': [0.12, -0.45], 'black-eye': [0.9, -0.5], m87: [0.3, 0] };

const STAR_LOOK = {
  sirius: { hot: '#eef4ff', mid: '#a9c4f5', cool: '#4f6fc4', cells: 30, contrast: 0.3, spots: 0, limb: 0.5, seed: 1.3 },
  proxima: { hot: '#ffc08a', mid: '#f0603a', cool: '#5a140c', cells: 9, contrast: 0.42, spots: 0.75, limb: 0.7, flare: 1, seed: 4.7 },
  betelgeuse: { hot: '#ffd29a', mid: '#f2662f', cool: '#4a1006', cells: 2.6, contrast: 0.5, spots: 0.25, limb: 0.85, lump: 0.06, seed: 8.2 },
  trappist1: { hot: '#ffa070', mid: '#d8432a', cool: '#3a0a06', cells: 8, contrast: 0.45, spots: 0.85, limb: 0.75, flare: 1.3, seed: 2.9 },
  kepler452: { hot: '#fffbe6', mid: '#ffd27e', cool: '#b8601a', cells: 28, contrast: 0.3, spots: 0.35, limb: 0.6, seed: 6.1 },
  '51pegasi': { hot: '#fff3d4', mid: '#ffc066', cool: '#a24c14', cells: 24, contrast: 0.34, spots: 0.5, limb: 0.64, seed: 3.6 },
  hd209458: { hot: '#ffffff', mid: '#fff0c8', cool: '#d4924a', cells: 34, contrast: 0.24, spots: 0.15, limb: 0.5, seed: 9.4 }
};
const EXOPLANET_LOOK = { 'proxima-b': 'eyeball', 'trappist1-b': 'lava', 'trappist1-e': 'ocean', 'kepler452-b': 'arid', '51pegasi-b': 'hotjupiter', 'hd209458-b': 'evaporating' };

const hash3 = (x, y, z, seed) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const valueNoise3 = (x, y, z, seed) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
};
const fbm3 = (x, y, z, seed, octaves = 5) => {
  let sum = 0, amp = 0.5, norm = 0, freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(x * freq + 11.3, y * freq + 7.1, z * freq + 3.7, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
};
const NOISE_GLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;
export class UniverseScene {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.spaceBackground = this.scene.background;
    this.camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.05, 150000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.45;
    this.controls.zoomSpeed = 0.7;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1600;

    this.manager = new THREE.LoadingManager();
    this.manager.onLoad = () => this.callbacks.onReady?.();
    this.textureLoader = new THREE.TextureLoader(this.manager);
    this.clock = new THREE.Clock();
    this.starMaterials = [];
    this.spinners = [];
    this.objectGroups = new Map();
    this.interactive = [];
    this.rotating = [];
    this.solarOrbiters = [];
    this.orbitalDeltas = new Map();
    this.keys = new Set();
    this.speed = 1;
    this.cruise = false;
    this.travel = null;
    this.selectedId = 'earth';
    this.level = 'stellar';
    this.stellarRoot = new THREE.Group();
    this.galaxyRoot = new THREE.Group();
    this.scene.add(this.stellarRoot, this.galaxyRoot);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 2;
    this.pointer = new THREE.Vector2();

    this.createLights();
    this.createNebulae();
    this.createObjects();
    this.createAsteroidBelt();
    this.bindEvents();

    this.stellarCenter = new THREE.Vector3();
    const stars = objects.filter((object) => object.type === 'stars');
    stars.forEach((object) => this.stellarCenter.add(this.objectGroups.get(object.id).position));
    this.stellarCenter.divideScalar(stars.length);
    this.galaxyRoot.visible = false;

    const earthPosition = this.objectGroups.get('earth').position;
    this.controls.target.copy(earthPosition);
    this.camera.position.copy(earthPosition).add(new THREE.Vector3(4.6, 1.8, 6.2));
    this.controls.update();
    this.animate();
  }

  createLights() {
    this.scene.add(new THREE.AmbientLight(0x8ca4d4, 0.48));
    const sunlight = new THREE.PointLight(0xfff0d7, 2900, 0, 2);
    sunlight.position.set(0, 0, 0);
    this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight(0xc7dcff, 1.1);
    fill.position.set(1, 0.7, 2);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x698cff, 0.4);
    rim.position.set(1, 1, -2);
    this.scene.add(rim);
  }

  createNebulae() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(0.16, 'rgba(255,255,255,0.22)');
    gradient.addColorStop(0.48, 'rgba(255,255,255,0.07)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    const nebulae = [
      [-120, 35, -300, 0x3449a8, 270, 0.2],
      [150, -90, -390, 0x652b8e, 330, 0.13],
      [-360, 160, -650, 0x1c7182, 430, 0.13],
      [320, 100, -600, 0x8c3b62, 280, 0.08]
    ];
    nebulae.forEach(([x, y, z, color, scale, opacity]) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
      sprite.position.set(x, y, z);
      sprite.scale.set(scale, scale, 1);
      this.stellarRoot.add(sprite);
    });
  }

  createObjects() {
    objects.forEach((object) => {
      const group = new THREE.Group();
      const angle = object.phase || 0;
      if (object.au) {
        const radius = object.au * SOLAR_DISTANCE_SCALE;
        group.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * Math.sin(THREE.MathUtils.degToRad(object.inclination)), Math.sin(angle) * radius);
        this.solarOrbiters.push({ object, group, angle, radius, inclination: THREE.MathUtils.degToRad(object.inclination) });
      } else if (object.id === 'moon') {
        const earthPosition = this.objectGroups.get('earth').position;
        group.position.set(earthPosition.x + Math.cos(angle) * object.orbitRadius, earthPosition.y + Math.sin(angle) * 0.55, earthPosition.z + Math.sin(angle) * object.orbitRadius);
      } else {
        group.position.set(...object.position);
        if (object.type === 'stars' && object.id !== 'sun') group.position.multiplyScalar(STAR_DISTANCE_SCALE);
        else if (object.type === 'galaxies') group.position.multiplyScalar(GALAXY_DISTANCE_SCALE);
        else if (object.type === 'exoplanets') {
          const hostPosition = this.objectGroups.get(object.host).position;
          group.position.sub(new THREE.Vector3(...byId[object.host].position)).add(hostPosition);
        }
      }
      group.userData.objectId = object.id;
      if (object.type === 'galaxies') this.createGalaxy(object, group);
      else this.createSphereObject(object, group);
      this.objectGroups.set(object.id, group);
      (object.type === 'galaxies' ? this.galaxyRoot : this.stellarRoot).add(group);
      if (object.au) this.createOrbit(object);
      if (object.id === 'moon') this.moonOrbit = { object, group, mesh: group.children[0], angle };
      if (object.type === 'exoplanets') this.createExoplanetOrbit(object);
    });
  }

  createSphereObject(object, group) {
    const segments = object.id === 'sun' ? 96 : 64;
    const geometry = new THREE.SphereGeometry(object.size, segments, segments);
    if (object.id === 'moon') geometry.rotateY(-Math.PI / 2);
    let material;
    let planetLayers = null;
    if (STAR_LOOK[object.id]) material = this.createStarMaterial(object);
    else if (EXOPLANET_LOOK[object.id]) {
      planetLayers = this.createExoplanetLayers(object);
      material = new THREE.MeshStandardMaterial({
        map: planetLayers.map, roughness: planetLayers.roughness, metalness: 0,
        emissive: 0xffffff, emissiveMap: planetLayers.emissive || planetLayers.map, emissiveIntensity: planetLayers.emissive ? 0.95 : 0.32
      });
    } else {
      const texture = object.procedural ? this.createProceduralPlanetTexture(object) : this.textureLoader.load(`/textures/${object.texture || '2k_sun'}.jpg`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      material = object.type === 'stars'
        ? new THREE.MeshBasicMaterial({ map: texture, color: object.color })
        : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0, emissive: object.type === 'exoplanets' ? object.color : 0x000000, emissiveIntensity: object.type === 'exoplanets' ? 0.3 : 0 });
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.objectId = object.id;
    group.add(mesh);
    this.interactive.push(mesh);
    if (object.id === 'moon') mesh.lookAt(this.objectGroups.get('earth').position);
    else {
      const axialSpeed = object.rotationHours
        ? Math.sign(object.rotationHours) * Math.PI * 2 / (12 * Math.abs(object.rotationHours) / 23.934)
        : object.type === 'stars' ? 0.018 : 0.035 / Math.sqrt(object.size);
      mesh.rotation.z = THREE.MathUtils.degToRad(object.axialTilt || 0);
      this.rotating.push({ mesh, speed: axialSpeed });
    }

    if (object.id === 'earth') {
      const cloudsTexture = this.textureLoader.load('/textures/2k_earth_clouds.jpg');
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(object.size * 1.008, 64, 64),
        new THREE.MeshStandardMaterial({ map: cloudsTexture, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      group.add(clouds);
      this.rotating.push({ mesh: clouds, speed: 0.047 });
      this.addAtmosphere(group, object.size, '#4c9dff');
    }
    if (object.type === 'stars') {
      this.addAtmosphere(group, object.size, object.color, 1.35);
      const glow = this.createGlow(object.color);
      glow.scale.setScalar(object.size * 6.5);
      group.add(glow);
    }
    if (object.atmosphere) this.addAtmosphere(group, object.size, object.color, 1.08);
    if (planetLayers?.clouds) {
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(object.size * 1.012, 64, 64),
        new THREE.MeshStandardMaterial({ map: planetLayers.clouds, transparent: true, depthWrite: false, roughness: 1, emissive: 0xffffff, emissiveMap: planetLayers.clouds, emissiveIntensity: 0.25 })
      );
      group.add(clouds);
      this.rotating.push({ mesh: clouds, speed: 0.05 / Math.sqrt(object.size) });
    }
    if (EXOPLANET_LOOK[object.id] === 'evaporating') this.createEvaporatingTail(object, group);
    if (object.id === 'betelgeuse') this.addAtmosphere(group, object.size, '#ff5a2a', 1.75);
    if (object.id === 'sirius') this.createSiriusB(object, group);
    if (object.id === 'saturn') this.createSaturnRings(group, object.size);
  }

  createStarMaterial(object) {
    const look = STAR_LOOK[object.id];
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: Math.random() * 100 },
        uHot: { value: new THREE.Color(look.hot) },
        uMid: { value: new THREE.Color(look.mid) },
        uCool: { value: new THREE.Color(look.cool) },
        uCells: { value: look.cells },
        uContrast: { value: look.contrast },
        uSpots: { value: look.spots },
        uLimb: { value: look.limb },
        uFlare: { value: look.flare || 0 },
        uLump: { value: look.lump || 0 },
        uSeed: { value: look.seed }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uLump;
        uniform float uSeed;
        varying vec3 vPos;
        varying vec3 vNormal;
        varying vec3 vView;
        ${NOISE_GLSL}
        void main() {
          vPos = normalize(position);
          float lump = uLump > 0.0 ? snoise(vPos * 1.6 + vec3(uSeed, uTime * 0.015, 0.0)) * uLump : 0.0;
          vec4 mvPosition = modelViewMatrix * vec4(position * (1.0 + lump), 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uHot;
        uniform vec3 uMid;
        uniform vec3 uCool;
        uniform float uCells;
        uniform float uContrast;
        uniform float uSpots;
        uniform float uLimb;
        uniform float uFlare;
        uniform float uSeed;
        varying vec3 vPos;
        varying vec3 vNormal;
        varying vec3 vView;
        ${NOISE_GLSL}
        float fbm(vec3 p) {
          float sum = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 4; i++) {
            sum += amp * snoise(p);
            p *= 2.07;
            amp *= 0.5;
          }
          return sum;
        }
        void main() {
          vec3 p = vPos;
          float t = uTime * 0.035;
          float cells = pow(1.0 - abs(snoise(p * uCells + vec3(t, -t, t * 0.6) + uSeed)), 2.2);
          float large = fbm(p * uCells * 0.3 + vec3(0.0, t * 0.4, uSeed * 1.7)) * 0.5 + 0.5;
          float heat = mix(0.62, mix(large, cells, 0.55), uContrast * 1.6);
          float spotNoise = snoise(p * 2.3 + vec3(uSeed * 3.1, 0.0, t * 0.15));
          float penumbra = smoothstep(0.42, 0.62, spotNoise) * uSpots;
          float umbra = smoothstep(0.6, 0.78, spotNoise) * uSpots;
          float faculae = smoothstep(0.24, 0.4, spotNoise) * (1.0 - smoothstep(0.4, 0.55, spotNoise)) * uSpots;
          heat += faculae * 0.18 - penumbra * 0.32 - umbra * 0.3;
          float mu = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
          float limb = 1.0 - uLimb * (1.0 - pow(mu, 0.55));
          heat = clamp(heat * (0.55 + limb * 0.55), 0.0, 1.0);
          vec3 color = heat < 0.5 ? mix(uCool, uMid, heat * 2.0) : mix(uMid, uHot, heat * 2.0 - 1.0);
          color *= 0.8 + limb * 0.5;
          float flareWave = pow(max(0.0, sin(uTime * 0.42 + uSeed * 7.0)), 28.0) * uFlare;
          float flareSpot = smoothstep(0.5, 0.82, snoise(p * 3.1 + uSeed * 5.0));
          color += uHot * flareWave * flareSpot * 1.8;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    this.starMaterials.push(material);
    return material;
  }

  createSiriusB(object, group) {
    const pivot = new THREE.Group();
    pivot.rotation.x = 0.42;
    const dwarf = new THREE.Mesh(new THREE.SphereGeometry(object.size * 0.07, 24, 24), new THREE.MeshBasicMaterial({ color: '#eaf3ff' }));
    dwarf.position.set(object.size * 3.4, 0, 0);
    const glow = this.createGlow('#bcd6ff');
    glow.scale.setScalar(object.size * 0.9);
    glow.position.copy(dwarf.position);
    pivot.add(dwarf, glow);
    group.add(pivot);
    this.spinners.push({ object: pivot, speed: 0.06 });
  }

  createEvaporatingTail(object, group) {
    const host = this.objectGroups.get(object.host);
    const away = group.position.clone().sub(host.position).normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(away).normalize();
    const up = away.clone().cross(side);
    const count = 4500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const base = new THREE.Color('#7fc8ff');
    for (let i = 0; i < count; i++) {
      const t = Math.pow(Math.random(), 1.8);
      const length = object.size * (0.9 + t * 9);
      const spread = object.size * (0.35 + t * 1.8) * Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      const point = away.clone().multiplyScalar(length)
        .add(side.clone().multiplyScalar(Math.cos(angle) * spread + t * t * object.size * 2.2))
        .add(up.clone().multiplyScalar(Math.sin(angle) * spread));
      positions.set([point.x, point.y, point.z], i * 3);
      const fade = (1 - t) * (0.5 + Math.random() * 0.5);
      colors.set([base.r * fade, base.g * fade, base.b * fade], i * 3);
      sizes[i] = object.size * (0.05 + Math.random() * 0.08);
    }
    const tail = new THREE.Points(this.createPointGeometry(positions, colors, sizes), this.createGalaxyPointMaterial(THREE.AdditiveBlending, 0.8));
    group.add(tail);
  }

  createExoplanetLayers(object) {
    const look = EXOPLANET_LOOK[object.id];
    const width = 512;
    const height = 256;
    const seed = [...object.id].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) & 0xffff;
    const makeCanvas = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      return { canvas, ctx, image: ctx.createImageData(width, height) };
    };
    const surface = makeCanvas();
    const glow = ['lava', 'hotjupiter'].includes(look) ? makeCanvas() : null;
    const cloudLayer = ['ocean', 'arid', 'eyeball'].includes(look) ? makeCanvas() : null;
    const ramp = (stops, t) => {
      t = THREE.MathUtils.clamp(t, 0, 1);
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const [t0, c0] = stops[i - 1];
          const [t1, c1] = stops[i];
          const k = (t - t0) / Math.max(t1 - t0, 0.0001);
          return [0, 1, 2].map((ch) => c0[ch] + (c1[ch] - c0[ch]) * k);
        }
      }
      return stops[stops.length - 1][1];
    };
    const rgb = (hex) => hex.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16));
    const P = {
      ice: rgb('#e4eef7'), iceBlue: rgb('#9fbfd8'), crack: rgb('#5d84a8'), deep: rgb('#0d2440'), ocean: rgb('#1d4d78'), shallow: rgb('#3f8a9c'),
      redLand: rgb('#6b3a2a'), darkLand: rgb('#3a2a22'), rust: rgb('#8e4b2e'), olive: rgb('#55623a'), moss: rgb('#38503a'),
      sand: rgb('#d7b07a'), ochre: rgb('#b77a42'), dune: rgb('#9a5f34'), rock: rgb('#6e5446'), sea: rgb('#24575e'),
      basalt: rgb('#1d1714'), ash: rgb('#3e332e'), lava: rgb('#ff5a14'), lavaCore: rgb('#ffd36a'),
      hotDark: rgb('#4a1410'), hotMid: rgb('#b8431d'), hotLight: rgb('#f2a35c'), hotCream: rgb('#f7d9a6'),
      tealDeep: rgb('#0e2f4a'), teal: rgb('#2f7aa6'), tealLight: rgb('#8cc6dc'), tealPale: rgb('#d0e6ea')
    };
    for (let y = 0; y < height; y++) {
      const lat = (0.5 - (y + 0.5) / height) * Math.PI;
      const cosLat = Math.cos(lat);
      for (let x = 0; x < width; x++) {
        const lon = ((x + 0.5) / width) * Math.PI * 2;
        const px = -Math.cos(lon) * cosLat;
        const py = Math.sin(lat);
        const pz = Math.sin(lon) * cosLat;
        const n = (scale, s = 0, oct = 5) => fbm3(px * scale, py * scale, pz * scale, seed + s, oct);
        let color;
        let emission = null;
        let cloud = 0;
        if (look === 'eyeball') {
          const facing = -px;
          const wobble = (n(2.4) - 0.5) * 0.35;
          const ridge = 1 - Math.abs(n(6, 3, 4) * 2 - 1);
          if (facing > 0.7 + wobble) color = ramp([[0, P.shallow], [1, P.deep]], (facing - 0.7) * 2.2 + (n(5, 9) - 0.5) * 0.4);
          else if (facing > 0.48 + wobble) color = ramp([[0, P.darkLand], [0.5, P.redLand], [1, P.rust]], n(7, 5));
          else color = ridge > 0.9 ? P.crack : ramp([[0, P.iceBlue], [1, P.ice]], n(4, 11) + (0.45 - facing) * 0.3);
          cloud = facing > 0.35 ? THREE.MathUtils.smoothstep(n(3.5, 21), 0.55, 0.78) * 0.85 : 0;
        } else if (look === 'lava') {
          const crust = n(3);
          color = ramp([[0, P.basalt], [0.6, P.ash], [1, P.rock]], crust);
          const cracks = 1 - Math.abs(n(4.2, 7, 4) * 2 - 1);
          const flow = THREE.MathUtils.smoothstep(cracks, 0.9, 0.985) + THREE.MathUtils.smoothstep(n(1.6, 13), 0.72, 0.82) * 0.6;
          const heat = Math.min(1, flow);
          emission = ramp([[0, [0, 0, 0]], [0.5, P.lava], [1, P.lavaCore]], heat);
          color = color.map((ch, i) => ch * (1 - heat * 0.7) + P.lava[i] * heat * 0.7);
        } else if (look === 'ocean') {
          const elevation = n(1.8) + (n(6, 4, 3) - 0.5) * 0.12;
          if (elevation < 0.56) color = ramp([[0.25, P.deep], [0.5, P.ocean], [0.56, P.shallow]], elevation);
          else color = ramp([[0.56, P.olive], [0.66, P.moss], [0.78, P.rock]], elevation);
          if (Math.abs(py) > 0.8 + (n(5, 8) - 0.5) * 0.2) color = P.ice;
          const warp = n(2, 31, 3);
          cloud = THREE.MathUtils.smoothstep(fbm3(px * 4 + warp * 2, py * 9, pz * 4 + warp, seed + 17, 5), 0.58, 0.8) * 0.8;
        } else if (look === 'arid') {
          const elevation = n(2.2);
          if (elevation < 0.4) color = ramp([[0.2, P.sea], [0.4, P.shallow]], elevation);
          else color = ramp([[0.4, P.sand], [0.55, P.ochre], [0.7, P.dune], [0.85, P.rock]], elevation + (n(9, 6, 3) - 0.5) * 0.1);
          if (Math.abs(py) > 0.88 + (n(5, 8) - 0.5) * 0.15) color = P.ice;
          cloud = THREE.MathUtils.smoothstep(n(3.2, 19), 0.6, 0.82) * 0.7;
        } else if (look === 'hotjupiter') {
          const warp = (n(3) - 0.5) * 0.5;
          const band = Math.sin((py + warp) * 13) * 0.5 + 0.5;
          const detail = n(9, 5, 4);
          color = ramp([[0, P.hotDark], [0.45, P.hotMid], [0.8, P.hotLight], [1, P.hotCream]], band * 0.75 + detail * 0.3);
          const storm = THREE.MathUtils.smoothstep(n(1.4, 23), 0.68, 0.8);
          color = color.map((ch, i) => ch * (1 - storm) + P.hotDark[i] * storm);
          emission = color.map((ch) => ch * (0.35 + detail * 0.3));
        } else {
          const warp = (n(2.6) - 0.5) * 0.45;
          const band = Math.sin((py + warp) * 10 + n(6, 3, 3) * 2) * 0.5 + 0.5;
          color = ramp([[0, P.tealDeep], [0.4, P.teal], [0.8, P.tealLight], [1, P.tealPale]], band * 0.8 + n(8, 9, 4) * 0.25);
        }
        const shade = 0.85 + cosLat * 0.15;
        const offset = (y * width + x) * 4;
        for (let ch = 0; ch < 3; ch++) surface.image.data[offset + ch] = color[ch] * shade;
        surface.image.data[offset + 3] = 255;
        if (glow) {
          for (let ch = 0; ch < 3; ch++) glow.image.data[offset + ch] = emission[ch];
          glow.image.data[offset + 3] = 255;
        }
        if (cloudLayer) {
          for (let ch = 0; ch < 3; ch++) cloudLayer.image.data[offset + ch] = 245;
          cloudLayer.image.data[offset + 3] = cloud * 255;
        }
      }
    }
    const finish = (layer) => {
      if (!layer) return null;
      layer.ctx.putImageData(layer.image, 0, 0);
      const texture = new THREE.CanvasTexture(layer.canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      return texture;
    };
    return { map: finish(surface), emissive: finish(glow), clouds: finish(cloudLayer), roughness: ['ocean', 'eyeball'].includes(look) ? 0.6 : 0.9 };
  }

  createProceduralPlanetTexture(object) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(canvas.width, canvas.height);
    const palette = object.surface.map((hex) => hex.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16)));
    for (let y = 0; y < canvas.height; y++) {
      const v = y / canvas.height;
      for (let x = 0; x < canvas.width; x++) {
        const u = x / canvas.width;
        const bands = 0.5 + Math.sin(v * 84 + Math.sin(u * 13) * 1.8 + Math.sin(v * 23)) * 0.24;
        const continents = 0.5 + Math.sin(u * 29 + Math.sin(v * 19) * 2.2) * Math.sin(v * 31 - u * 8) * 0.27;
        const grain = (Math.random() - 0.5) * 0.18;
        const mix = THREE.MathUtils.clamp((object.pattern === 'bands' ? bands : continents) + grain, 0, 1);
        const shade = 0.8 + Math.cos((v - 0.5) * Math.PI) * 0.2;
        const offset = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) image.data[offset + channel] = (palette[0][channel] * (1 - mix) + palette[1][channel] * mix) * shade;
        image.data[offset + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  addAtmosphere(group, size, color, scale = 1.065) {
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.2);
          gl_FragColor = vec4(uColor, intensity * 0.38);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(size * scale, 64, 64), material));
  }

  createGlow(color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.18, 'rgba(255,255,255,0.25)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  }

  createSaturnRings(group, size) {
    const geometry = new THREE.RingGeometry(size * 1.35, size * 2.35, 128, 1);
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const radius = Math.sqrt(pos.getX(i) ** 2 + pos.getY(i) ** 2);
      uv.setXY(i, (radius - size * 1.35) / size, 0.5);
    }
    const texture = this.textureLoader.load('/textures/2k_saturn_ring_alpha.png');
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xe8d1a5, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false });
    const rings = new THREE.Mesh(geometry, material);
    rings.rotation.x = -Math.PI / 2.25;
    rings.rotation.y = 0.18;
    rings.userData.objectId = 'saturn';
    group.add(rings);
    this.interactive.push(rings);
  }

  createOrbit(object) {
    const radius = object.au * SOLAR_DISTANCE_SCALE;
    const inclination = THREE.MathUtils.degToRad(object.inclination);
    const points = [];
    for (let i = 0; i < 256; i++) {
      const angle = (i / 256) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * Math.sin(inclination), Math.sin(angle) * radius));
    }
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0x6e83a8, transparent: true, opacity: 0.13, depthWrite: false })
    );
    this.stellarRoot.add(line);
  }

  createExoplanetOrbit(object) {
    const hostPosition = this.objectGroups.get(object.host).position;
    const planetPosition = this.objectGroups.get(object.id).position;
    const radius = Math.hypot(planetPosition.x - hostPosition.x, planetPosition.z - hostPosition.z);
    const points = [];
    for (let i = 0; i < 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(hostPosition.x + Math.cos(angle) * radius, planetPosition.y, hostPosition.z + Math.sin(angle) * radius));
    }
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: object.color, transparent: true, opacity: 0.2, depthWrite: false })
    );
    this.stellarRoot.add(line);
  }

  createAsteroidBelt() {
    const count = 2200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = (2.2 + Math.random()) * SOLAR_DISTANCE_SCALE;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.8;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stellarRoot.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xb8a693, size: 0.055, transparent: true, opacity: 0.55 })));
  }

  createGalaxy(object, group) {
    const size = object.size;
    const count = innerWidth < 650 ? 42000 : 68000;
    const elliptical = object.shape === 'elliptical';
    const starburst = object.shape === 'starburst';
    const spiral = Boolean(object.arms) && !object.shape;
    const pitch = GALAXY_PITCH[object.id] ?? 0.3;
    const armStart = size * (object.bar ? 0.3 : 0.1);
    const armAngle = (r, arm) => arm / object.arms * Math.PI * 2 + Math.log(Math.max(r, armStart) / armStart) / Math.tan(pitch);
    const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(0.0001, Math.random()))) * Math.cos(Math.PI * 2 * Math.random());
    const expRadius = (scale, max) => -scale * Math.log(1 - Math.random() * (1 - Math.exp(-max / scale)));
    const sersic = (scale, max) => Math.min(max, scale * Math.pow(-Math.log(1 - Math.random() * 0.9999), 2));
    const direction = () => {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return [Math.cos(a) * s, Math.sin(a) * s, u];
    };
    const palette = {
      core: new THREE.Color('#fff1d6'),
      old: new THREE.Color('#ffd29e'),
      disk: new THREE.Color(object.color).lerp(new THREE.Color('#fff0dc'), 0.45),
      young: new THREE.Color(object.color).lerp(new THREE.Color('#a8c8ff'), 0.35),
      hii: new THREE.Color('#ff86b4'),
      outflow: new THREE.Color('#ff5236'),
      jet: new THREE.Color('#9ec9ff'),
      starburstDisk: new THREE.Color('#b6cdf2')
    };
    const knots = spiral ? Array.from({ length: object.arms * 22 }, (_, k) => {
      const r = armStart + Math.pow(Math.random(), 0.8) * size * 0.85;
      const a = armAngle(r, k % object.arms) + gaussian() * 0.05;
      return [Math.cos(a) * r, Math.sin(a) * r, size * (0.015 + Math.random() * 0.025)];
    }) : [];
    const jetDir = new THREE.Vector3(0.55, 0.35, 0.76).normalize();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = Math.random();
      let x, y, z, color, brightness;
      let starSize = 0.3 + Math.random() * 0.6;
      if (elliptical) {
        const axes = object.id === 'm87' ? [1, 0.95, 0.9] : [1, 0.84, 0.78];
        if (object.id === 'centaurus-a' && p < 0.035) {
          const along = gaussian() * size * 0.3;
          const side = Math.random() < 0.5 ? -1 : 1;
          x = along;
          y = Math.sin(along / size * 3.2) * size * 0.05 + side * size * (0.045 + Math.abs(gaussian()) * 0.015);
          z = gaussian() * size * 0.3;
          color = palette.jet;
          brightness = 0.7 + Math.random() * 0.3;
        } else if (object.id === 'm87' && p < 0.02) {
          const t = Math.pow(Math.random(), 1.4) * size * 0.7;
          const spread = size * (0.003 + t / size * 0.025);
          x = jetDir.x * t + gaussian() * spread;
          y = jetDir.y * t + gaussian() * spread;
          z = jetDir.z * t + gaussian() * spread;
          color = palette.jet;
          brightness = 1 - t / size * 0.8;
        } else if (p < 0.05) {
          const [dx, dy, dz] = direction();
          const r = expRadius(size * 0.55, size * 1.7);
          [x, y, z] = [dx * r, dy * r, dz * r];
          color = palette.old;
          brightness = 0.45;
          starSize = 0.55 + Math.random() * 0.35;
        } else {
          const [dx, dy, dz] = direction();
          const r = sersic(size * 0.05, size * 1.6);
          [x, y, z] = [dx * r * axes[0], dy * r * axes[1], dz * r * axes[2]];
          color = palette.core.clone().lerp(palette.old, Math.min(1, r / size * 1.8));
          brightness = 0.3 + 0.65 * Math.exp(-r / (size * 0.12)) + Math.random() * 0.15;
        }
      } else if (starburst && p < 0.24) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const t = expRadius(0.45, 1.5);
        const filament = (Math.floor(Math.random() * 28) / 28) * Math.PI * 2 + gaussian() * 0.07;
        const cone = size * (0.05 + t * 0.4);
        const rr = cone * (Math.random() < 0.65 ? Math.abs(gaussian()) * 0.55 : Math.sqrt(Math.random()));
        x = Math.cos(filament) * rr * 1.1;
        y = Math.sin(filament) * rr * 0.8;
        z = side * (size * 0.04 + t * size);
        color = palette.outflow.clone().lerp(palette.core, Math.max(0, 0.55 - t));
        brightness = (0.35 + Math.random() * 0.45) * (1 - Math.min(t, 1) * 0.35);
      } else if (p < (object.bulgeHeavy ? 0.42 : starburst ? 0.36 : 0.16)) {
        const [dx, dy, dz] = direction();
        const r = sersic(size * (object.bulgeHeavy ? 0.055 : 0.03), size * 0.7);
        [x, y, z] = [dx * r, dy * r, dz * r * (object.bulgeHeavy ? 0.78 : 0.62)];
        color = palette.core.clone().lerp(palette.old, Math.min(1, r / (size * 0.3)));
        brightness = 0.45 + 0.7 * Math.exp(-r / (size * 0.07)) + Math.random() * 0.2;
        starSize = 0.3 + Math.random() * 0.85;
      } else if (object.bar && p < 0.3) {
        x = gaussian() * size * 0.19;
        y = gaussian() * size * 0.05 * (0.55 + 0.45 * Math.exp(-(x * x) / (2 * (size * 0.12) ** 2)));
        z = gaussian() * size * 0.022;
        color = palette.core.clone().lerp(palette.old, Math.min(1, Math.abs(x) / (size * 0.4)));
        brightness = 0.5 + Math.random() * 0.35;
      } else if (spiral && p < 0.62) {
        if (Math.random() < 0.06) {
          const [kx, ky, ks] = knots[Math.floor(Math.random() * knots.length)];
          x = kx + gaussian() * ks;
          y = ky + gaussian() * ks;
          z = gaussian() * size * 0.008;
          color = Math.random() < 0.3 ? palette.hii : palette.young;
          brightness = 0.45 + Math.random() * 0.35;
          starSize = 0.4 + Math.random() * 0.5;
        } else {
          const arm = i % object.arms;
          const r = armStart + expRadius(size * 0.34, size * 1.05);
          const a = armAngle(r, arm) + gaussian() * 0.07;
          const width = size * (0.05 + r / size * 0.14);
          const offset = gaussian() * width * (Math.random() < 0.7 ? 1 : 2.2);
          x = Math.cos(a) * r - Math.sin(a) * offset;
          y = Math.sin(a) * r + Math.cos(a) * offset;
          z = gaussian() * size * 0.014;
          const patch = 0.55 + 0.45 * Math.sin(r / size * 17 + arm * 2.1) * Math.sin(r / size * 7.3 + arm);
          const youth = Math.exp(-(offset * offset) / (2 * (width * 0.6) ** 2)) * Math.min(1, r / (size * 0.4));
          color = palette.disk.clone().lerp(palette.young, youth * 0.75);
          brightness = (0.24 + youth * 0.3 + Math.random() * 0.22) * patch;
        }
      } else {
        const ring = object.id === 'sombrero' && Math.random() < 0.45;
        const r = ring ? size * (0.74 + gaussian() * 0.06) : expRadius(size * (starburst ? 0.3 : 0.34), size * 1.35);
        const a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * r * (starburst ? 1.35 : 1);
        y = Math.sin(a) * r;
        z = gaussian() * size * (starburst ? 0.03 : 0.015) * (1 + r / size * 0.6);
        color = palette.core.clone().lerp(starburst ? palette.starburstDisk : palette.disk, Math.min(1, r / size * 1.4));
        brightness = 0.22 + Math.random() * 0.33;
      }
      positions.set([x, y, z], i * 3);
      colors.set([color.r * brightness, color.g * brightness, color.b * brightness], i * 3);
      sizes[i] = starSize;
    }
    const points = new THREE.Points(this.createPointGeometry(positions, colors, sizes), this.createGalaxyPointMaterial(THREE.AdditiveBlending, 0.64));
    points.userData.objectId = object.id;
    group.add(points);
    this.interactive.push(points);

    const dust = this.createGalaxyDust(object, { gaussian, expRadius, armAngle, armStart, spiral });
    if (dust) group.add(dust);

    group.rotation.x = GALAXY_TILT[object.id]?.[0] ?? 0.38;
    group.rotation.z = GALAXY_TILT[object.id]?.[1] ?? -0.16;

    const detail = [points];
    if (dust) detail.push(dust);
    if (!elliptical) {
      const disk = new THREE.Mesh(
        new THREE.PlaneGeometry(size * 2.35, size * 2.35),
        new THREE.MeshBasicMaterial({ map: this.createGalaxyHaze(object, armStart, pitch), transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
      );
      disk.position.z = -0.12;
      if (starburst) disk.scale.set(1.25, 0.7, 1);
      group.add(disk);
      detail.push(disk);
    } else {
      const halo = this.createGlow(object.color);
      halo.material.opacity = 0.55;
      halo.scale.set(size * 2.6, size * 2.6 * 0.92, 1);
      group.add(halo);
      detail.push(halo);
    }
    const core = this.createGlow('#ffd7ad');
    const coreAspect = elliptical ? 0.92 : starburst ? 0.53 : 0.6;
    const coreBase = size * (elliptical ? 1.05 : starburst ? 0.6 : 0.85);
    core.scale.set(coreBase, coreBase * coreAspect, 1);
    core.userData.objectId = object.id;
    group.add(core);
    this.interactive.push(core);
    group.userData.detail = detail;
    group.userData.core = core;
    group.userData.coreAspect = coreAspect;
    group.userData.coreBase = coreBase;

    if (object.id === 'whirlpool') {
      const companion = this.createGlow('#ffd7ad');
      companion.scale.set(size * 0.34, size * 0.24, 1);
      companion.position.set(size * 1.15, -size * 0.3, 0);
      group.add(companion);
    }

    if (object.id === 'milkyway') {
      this.milkyWaySky = this.textureLoader.load('/textures/8k_stars_milky_way.jpg');
      this.milkyWaySky.mapping = THREE.EquirectangularReflectionMapping;
      this.milkyWaySky.colorSpace = THREE.SRGBColorSpace;
    }
  }

  createGalaxyDust(object, { gaussian, expRadius, armAngle, armStart, spiral }) {
    const size = object.size;
    if (!spiral && !object.dustLane && object.shape !== 'starburst') return null;
    const count = innerWidth < 650 ? 5000 : 9000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const dark = new THREE.Color('#140b07');
    for (let i = 0; i < count; i++) {
      let x, y, z;
      if (object.id === 'sombrero') {
        const r = size * (0.8 + gaussian() * 0.07);
        const a = Math.random() * Math.PI * 2;
        [x, y, z] = [Math.cos(a) * r, Math.sin(a) * r, gaussian() * size * 0.012];
      } else if (object.id === 'centaurus-a') {
        const r = size * (0.03 + Math.sqrt(Math.random()) * 0.5);
        const a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = Math.sin(x / size * 3.2) * size * 0.05 + gaussian() * size * 0.022 * (1 - r / size);
      } else if (object.id === 'black-eye' && Math.random() < 0.6) {
        const r = size * (0.16 + Math.random() * 0.3);
        const a = -0.35 * Math.PI + Math.pow(Math.random(), 0.8) * 1.05 * Math.PI;
        [x, y, z] = [Math.cos(a) * r, Math.sin(a) * r, gaussian() * size * 0.01];
      } else if (object.shape === 'starburst') {
        const r = expRadius(size * 0.25, size * 0.9);
        const a = Math.random() * Math.PI * 2;
        [x, y, z] = [Math.cos(a) * r * 1.35, Math.sin(a) * r, gaussian() * size * 0.02];
      } else {
        const r = armStart * 1.1 + expRadius(size * 0.3, size * 0.95);
        const a = armAngle(r, i % object.arms) + gaussian() * 0.06;
        const width = size * (0.05 + r / size * 0.14);
        const offset = -width * 0.4 + gaussian() * width * 0.45;
        [x, y, z] = [Math.cos(a) * r - Math.sin(a) * offset, Math.sin(a) * r + Math.cos(a) * offset, gaussian() * size * 0.006];
      }
      positions.set([x, y, z], i * 3);
      colors.set([dark.r, dark.g, dark.b], i * 3);
      sizes[i] = 1 + Math.random() * 1.2;
    }
    const dustOpacity = object.id === 'sombrero' ? 0.35 : object.id === 'centaurus-a' ? 0.2 : object.id === 'black-eye' ? 0.18 : 0.1;
    const dust = new THREE.Points(this.createPointGeometry(positions, colors, sizes), this.createGalaxyPointMaterial(THREE.NormalBlending, dustOpacity));
    dust.renderOrder = 2;
    return dust;
  }

  createPointGeometry(positions, colors, sizes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }

  createGalaxyPointMaterial(blending, opacity) {
    return new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: opacity } },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * (230.0 / -mvPosition.z), 0.55, 6.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, alpha * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending
    });
  }

  createGalaxyHaze(object, armStart, pitch) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(canvas.width, canvas.height);
    const inner = [255, 225, 186];
    const outer = object.color.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16));
    const spiral = Boolean(object.arms) && !object.shape;
    const halfSpan = object.size * 1.175;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const nx = ((x + 0.5) / canvas.width - 0.5) * 2;
        const ny = (0.5 - (y + 0.5) / canvas.height) * 2;
        const radius = Math.hypot(nx, ny);
        const edgeFade = 1 - THREE.MathUtils.smoothstep(radius, 0.55, 1);
        const diskLight = Math.exp(-radius * 3.2) * 0.32;
        let armLight = 0;
        if (spiral && radius > 0.05) {
          const r = radius * halfSpan;
          const phase = (Math.cos(object.arms * (Math.atan2(ny, nx) - Math.log(Math.max(r, armStart) / armStart) / Math.tan(pitch))) + 1) * 0.5;
          armLight = Math.pow(phase, 1.6) * Math.exp(-radius * 1.6) * 0.26 * Math.min(1, r / armStart);
        }
        const barLight = object.bar ? Math.exp(-((nx * halfSpan) ** 2) / (2 * (object.size * 0.19) ** 2) - ((ny * halfSpan) ** 2) / (2 * (object.size * 0.05) ** 2)) * 0.3 : 0;
        const mix = Math.min(1, radius * 1.1);
        const offset = (y * canvas.width + x) * 4;
        for (let channel = 0; channel < 3; channel++) image.data[offset + channel] = inner[channel] * (1 - mix) + outer[channel] * mix;
        image.data[offset + 3] = Math.min(1, (diskLight + armLight + barLight) * edgeFade) * 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  getApparentRadius(mesh) {
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
    const distance = Math.max(this.camera.position.distanceTo(mesh.parent.position), 0.001);
    const projectionScale = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)));
    return mesh.geometry.boundingSphere.radius * projectionScale / distance;
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  setCruise(enabled) {
    this.cruise = enabled;
  }

  travelTo(id, instant = false) {
    const object = byId[id];
    const group = this.objectGroups.get(id);
    if (!object || !group) return;
    const level = object.type === 'galaxies' ? 'galaxy' : 'stellar';
    if (level !== this.level) level === 'galaxy' ? this.exitToGalaxies() : this.enterStellar();
    const target = group.position.clone();
    const direction = this.camera.position.clone().sub(target);
    if (direction.lengthSq() < 0.01) direction.set(0.75, 0.3, 1);
    direction.normalize();
    direction.y = Math.max(direction.y, 0.2);
    direction.normalize();
    const distance = object.size * (object.type === 'galaxies' ? 2.65 : object.type === 'stars' ? 4.1 : 4.6);
    const destination = target.clone().add(direction.multiplyScalar(distance));
    this.startTravel(id, target, destination, instant);
  }

  setLevel(level) {
    this.level = level;
    this.travel = null;
    this.controls.enabled = true;
    this.stellarRoot.visible = level === 'stellar';
    this.galaxyRoot.visible = level === 'galaxy';
    this.callbacks.onLevelChange?.(level);
  }

  enterStellar() {
    this.setLevel('stellar');
    this.selectedId = null;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 1800;
    this.controls.target.copy(this.stellarCenter);
    this.camera.position.copy(this.stellarCenter).add(new THREE.Vector3(0, 0, 40));
    this.controls.update();
  }

  exitToGalaxies(auto = false) {
    this.setLevel('galaxy');
    this.selectedId = 'milkyway';
    const galaxy = byId.milkyway;
    const position = this.objectGroups.get('milkyway').position;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 700;
    this.controls.target.copy(position);
    this.camera.position.copy(position).addScaledVector(new THREE.Vector3(0, 0.3, 1).normalize(), galaxy.size * 2.65);
    this.controls.update();
    if (auto) this.callbacks.onFocusChange?.('milkyway');
  }

  showOverview() {
    if (this.level !== 'stellar') this.enterStellar();
    this.startTravel('overview', new THREE.Vector3(0, 0, 0), new THREE.Vector3(650, 720, 1050));
  }

  travelToSolarView() {
    if (this.level !== 'stellar') this.enterStellar();
    this.startTravel('sun', new THREE.Vector3(0, 0, 0), new THREE.Vector3(163, 280, 236));
  }

  startTravel(id, target, destination, instant = false) {
    this.selectedId = id === 'overview' ? null : id;
    const object = byId[this.selectedId];
    this.controls.minDistance = object?.type === 'galaxies' ? 0.5 : object ? object.size * 1.35 : 2;
    this.controls.maxDistance = object?.type === 'galaxies' ? 700 : 1800;
    const legDistance = instant ? 0 : this.camera.position.distanceTo(destination);
    const baseDuration = 2.8 + Math.max(0, Math.log10(legDistance / 400)) * 3;
    const duration = instant ? 0 : THREE.MathUtils.clamp(baseDuration / Math.sqrt(this.speed), 0.32, 8);
    this.travel = {
      id, target, destination, duration, elapsed: 0,
      fromTarget: this.controls.target.clone(),
      fromPosition: this.camera.position.clone()
    };
    this.controls.enabled = false;
    this.callbacks.onTravelStart?.(id, duration);
    if (instant) this.updateTravel(duration);
  }

  updateTravel(delta) {
    const travel = this.travel;
    if (!travel) return;
    const group = this.objectGroups.get(travel.id);
    if (group) {
      const shift = group.position.clone().sub(travel.target);
      travel.target.copy(group.position);
      travel.destination.add(shift);
    }
    travel.elapsed += delta;
    const raw = travel.duration === 0 ? 1 : Math.min(1, travel.elapsed / travel.duration);
    const t = raw < 0.5 ? 4 * raw ** 3 : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    this.camera.position.lerpVectors(travel.fromPosition, travel.destination, t);
    this.controls.target.lerpVectors(travel.fromTarget, travel.target, t);
    this.camera.lookAt(this.controls.target);
    if (raw >= 1) {
      this.travel = null;
      this.controls.enabled = true;
      this.callbacks.onTravelEnd?.(travel.id);
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    });
    window.addEventListener('keydown', (event) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      this.keys.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    });
    this.renderer.domElement.addEventListener('pointerup', (event) => {
      if (!this.pointerDown || Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 5) return;
      this.pointer.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.interactive, false).find(({ object }) => {
        for (let node = object; node; node = node.parent) if (!node.visible) return false;
        return true;
      });
      const id = hit?.object.userData.objectId;
      if (id) this.callbacks.onObjectClick?.(id);
    });
  }

  moveCamera(delta) {
    const forwardAmount = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) + (this.cruise ? 0.16 : 0);
    const sideAmount = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const verticalAmount = Number(this.keys.has('KeyE')) - Number(this.keys.has('KeyQ'));
    if (!forwardAmount && !sideAmount && !verticalAmount) return;
    const object = byId[this.selectedId];
    const levelScale = object?.type === 'stars' || !object ? 12 : 1;
    const nearestGalaxy = this.level === 'galaxy' ? Math.min(...objects.filter((item) => item.type === 'galaxies').map((item) => this.camera.position.distanceTo(this.objectGroups.get(item.id).position))) : 0;
    const baseSpeed = this.level === 'galaxy' ? Math.max(1.5, nearestGalaxy * 0.35) : Math.max(1.8, object?.size || 2) * levelScale;
    const velocity = baseSpeed * this.speed * delta * (this.keys.has('ShiftLeft') ? 3 : 1);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const movement = forward.multiplyScalar(forwardAmount).add(right.multiplyScalar(sideAmount)).add(new THREE.Vector3(0, verticalAmount, 0)).multiplyScalar(velocity);
    this.camera.position.add(movement);
    this.controls.target.add(movement);
  }

  updateSolarSystem(delta) {
    const simulationDelta = delta * Math.min(this.speed, 20);
    this.orbitalDeltas.clear();
    this.solarOrbiters.forEach((orbit) => {
      const previous = orbit.group.position.clone();
      const orbitalPeriod = 120 * orbit.object.periodDays / 365.25;
      orbit.angle += simulationDelta * Math.PI * 2 / orbitalPeriod;
      orbit.group.position.set(
        Math.cos(orbit.angle) * orbit.radius,
        Math.sin(orbit.angle) * orbit.radius * Math.sin(orbit.inclination),
        Math.sin(orbit.angle) * orbit.radius
      );
      this.orbitalDeltas.set(orbit.object.id, orbit.group.position.clone().sub(previous));
    });
    if (this.moonOrbit) {
      const moon = this.moonOrbit;
      const earthPosition = this.objectGroups.get('earth').position;
      const previous = moon.group.position.clone();
      const orbitalPeriod = 120 * moon.object.periodDays / 365.25;
      moon.angle += simulationDelta * Math.PI * 2 / orbitalPeriod;
      moon.group.position.set(
        earthPosition.x + Math.cos(moon.angle) * moon.object.orbitRadius,
        earthPosition.y + Math.sin(moon.angle) * 0.55,
        earthPosition.z + Math.sin(moon.angle) * moon.object.orbitRadius
      );
      if (this.getApparentRadius(moon.mesh) >= 2) moon.mesh.lookAt(earthPosition);
      this.orbitalDeltas.set('moon', moon.group.position.clone().sub(previous));
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);
    this.updateSolarSystem(delta);
    const orbitalDelta = this.orbitalDeltas.get(this.selectedId);
    if (orbitalDelta && !this.travel) {
      this.camera.position.add(orbitalDelta);
      this.controls.target.add(orbitalDelta);
    }
    if (this.travel) this.updateTravel(rawDelta);
    else this.moveCamera(delta);
    this.starMaterials.forEach((material) => { material.uniforms.uTime.value += delta; });
    this.spinners.forEach(({ object, speed }) => { object.rotation.y += speed * delta * Math.min(this.speed, 20); });
    this.rotating.forEach(({ mesh, speed }) => {
      if (this.getApparentRadius(mesh) < 2) return;
      mesh.rotateY(speed * delta * Math.min(this.speed, 20));
    });
    if (this.level === 'galaxy') {
      this.scene.background = this.spaceBackground;
      this.scene.backgroundIntensity = 1;
      objects.forEach((object) => {
        if (object.type !== 'galaxies') return;
        const group = this.objectGroups.get(object.id);
        const distance = this.camera.position.distanceTo(group.position);
        const near = this.travel?.id === object.id || distance < 1050;
        group.userData.detail.forEach((part) => { part.visible = near; });
        const coreWidth = Math.max(group.userData.coreBase, distance * 0.016);
        group.userData.core.scale.set(coreWidth, coreWidth * group.userData.coreAspect, 1);
      });
      const milkyWay = this.objectGroups.get('milkyway');
      if (!this.travel && this.camera.position.distanceTo(milkyWay.position) < byId.milkyway.size * 0.9) {
        this.enterStellar();
      }
    } else {
      this.scene.background = this.milkyWaySky || this.spaceBackground;
      this.scene.backgroundIntensity = 1.6;
      if (!this.travel && this.camera.position.distanceTo(this.stellarCenter) > 9000) this.exitToGalaxies(true);
    }
    let nearest = Infinity;
    this.objectGroups.forEach((group, id) => {
      const object = byId[id];
      const base = object.size * (object.type === 'galaxies' ? 2.65 : object.type === 'stars' ? 4.1 : 4.6);
      nearest = Math.min(nearest, this.camera.position.distanceTo(group.position) / base);
    });
    this.callbacks.onProximity?.(0.3 + 1.2 * Math.exp(-0.54 * nearest));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
