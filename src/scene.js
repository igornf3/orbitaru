import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { byId, objects, SOLAR_DISTANCE_SCALE, STAR_DISTANCE_SCALE, GALAXY_DISTANCE_SCALE } from './data.js';

const GALAXY_PITCH = { milkyway: 0.24, andromeda: 0.25, whirlpool: 0.34, triangulum: 0.44, pinwheel: 0.4, ngc1300: 0.36, 'black-eye': 0.22 };
const GALAXY_TILT = { andromeda: [1.2, -0.62], sombrero: [1.47, 0.12], cigar: [1.4, -0.42], 'centaurus-a': [0.12, -0.45], 'black-eye': [0.9, -0.5], m87: [0.3, 0] };

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
    const texture = object.procedural
      ? this.createProceduralPlanetTexture(object)
      : object.type === 'stars' && object.id !== 'sun'
        ? this.createStarSurface()
        : this.textureLoader.load(`/textures/${object.texture || '2k_sun'}.jpg`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const material = object.type === 'stars'
      ? new THREE.MeshBasicMaterial({ map: texture, color: object.color })
      : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, metalness: 0, emissive: object.type === 'exoplanets' ? object.color : 0x000000, emissiveIntensity: object.type === 'exoplanets' ? 0.3 : 0 });
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
    if (object.id === 'saturn') this.createSaturnRings(group, object.size);
  }

  createStarSurface() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.filter = 'blur(4px)';
    for (let i = 0; i < 700; i++) {
      const shade = 150 + Math.floor(Math.random() * 105);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.22)`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 9, 0, Math.PI * 2);
      ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
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
