import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VIEWER_ACCESS, VIEWER_MODEL_URL, VIEWER_SCENE } from "./viewer-data.js";

const canvas = document.querySelector("#viewer-scene");
const statusEl = document.querySelector("#viewer-status");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#020b12");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new THREE.PerspectiveCamera(42, 1, 1, 5000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
let cameraControlMode = "orbit";

const labelLayer = new THREE.Group();
labelLayer.name = "Viewer Name Labels";
scene.add(labelLayer);
const viewerRaycaster = new THREE.Raycaster();
const viewerPointer = new THREE.Vector2();
const buildingRecords = new Map((VIEWER_SCENE.objects || []).flatMap((record) => [[record.name, record], [record.id, record]]));
const interiorUi = createViewerInteriorUi();
let modelRoot = null;
let activeInteriorRecord = null;
let activeInteriorFloorId = null;
let viewerUnlocked = false;

const cameraPresets = {
  dispatch: { position: [0, -680, 760], target: [20, 0, 30] },
  topdown: { position: [0, 0, 980], target: [0, 0, 0] },
  lowOblique: { position: [-520, -680, 360], target: [20, -20, 35] }
};

function setStatus(text) {
  statusEl.textContent = text;
}

function createViewerInteriorUi() {
  const shell = document.createElement("div");
  shell.className = "viewer-interior hidden";
  shell.innerHTML = `
    <aside class="viewer-interior-panel">
      <strong id="viewer-interior-title">内部模式</strong>
      <button data-viewer-interior="back">返回全景</button>
      <div id="viewer-floor-list" class="viewer-floor-list"></div>
    </aside>
    <main class="viewer-floor-wrap">
      <div id="viewer-floor-title" class="viewer-floor-title">请选择建筑</div>
      <div id="viewer-floor-plan" class="viewer-floor-plan"></div>
      <div id="viewer-floor-stack" class="viewer-floor-stack"></div>
    </main>
  `;
  document.body.append(shell);
  shell.querySelector("[data-viewer-interior='back']").addEventListener("click", closeViewerInterior);
  return {
    shell,
    title: shell.querySelector("#viewer-interior-title"),
    floorTitle: shell.querySelector("#viewer-floor-title"),
    floorList: shell.querySelector("#viewer-floor-list"),
    floorPlan: shell.querySelector("#viewer-floor-plan"),
    floorStack: shell.querySelector("#viewer-floor-stack")
  };
}

function openViewerInterior(record) {
  if (!record?.interior?.floors) {
    setStatus("该建筑没有内部数据");
    return;
  }
  activeInteriorRecord = record;
  activeInteriorFloorId = record.interior.activeFloorId || Object.keys(record.interior.floors)[0];
  interiorUi.shell.classList.remove("hidden");
  renderViewerInterior();
  setStatus(`内部模式：${record.name}`);
}

function closeViewerInterior() {
  activeInteriorRecord = null;
  activeInteriorFloorId = null;
  interiorUi.shell.classList.add("hidden");
  setStatus("已返回全景");
}

function renderViewerInterior() {
  const interior = activeInteriorRecord?.interior;
  if (!interior) return;
  const floors = Object.values(interior.floors).sort((a, b) => (a.level || 0) - (b.level || 0));
  const floor = interior.floors[activeInteriorFloorId] || floors[0];
  activeInteriorFloorId = floor.id;
  interiorUi.title.textContent = activeInteriorRecord.name;
  interiorUi.floorTitle.textContent = floor.name;
  interiorUi.floorList.innerHTML = "";
  floors.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("active", item.id === floor.id);
    button.innerHTML = `${item.name}<small>${item.groupId ? "标准层组" : "独立层"} / Level ${item.level}</small>`;
    button.addEventListener("click", () => {
      activeInteriorFloorId = item.id;
      renderViewerInterior();
    });
    interiorUi.floorList.append(button);
  });
  renderViewerFloorPlan(floor, activeInteriorRecord.dimensions || [160, 110, 90]);
  renderViewerFloorStack(floors, floor.id);
}

function renderViewerFloorPlan(floor, dimensions) {
  const width = Math.max(90, Math.min(280, dimensions[0] || 160));
  const depth = Math.max(70, Math.min(230, dimensions[1] || 110));
  const elements = [...(floor.corridors || []), ...(floor.rooms || []), ...(floor.facilities || [])];
  interiorUi.floorPlan.innerHTML = "";
  elements.forEach((element) => {
    const node = document.createElement("div");
    node.className = `viewer-floor-item ${element.kind}`;
    node.textContent = element.name;
    node.title = `${element.type || ""} / ${element.status || ""}`;
    node.style.left = `${50 + ((element.x || 0) / width) * 88}%`;
    node.style.top = `${50 + ((element.z || 0) / depth) * 82}%`;
    node.style.width = `${Math.max(5, ((element.w || 12) / width) * 88)}%`;
    node.style.height = `${Math.max(5, ((element.d || 12) / depth) * 82)}%`;
    node.style.background = element.color || "#25c9be";
    interiorUi.floorPlan.append(node);
  });
}

function renderViewerFloorStack(floors, activeId) {
  interiorUi.floorStack.innerHTML = "";
  floors.forEach((floor) => {
    const slab = document.createElement("button");
    slab.type = "button";
    slab.className = floor.id === activeId ? "active" : "";
    slab.textContent = floor.name;
    slab.addEventListener("click", () => {
      activeInteriorFloorId = floor.id;
      renderViewerInterior();
    });
    interiorUi.floorStack.append(slab);
  });
}

function setCameraPreset(name) {
  const preset = cameraPresets[name] || cameraPresets.dispatch;
  camera.position.fromArray(preset.position);
  orbit.target.fromArray(preset.target);
  orbit.update();
  setStatus(`镜头：${name}`);
}

