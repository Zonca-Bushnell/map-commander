import "./pages-viewer.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import sceneData from "../data/saves/default.scene.json";
import manifest from "../data/saves/manifest.json";

const PASSWORD_HASH = "f174423444907a20b05145600dd8b960b743c75023548870468dd2075f4dd16a";

const canvas = document.querySelector("#viewer");
const statusEl = document.querySelector("#status");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color("#020b12");

const camera = new THREE.PerspectiveCamera(42, 1, 1, 5000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(20, 0, 30);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const world = new THREE.Group();
const labels = new THREE.Group();
scene.add(world, labels);

const recordsByObject = new Map();
let labelsVisible = true;
let activeSceneData = sceneData;

const cameras = {
  dispatch: { position: [0, -720, 760], target: [20, 0, 30] },
  topdown: { position: [0, 0, 1100], target: [0, 0, 0] },
  low: { position: [-560, -720, 360], target: [20, -20, 60] }
};

function setStatus(text) {
  statusEl.textContent = text;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text || "")));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createPasswordGate() {
  const gate = document.createElement("div");
  gate.className = "password-gate";
  gate.innerHTML = `
    <div class="password-card">
      <span>ARCHIVE LOCK</span>
      <strong>${manifest.saves?.[0]?.title || "FOR THE FUTURE"}</strong>
      <label>Viewer password<input id="viewer-password" type="password" autocomplete="current-password" /></label>
      <button id="unlock-viewer">Open Viewer</button>
      <button id="open-test-viewer" type="button">Open Test Archive</button>
      <p id="password-status">Enter the archive viewer password.</p>
    </div>
  `;
  document.body.append(gate);
  const input = gate.querySelector("#viewer-password");
  const passwordStatus = gate.querySelector("#password-status");
  const unlock = async () => {
    if ((await sha256(input.value)) !== PASSWORD_HASH) {
      passwordStatus.textContent = "Password is incorrect.";
      return;
    }
    gate.remove();
    buildWorld(sceneData, "FOR THE FUTURE");
  };
  gate.querySelector("#unlock-viewer").addEventListener("click", unlock);
  gate.querySelector("#open-test-viewer").addEventListener("click", () => {
    gate.remove();
    buildWorld(createTestSceneData(), "TEST ARCHIVE");
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") unlock();
  });
  input.focus();
}

function createTestSceneData() {
  const types = [
    "office_block",
    "tower_cluster",
    "podium_complex",
    "hospital",
    "nasa_research",
    "warehouse",
    "freight_depot",
    "port",
    "residential_district",
    "rocket_launch_site",
    "mega_hq_tower"
  ];
  const colors = ["#25c9be", "#34e6d8", "#1aa8ff", "#58f3c0", "#71d8ff"];
  const defaults = {
    office_block: [5, 80, 70, 90],
    tower_cluster: [8, 110, 100, 130],
    podium_complex: [5, 130, 100, 95],
    hospital: [4, 160, 120, 80],
    nasa_research: [5, 170, 140, 120],
    warehouse: [5, 150, 100, 45],
    freight_depot: [12, 160, 120, 55],
    port: [10, 180, 120, 60],
    residential_district: [12, 150, 140, 95],
    rocket_launch_site: [1, 180, 180, 220],
    mega_hq_tower: [1, 150, 140, 460]
  };
  const objects = [];
  for (let index = 0; index < 18; index += 1) {
    const type = types[index % types.length];
    const [count, width, depth, height] = defaults[type];
    const angle = index * 0.68;
    const ring = index % 2 ? 285 : 165;
    objects.push({
      id: `pages_test_${index + 1}`,
      name: `TEST ${index + 1}`,
      kind: "generated_building",
      color: colors[index % colors.length],
      position: [
        Math.round(Math.cos(angle) * ring + ((index % 3) - 1) * 24),
        0,
        Math.round(Math.sin(angle) * ring + ((index % 4) - 1.5) * 22)
      ],
      rotation: [0, (index % 7) * 0.12, 0],
      scale: [1, 1, 1],
      dimensions: [width, depth, height],
      showNameplate: index % 3 === 0,
      generator: {
        type,
        count,
        width,
        depth,
        height,
        spacing: 14,
        heightVariance: 0.24,
        seed: `pages-test-${index}`
      },
      interior: null
    });
  }
  return { version: 2, savedAt: new Date().toISOString(), testOnly: true, objects };
}

function makeMaterial(color, opacity = 0.78) {
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.46,
    metalness: 0.08,
    emissive: new THREE.Color(color).multiplyScalar(0.12)
  });
  return material;
}

function addBox(group, x, z, w, d, h, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMaterial(color));
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFootprint(group, w, d, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w + 20, 1.8, d + 20), makeMaterial(color, 0.24));
  mesh.position.y = 0.4;
  group.add(mesh);
}

