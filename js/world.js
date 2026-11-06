import * as THREE from '../vendor/three.module.min.js';
import { SIBLINGS, DAD_SUCCESS } from './data.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeCanvasTexture(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...extra });
}

function addBox(parent, w, h, d, x, y, z, material, extra = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  Object.assign(mesh, extra);
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, rt, rb, h, x, y, z, material, seg = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, r, x, y, z, material, seg = 12) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140b1e);
  scene.fog = new THREE.Fog(0x1b0f28, 13, 27);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
  const camTarget = new THREE.Vector3(0, 1.05, -1.3);
  let camTween = null;
  let mode = 'all';
  let activeId = null;
  let shake = 0;
  let time = 0;
  let layoutMode = '';
  let trophy = null;
  let trophyHost = null;
  let effectBurstTimer = 0;

  const effects = [];
  const characters = {};
  const homes = {};
  const PORTRAIT_SLOTS = [
    { x: -1.42, z: -1.72 },
    { x: -0.48, z: -0.96 },
    { x: 0.48, z: -0.96 },
    { x: 1.42, z: -1.72 }
  ];
  const LANDSCAPE_SLOTS = [
    { x: -2.2, z: -1.5 },
    { x: -0.74, z: -1.14 },
    { x: 0.74, z: -1.14 },
    { x: 2.2, z: -1.5 }
  ];

  // ---------------------------------------------------------------- textures
  const wallpaperTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#d7b98f';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = x % 64 === 0 ? '#cba978' : '#d2b286';
        ctx.fillRect(x + 6, 0, 13, h);
        ctx.fillStyle = '#b58e63';
        ctx.fillRect(x + 6, 0, 2, h);
        ctx.fillRect(x + 17, 0, 1, h);
      }
      ctx.globalAlpha = 0.5;
      for (let y = 18; y < h; y += 42) {
        for (let x = 20; x < w; x += 64) {
          ctx.fillStyle = '#a97a66';
          ctx.beginPath();
          ctx.moveTo(x, y - 5);
          ctx.lineTo(x + 5, y);
          ctx.lineTo(x, y + 5);
          ctx.lineTo(x - 5, y);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
    [4, 2]
  );

  const carpetTex = makeCanvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#1e6c63';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2b8d80';
      ctx.lineWidth = 2;
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.25, y + 14, w * 0.5, y - 14, w, y);
        ctx.stroke();
      }
      for (let y = 16; y < h; y += 64) {
        for (let x = 16; x < w; x += 64) {
          ctx.fillStyle = 'rgba(255,210,63,.18)';
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,47,135,.14)';
          ctx.fillRect(x + 22, y - 4, 20, 3);
        }
      }
    },
    [5, 5]
  );

  const rugTex = makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#51254e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 11;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    ctx.strokeStyle = '#ff2f87';
    ctx.lineWidth = 5;
    ctx.strokeRect(30, 30, w - 60, h - 60);
    const cols = ['#14b8a6', '#ffd23f', '#ff2f87', '#8b5cf6'];
    for (let i = 4; i > 0; i--) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, i * 48, 0, TAU);
      ctx.strokeStyle = cols[i % cols.length];
      ctx.lineWidth = 9;
      ctx.stroke();
    }
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * TAU;
      ctx.save();
      ctx.translate(w / 2 + Math.cos(ang) * 205, h / 2 + Math.sin(ang) * 205);
      ctx.rotate(ang);
      ctx.fillStyle = a % 2 ? '#14b8a6' : '#ffd23f';
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
  });

  const staticTex = makeCanvasTexture(128, 96, (ctx, w, h) => {
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const v = 35 + Math.random() * 180;
        ctx.fillStyle = `rgb(${v * 0.7},${v * 0.85},${v})`;
        ctx.fillRect(x, y, 3, 3);
      }
    }
  });

  const familyTex = makeCanvasTexture(320, 240, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#78c8c2');
    grad.addColorStop(1, '#bd7b46');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2c58d';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    const people = [
      [58, 0.55, '#3d5d9c'],
      [118, 0.72, '#b64f63'],
      [176, 0.58, '#5c8a4f'],
      [238, 0.64, '#8f5fa5']
    ];
    people.forEach(([x, s, col], i) => {
      ctx.fillStyle = col;
      ctx.fillRect(x - 22 * s, 130 - 35 * s, 44 * s, 90 * s);
      ctx.fillStyle = i === 0 ? '#d9b48a' : '#e6b891';
      ctx.beginPath();
      ctx.arc(x, 108 - 28 * s, 17 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = i === 2 ? '#3c2b1e' : '#5a3b26';
      ctx.beginPath();
      ctx.arc(x, 103 - 28 * s, 17 * s, Math.PI, TAU);
      ctx.fill();
    });
    ctx.fillStyle = '#fff4d6';
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THANKSGIVING ’94', w / 2, 28);
  });

  const neonTex = makeCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.font = '900 148px Impact, "Arial Black", sans-serif';
    ctx.shadowColor = '#ff2f87';
    ctx.shadowBlur = 40;
    ctx.strokeStyle = '#ffd1e8';
    ctx.lineWidth = 6;
    ctx.strokeText('DAD', w / 2, 150);
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#ff2f87';
    ctx.lineWidth = 3;
    ctx.strokeText('DAD', w / 2, 150);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff6fb';
    ctx.font = '700 28px "Trebuchet MS", sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('AUTHORITY', w / 2, 202);
  });

  const gameBoxTex = makeCanvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#241641';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(0, 0, w, 62);
    ctx.fillStyle = '#1b1230';
    ctx.font = '900 35px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TRUTH OR DARE', w / 2, 43);
    ctx.font = '900 54px Impact, "Arial Black", sans-serif';
    ctx.fillStyle = '#ff2f87';
    ctx.fillText('?', w / 2, 150);
    ctx.fillStyle = '#14b8a6';
    ctx.font = '700 21px "Trebuchet MS", sans-serif';
    ctx.fillText('FAMILY EDITION', w / 2, 195);
    ctx.fillStyle = '#fff6e5';
    ctx.font = '14px "Trebuchet MS", sans-serif';
    ctx.fillText('ADULTS 18+ · 1995', w / 2, 238);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 5;
    ctx.strokeRect(7, 7, w - 14, h - 14);
  });

  const tieDyeTex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    const cols = ['#ffd23f', '#ff2f87', '#14b8a6', '#6c2bd9', '#ff7a2a', '#ffe9a8'];
    ctx.fillStyle = '#6c2bd9';
    ctx.fillRect(0, 0, w, h);
    for (let i = 14; i > 0; i--) {
      ctx.strokeStyle = cols[i % cols.length];
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.sin(i) * 10, h / 2 + Math.cos(i) * 8, i * 9, 0, TAU);
      ctx.stroke();
    }
  });

  const starTex = makeCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.translate(w / 2, h / 2);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,235,150,.9)');
    grad.addColorStop(1, 'rgba(255,120,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const r = i % 2 ? 7 : 30;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });

  // ---------------------------------------------------------------- room
  const floor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.2, 12), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }));
  floor.position.set(0, -0.11, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallpaperTex, roughness: 0.95 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(13, 5.8, 0.24), wallMat);
  backWall.position.set(0, 2.8, -4.35);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const sideMat = new THREE.MeshStandardMaterial({ color: 0x3c2747, roughness: 0.95 });
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 5.8, 12), sideMat);
  leftWall.position.set(-6.4, 2.8, 0);
  scene.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.position.x = 6.4;
  scene.add(rightWall);

  const trimMat = std(0x4a2a2f, { roughness: 0.55 });
  addBox(scene, 13, 0.34, 0.2, 0, 0.16, -4.18, trimMat);
  addBox(scene, 13, 0.12, 0.16, 0, 3.8, -4.18, std(0x6b4a35));
  addBox(scene, 13, 0.09, 0.16, 0, 5.35, -4.18, std(0x6b4a35));

  // Rug
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.4, 48), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1.25, 0.72, 1);
  rug.position.set(0, 0.008, -1.15);
  rug.receiveShadow = true;
  scene.add(rug);

  // String lights
  const lightBulbMat = new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffb347, emissiveIntensity: 1.4, roughness: 0.4 });
  const bulbGeo = new THREE.SphereGeometry(0.055, 8, 6);
  const wirePts = [];
  for (let i = 0; i <= 24; i++) {
    const x = -5.4 + (i / 24) * 10.8;
    const y = 3.95 - Math.sin((i / 24) * Math.PI) * 0.38;
    wirePts.push(new THREE.Vector3(x, y, -4.15));
    if (i > 0 && i < 24 && i % 2 === 1) {
      const b = new THREE.Mesh(bulbGeo, lightBulbMat);
      b.position.set(x, y - 0.07, -4.08);
      scene.add(b);
    }
  }
  const wireGeo = new THREE.BufferGeometry().setFromPoints(wirePts);
  scene.add(new THREE.Line(wireGeo, new THREE.LineBasicMaterial({ color: 0x2c3a2c })));

  // ---------------------------------------------------------------- furniture
  function makeFrame(texture, w, h) {
    const g = new THREE.Group();
    addBox(g, w + 0.14, h + 0.14, 0.09, 0, 0, 0, std(0x5a3826, { metalness: 0.15 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }));
    photo.position.z = 0.052;
    g.add(photo);
    return g;
  }
  const familyFrame = makeFrame(familyTex, 1.25, 0.94);
  familyFrame.position.set(-1.28, 2.85, -4.19);
  familyFrame.rotation.y = 0.05;
  scene.add(familyFrame);

  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.0),
    new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  neon.position.set(0, 3.62, -4.15);
  scene.add(neon);
  const neonGlow = new THREE.PointLight(0xff3f98, 7, 5, 2);
  neonGlow.position.set(0, 3.4, -3.6);
  scene.add(neonGlow);

  function makeTV() {
    const g = new THREE.Group();
    const wood = std(0x5f3b2b);
    addBox(g, 1.7, 0.12, 0.7, 0, 0.68, 0, wood);
    addBox(g, 0.14, 0.62, 0.14, -0.68, 0.34, 0, wood);
    addBox(g, 0.14, 0.62, 0.14, 0.68, 0.34, 0, wood);
    addBox(g, 1.75, 0.12, 0.75, 0, 0.03, 0, std(0x40251c));
    addBox(g, 1.5, 1.12, 0.8, 0, 1.33, 0, std(0x3a3433, { roughness: 0.5 }));
    addBox(g, 1.2, 0.24, 0.05, 0, 0.92, 0.42, std(0x1e1a19));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.79),
      new THREE.MeshStandardMaterial({ map: staticTex, emissiveMap: staticTex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.35 })
    );
    screen.position.set(-0.07, 1.36, 0.412);
    g.add(screen);
    addCyl(g, 0.065, 0.065, 0.05, 0.58, 1.55, 0.43, std(0x111111)).rotation.x = Math.PI / 2;
    addCyl(g, 0.05, 0.05, 0.05, 0.58, 1.36, 0.43, std(0x111111)).rotation.x = Math.PI / 2;
    const antMat = std(0x9a9a9a, { metalness: 0.7, roughness: 0.3 });
    const a1 = addCyl(g, 0.012, 0.012, 0.9, -0.2, 2.05, -0.1, antMat, 6);
    a1.rotation.z = -0.35;
    const a2 = addCyl(g, 0.012, 0.012, 0.9, 0.2, 2.05, -0.1, antMat, 6);
    a2.rotation.z = 0.35;
    const glow = new THREE.PointLight(0x78b6ff, 8, 4.2, 2);
    glow.position.set(0, 1.4, 0.9);
    g.add(glow);
    addBox(g, 0.65, 0.1, 0.4, 0, 0.78, 0.25, std(0x2b2523));
    g.position.set(-3.25, 0, -3.76);
    g.rotation.y = 0.12;
    return { group: g, screen };
  }
  const tv = makeTV();
  scene.add(tv.group);

  function makeShelf() {
    const g = new THREE.Group();
    addBox(g, 1.55, 0.1, 0.34, 0, 0, 0, std(0x6b422c));
    addBox(g, 1.55, 0.1, 0.34, 0, 0.62, 0, std(0x6b422c));
    addBox(g, 0.08, 0.7, 0.3, -0.7, 0.31, 0, std(0x4c2d1e));
    addBox(g, 0.08, 0.7, 0.3, 0.7, 0.31, 0, std(0x4c2d1e));
    const trophyMats = [std(0xffcf4a, { metalness: 0.75, roughness: 0.22, emissive: 0x3a2400, emissiveIntensity: 0.35 }), std(0xc9d3dd, { metalness: 0.75, roughness: 0.22 })];
    function tinyTrophy(x, y, z, m) {
      addCyl(g, 0.11, 0.14, 0.08, x, y + 0.04, z, std(0x2a1b16));
      addCyl(g, 0.025, 0.025, 0.16, x, y + 0.16, z, m, 8);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.045, 0.15, 10), m);
      cup.position.set(x, y + 0.3, z);
      g.add(cup);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 10, Math.PI), m);
      handle.position.set(x, y + 0.3, z);
      handle.rotation.z = Math.PI / 2;
      g.add(handle);
    }
    tinyTrophy(-0.45, 0.05, 0.02, trophyMats[0]);
    tinyTrophy(0.05, 0.05, 0.02, trophyMats[1]);
    tinyTrophy(-0.2, 0.67, 0.0, trophyMats[0]);
    addBox(g, 0.36, 0.22, 0.03, 0.42, 0.73, 0.03, std(0x9b3f56));
    g.position.set(1.85, 2.35, -4.15);
    return g;
  }
  scene.add(makeShelf());

  function makeLavaLamp() {
    const g = new THREE.Group();
    const table = new THREE.Group();
    addCyl(table, 0.38, 0.42, 0.07, 0, 0.62, 0, std(0x4a2a2f));
    addCyl(table, 0.07, 0.09, 0.58, 0, 0.3, 0, std(0x3a2025), 10);
    addCyl(table, 0.28, 0.34, 0.05, 0, 0.02, 0, std(0x3a2025));
    g.add(table);
    addCyl(g, 0.18, 0.24, 0.1, 0, 0.7, 0, std(0x2b2523, { metalness: 0.4 }));
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 0.5, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.38, roughness: 0.15, metalness: 0.1, emissive: 0xff3d00, emissiveIntensity: 0.5, side: THREE.DoubleSide })
    );
    glass.position.y = 1.0;
    g.add(glass);
    addCyl(g, 0.2, 0.14, 0.08, 0, 1.29, 0, std(0x2b2523, { metalness: 0.5 }));
    const blobMat = new THREE.MeshStandardMaterial({ color: 0xff7b35, emissive: 0xff3c00, emissiveIntensity: 1.1, roughness: 0.4 });
    const blobs = [];
    for (let i = 0; i < 4; i++) {
      const b = addSphere(g, 0.07 + i * 0.012, 0, 0.86 + i * 0.1, 0, blobMat, 8);
      blobs.push({ mesh: b, phase: i * 1.7, baseY: 0.86 + i * 0.1 });
    }
    const glow = new THREE.PointLight(0xff7a2a, 9, 4.5, 2);
    glow.position.set(0, 1.0, 0.2);
    g.add(glow);
    g.position.set(3.15, 0, -3.18);
    g.userData.blobs = blobs;
    return g;
  }
  const lava = makeLavaLamp();
  scene.add(lava);

  function makePlant() {
    const g = new THREE.Group();
    addCyl(g, 0.3, 0.22, 0.34, 0, 0.17, 0, std(0xb0553f), 12);
    addCyl(g, 0.24, 0.24, 0.04, 0, 0.34, 0, std(0x4e3020), 12);
    addCyl(g, 0.035, 0.05, 0.8, 0, 0.72, 0, std(0x446633), 8);
    const leafMat = std(0x3f7a3a, { roughness: 0.9 });
    const leafMat2 = std(0x5e9b45, { roughness: 0.9 });
    const leaves = [
      [0.25, 1.02, 0.02, 0.55, -0.5],
      [-0.25, 1.0, 0.02, 0.55, 0.5],
      [0.16, 1.22, -0.1, 0.45, -0.9],
      [-0.18, 1.24, 0.08, 0.45, 0.8],
      [0.02, 1.38, 0.02, 0.4, 0]
    ];
    leaves.forEach(([x, y, z, s, r], i) => {
      const leaf = addSphere(g, 0.3, x, y, z, i % 2 ? leafMat : leafMat2, 8);
      leaf.scale.set(s, s * 0.35, s * 0.85);
      leaf.rotation.z = r;
      leaf.rotation.y = i * 1.3;
    });
    g.position.set(-4.75, 0, -3.52);
    g.rotation.y = 0.3;
    return g;
  }
  scene.add(makePlant());

  function makeCouch() {
    const g = new THREE.Group();
    const fabric = std(0x2f8f88);
    const dark = std(0x226b67);
    addBox(g, 2.5, 0.28, 0.95, 0, 0.45, 0, dark);
    addBox(g, 2.35, 0.2, 0.82, 0, 0.6, 0.02, fabric);
    addBox(g, 2.45, 0.9, 0.24, 0, 1.04, -0.4, fabric);
    addBox(g, 0.22, 0.58, 1.02, -1.24, 0.7, 0, dark);
    addBox(g, 0.22, 0.58, 1.02, 1.24, 0.7, 0, dark);
    addBox(g, 0.12, 0.26, 0.12, -1.08, 0.16, 0.34, std(0x3e2a1e));
    addBox(g, 0.12, 0.26, 0.12, 1.08, 0.16, 0.34, std(0x3e2a1e));
    const cushion = addBox(g, 0.55, 0.42, 0.14, -0.68, 0.9, -0.2, std(0xffd23f));
    cushion.rotation.z = -0.15;
    g.position.set(-4.9, 0, -2.45);
    g.rotation.y = Math.PI / 2;
    return g;
  }
  scene.add(makeCouch());

  // Coffee table with game props
  const tableGroup = new THREE.Group();
  addBox(tableGroup, 2.25, 0.1, 1.02, 0, 0.58, 0, std(0x6c4128));
  addBox(tableGroup, 2.05, 0.06, 0.84, 0, 0.52, 0, std(0x8a5934));
  [
    [-0.95, 0.28, -0.35],
    [0.95, 0.28, -0.35],
    [-0.95, 0.28, 0.35],
    [0.95, 0.28, 0.35]
  ].forEach(([x, y, z]) => addBox(tableGroup, 0.1, 0.5, 0.1, x, y, z, std(0x4c2d1e)));
  const gameBox = new THREE.Group();
  addBox(gameBox, 0.58, 0.22, 0.78, 0, 0, 0, std(0x211637));
  const boxTop = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.76), new THREE.MeshStandardMaterial({ map: gameBoxTex, roughness: 0.7 }));
  boxTop.rotation.x = -Math.PI / 2;
  boxTop.position.y = 0.112;
  gameBox.add(boxTop);
  gameBox.position.set(-0.62, 0.75, 0.02);
  gameBox.rotation.y = 0.15;
  tableGroup.add(gameBox);
  const pizza = new THREE.Group();
  addBox(pizza, 0.62, 0.06, 0.62, 0, 0, 0, std(0xd9c6a5));
  addBox(pizza, 0.62, 0.055, 0.62, 0, 0.052, 0, std(0xb33b34));
  pizza.position.set(0.55, 0.69, 0.03);
  pizza.rotation.y = -0.18;
  tableGroup.add(pizza);
  const remote = addBox(tableGroup, 0.18, 0.05, 0.42, 0.05, 0.65, 0.34, std(0x211a1a));
  remote.rotation.y = 0.5;
  const vhs1 = addBox(tableGroup, 0.42, 0.08, 0.24, 0.95, 0.66, -0.3, std(0x1f1f27));
  vhs1.rotation.y = -0.2;
  addBox(tableGroup, 0.4, 0.02, 0.16, 0.95, 0.705, -0.3, std(0xffd23f)).rotation.y = -0.2;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8, 0, TAU, 0, Math.PI / 2), std(0xffe6a8, { side: THREE.DoubleSide }));
  bowl.position.set(-1.0, 0.72, 0.28);
  bowl.rotation.x = Math.PI;
  tableGroup.add(bowl);
  tableGroup.position.set(0, 0, 1.62);
  scene.add(tableGroup);

  // Dad's armchair
  const chair = new THREE.Group();
  const chairFabric = std(0x74343f, { roughness: 0.92 });
  const chairDark = std(0x54232d, { roughness: 0.92 });
  addBox(chair, 1.7, 0.16, 1.7, 0, 0.1, 0, std(0x3c2418));
  addBox(chair, 1.32, 0.28, 1.12, 0, 0.48, 0.04, chairDark);
  addBox(chair, 1.2, 0.19, 0.95, 0, 0.62, 0.06, chairFabric);
  addBox(chair, 1.3, 1.45, 0.28, 0, 1.25, -0.45, chairFabric);
  const roll = addCyl(chair, 0.15, 0.15, 1.28, 0, 1.98, -0.45, chairDark, 12);
  roll.rotation.z = Math.PI / 2;
  [-1, 1].forEach((s) => {
    addBox(chair, 0.24, 0.5, 1.12, s * 0.7, 0.83, 0.04, chairDark);
    const armRoll = addCyl(chair, 0.12, 0.12, 1.12, s * 0.7, 1.08, 0.04, chairFabric, 10);
    armRoll.rotation.x = Math.PI / 2;
  });
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 2; x++) {
      addSphere(chair, 0.035, x ? 0.25 : -0.25, 1.25 + y * 0.35, -0.3, chairDark, 8);
    }
  }
  chair.position.set(0, 0, -3.42);
  scene.add(chair);

  // ---------------------------------------------------------------- dad
  function makeDad() {
    const g = new THREE.Group();
    const skin = std(0xd9a077);
    const skinDark = std(0xc98c63);
    const cardigan = std(0x7a5b43, { roughness: 0.92 });
    const shirt = std(0xd8cba6);
    const pants = std(0x4e4b48);
    const slipperMat = std(0xc96f7a, { roughness: 0.65 });
    const slipperSole = std(0x5d3b33);

    addBox(g, 0.78, 0.6, 0.5, 0, 1.2, 0.02, cardigan);
    const belly = addSphere(g, 0.36, 0, 1.12, 0.09, cardigan, 16);
    belly.scale.set(1.08, 0.92, 0.92);
    addBox(g, 0.2, 0.55, 0.22, -0.18, 0.7, 0.35, pants);
    addBox(g, 0.2, 0.55, 0.22, 0.18, 0.7, 0.35, pants);
    addBox(g, 0.19, 0.5, 0.2, -0.18, 0.34, 0.66, pants);
    addBox(g, 0.19, 0.5, 0.2, 0.18, 0.34, 0.66, pants);
    [-1, 1].forEach((s) => {
      addBox(g, 0.24, 0.11, 0.42, s * 0.18, 0.11, 0.76, slipperMat);
      addBox(g, 0.26, 0.045, 0.44, s * 0.18, 0.045, 0.77, slipperSole);
    });

    // head
    const head = new THREE.Group();
    head.position.y = 1.86;
    g.add(head);
    const skull = addSphere(head, 0.3, 0, 0, 0, skin, 18);
    skull.scale.set(1, 1.04, 0.94);
    addSphere(head, 0.265, 0, 0.06, -0.035, skinDark, 16).scale.set(1, 0.98, 0.9);
    // side hair / bald top
    [-1, 1].forEach((s) => {
      const tuft = addSphere(head, 0.15, s * 0.24, 0.02, -0.01, std(0x9b938b), 10);
      tuft.scale.set(0.55, 0.9, 0.9);
    });
    addSphere(head, 0.16, 0, -0.04, -0.2, std(0x9b938b), 10).scale.set(1.3, 0.55, 0.5);
    // brows / eyes / nose
    [-1, 1].forEach((s) => {
      addBox(head, 0.12, 0.026, 0.03, s * 0.105, 0.12, 0.255, std(0x6c625a)).rotation.z = s * 0.15;
      const eye = addSphere(head, 0.055, s * 0.105, 0.04, 0.24, std(0xfbf4e8), 10);
      eye.scale.set(1, 0.9, 0.5);
      addSphere(head, 0.024, s * 0.105, 0.04, 0.276, new THREE.MeshBasicMaterial({ color: 0x201610 }), 8);
    });
    addSphere(head, 0.055, 0, -0.015, 0.285, skinDark, 8);
    // mustache
    [-1, 1].forEach((s) => {
      const m = addBox(head, 0.14, 0.045, 0.035, s * 0.06, -0.085, 0.27, std(0x72665d));
      m.rotation.z = s * -0.22;
    });
    // mouth
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x4b2a25 }));
    mouth.position.set(0, -0.14, 0.262);
    mouth.rotation.z = Math.PI;
    head.add(mouth);
    // glasses
    [-1, 1].forEach((s) => {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.01, 5, 14), std(0x2f2a28));
      rim.position.set(s * 0.105, 0.04, 0.284);
      head.add(rim);
    });
    addBox(head, 0.09, 0.012, 0.012, 0, 0.045, 0.29, std(0x2f2a28));
    [-1, 1].forEach((s) => {
      addBox(head, 0.13, 0.014, 0.012, s * 0.16, 0.055, 0.265, std(0x2f2a28)).rotation.z = s * 0.12;
    });

    // arms
    const armL = new THREE.Group();
    armL.position.set(-0.46, 1.45, 0);
    g.add(armL);
    const armLmesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), cardigan);
    armLmesh.position.y = -0.2;
    armL.add(armLmesh);
    addSphere(armL, 0.09, 0, -0.42, 0, skin, 10);
    armL.rotation.z = 0.22;
    armL.rotation.x = -0.4;

    const armR = new THREE.Group();
    armR.position.set(0.46, 1.45, 0);
    g.add(armR);
    const armRmesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), cardigan);
    armRmesh.position.y = -0.2;
    armR.add(armRmesh);
    addSphere(armR, 0.09, 0, -0.42, 0, skin, 10);
    armR.rotation.z = -0.22;
    armR.rotation.x = -0.65;
    const slipper = new THREE.Group();
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.46), slipperSole);
    sole.position.set(0, -0.5, 0.19);
    slipper.add(sole);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.36), slipperMat);
    top.position.set(0, -0.455, 0.15);
    slipper.add(top);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 6, 12, Math.PI), slipperMat);
    strap.position.set(0, -0.42, 0.2);
    strap.rotation.x = Math.PI / 2;
    slipper.add(strap);
    armR.add(slipper);

    g.position.set(0, 0, -3.38);
    g.scale.setScalar(1.04);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.userData = { armR, armL, head, phase: 1.7 };
    return g;
  }
  const dad = makeDad();
  scene.add(dad);

  // ---------------------------------------------------------------- characters
  function makeCharacter(def) {
    const g = new THREE.Group();
    const skinMat = std(def.skin);
    const skinDark = std(new THREE.Color(def.skin).multiplyScalar(0.88).getHex());
    const hairMat = std(def.hair, { roughness: 0.88 });
    const shirtMat = std(def.shirt, { roughness: 0.88 });
    const pantsMat = std(def.pants, { roughness: 0.9 });
    const shoeMat = std(def.shoe, { roughness: 0.7 });

    // legs
    [-1, 1].forEach((s) => {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.36, 4, 8), pantsMat);
      leg.position.set(s * 0.15, 0.45, 0);
      g.add(leg);
      addBox(g, 0.18, 0.12, 0.3, s * 0.15, 0.075, 0.055, shoeMat);
    });

    // torso
    let torsoMat = shirtMat;
    if (def.id === 'tad') {
      torsoMat = new THREE.MeshStandardMaterial({ map: tieDyeTex, roughness: 0.85 });
    }
    if (def.id === 'brad') {
      torsoMat = std(0xf1ead8);
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.38, 5, 14), torsoMat);
    torso.position.y = 1.03;
    torso.scale.z = 0.72;
    g.add(torso);
    addBox(g, 0.53, 0.08, 0.31, 0, 0.58, 0.0, std(0x4b3628));
    addBox(g, 0.11, 0.09, 0.035, 0, 0.58, 0.18, std(0xe8c56b, { metalness: 0.65, roughness: 0.3 }));

    // outfit details
    if (def.id === 'chad') {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), std(0xe8c56b));
      patch.position.set(-0.17, 1.15, 0.29);
      patch.rotation.x = -0.15;
      g.add(patch);
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 5, 10), std(0x2f5bd0));
      c.position.set(-0.17, 1.15, 0.302);
      c.rotation.x = -0.15;
      g.add(c);
    }
    if (def.id === 'brad') {
      const vestMat = std(def.shirt);
      [-1, 1].forEach((s) => {
        const panel = addBox(g, 0.21, 0.64, 0.04, s * 0.16, 1.02, 0.195, vestMat);
        panel.rotation.z = s * 0.015;
      });
      addBox(g, 0.06, 0.31, 0.03, 0, 1.2, 0.205, std(0xe6dcc6));
      addBox(g, 0.05, 0.05, 0.02, -0.11, 1.1, 0.23, std(0xffd23f, { metalness: 0.35, roughness: 0.4 }));
      addBox(g, 0.05, 0.05, 0.02, 0.11, 1.1, 0.23, std(0xffd23f, { metalness: 0.35, roughness: 0.4 }));
      addBox(g, 0.34, 0.05, 0.23, 0, 1.36, 0.1, std(0xf1ead8));
    }
    if (def.id === 'stacy') {
      [-1, 1].forEach((s) => {
        const lapel = addBox(g, 0.1, 0.34, 0.03, s * 0.13, 1.24, 0.27, std(0x45688f));
        lapel.rotation.z = s * 0.3;
      });
      addBox(g, 0.2, 0.38, 0.02, 0, 1.03, 0.285, std(0xf1e7d8));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 5, 10), std(0xffd23f, { metalness: 0.6, roughness: 0.3 }));
      ring.position.set(0.27, 1.59, 0.02);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
    }
    if (def.id === 'tad') {
      addBox(g, 0.2, 0.16, 0.02, 0, 1.15, 0.29, std(0xffd23f));
    }

    // arms
    const armMat = def.id === 'chad' ? std(0xf1e7d8) : def.id === 'brad' ? std(0xf1ead8) : shirtMat;
    const arms = {};
    [-1, 1].forEach((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.36, 1.28, 0);
      const shoulder = addSphere(pivot, 0.074, 0, 0.015, 0, armMat, 10);
      shoulder.scale.set(1.02, 0.9, 0.95);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.3, 4, 8), armMat);
      arm.position.y = -0.2;
      pivot.add(arm);
      addSphere(pivot, 0.082, 0, -0.42, 0, skinMat, 10);
      pivot.rotation.z = s * 0.13;
      g.add(pivot);
      arms[s] = pivot;
    });

    // head
    const head = new THREE.Group();
    head.position.y = 1.69;
    g.add(head);
    const skull = addSphere(head, 0.275, 0, 0, 0, skinMat, 18);
    skull.scale.set(1, 1.06, 0.92);
    addCyl(g, 0.09, 0.1, 0.13, 0, 1.42, 0, skinMat, 10);
    // ears
    [-1, 1].forEach((s) => addSphere(head, 0.055, s * 0.256, 0.01, 0, skinDark, 8).scale.set(0.7, 1, 0.7));
    // face
    [-1, 1].forEach((s) => {
      const eye = addSphere(head, 0.056, s * 0.1, 0.035, 0.235, std(0xfbf8ef), 10);
      eye.scale.set(1, 1.1, 0.5);
      addSphere(head, 0.025, s * 0.1, 0.035, 0.267, new THREE.MeshBasicMaterial({ color: 0x221a1b }), 8);
      addBox(head, 0.105, 0.018, 0.02, s * 0.1, 0.125, 0.25, hairMat).rotation.z = s * -0.12;
    });
    addSphere(head, 0.045, 0, -0.005, 0.265, skinDark, 8);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 5, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x4b2828 }));
    smile.position.set(0, -0.1, 0.255);
    smile.rotation.z = Math.PI;
    head.add(smile);

    // hair
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.282, 16, 10, 0, TAU, 0, Math.PI * 0.58), hairMat);
    hairCap.position.y = 0.018;
    head.add(hairCap);
    if (def.hairStyle === 'short') {
      const fringe = addBox(head, 0.22, 0.07, 0.09, -0.05, 0.215, 0.18, hairMat);
      fringe.rotation.z = -0.15;
    } else if (def.hairStyle === 'swoop') {
      const swoop = addSphere(head, 0.16, -0.04, 0.19, 0.13, hairMat, 10);
      swoop.scale.set(1.35, 0.45, 0.75);
      swoop.rotation.z = -0.32;
    } else if (def.hairStyle === 'ponytail') {
      const back = addSphere(head, 0.19, 0, 0.02, -0.15, hairMat, 10);
      back.scale.set(0.95, 1.05, 0.7);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), hairMat);
      tail.position.set(0, -0.17, -0.27);
      tail.rotation.x = 0.35;
      head.add(tail);
      const scrunch = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 6, 12), std(def.color));
      scrunch.position.set(0, -0.04, -0.25);
      scrunch.rotation.x = Math.PI / 2;
      head.add(scrunch);
    } else if (def.hairStyle === 'cap') {
      const crown = addCyl(head, 0.275, 0.29, 0.2, 0, 0.19, 0, std(def.color), 16);
      crown.scale.z = 0.95;
      const brim = addBox(head, 0.34, 0.045, 0.26, 0, 0.1, -0.2, std(def.color));
      brim.rotation.x = -0.12;
      addSphere(head, 0.03, 0, 0.3, 0, std(0xffd23f), 8);
      addBox(head, 0.22, 0.05, 0.02, 0, 0.11, 0.268, std(0xf1e7d8));
    }

    // dolls get glasses? Brad
    if (def.id === 'brad') {
      [-1, 1].forEach((s) => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.01, 5, 14), std(0x2b2522));
        rim.position.set(s * 0.1, 0.035, 0.272);
        head.add(rim);
      });
      addBox(head, 0.08, 0.011, 0.012, 0, 0.04, 0.28, std(0x2b2522));
    }

    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.userData = {
      id: def.id,
      def,
      arms,
      head,
      baseY: 0,
      phase: Math.random() * TAU,
      reaction: null,
      home: new THREE.Vector3()
    };
    return g;
  }

  SIBLINGS.forEach((def) => {
    const g = makeCharacter(def);
    scene.add(g);
    characters[def.id] = g;
  });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.46, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.visible = false;
  scene.add(ring);

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x38233f, 0.95));
  const key = new THREE.DirectionalLight(0xffe0b0, 2.5);
  key.position.set(3.5, 7.5, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.bias = -0.0015;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x7fb0ff, 0.65);
  fill.position.set(-5, 4, 3);
  scene.add(fill);
  const warm = new THREE.PointLight(0xffb067, 9, 12, 2);
  warm.position.set(0, 3.2, 3.4);
  scene.add(warm);

  const activeSpot = new THREE.SpotLight(0xffe2a6, 32, 9, 0.53, 0.65, 1.5);
  activeSpot.position.set(0, 3.4, 2.8);
  activeSpot.target.position.set(0, 1.1, -1.2);
  scene.add(activeSpot);
  scene.add(activeSpot.target);

  // ---------------------------------------------------------------- layout / camera
  function isPortrait() {
    return window.innerWidth / window.innerHeight < 0.82;
  }

  function layoutStage() {
    const portrait = isPortrait();
    const nextMode = portrait ? 'portrait' : 'landscape';
    const slots = portrait ? PORTRAIT_SLOTS : LANDSCAPE_SLOTS;
    SIBLINGS.forEach((def, i) => {
      const c = characters[def.id];
      const slot = slots[i];
      homes[def.id] = { x: slot.x, z: slot.z };
      c.userData.home.set(slot.x, 0, slot.z);
      c.position.x = slot.x;
      c.position.z = slot.z;
      c.scale.setScalar(portrait ? 0.96 : 1);
    });
    // dad sits a little closer in portrait so he stays in frame
    dad.position.z = -3.38;
    if (layoutMode !== nextMode) {
      layoutMode = nextMode;
      if (mode === 'all') snapBase();
      else if (mode === 'focus' && activeId) snapFocus(activeId);
    }
  }

  function baseView() {
    if (isPortrait()) {
      return {
        pos: new THREE.Vector3(0, 2.4, 5.9),
        target: new THREE.Vector3(0, 1.0, -1.2),
        fov: 59
      };
    }
    return {
      pos: new THREE.Vector3(0, 2.5, 5.55),
      target: new THREE.Vector3(0, 1.07, -1.35),
      fov: 46
    };
  }

  function focusView(id) {
    const c = characters[id];
    const p = homes[id];
    const portrait = isPortrait();
    return {
      pos: new THREE.Vector3(p.x + (p.x >= 0 ? 0.3 : -0.3), portrait ? 1.78 : 1.72, p.z + (portrait ? 3.9 : 4.4)),
      target: new THREE.Vector3(p.x, 1.08, p.z),
      fov: portrait ? 42 : 38
    };
  }

  function flyTo(view, dur = 900) {
    camTween = {
      pos0: camera.position.clone(),
      target0: camTarget.clone(),
      fov0: camera.fov,
      pos1: view.pos.clone(),
      target1: view.target.clone(),
      fov1: view.fov,
      t: 0,
      dur: Math.max(0.001, dur)
    };
    mode = view.mode || mode;
  }

  function snapCamera(view) {
    camera.position.copy(view.pos);
    camTarget.copy(view.target);
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    camTween = null;
  }

  function snapBase() {
    snapCamera(baseView());
  }

  function snapFocus(id) {
    snapCamera(focusView(id));
  }

  function setAll(dur = 900) {
    mode = 'all';
    flyTo(baseView(), dur);
    activeId = null;
    ring.visible = false;
  }

  function setFocus(id, dur = 800) {
    mode = 'focus';
    activeId = id;
    const v = focusView(id);
    v.mode = 'focus';
    flyTo(v, dur);
    ring.visible = true;
    const p = homes[id];
    ring.position.set(p.x, 0.03, p.z);
    activeSpot.target.position.set(p.x, 1.15, p.z);
    activeSpot.position.set(p.x + 0.2, 3.5, p.z + 2.6);
  }

  function setActive(id) {
    activeId = id;
    if (!id) {
      ring.visible = false;
      return;
    }
    ring.visible = true;
    const p = homes[id];
    ring.position.set(p.x, 0.03, p.z);
    activeSpot.target.position.set(p.x, 1.15, p.z);
    activeSpot.position.set(p.x + 0.2, 3.5, p.z + 2.6);
  }

  function setEnd(winnerId) {
    mode = 'end';
    const p = homes[winnerId];
    const portrait = isPortrait();
    flyTo(
      {
        pos: new THREE.Vector3(p.x * 0.4 + (portrait ? 0 : 1.2), portrait ? 2.1 : 2.4, portrait ? 5.3 : 5.0),
        target: new THREE.Vector3(0, 1.15, -1.4),
        fov: portrait ? 54 : 44
      },
      1100
    );
    showTrophy(winnerId);
  }

  // ---------------------------------------------------------------- effects
  function burst(x, y, z, count = 22, strength = 1) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const vel = [];
    const palette = [new THREE.Color(0xffd23f), new THREE.Color(0xff2f87), new THREE.Color(0xffffff), new THREE.Color(0x14b8a6)];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
      const a = Math.random() * TAU;
      const sp = (0.8 + Math.random() * 1.7) * strength;
      vel.push(new THREE.Vector3(Math.cos(a) * sp, 1.2 + Math.random() * 2.2, Math.sin(a) * sp * 0.5));
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.26,
      map: starTex,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    effects.push({ points, vel, life: 0, max: 1.15, positions });
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i];
      fx.life += dt;
      const pos = fx.points.geometry.attributes.position;
      for (let j = 0; j < fx.vel.length; j++) {
        fx.vel[j].y -= 3.2 * dt;
        pos.array[j * 3] += fx.vel[j].x * dt;
        pos.array[j * 3 + 1] += fx.vel[j].y * dt;
        pos.array[j * 3 + 2] += fx.vel[j].z * dt;
      }
      pos.needsUpdate = true;
      fx.points.material.opacity = Math.max(0, 1 - fx.life / fx.max);
      if (fx.life >= fx.max) {
        scene.remove(fx.points);
        fx.points.geometry.dispose();
        fx.points.material.dispose();
        effects.splice(i, 1);
      }
    }
  }

  function makeTrophy(scale = 0.7) {
    const g = new THREE.Group();
    const gold = std(0xffcf4a, { metalness: 0.8, roughness: 0.2, emissive: 0x513300, emissiveIntensity: 0.4 });
    addCyl(g, 0.2, 0.26, 0.08, 0, 0.04, 0, std(0x2d1b16));
    addCyl(g, 0.055, 0.055, 0.26, 0, 0.2, 0, gold, 10);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.08, 0.32, 16), gold);
    cup.position.y = 0.48;
    g.add(cup);
    const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 6, 12, Math.PI), gold);
    handleL.position.set(-0.2, 0.55, 0);
    handleL.rotation.z = Math.PI / 2;
    handleL.rotation.y = 0.2;
    g.add(handleL);
    const handleR = handleL.clone();
    handleR.position.x = 0.2;
    handleR.rotation.z = -Math.PI / 2;
    g.add(handleR);
    addSphere(g, 0.07, 0, 0.7, 0, gold, 12);
    g.scale.setScalar(scale);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    return g;
  }

  function showTrophy(id) {
    if (trophy) {
      scene.remove(trophy);
      trophy = null;
    }
    trophyHost = id;
    trophy = makeTrophy(0.82);
    const p = homes[id];
    trophy.position.set(p.x, 2.2, p.z + 0.25);
    scene.add(trophy);
    burst(p.x, 1.8, p.z + 0.3, 30, 1.25);
  }

  function celebrate(id, perfect = false) {
    const c = characters[id];
    c.userData.reaction = { type: 'success', t: 0, perfect };
    const p = homes[id];
    setTimeout(() => burst(p.x, 1.55, p.z + 0.2, perfect ? 34 : 20, perfect ? 1.3 : 1), 320);
    if (perfect) setTimeout(() => burst(p.x, 1.9, p.z + 0.2, 24, 1.4), 620);
  }

  function slap(id) {
    const c = characters[id];
    const p = homes[id];
    // lean in close with a side angle so the slipper reads clearly
    const portrait = isPortrait();
    flyTo(
      {
        pos: new THREE.Vector3(p.x + (p.x >= 0 ? 1.65 : -1.65), portrait ? 1.74 : 1.7, p.z + (portrait ? 3.55 : 3.65)),
        target: new THREE.Vector3(p.x * 0.7, 1.0, p.z - 0.3),
        fov: 42
      },
      420
    );
    const arm = dad.userData.armR;
    return new Promise((resolve) => {
      let t0 = performance.now();
      function tick(now) {
        const t = (now - t0) / 1000;
        if (t < 0.3) {
          arm.rotation.x = -0.65 - (t / 0.3) * 1.1;
          requestAnimationFrame(tick);
          return;
        }
        if (t < 0.48) {
          const k = (t - 0.3) / 0.18;
          arm.rotation.x = -1.75 + k * 1.35;
          requestAnimationFrame(tick);
          return;
        }
        if (t < 0.58) {
          arm.rotation.x = -0.4 + Math.sin((t - 0.48) * 40) * 0.06;
          if (t < 0.5) {
            c.userData.reaction = { type: 'fail', t: 0 };
            shake = 0.11;
            burst(p.x, 1.12, p.z - 0.2, 26, 1.4);
          }
          requestAnimationFrame(tick);
          return;
        }
        const k = Math.min(1, (t - 0.58) / 0.5);
        arm.rotation.x = -0.4 + k * 0.4;
        if (t < 1.15) requestAnimationFrame(tick);
        else {
          arm.rotation.x = -0.65;
          resolve();
        }
      }
      requestAnimationFrame(tick);
    });
  }

  function reset() {
    if (trophy) {
      scene.remove(trophy);
      trophy = null;
    }
    if (effectBurstTimer) {
      clearInterval(effectBurstTimer);
      effectBurstTimer = 0;
    }
    shake = 0;
    setAll(500);
  }

  function endCelebrate(id) {
    celebrate(id, true);
    let n = 0;
    if (effectBurstTimer) clearInterval(effectBurstTimer);
    effectBurstTimer = setInterval(() => {
      const p = homes[id];
      burst(p.x + (Math.random() - 0.5) * 1.6, 2.1 + Math.random() * 0.7, p.z + 0.2, 16, 1.2);
      n++;
      if (n > 4 && effectBurstTimer) {
        clearInterval(effectBurstTimer);
        effectBurstTimer = 0;
      }
    }, 420);
  }

  // ---------------------------------------------------------------- loop
  function updateCharacter(c, dt) {
    const u = c.userData;
    const home = u.home;
    const idle = Math.sin(time * 2.1 + u.phase);
    c.position.y = u.baseY + idle * 0.012;
    c.rotation.y = Math.sin(time * 0.75 + u.phase) * 0.025;
    const isActive = u.id === activeId;
    if (isActive) c.position.y += Math.sin(time * 3.1) * 0.009;
    if (u.arms) {
      const a = isActive ? 0.1 : 0.045;
      u.arms[-1].rotation.x = Math.sin(time * 1.8 + u.phase) * a;
      u.arms[1].rotation.x = Math.sin(time * 1.8 + u.phase + 0.8) * a;
      u.arms[-1].rotation.z = -0.13;
      u.arms[1].rotation.z = 0.13;
    }
    u.head.rotation.z = Math.sin(time * 1.1 + u.phase) * 0.016;

    if (u.reaction) {
      u.reaction.t += dt;
      const r = u.reaction;
      if (r.type === 'success') {
        const p = clamp01(r.t / 0.85);
        const hop = Math.sin(p * Math.PI) * (r.perfect ? 0.26 : 0.18);
        c.position.y += hop;
        const raise = Math.sin(Math.min(1, p * 1.5) * Math.PI * 0.5);
        if (u.arms) {
          u.arms[-1].rotation.z = -0.13 - raise * (r.perfect ? 2.3 : 1.8);
          u.arms[1].rotation.z = 0.13 + raise * (r.perfect ? 2.3 : 1.8);
          u.arms[-1].rotation.x = -raise * 0.5;
          u.arms[1].rotation.x = -raise * 0.5;
        }
        if (r.t > 1.2) u.reaction = null;
      } else if (r.type === 'fail') {
        const p = clamp01(r.t / 1.3);
        const wobble = Math.sin(p * Math.PI * 5) * (1 - p) * 0.1;
        c.rotation.x = -0.12 * Math.sin(p * Math.PI * 0.9) + wobble;
        c.position.y += Math.sin(p * Math.PI) * 0.09;
        if (u.arms) {
          u.arms[-1].rotation.x = 1.0 - p * 1.0;
          u.arms[1].rotation.x = 1.0 - p * 1.0;
          u.arms[-1].rotation.z = -0.7 * (1 - p);
          u.arms[1].rotation.z = 0.7 * (1 - p);
        }
        if (r.t > 1.5) {
          u.reaction = null;
          c.rotation.x = 0;
        }
      }
    } else {
      c.rotation.x = 0;
    }
  }

  function updateDad(dt) {
    const u = dad.userData;
    const arm = u.armR;
    // when not mid-slap, gentle idle breathing
    if (Math.abs(arm.rotation.x + 0.65) < 0.001) {
      dad.position.y = Math.sin(time * 1.6) * 0.008;
    }
    u.head.rotation.z = Math.sin(time * 0.9 + u.phase) * 0.012;
    u.head.rotation.y = Math.sin(time * 0.5 + 0.4) * 0.04;
  }

  function updateCamera(dt) {
    if (camTween) {
      camTween.t += dt;
      const p = clamp01(camTween.t / (camTween.dur / 1000));
      const e = easeInOut(p);
      camera.position.lerpVectors(camTween.pos0, camTween.pos1, e);
      camTarget.lerpVectors(camTween.target0, camTween.target1, e);
      camera.fov = camTween.fov0 + (camTween.fov1 - camTween.fov0) * e;
      camera.updateProjectionMatrix();
      if (p >= 1) camTween = null;
    }
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 0.85);
      const s = shake * 0.5;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s * 0.4;
    }
    camera.lookAt(camTarget);
    if (ring.visible) {
      const k = 1 + Math.sin(time * 4.2) * 0.06;
      ring.scale.set(k, k, 1);
      ring.material.opacity = 0.68 + Math.sin(time * 4.2) * 0.18;
    }
    activeSpot.intensity = 30 + Math.sin(time * 2.5) * 3;
  }

  let staticClock = 0;
  function updateStatic(dt) {
    staticClock += dt;
    if (staticClock < 0.095) return;
    staticClock = 0;
    const ctx = staticTex.image.getContext('2d');
    const w = staticTex.image.width;
    const h = staticTex.image.height;
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const v = 25 + Math.random() * 210;
        ctx.fillStyle = `rgb(${v * 0.65},${v * 0.82},${v})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    staticTex.needsUpdate = true;
  }

  function updateLava(dt) {
    const blobs = lava.userData.blobs;
    blobs.forEach((b, i) => {
      const y = b.baseY + Math.sin(time * (0.5 + i * 0.12) + b.phase) * 0.12;
      b.mesh.position.y = y;
      b.mesh.position.x = Math.sin(time * 0.8 + b.phase * 2) * 0.05;
      const s = 1 + Math.sin(time * 1.3 + b.phase) * 0.22;
      b.mesh.scale.setScalar(s);
    });
  }

  function updateTrophy(dt) {
    if (!trophy) return;
    trophy.rotation.y += dt * 0.7;
    trophy.position.y = 2.2 + Math.sin(time * 2.2) * 0.06;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layoutStage();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    SIBLINGS.forEach((def) => updateCharacter(characters[def.id], dt));
    updateDad(dt);
    updateEffects(dt);
    updateStatic(dt);
    updateLava(dt);
    updateTrophy(dt);
    updateCamera(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 180));

  layoutStage();
  snapBase();
  requestAnimationFrame(frame);

  return {
    setFocus,
    setActive,
    setAll,
    setEnd,
    celebrate,
    slap,
    endCelebrate,
    reset,
    resize,
    get activeId() {
      return activeId;
    }
  };
}
