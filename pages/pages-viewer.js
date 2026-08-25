import "./pages-viewer.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import sceneData from "../data/saves/default.scene.json";
import manifest from "../data/saves/manifest.json";
import { createBuildingBlock, generatorDefaults, typeLabels } from "../src/blocks/blockLibrary.js";

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
  const objects = [];
  for (let index = 0; index < 18; index += 1) {
    const type = types[index % types.length];
    const base = generatorDefaults[type];
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
      dimensions: [base.width, base.depth, base.height],
      showNameplate: index % 3 === 0,
      generator: {
        ...base,
        type,
        seed: `pages-test-${index}`
      },
      interior: null
    });
  }
  return { version: 2, savedAt: new Date().toISOString(), testOnly: true, objects };
}

function makeGroundMaterial(color, opacity = 0.78) {
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

function addGroundBox(group, x, z, w, d, h, color, opacity = 0.78) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeGroundMaterial(color, opacity));
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createRecordObject(record) {
  const group = createBuildingBlock(record);
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
  if (!record.showNameplate) return;
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
  addGroundBox(world, 0, 0, 1180, 760, 2, "#05323a");
  addGroundBox(world, -440, 0, 250, 760, 2.5, "#064c58");
  [-220, -70, 90, 245].forEach((z) => addGroundBox(world, 60, z, 860, 8, 2.8, "#06151c"));
  [-240, -30, 190, 390].forEach((x) => addGroundBox(world, x, 0, 8, 590, 2.8, "#06151c"));
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
    <p>${typeLabels[record.generator?.type] || record.generator?.type || "building"} / ${floors.length || 0} floors</p>
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