function setCameraControlMode(mode) {
  cameraControlMode = mode === "pan" ? "pan" : "orbit";
  orbit.enablePan = true;
  orbit.enableRotate = cameraControlMode === "orbit";
  orbit.mouseButtons.LEFT = cameraControlMode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  orbit.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  orbit.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  document.querySelectorAll("[data-camera-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.cameraMode === cameraControlMode);
  });
  setStatus(cameraControlMode === "pan" ? "镜头平移模式" : "镜头旋转模式");
}

function makeNameplateTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "800 44px 'Microsoft YaHei UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#24d8ff";
  ctx.fillStyle = "#ffffff";
  const label = String(text || "").slice(0, 24);
  ctx.strokeText(label, 256, 72);
  ctx.fillText(label, 256, 72);
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(256, 128);
  ctx.lineTo(256, 226);
  ctx.moveTo(214, 184);
  ctx.lineTo(256, 228);
  ctx.lineTo(298, 184);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function estimateLabelHeight(record) {
  const measuredHeight = Number(record.dimensions?.[2]);
  const generatorHeight = Number(record.generator?.height) || 90;
  const scaleY = Number(record.scale?.[1]) || 1;
  const buildingHeight = measuredHeight || generatorHeight * scaleY;
  return Math.max(150, buildingHeight + 128);
}

function addNameplates() {
  const namedObjects = (VIEWER_SCENE.objects || []).filter((record) => record.showNameplate && record.name);
  namedObjects.forEach((record) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeNameplateTexture(record.name),
      transparent: true,
      depthTest: false,
      depthWrite: false
    }));
    const position = record.position || [0, 0, 0];
    sprite.position.set(position[0] || 0, (position[1] || 0) + estimateLabelHeight(record), position[2] || 0);
    sprite.scale.set(Math.max(130, Math.min(230, String(record.name).length * 22)), 116, 1);
    sprite.renderOrder = 1000;
    labelLayer.add(sprite);
  });
  setStatus(namedObjects.length ? `已加载 ${namedObjects.length} 个名称标牌` : "已加载模型");
}

function wireControls() {
  document.querySelectorAll("[data-camera]").forEach((button) => {
    button.addEventListener("click", () => setCameraPreset(button.dataset.camera));
  });
  document.querySelectorAll("[data-camera-mode]").forEach((button) => {
    button.addEventListener("click", () => setCameraControlMode(button.dataset.cameraMode));
  });
  document.querySelector("[data-action='toggle-labels']").addEventListener("click", () => {
    labelLayer.visible = !labelLayer.visible;
    setStatus(labelLayer.visible ? "已显示名称/箭头" : "已隐藏名称/箭头");
  });
  document.querySelector("[data-action='reset']").addEventListener("click", () => setCameraPreset("dispatch"));
  renderer.domElement.addEventListener("click", onViewerCanvasClick);
}

function onViewerCanvasClick(event) {
  if (!modelRoot || interiorUi.shell.contains(event.target)) return;
  const rect = renderer.domElement.getBoundingClientRect();
  viewerPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  viewerPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  viewerRaycaster.setFromCamera(viewerPointer, camera);
  const hits = viewerRaycaster.intersectObject(modelRoot, true);
  for (const hit of hits) {
    let object = hit.object;
    while (object) {
      const record = buildingRecords.get(object.name);
      if (record) {
        openViewerInterior(record);
        return;
      }
      object = object.parent;
    }
  }
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function loadViewerModel() {
  const loader = new GLTFLoader();
  loader.load(
    VIEWER_MODEL_URL,
    (gltf) => {
      modelRoot = gltf.scene;
      scene.add(modelRoot);
      addNameplates();
    },
    undefined,
    (error) => setStatus(`模型读取失败：${error.message}`)
  );
}

function createViewerPasswordGate() {
  const gate = document.createElement("div");
  gate.className = "viewer-password-gate";
  gate.innerHTML = `
    <div class="viewer-password-card">
      <span>ARCHIVE LOCK</span>
      <strong>${VIEWER_ACCESS?.title || "Dispatch Map Viewer"}</strong>
      <label>
        观看密码
        <input id="viewer-password-input" type="password" autocomplete="current-password" />
      </label>
      <button id="viewer-password-open">进入观看</button>
      <p id="viewer-password-status">该观看页来自带密码的存档。</p>
    </div>
  `;
  document.body.append(gate);
  const input = gate.querySelector("#viewer-password-input");
  const status = gate.querySelector("#viewer-password-status");
  const submit = async () => {
    const nextHash = await sha256(input.value);
    if (nextHash !== VIEWER_ACCESS.passwordHash) {
      status.textContent = "密码不正确。";
      return;
    }
    viewerUnlocked = true;
    gate.remove();
    loadViewerModel();
  };
  gate.querySelector("#viewer-password-open").addEventListener("click", submit);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submit();
  });
  input.focus();
}

async function init() {
  scene.add(new THREE.HemisphereLight("#bdfcff", "#041016", 1.2));
  const sun = new THREE.DirectionalLight("#ffffff", 1.6);
  sun.position.set(-240, -320, 540);
  scene.add(sun);
  wireControls();
  resize();
  setCameraPreset("dispatch");
  setCameraControlMode("orbit");
  window.addEventListener("resize", resize);
  if (VIEWER_ACCESS?.locked && !viewerUnlocked) {
    createViewerPasswordGate();
    animate();
    return;
  }

  const loader = new GLTFLoader();
  loader.load(
    VIEWER_MODEL_URL,
    (gltf) => {
      modelRoot = gltf.scene;
      scene.add(modelRoot);
      addNameplates();
    },
    undefined,
    (error) => setStatus(`模型读取失败：${error.message}`)
  );
  animate();
}

init();