function createRecordObject(record) {
  const group = new THREE.Group();
  group.name = record.name || record.id;
  group.position.fromArray(record.position || [0, 0, 0]);
  group.rotation.set(...(record.rotation || [0, 0, 0]));
  group.scale.fromArray(record.scale || [1, 1, 1]);

  const generator = record.generator || {};
  const color = record.color || "#25c9be";
  const w = Math.max(24, record.dimensions?.[0] || generator.width || 60);
  const d = Math.max(24, record.dimensions?.[1] || generator.depth || 60);
  const h = Math.max(16, record.dimensions?.[2] || generator.height || 60);
  addFootprint(group, w, d, color);

  const count = Math.max(1, Math.min(16, generator.count || 1));
  if (generator.type === "ring_hq" || generator.type === "circular_facility") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.48, h * 0.35, 72), makeMaterial(color));
    base.position.y = h * 0.18;
    group.add(base);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.22, h, 72), makeMaterial(color, 0.86));
    core.position.y = h / 2;
    group.add(core);
  } else if (generator.type === "rocket_launch_site") {
    addBox(group, 0, 0, w * 0.7, d * 0.7, 8, color);
    const rocket = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, h, 32), makeMaterial("#dffcff", 0.9));
    rocket.position.y = h / 2 + 8;
    group.add(rocket);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(10, 26, 32), makeMaterial("#72fff2"));
    cone.position.y = h + 21;
    group.add(cone);
  } else {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellW = w / cols;
    const cellD = d / rows;
    for (let i = 0; i < count; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = -w / 2 + cellW * (col + 0.5);
      const z = -d / 2 + cellD * (row + 0.5);
      const height = h * (0.45 + ((i % 5) + 1) * 0.11);
      addBox(group, x, z, cellW * 0.72, cellD * 0.72, Math.min(h, height), color);
    }
  }

  group.traverse((child) => {
    if (child.isMesh) recordsByObject.set(child.uuid, record);
  });
  return group;
}

function makeLabelTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.font = "800 42px Microsoft YaHei UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#24d8ff";
  ctx.fillStyle = "#ffffff";
  const label = String(text || "").slice(0, 24);
  ctx.strokeText(label, 256, 70);
  ctx.fillText(label, 256, 70);
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(256, 126);
  ctx.lineTo(256, 224);
  ctx.moveTo(218, 184);
  ctx.lineTo(256, 224);
  ctx.lineTo(294, 184);
  ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}

function addLabel(record) {
  if (!record.showNameplate && !record.name) return;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeLabelTexture(record.name || record.id),
    transparent: true,
    depthTest: false
  }));
  const pos = record.position || [0, 0, 0];
  const height = Math.max(120, (record.dimensions?.[2] || record.generator?.height || 80) + 120);
  sprite.position.set(pos[0] || 0, height, pos[2] || 0);
  sprite.scale.set(180, 95, 1);
  sprite.renderOrder = 1000;
  labels.add(sprite);
}

function addBaseMap() {
  addBox(world, 0, 0, 1180, 760, 2, "#05323a");
  addBox(world, -440, 0, 250, 760, 2.5, "#064c58");
  [-220, -70, 90, 245].forEach((z) => addBox(world, 60, z, 860, 8, 2.8, "#06151c"));
  [-240, -30, 190, 390].forEach((x) => addBox(world, x, 0, 8, 590, 2.8, "#06151c"));
}

function clearGroup(group) {
  group.children.slice().forEach((child) => {
    group.remove(child);
    child.traverse?.((item) => {
      item.geometry?.dispose?.();
      if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose?.());
      else item.material?.dispose?.();
    });
  });
}

function buildWorld(nextSceneData = sceneData, title = "FOR THE FUTURE") {
  activeSceneData = nextSceneData;
  recordsByObject.clear();
  clearGroup(world);
  clearGroup(labels);
  document.querySelector(".interior-readout")?.remove();
  document.querySelector(".hud strong").textContent = title;
  addBaseMap();
  (activeSceneData.objects || []).forEach((record) => {
    const object = createRecordObject(record);
    world.add(object);
    addLabel(record);
  });
  setStatus(`Loaded ${(activeSceneData.objects || []).length} map objects`);
}

function showInterior(record) {
  const existing = document.querySelector(".interior-readout");
  existing?.remove();
  const panel = document.createElement("div");
  panel.className = "interior-readout";
  const floors = Object.values(record.interior?.floors || {});
  panel.innerHTML = `
    <strong>${record.name || record.id}</strong>
    <button type="button">Close</button>
    <p>${record.generator?.type || "building"} / ${floors.length || 0} floors</p>
    <div>${floors.map((floor) => `<span>${floor.name}</span>`).join("") || "<span>No interior data</span>"}</div>
  `;
  panel.querySelector("button").addEventListener("click", () => panel.remove());
  document.body.append(panel);
}

function setCamera(name) {
  const preset = cameras[name] || cameras.dispatch;
  camera.position.fromArray(preset.position);
  orbit.target.fromArray(preset.target);
  orbit.update();
}

function setCameraMode(mode) {
  orbit.enablePan = true;
  orbit.enableRotate = mode !== "pan";
  orbit.mouseButtons.LEFT = mode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  orbit.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
}

function onClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(world, true)[0];
  const record = hit ? recordsByObject.get(hit.object.uuid) : null;
  if (record) showInterior(record);
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function animate() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

scene.add(new THREE.HemisphereLight("#bdfcff", "#041016", 1.2));
const sun = new THREE.DirectionalLight("#ffffff", 1.6);
sun.position.set(-240, -320, 540);
scene.add(sun);

document.querySelectorAll("[data-camera]").forEach((button) => {
  button.addEventListener("click", () => setCamera(button.dataset.camera));
});
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => setCameraMode(button.dataset.mode));
});
document.querySelector("[data-action='labels']").addEventListener("click", () => {
  labelsVisible = !labelsVisible;
  labels.visible = labelsVisible;
});
document.querySelector("[data-action='test']").addEventListener("click", () => {
  buildWorld(createTestSceneData(), "TEST ARCHIVE");
});
canvas.addEventListener("click", onClick);
window.addEventListener("resize", resize);

resize();
setCamera("dispatch");
setCameraMode("orbit");
createPasswordGate();
animate();
