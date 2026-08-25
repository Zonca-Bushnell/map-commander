import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { exportGltf, exportScreenshot, exportViewer } from "./exporters.js";
import {
  addInteriorElement,
  cloneInterior,
  createInteriorForBuilding,
  detachActiveFloor,
  findInteriorElement,
  getActiveFloor,
  getInteriorElements,
  interiorElementKinds,
  listInteriorFloors,
  removeInteriorElement,
  updateInteriorElement
} from "./interiorData.js";
import { createSave, listSaves, loadArchiveScene, saveArchiveScene } from "./saveArchive.js";
import { applyRecordToObject, makeMaterial, serializeScene } from "./sceneStore.js";

const app = document.querySelector("#app");
const canvas = document.querySelector("#scene");
const viewport = document.querySelector("#viewport");
const statusEl = document.querySelector("#status");
const objectListEl = document.querySelector("#object-list");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#020b12");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 0, 0);

const transform = new TransformControls(camera, renderer.domElement);
const transformHelper = transform.getHelper();
transformHelper.userData.nonExport = true;
transformHelper.visible = false;
transform.setMode("translate");
transform.addEventListener("dragging-changed", (event) => {
  orbit.enabled = !event.value;
});
transform.addEventListener("objectChange", () => {
  updateSelectionMarker();
  syncInspector();
  renderObjectList();
  updateFootprintOverlaps();
});
scene.add(transformHelper);

const selectionMarker = new THREE.Mesh(
  new THREE.RingGeometry(0.92, 1, 96),
  new THREE.MeshBasicMaterial({ color: "#73fff2", transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
selectionMarker.rotation.x = -Math.PI / 2;
selectionMarker.visible = false;
selectionMarker.userData.nonExport = true;
scene.add(selectionMarker);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const editableGroup = new THREE.Group();
editableGroup.name = "Editable Generated Buildings";
scene.add(editableGroup);

const extensionGroup = new THREE.Group();
extensionGroup.name = "Dynamic Ground Extensions";
extensionGroup.userData.nonExport = true;
scene.add(extensionGroup);

const overlapGroup = new THREE.Group();
overlapGroup.name = "Different Type Footprint Overlaps";
scene.add(overlapGroup);

const interiorGroup = new THREE.Group();
interiorGroup.name = "Interior Mode";
interiorGroup.userData.nonExport = true;
interiorGroup.visible = false;
scene.add(interiorGroup);

let selected = null;
let objectCounter = 1;
let dragState = null;
let placementState = null;
let cameraControlMode = "orbit";
let appMode = "panorama";
let currentInteriorBuilding = null;
let selectedInteriorElementId = null;
let interiorDragState = null;
let interiorViewMode = "floor";
let hiddenForInterior = [];
let undoStack = [];
let redoStack = [];
let currentSaveAccess = null;
let savePickerUi = null;

const cameras = {
  dispatch: { position: [0, -680, 760], target: [20, 0, 30] },
  topdown: { position: [0, 0, 980], target: [0, 0, 0] },
  lowOblique: { position: [-520, -680, 360], target: [20, -20, 35] }
};

const BASE_BOUNDS = {
  minX: -560,
  maxX: 560,
  minZ: -360,
  maxZ: 360
};

const typeLabels = {
  office_block: "写字楼体块",
  dense_city_block: "密集街区",
  long_office_bar: "长条楼组",
  twin_towers: "双塔",
  tower_cluster: "塔楼群",
  podium_complex: "裙楼综合体",
  dispatch_compound: "派遣建筑组",
  circular_facility: "圆形设施",
  ring_hq: "环形总部",
  mission_marker: "任务点",
  library: "图书馆",
  mega_hq_tower: "超高总部大楼",
  rocket_launch_site: "火箭发射区",
  port: "港口",
  freight_depot: "托运部门",
  warehouse: "仓库",
  research_lab: "研究所",
  hospital: "大型医院",
  nasa_research: "NASA研究所",
  residential_district: "居民区"
};

const generatorDefaults = {
  office_block: { type: "office_block", count: 5, width: 42, depth: 42, height: 96, spacing: 18, heightVariance: 0.25, seed: "office-01" },
  dense_city_block: { type: "dense_city_block", count: 18, width: 22, depth: 30, height: 38, spacing: 8, heightVariance: 0.35, seed: "dense-01" },
  long_office_bar: { type: "long_office_bar", count: 6, width: 28, depth: 72, height: 58, spacing: 10, heightVariance: 0.18, seed: "bar-01" },
  twin_towers: { type: "twin_towers", count: 2, width: 44, depth: 44, height: 150, spacing: 34, heightVariance: 0.08, seed: "twin-01" },
  tower_cluster: { type: "tower_cluster", count: 8, width: 32, depth: 32, height: 118, spacing: 24, heightVariance: 0.45, seed: "cluster-01" },
  podium_complex: { type: "podium_complex", count: 5, width: 48, depth: 40, height: 92, spacing: 18, heightVariance: 0.28, seed: "podium-01" },
  dispatch_compound: { type: "dispatch_compound", count: 5, width: 44, depth: 44, height: 82, spacing: 14, heightVariance: 0.25, seed: "dispatch-01" },
  circular_facility: { type: "circular_facility", count: 1, width: 96, depth: 96, height: 36, spacing: 12, heightVariance: 0, seed: "circle-01" },
  ring_hq: { type: "ring_hq", count: 1, width: 120, depth: 120, height: 58, spacing: 18, heightVariance: 0, seed: "hq-01" },
  mission_marker: { type: "mission_marker", count: 1, width: 34, depth: 34, height: 42, spacing: 0, heightVariance: 0, seed: "marker-01" },
  library: { type: "library", count: 3, width: 70, depth: 58, height: 54, spacing: 12, heightVariance: 0.12, seed: "library-01" },
  mega_hq_tower: { type: "mega_hq_tower", count: 1, width: 128, depth: 116, height: 450, spacing: 28, heightVariance: 0, seed: "mega-hq-01" },
  rocket_launch_site: { type: "rocket_launch_site", count: 1, width: 170, depth: 170, height: 220, spacing: 18, heightVariance: 0, seed: "rocket-01" },
  port: { type: "port", count: 10, width: 118, depth: 72, height: 58, spacing: 14, heightVariance: 0.15, seed: "port-01" },
  freight_depot: { type: "freight_depot", count: 12, width: 92, depth: 58, height: 52, spacing: 12, heightVariance: 0.1, seed: "freight-01" },
  warehouse: { type: "warehouse", count: 5, width: 104, depth: 70, height: 42, spacing: 18, heightVariance: 0.16, seed: "warehouse-01" },
  research_lab: { type: "research_lab", count: 4, width: 120, depth: 104, height: 96, spacing: 22, heightVariance: 0.22, seed: "lab-01" },
  hospital: { type: "hospital", count: 4, width: 126, depth: 92, height: 72, spacing: 18, heightVariance: 0.12, seed: "hospital-01" },
  nasa_research: { type: "nasa_research", count: 5, width: 142, depth: 118, height: 108, spacing: 24, heightVariance: 0.18, seed: "nasa-01" },
  residential_district: { type: "residential_district", count: 12, width: 38, depth: 46, height: 88, spacing: 18, heightVariance: 0.28, seed: "residential-01" }
};

const createInputs = {
  type: document.querySelector("#create-type"),
  count: document.querySelector("#create-count"),
  width: document.querySelector("#create-width"),
  depth: document.querySelector("#create-depth"),
  height: document.querySelector("#create-height"),
  spacing: document.querySelector("#create-spacing"),
  variance: document.querySelector("#create-variance"),
  seed: document.querySelector("#create-seed"),
  color: document.querySelector("#create-color")
};

const inputs = {
  name: document.querySelector("#prop-name"),
  kind: document.querySelector("#prop-kind"),
  x: document.querySelector("#prop-x"),
  y: document.querySelector("#prop-y"),
  z: document.querySelector("#prop-z"),
  rot: document.querySelector("#prop-rot"),
  scale: document.querySelector("#prop-scale"),
  color: document.querySelector("#prop-color"),
  genType: document.querySelector("#prop-gen-type"),
  genCount: document.querySelector("#prop-gen-count"),
  genWidth: document.querySelector("#prop-gen-width"),
  genDepth: document.querySelector("#prop-gen-depth"),
  genHeight: document.querySelector("#prop-gen-height"),
  genSpacing: document.querySelector("#prop-gen-spacing"),
  genVariance: document.querySelector("#prop-gen-variance"),
  genSeed: document.querySelector("#prop-gen-seed")
};

const snapControls = {
  enabled: document.querySelector("#snap-enabled"),
  size: document.querySelector("#snap-size")
};

const interiorUi = createInteriorUi();
savePickerUi = createSavePickerUi();
queueMicrotask(() => refreshSaveList().catch((error) => setSavePickerStatus(error.message)));

async function loadScene() {
  return null;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function createInteriorUi() {
  const enterButton = document.createElement("button");
  enterButton.id = "enter-interior";
  enterButton.type = "button";
  enterButton.textContent = "进入内部模式";
  document.querySelector(".button-grid").append(enterButton);

  const shell = document.createElement("div");
  shell.id = "interior-shell";
  shell.className = "interior-shell hidden";
  shell.innerHTML = `
    <aside class="interior-panel interior-left">
      <div class="brand"><span>INTERIOR</span><strong id="interior-building-name">未选择建筑</strong></div>
      <section>
        <h2>内部控制</h2>
        <button data-interior-action="back">返回全景</button>
        <button data-interior-view="floor" class="active">楼层视图</button>
        <button data-interior-view="stack">堆叠视图</button>
        <button data-interior-action="save">保存</button>
        <button data-interior-action="reset" class="danger">重置本建筑内部</button>
      </section>
      <section>
        <h2>楼层 / 标准层</h2>
        <div id="interior-floor-list" class="object-list"></div>
        <button data-interior-action="detach-floor">拆分为独立楼层</button>
      </section>
    </aside>
    <div class="interior-center-hud">
      <strong id="interior-floor-title">内部模式</strong>
      <span id="interior-hint">拖动房间、走廊或设施。Ctrl+S 保存，Delete 删除。</span>
    </div>
    <aside class="interior-panel interior-right">
      <section>
        <h2>新增对象</h2>
        <div class="button-grid">
          <button data-interior-add="room">新增房间</button>
          <button data-interior-add="corridor">新增走廊</button>
          <button data-interior-add="facility">新增设施</button>
        </div>
      </section>
      <section>
        <h2>室内属性</h2>
        <label>名称<input id="interior-prop-name" type="text" /></label>
        <label>类型<input id="interior-prop-type" type="text" /></label>
        <label>状态<input id="interior-prop-status" type="text" /></label>
        <div class="grid-fields">
          <label>X<input id="interior-prop-x" type="number" step="1" /></label>
          <label>Z<input id="interior-prop-z" type="number" step="1" /></label>
          <label>颜色<input id="interior-prop-color" type="color" /></label>
        </div>
        <div class="grid-fields">
          <label>宽<input id="interior-prop-w" type="number" min="4" step="1" /></label>
          <label>深<input id="interior-prop-d" type="number" min="4" step="1" /></label>
          <label>类别<input id="interior-prop-kind" type="text" disabled /></label>
        </div>
        <div class="button-grid">
          <button data-interior-action="apply-element">应用室内属性</button>
          <button data-interior-action="copy-element">复制室内对象</button>
          <button data-interior-action="delete-element" class="danger">删除室内对象</button>
        </div>
      </section>
    </aside>
  `;
  app.append(shell);
  return {
    enterButton,
    shell,
    buildingName: shell.querySelector("#interior-building-name"),
    floorTitle: shell.querySelector("#interior-floor-title"),
    floorList: shell.querySelector("#interior-floor-list"),
    elementInputs: {
      name: shell.querySelector("#interior-prop-name"),
      type: shell.querySelector("#interior-prop-type"),
      status: shell.querySelector("#interior-prop-status"),
      x: shell.querySelector("#interior-prop-x"),
      z: shell.querySelector("#interior-prop-z"),
      color: shell.querySelector("#interior-prop-color"),
      w: shell.querySelector("#interior-prop-w"),
      d: shell.querySelector("#interior-prop-d"),
      kind: shell.querySelector("#interior-prop-kind")
    }
  };
}

function createSavePickerUi() {
  const shell = document.createElement("div");
  shell.id = "save-picker";
  shell.className = "save-picker";
  shell.innerHTML = `
    <div class="save-picker-card">
      <div class="save-picker-head">
        <span>ARCHIVE</span>
        <strong>选择地图存档</strong>
      </div>
      <div id="save-list" class="save-list"></div>
      <label>
        当前存档密码
        <input id="save-password" type="password" autocomplete="current-password" placeholder="无密码可留空" />
      </label>
      <div class="button-grid">
        <button id="open-save">打开存档</button>
        <button id="refresh-saves">刷新列表</button>
      </div>
      <button id="open-test-save">打开测试 JSON</button>
      <hr />
      <label>
        新存档名称
        <input id="new-save-title" type="text" placeholder="例如：第一章城市布局" />
      </label>
      <label>
        新存档密码
        <input id="new-save-password" type="password" autocomplete="new-password" placeholder="可留空" />
      </label>
      <button id="create-save">创建空白存档</button>
      <p id="save-picker-status" class="hint">请选择一个存档。带锁图标的存档需要密码，观看页也会需要密码。</p>
    </div>
  `;
  document.body.append(shell);
  return {
    shell,
    list: shell.querySelector("#save-list"),
    password: shell.querySelector("#save-password"),
    open: shell.querySelector("#open-save"),
    refresh: shell.querySelector("#refresh-saves"),
    test: shell.querySelector("#open-test-save"),
    title: shell.querySelector("#new-save-title"),
    newPassword: shell.querySelector("#new-save-password"),
    create: shell.querySelector("#create-save"),
    status: shell.querySelector("#save-picker-status"),
    selectedSaveId: null,
    saves: []
  };
}

function resize() {
  const rect = viewport.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

function addLightRig() {
  scene.add(new THREE.HemisphereLight("#9ffcf2", "#021018", 1.2));
  const key = new THREE.DirectionalLight("#bffff7", 1.8);
  key.position.set(-260, -420, 680);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#26f0df", 1.0);
  rim.position.set(380, 240, 360);
  scene.add(rim);
}

function addGrid() {
  const grid = new THREE.GridHelper(1200, 24, "#1ce7db", "#0b5c63");
  grid.name = "Locked Grid";
  grid.userData.locked = true;
  grid.material.transparent = true;
  grid.material.opacity = 0.38;
  scene.add(grid);
}

function addPlane(name, x, z, w, d, color, opacity = 0.72) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), makeMaterial(color, opacity));
  mesh.name = name;
  mesh.position.set(x, 0, z);
  mesh.userData.locked = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addRoad(name, x, z, w, d) {
  return addPlane(name, x, z, w, d, "#02070c", 0.95);
}

function addBaseMap() {
  addPlane("Locked Ground", 0, 0, 1120, 720, "#05323a", 0.82);
  addPlane("Locked Water / No Data Zone", -435, 0, 250, 720, "#064c58", 0.58);
  [-220, -70, 90, 245].forEach((z, index) => addRoad(`Locked East-West Road ${index + 1}`, 60, z, 840, 20));
  [-240, -30, 190, 390].forEach((x, index) => addRoad(`Locked North-South Road ${index + 1}`, x, 0, 22, 580));
  addRoad("Locked Main Diagonal A", 80, -10, 920, 16).rotation.y = -0.13;
  addRoad("Locked Main Diagonal B", 160, 155, 650, 16).rotation.y = 0.28;

  const hq = createGeneratedGroup({
    generator: { ...generatorDefaults.ring_hq, width: 130, depth: 130, height: 48 },
    color: "#23d8d0",
    name: "Locked HQ Ring",
    locked: true
  });
  hq.position.set(80, 0, -72);
  scene.add(hq);

  [
    [-170, -90, "SLOT-01"],
    [175, -118, "SLOT-02"],
    [360, 70, "SLOT-03"],
    [-15, 100, "SLOT-04"]
  ].forEach(([x, z, name]) => {
    const marker = createGeneratedGroup({
      generator: { ...generatorDefaults.mission_marker, width: 28, depth: 28, height: 18 },
      color: "#33e6d8",
      name,
      locked: true
    });
    marker.position.set(x, 0, z);
    scene.add(marker);
  });
}

function nextId(kind) {
  return `${kind}_${String(objectCounter++).padStart(3, "0")}`;
}

function rememberId(id) {
  const match = String(id || "").match(/_(\d+)$/);
  if (match) objectCounter = Math.max(objectCounter, Number(match[1]) + 1);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeGenerator(source = {}) {
  const type = generatorDefaults[source.type] ? source.type : "office_block";
  const base = generatorDefaults[type];
  return {
    type,
    count: Math.round(clampNumber(source.count, 1, 24, base.count)),
    width: clampNumber(source.width, 8, 180, base.width),
    depth: clampNumber(source.depth, 8, 180, base.depth),
    height: clampNumber(source.height, 4, 520, base.height),
    spacing: clampNumber(source.spacing, 0, 120, base.spacing),
    heightVariance: clampNumber(source.heightVariance ?? source.variance, 0, 1, base.heightVariance),
    seed: String(source.seed || base.seed)
  };
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function lighten(color, amount = 0.35) {
  return new THREE.Color(color).lerp(new THREE.Color("#ffffff"), amount).getStyle();
}

function makeBoxMaterials(color, opacity, westColor = null) {
  const base = makeMaterial(color, opacity);
  const west = makeMaterial(westColor || new THREE.Color(color).lerp(new THREE.Color("#8bfff5"), 0.32).getStyle(), Math.min(1, opacity + 0.08));
  return [base, west, base, base, base, base];
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => {
      material.map?.dispose?.();
      material.dispose?.();
    });
    else {
      child.material?.map?.dispose?.();
      child.material?.dispose?.();
    }
  });
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    disposeObject(child);
  }
}

function makeFootprintMaterial(opacity = 0.34) {
  return new THREE.MeshBasicMaterial({
    color: "#2fd8e6",
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function addEdges(mesh, color = "#96fff6") {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })
  );
  mesh.add(edges);
  return edges;
}

function addFacadeLines(mesh, w, d, h) {
  const lines = [];
  const floors = Math.min(16, Math.max(3, Math.floor(h / 9)));
  for (let i = 1; i < floors; i += 1) {
    const y = -h / 2 + (h / floors) * i;
    lines.push([-w / 2 - 0.08, y, -d / 2, w / 2 + 0.08, y, -d / 2]);
    lines.push([-w / 2 - 0.08, y, d / 2, w / 2 + 0.08, y, d / 2]);
  }
  const columns = Math.min(8, Math.max(2, Math.floor(w / 12)));
  for (let i = 1; i < columns; i += 1) {
    const x = -w / 2 + (w / columns) * i;
    lines.push([x, -h / 2, -d / 2 - 0.08, x, h / 2, -d / 2 - 0.08]);
    lines.push([x, -h / 2, d / 2 + 0.08, x, h / 2, d / 2 + 0.08]);
  }
  const points = lines.flatMap((line) => [new THREE.Vector3(line[0], line[1], line[2]), new THREE.Vector3(line[3], line[4], line[5])]);
  const facade = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: "#d8fffb", transparent: true, opacity: 0.28 }));
  mesh.add(facade);
}

function addWindowGrid(mesh, w, d, h) {
  if (w < 22 || d < 18 || h < 34) return;
  const rows = Math.min(14, Math.max(3, Math.floor(h / 12)));
  const cols = Math.min(10, Math.max(3, Math.floor(w / 10)));
  const geometry = new THREE.PlaneGeometry(Math.max(2.4, w / cols * 0.38), Math.max(1.8, h / rows * 0.22));
  const material = new THREE.MeshBasicMaterial({
    color: "#d8fffb",
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const count = rows * cols;
  const front = new THREE.InstancedMesh(geometry, material, count);
  const back = new THREE.InstancedMesh(geometry, material.clone(), count);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = -w * 0.42 + (w * 0.84 * col) / Math.max(1, cols - 1);
      const y = -h * 0.34 + (h * 0.68 * row) / Math.max(1, rows - 1);
      dummy.position.set(x, y, -d / 2 - 0.12);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      front.setMatrixAt(index, dummy.matrix);
      dummy.position.z = d / 2 + 0.12;
      dummy.rotation.y = Math.PI;
      dummy.updateMatrix();
      back.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  }
  front.name = "Window Grid Front";
  back.name = "Window Grid Back";
  mesh.add(front, back);
}

function addRoofDetails(mesh, w, d, h, color) {
  if (w < 18 || d < 18 || h < 22) return;
  const material = makeMaterial(lighten(color, 0.18), 0.78);
  const unitA = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, Math.max(3, h * 0.05), d * 0.18), material);
  unitA.position.set(-w * 0.22, h / 2 + Math.max(2, h * 0.025), -d * 0.18);
  unitA.userData.detail = true;
  const unitB = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, Math.max(3, h * 0.045), d * 0.14), material.clone());
  unitB.position.set(w * 0.24, h / 2 + Math.max(2, h * 0.022), d * 0.2);
  unitB.userData.detail = true;
  mesh.add(unitA, unitB);
  addEdges(unitA, "#d8fffb");
  addEdges(unitB, "#d8fffb");
}

function addBox(group, name, x, z, w, d, h, color, opacity = 0.84, westColor = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeBoxMaterials(color, opacity, westColor));
  mesh.name = name;
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  addEdges(mesh);
  addFacadeLines(mesh, w, d, h);
  addWindowGrid(mesh, w, d, h);
  addRoofDetails(mesh, w, d, h, color);
  return mesh;
}

function addCylinder(group, name, x, z, radiusTop, radiusBottom, h, segments, color, opacity = 0.84) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, h, segments), makeMaterial(color, opacity));
  mesh.name = name;
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  addEdges(mesh);
  addCylinderBands(mesh, Math.max(radiusTop, radiusBottom), h);
  return mesh;
}

function addCylinderBands(mesh, radius, h) {
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.02, 1.1, 8, 48), makeMaterial("#d8fffb", 0.42));
  topRing.rotation.x = Math.PI / 2;
  topRing.position.y = h / 2 + 0.8;
  const midRing = topRing.clone();
  midRing.position.y = Math.max(1, h * 0.18);
  mesh.add(topRing, midRing);
}

function addSpire(group, x, z, h, color = "#d8fffb") {
  const spire = new THREE.Mesh(new THREE.ConeGeometry(8, h, 5), makeMaterial(color, 0.7));
  spire.name = "Spire";
  spire.position.set(x, h / 2, z);
  group.add(spire);
  addEdges(spire, "#d8fffb");
  return spire;
}

function addTruck(group, name, x, z, length = 26, color = "#31d4c8") {
  const truck = new THREE.Group();
  truck.name = name;
  addBox(truck, "Trailer", 0, 0, length, 11, 9, color, 0.78);
  addBox(truck, "Cab", length * 0.42, 0, 9, 11, 8, lighten(color, 0.16), 0.82);
  [-length * 0.32, length * 0.12, length * 0.42].forEach((wheelX) => {
    addCylinder(truck, "Wheel", wheelX, -6.2, 2, 2, 2, 12, "#06262c", 0.95).rotation.z = Math.PI / 2;
    addCylinder(truck, "Wheel", wheelX, 6.2, 2, 2, 2, 12, "#06262c", 0.95).rotation.z = Math.PI / 2;
  });
  truck.position.set(x, 0, z);
  group.add(truck);
  return truck;
}

function addRedCross(group, name, x, z, size, y) {
  const cross = new THREE.Group();
  cross.name = name;
  addBox(cross, "Cross Vertical", 0, 0, size * 0.28, size, size * 0.12, "#ff3d45", 0.95);
  addBox(cross, "Cross Horizontal", 0, 0, size, size * 0.28, size * 0.12, "#ff3d45", 0.95);
  cross.position.set(x, y, z);
  group.add(cross);
  return cross;
}

function addFence(group, w, d, color = "#8bfff5") {
  const postCountX = 8;
  const postCountZ = 6;
  for (let i = 0; i < postCountX; i += 1) {
    const x = -w / 2 + (w * i) / (postCountX - 1);
    addBox(group, `Fence Post N ${i + 1}`, x, -d / 2, 3, 3, 12, color, 0.5);
    addBox(group, `Fence Post S ${i + 1}`, x, d / 2, 3, 3, 12, color, 0.5);
  }
  for (let i = 0; i < postCountZ; i += 1) {
    const z = -d / 2 + (d * i) / (postCountZ - 1);
    addBox(group, `Fence Post W ${i + 1}`, -w / 2, z, 3, 3, 12, color, 0.5);
    addBox(group, `Fence Post E ${i + 1}`, w / 2, z, 3, 3, 12, color, 0.5);
  }
  addBox(group, "Fence Rail North", 0, -d / 2, w, 2, 4, color, 0.36).position.y = 9;
  addBox(group, "Fence Rail South", 0, d / 2, w, 2, 4, color, 0.36).position.y = 9;
  addBox(group, "Fence Rail West", -w / 2, 0, 2, d, 4, color, 0.36).position.y = 9;
  addBox(group, "Fence Rail East", w / 2, 0, 2, d, 4, color, 0.36).position.y = 9;
}

function addDish(group, name, x, z, radius, y, color = "#d8fffb") {
  const dish = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial(color, 0.52));
  dish.name = name;
  dish.position.set(x, y, z);
  dish.rotation.x = Math.PI * 0.2;
  dish.scale.y = 0.28;
  group.add(dish);
  addEdges(dish, "#ffffff");
  addCylinder(group, `${name} Mast`, x, z, radius * 0.09, radius * 0.12, y, 12, color, 0.42);
  return dish;
}

function buildOfficeBlock(group, generator, color, random) {
  const columns = Math.ceil(Math.sqrt(generator.count));
  const rows = Math.ceil(generator.count / columns);
  const stepX = generator.width + generator.spacing;
  const stepZ = generator.depth + generator.spacing;
  for (let i = 0; i < generator.count; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = (col - (columns - 1) / 2) * stepX;
    const z = (row - (rows - 1) / 2) * stepZ;
    const h = generator.height * (1 - generator.heightVariance / 2 + random() * generator.heightVariance);
    addBox(group, `Office Block ${i + 1}`, x, z, generator.width, generator.depth, h, color);
    if (h > 48) addBox(group, `Roof Unit ${i + 1}`, x, z, generator.width * 0.52, generator.depth * 0.42, Math.max(5, h * 0.08), lighten(color, 0.2), 0.78).position.y = h + Math.max(3, h * 0.04);
  }
}

function buildDenseCityBlock(group, generator, color, random) {
  const columns = Math.ceil(Math.sqrt(generator.count * 1.35));
  const stepX = generator.width + generator.spacing;
  const stepZ = generator.depth + generator.spacing;
  for (let i = 0; i < generator.count; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = (col - (columns - 1) / 2) * stepX + (random() - 0.5) * generator.spacing;
    const z = (row - 1.5) * stepZ + (random() - 0.5) * generator.spacing;
    const h = generator.height * (0.45 + random() * (0.35 + generator.heightVariance));
    addBox(group, `City Lot ${i + 1}`, x, z, generator.width * (0.75 + random() * 0.45), generator.depth * (0.7 + random() * 0.5), h, color, 0.58);
  }
}

function buildLongOfficeBar(group, generator, color, random) {
  const step = generator.depth + generator.spacing;
  for (let i = 0; i < generator.count; i += 1) {
    const z = (i - (generator.count - 1) / 2) * step;
    const h = generator.height * (0.75 + random() * generator.heightVariance);
    addBox(group, `Office Bar ${i + 1}`, 0, z, generator.width, generator.depth, h, i % 2 ? lighten(color, 0.08) : color, 0.66);
  }
}

function buildTwinTowers(group, generator, color) {
  const distance = generator.width + generator.spacing;
  addBox(group, "Podium", 0, 0, distance * 2.1, generator.depth * 1.35, generator.height * 0.22, "#126a68", 0.8);
  addBox(group, "Tower A", -distance / 2, 0, generator.width, generator.depth, generator.height, color);
  addBox(group, "Tower B", distance / 2, 0, generator.width, generator.depth, generator.height * 0.92, lighten(color, 0.15));
  addBox(group, "Sky Bridge", 0, 0, distance * 0.72, generator.depth * 0.34, generator.height * 0.08, "#73fff2", 0.72).position.y = generator.height * 0.58;
}

function buildTowerCluster(group, generator, color, random) {
  const radius = Math.max(generator.width, generator.depth) + generator.spacing;
  for (let i = 0; i < generator.count; i += 1) {
    const angle = (i / generator.count) * Math.PI * 2 + random() * 0.35;
    const distance = radius * (0.25 + random() * 1.25);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance * 0.74;
    const h = generator.height * (0.72 + random() * generator.heightVariance + 0.18);
    addCylinder(group, `Cluster Tower ${i + 1}`, x, z, generator.width / 2, generator.depth / 2, h, 8, i % 2 ? lighten(color, 0.18) : color);
  }
}

function buildPodiumComplex(group, generator, color, random) {
  const podiumH = Math.max(12, generator.height * 0.22);
  addBox(group, "Wide Podium", 0, 0, generator.width * 2.8, generator.depth * 1.8, podiumH, "#114f58", 0.84);
  const count = Math.max(2, generator.count);
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const x = (t - 0.5) * generator.width * 2.0;
    const z = (random() - 0.5) * generator.depth * 0.65;
    const h = generator.height * (0.52 + random() * Math.max(0.18, generator.heightVariance));
    const block = addBox(group, `Upper Mass ${i + 1}`, x, z, generator.width * (0.55 + random() * 0.35), generator.depth * 0.72, h, i % 2 ? color : lighten(color, 0.12));
    block.position.y = podiumH + h / 2;
  }
}

function buildDispatchCompound(group, generator, color, random) {
  const padColor = new THREE.Color(color).lerp(new THREE.Color("#d8fffb"), 0.18).getStyle();
  addBox(group, "Dispatch Pad", 0, 0, generator.width * 2.4, generator.depth * 1.65, Math.max(8, generator.height * 0.16), "#0b6d72", 0.7);
  addBox(group, "Command Block", -generator.width * 0.42, 0, generator.width * 0.85, generator.depth * 0.9, generator.height, color, 0.82, padColor);
  addBox(group, "Support Block", generator.width * 0.52, -generator.depth * 0.18, generator.width * 0.72, generator.depth * 0.68, generator.height * 0.62, lighten(color, 0.1), 0.78, padColor);
  for (let i = 0; i < Math.max(1, generator.count - 2); i += 1) {
    const x = (random() - 0.5) * generator.width * 1.8;
    const z = generator.depth * (0.58 + random() * 0.32);
    addBox(group, `Annex ${i + 1}`, x, z, generator.width * 0.36, generator.depth * 0.34, generator.height * (0.32 + random() * 0.28), color, 0.72, padColor);
  }
}

function buildCircularFacility(group, generator, color) {
  const radius = Math.max(generator.width, generator.depth) * 0.42;
  addCylinder(group, "Circular Base", 0, 0, radius, radius, generator.height * 0.35, 48, "#0b6d72", 0.62);
  addCylinder(group, "Circular Core", 0, 0, radius * 0.42, radius * 0.5, generator.height, 32, color, 0.78);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, 2.5, 10, 80), makeMaterial(lighten(color, 0.18), 0.86));
  ring.name = "Facility Ring";
  ring.rotation.x = Math.PI / 2;
  ring.position.y = generator.height * 0.42;
  group.add(ring);
}

function buildRingHq(group, generator, color) {
  const radius = Math.max(generator.width, generator.depth) * 0.42;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 3, 12, 96), makeMaterial(color, 0.92));
  ring.name = "HQ Ring";
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 6;
  group.add(ring);
  addCylinder(group, "HQ Core", 0, 0, generator.width * 0.18, generator.depth * 0.22, generator.height, 28, "#159a93", 0.86);
  addBox(group, "Command Wing A", -radius * 0.72, 0, generator.width * 0.28, generator.depth * 0.18, generator.height * 0.46, color, 0.72);
  addBox(group, "Command Wing B", radius * 0.72, 0, generator.width * 0.28, generator.depth * 0.18, generator.height * 0.46, color, 0.72);
}

function buildMissionMarker(group, generator, color) {
  addCylinder(group, "Marker Base", 0, 0, generator.width / 2, generator.depth / 2, Math.max(8, generator.height * 0.22), 32, color, 0.92);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(generator.width * 0.28, Math.max(18, generator.height), 4),
    makeMaterial("#8bfff5", 0.5)
  );
  beam.name = "Marker Beam";
  beam.position.y = generator.height * 0.68;
  beam.rotation.y = Math.PI / 4;
  group.add(beam);
}

function buildLibrary(group, generator, color, random) {
  addBox(group, "Library Plaza", 0, 0, generator.width * 2.2, generator.depth * 1.5, 8, "#0b6d72", 0.58);
  addBox(group, "Archive Hall", -generator.width * 0.35, 0, generator.width, generator.depth, generator.height, color, 0.82);
  addBox(group, "Reading Wing", generator.width * 0.5, -generator.depth * 0.22, generator.width * 0.75, generator.depth * 0.72, generator.height * 0.72, lighten(color, 0.12), 0.78);
  addCylinder(group, "Data Atrium", generator.width * 0.28, generator.depth * 0.38, generator.width * 0.18, generator.width * 0.22, generator.height * 0.58, 28, "#159a93", 0.72);
  for (let i = 0; i < generator.count; i += 1) {
    addBox(group, `Archive Stack ${i + 1}`, -generator.width * 0.82 + i * generator.width * 0.28, generator.depth * 0.55, 8, generator.depth * 0.42, generator.height * (0.35 + random() * 0.18), "#8bfff5", 0.35);
  }
}

function buildMegaHqTower(group, generator, color) {
  addBox(group, "Mega HQ Base", 0, 0, generator.width * 1.45, generator.depth * 1.3, generator.height * 0.16, "#0b6d72", 0.72);
  addBox(group, "Lower Command Mass", -generator.width * 0.12, 0, generator.width * 0.95, generator.depth * 0.82, generator.height * 0.38, color, 0.8);
  addBox(group, "Offset Core", generator.width * 0.08, -generator.depth * 0.04, generator.width * 0.68, generator.depth * 0.62, generator.height * 0.64, lighten(color, 0.1), 0.8).position.y = generator.height * 0.35;
  addBox(group, "Upper Blade", -generator.width * 0.1, generator.depth * 0.08, generator.width * 0.42, generator.depth * 0.42, generator.height * 0.76, color, 0.82).position.y = generator.height * 0.72;
  addSpire(group, -generator.width * 0.1, generator.depth * 0.08, generator.height * 0.42);
  group.children.at(-1).position.y = generator.height * 1.45;
}

function buildRocketLaunchSite(group, generator, color) {
  const rocketRadius = generator.width * 0.075;
  addBox(group, "Launch Apron", 0, 0, generator.width * 1.65, generator.depth * 1.55, 8, "#0b6d72", 0.58);
  addBox(group, "Flame Trench", 0, generator.depth * 0.28, generator.width * 0.26, generator.depth * 0.62, 6, "#06262c", 0.9);
  addCylinder(group, "Launch Clamp Ring", 0, 0, generator.width * 0.22, generator.width * 0.27, 18, 48, color, 0.64);

  const towerX = -generator.width * 0.34;
  addBox(group, "Service Tower Core", towerX, 0, generator.width * 0.1, generator.depth * 0.12, generator.height * 0.88, "#159a93", 0.68);
  for (let i = 0; i < 4; i += 1) {
    const y = generator.height * (0.2 + i * 0.16);
    const arm = addBox(group, `Service Arm ${i + 1}`, towerX * 0.48, 0, Math.abs(towerX) * 0.82, generator.depth * 0.045, generator.height * 0.025, "#8bfff5", 0.46);
    arm.position.y = y;
  }
  addSpire(group, towerX, 0, generator.height * 0.18, "#8bfff5").position.y = generator.height * 0.92;

  const lower = addCylinder(group, "First Stage", 0, 0, rocketRadius * 0.96, rocketRadius, generator.height * 0.48, 36, "#d8fffb", 0.82);
  lower.position.y = generator.height * 0.3;
  const upper = addCylinder(group, "Second Stage", 0, 0, rocketRadius * 0.78, rocketRadius * 0.86, generator.height * 0.28, 36, "#bafff7", 0.8);
  upper.position.y = generator.height * 0.68;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(rocketRadius * 0.86, generator.height * 0.14, 36), makeMaterial("#8bfff5", 0.84));
  nose.name = "Payload Fairing";
  nose.position.set(0, generator.height * 0.89, 0);
  group.add(nose);
  addEdges(nose, "#ffffff");

  [-1, 1].forEach((side) => {
    const booster = addCylinder(group, `Side Booster ${side}`, side * rocketRadius * 1.65, 0, rocketRadius * 0.42, rocketRadius * 0.46, generator.height * 0.42, 24, "#9ffff5", 0.7);
    booster.position.y = generator.height * 0.28;
    const fin = addBox(group, `Rocket Fin ${side}`, side * rocketRadius * 1.2, -rocketRadius * 0.95, rocketRadius * 0.22, rocketRadius * 0.22, generator.height * 0.12, color, 0.82);
    fin.rotation.y = side * 0.55;
  });
  [-1, 0, 1].forEach((slot) => {
    const engine = addCylinder(group, `Engine Bell ${slot}`, slot * rocketRadius * 0.55, rocketRadius * 0.34, rocketRadius * 0.22, rocketRadius * 0.34, generator.height * 0.045, 20, "#06262c", 0.92);
    engine.position.y = generator.height * 0.055;
  });
}

function buildPort(group, generator, color, random) {
  addBox(group, "Harbor Water", 0, generator.depth * 0.62, generator.width * 3.3, generator.depth * 1.18, 3, "#064c58", 0.48);
  addBox(group, "Main Pier Deck", 0, -generator.depth * 0.08, generator.width * 2.85, generator.depth * 0.52, 9, "#0b6d72", 0.72);
  addBox(group, "Harbor Warehouse", -generator.width * 0.8, -generator.depth * 0.55, generator.width * 0.95, generator.depth * 0.7, generator.height, color, 0.78);
  addBox(group, "Customs Block", generator.width * 0.28, -generator.depth * 0.54, generator.width * 0.62, generator.depth * 0.48, generator.height * 0.72, lighten(color, 0.1), 0.76);
  for (let i = 0; i < generator.count; i += 1) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = (col - 2) * generator.width * 0.28;
    const z = -generator.depth * 0.05 + row * generator.depth * 0.18;
    addBox(group, `Container Stack ${i + 1}`, x, z, generator.width * 0.22, generator.depth * 0.14, generator.height * (0.34 + random() * 0.24), i % 2 ? lighten(color, 0.14) : "#159a93", 0.72);
  }
  addBox(group, "Crane Rail", generator.width * 0.78, generator.depth * 0.18, generator.width * 0.08, generator.depth * 1.25, generator.height * 0.12, "#8bfff5", 0.5);
  addBox(group, "Gantry Crane A", generator.width * 0.78, generator.depth * 0.1, generator.width * 0.42, generator.depth * 0.05, generator.height * 0.86, "#8bfff5", 0.44).position.y = generator.height * 0.45;
  addBox(group, "Gantry Crane B", generator.width * 1.05, generator.depth * 0.36, generator.width * 0.38, generator.depth * 0.05, generator.height * 0.68, "#8bfff5", 0.38).position.y = generator.height * 0.36;
}

function buildFreightDepot(group, generator, color) {
  addBox(group, "Sorting Warehouse", -generator.width * 0.55, 0, generator.width * 1.55, generator.depth * 1.25, generator.height, color, 0.78);
  addBox(group, "Cross Dock Hall", generator.width * 0.15, -generator.depth * 0.58, generator.width * 1.25, generator.depth * 0.42, generator.height * 0.58, lighten(color, 0.08), 0.76);
  addBox(group, "Truck Yard", generator.width * 0.95, 0, generator.width * 1.65, generator.depth * 2.15, 5, "#0b6d72", 0.56);
  for (let dock = 0; dock < 7; dock += 1) {
    addBox(group, `Loading Door ${dock + 1}`, -generator.width * 0.98 + dock * generator.width * 0.18, generator.depth * 0.68, generator.width * 0.1, generator.depth * 0.06, generator.height * 0.16, "#8bfff5", 0.42);
  }
  for (let i = 0; i < generator.count; i += 1) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = generator.width * 0.38 + col * generator.width * 0.34;
    const z = (row - 0.8) * generator.depth * 0.48;
    addBox(group, `Parking Slot ${i + 1}`, x, z, generator.width * 0.25, generator.depth * 0.12, 1.5, "#8bfff5", 0.28);
    const truck = addTruck(group, `Truck ${i + 1}`, x, z, generator.width * 0.3, i % 2 ? lighten(color, 0.12) : color);
    truck.rotation.y = Math.PI / 2;
  }
}

function buildWarehouse(group, generator, color, random) {
  addBox(group, "Warehouse Yard", 0, 0, generator.width * 2.35, generator.depth * 1.65, 5, "#0b6d72", 0.56);
  addBox(group, "Main Warehouse", -generator.width * 0.28, 0, generator.width * 1.55, generator.depth, generator.height, color, 0.78);
  addBox(group, "Cold Storage Wing", generator.width * 0.72, -generator.depth * 0.22, generator.width * 0.7, generator.depth * 0.66, generator.height * 0.82, lighten(color, 0.12), 0.74);
  for (let i = 0; i < generator.count; i += 1) {
    const x = -generator.width * 0.95 + i * generator.width * 0.38;
    const z = generator.depth * 0.72;
    addBox(group, `Dock Bay ${i + 1}`, x, z, generator.width * 0.24, generator.depth * 0.12, generator.height * (0.18 + random() * 0.08), "#8bfff5", 0.4);
  }
  addBox(group, "Solar Roof A", -generator.width * 0.34, -generator.depth * 0.18, generator.width * 0.85, generator.depth * 0.18, 3, "#d8fffb", 0.35).position.y = generator.height + 4;
  addBox(group, "Solar Roof B", -generator.width * 0.34, generator.depth * 0.14, generator.width * 0.85, generator.depth * 0.18, 3, "#d8fffb", 0.35).position.y = generator.height + 4;
}

function buildResearchLab(group, generator, color, random) {
  addBox(group, "Research Campus Base", 0, 0, generator.width * 2.05, generator.depth * 1.72, Math.max(10, generator.height * 0.14), "#0b6d72", 0.62);
  addBox(group, "Main Lab Slab", -generator.width * 0.26, 0, generator.width * 1.15, generator.depth * 0.92, generator.height * 0.72, color, 0.78);
  addBox(group, "Containment Wing", generator.width * 0.62, -generator.depth * 0.24, generator.width * 0.7, generator.depth * 0.62, generator.height * 0.92, lighten(color, 0.12), 0.76);
  addCylinder(group, "Experiment Core", generator.width * 0.42, generator.depth * 0.34, generator.width * 0.22, generator.width * 0.28, generator.height * 1.16, 32, "#159a93", 0.72);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(generator.width * 0.28, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), makeMaterial("#8bfff5", 0.48));
  dome.name = "Research Dome";
  dome.position.set(-generator.width * 0.55, generator.height * 0.72, generator.depth * 0.28);
  dome.scale.y = 0.48;
  group.add(dome);
  addEdges(dome, "#d8fffb");
  const ring = new THREE.Mesh(new THREE.TorusGeometry(generator.width * 0.34, 2.2, 8, 80), makeMaterial("#8bfff5", 0.62));
  ring.name = "Accelerator Ring";
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, generator.height * 0.34, -generator.depth * 0.5);
  group.add(ring);
  for (let i = 0; i < generator.count; i += 1) {
    const angle = (i / generator.count) * Math.PI * 2;
    addCylinder(group, `Sensor Mast ${i + 1}`, Math.cos(angle) * generator.width * 0.82, Math.sin(angle) * generator.depth * 0.58, 3.5, 5.5, generator.height * (0.34 + random() * 0.2), 12, "#d8fffb", 0.54);
  }
}

function buildHospital(group, generator, color, random) {
  const baseW = generator.width * 2.15;
  const baseD = generator.depth * 1.72;
  addBox(group, "Hospital Campus Pad", 0, 0, baseW, baseD, 6, "#0b6d72", 0.54);
  addFence(group, baseW * 1.05, baseD * 1.08);
  addBox(group, "Main Hospital Block", -generator.width * 0.28, 0, generator.width * 1.12, generator.depth * 0.92, generator.height, color, 0.78, "#eaffff");
  addBox(group, "Emergency Wing", generator.width * 0.62, -generator.depth * 0.28, generator.width * 0.78, generator.depth * 0.56, generator.height * 0.68, lighten(color, 0.14), 0.76, "#eaffff");
  addBox(group, "Inpatient Tower", -generator.width * 0.62, generator.depth * 0.34, generator.width * 0.56, generator.depth * 0.48, generator.height * 1.28, color, 0.78, "#eaffff");
  addBox(group, "Ambulance Court", generator.width * 0.58, generator.depth * 0.42, generator.width * 0.72, generator.depth * 0.36, 4, "#06262c", 0.82);
  addRedCross(group, "Roof Red Cross", -generator.width * 0.28, 0, generator.width * 0.34, generator.height + 9);
  addRedCross(group, "Emergency Red Cross", generator.width * 0.62, -generator.depth * 0.28, generator.width * 0.22, generator.height * 0.68 + 8);
  for (let i = 0; i < generator.count; i += 1) {
    const x = generator.width * (0.28 + random() * 0.62);
    const z = generator.depth * (0.2 + random() * 0.48);
    addTruck(group, `Ambulance ${i + 1}`, x, z, generator.width * 0.22, i % 2 ? "#ff3d45" : "#d8fffb").scale.set(0.9, 0.9, 0.9);
  }
}

function buildNasaResearch(group, generator, color, random) {
  const baseW = generator.width * 2.25;
  const baseD = generator.depth * 1.82;
  addBox(group, "NASA Research Campus", 0, 0, baseW, baseD, 7, "#0b6d72", 0.56);
  addBox(group, "Aerospace Lab", -generator.width * 0.42, -generator.depth * 0.08, generator.width * 1.08, generator.depth * 0.82, generator.height, "#d8fffb", 0.76, color);
  addBox(group, "Mission Control Wing", generator.width * 0.55, -generator.depth * 0.38, generator.width * 0.88, generator.depth * 0.48, generator.height * 0.58, color, 0.76, "#eaffff");
  addBox(group, "Thermal Test Hall", generator.width * 0.42, generator.depth * 0.38, generator.width * 0.78, generator.depth * 0.62, generator.height * 0.74, lighten(color, 0.16), 0.72);
  addCylinder(group, "Wind Tunnel", -generator.width * 0.58, generator.depth * 0.44, generator.width * 0.18, generator.width * 0.24, generator.height * 0.64, 32, "#159a93", 0.64).rotation.z = Math.PI / 2;
  addDish(group, "Deep Space Dish A", generator.width * 0.96, generator.depth * 0.36, generator.width * 0.18, generator.height * 0.58);
  addDish(group, "Deep Space Dish B", generator.width * 0.92, -generator.depth * 0.04, generator.width * 0.13, generator.height * 0.42);
  addBox(group, "Blue Insignia Bar", -generator.width * 0.42, -generator.depth * 0.52, generator.width * 0.88, generator.depth * 0.06, generator.height * 0.08, "#2f7dff", 0.82).position.y = generator.height * 0.72;
  addBox(group, "Red Vector Bar", -generator.width * 0.12, -generator.depth * 0.53, generator.width * 0.52, generator.depth * 0.035, generator.height * 0.05, "#ff3d45", 0.86).rotation.y = -0.28;
  for (let i = 0; i < generator.count; i += 1) {
    const x = -generator.width * 0.96 + i * generator.width * 0.24;
    addBox(group, `Research Module ${i + 1}`, x, generator.depth * 0.76, generator.width * 0.18, generator.depth * 0.22, generator.height * (0.22 + random() * 0.16), color, 0.64);
  }
}

function buildResidentialDistrict(group, generator, color, random) {
  const rows = Math.ceil(generator.count / 4);
  addBox(group, "Residential Block Ground", 0, 0, generator.width * 5.3, generator.depth * (rows + 0.8), 5, "#0b6d72", 0.48);
  addBox(group, "Community Courtyard", 0, 0, generator.width * 1.9, generator.depth * 1.2, 4, "#159a93", 0.38);
  for (let i = 0; i < generator.count; i += 1) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = (col - 1.5) * (generator.width + generator.spacing);
    const z = (row - (rows - 1) / 2) * (generator.depth + generator.spacing);
    const h = generator.height * (0.72 + random() * generator.heightVariance);
    const w = generator.width * (0.88 + random() * 0.18);
    const d = generator.depth * (0.86 + random() * 0.18);
    addBox(group, `Residential Tower ${i + 1}`, x, z, w, d, h, i % 2 ? lighten(color, 0.1) : color, 0.68, "#d8fffb");
  }
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    addCylinder(group, `Courtyard Light ${i + 1}`, Math.cos(angle) * generator.width * 1.25, Math.sin(angle) * generator.depth * 0.72, 2.4, 3.2, 18, 10, "#8bfff5", 0.46);
  }
}

function rebuildGeneratedGroup(group, generatorSource, colorSource) {
  const generator = normalizeGenerator(generatorSource);
  const color = colorSource || group.userData.color || "#25c9be";
  clearGroup(group);
  const random = makeRandom(generator.seed);
  if (generator.type === "office_block") buildOfficeBlock(group, generator, color, random);
  if (generator.type === "dense_city_block") buildDenseCityBlock(group, generator, color, random);
  if (generator.type === "long_office_bar") buildLongOfficeBar(group, generator, color, random);
  if (generator.type === "twin_towers") buildTwinTowers(group, generator, color, random);
  if (generator.type === "tower_cluster") buildTowerCluster(group, generator, color, random);
  if (generator.type === "podium_complex") buildPodiumComplex(group, generator, color, random);
  if (generator.type === "dispatch_compound") buildDispatchCompound(group, generator, color, random);
  if (generator.type === "circular_facility") buildCircularFacility(group, generator, color, random);
  if (generator.type === "ring_hq") buildRingHq(group, generator, color, random);
  if (generator.type === "mission_marker") buildMissionMarker(group, generator, color, random);
  if (generator.type === "library") buildLibrary(group, generator, color, random);
  if (generator.type === "mega_hq_tower") buildMegaHqTower(group, generator, color, random);
  if (generator.type === "rocket_launch_site") buildRocketLaunchSite(group, generator, color, random);
  if (generator.type === "port") buildPort(group, generator, color, random);
  if (generator.type === "freight_depot") buildFreightDepot(group, generator, color, random);
  if (generator.type === "warehouse") buildWarehouse(group, generator, color, random);
  if (generator.type === "research_lab") buildResearchLab(group, generator, color, random);
  if (generator.type === "hospital") buildHospital(group, generator, color, random);
  if (generator.type === "nasa_research") buildNasaResearch(group, generator, color, random);
  if (generator.type === "residential_district") buildResidentialDistrict(group, generator, color, random);
  addFootprint(group);
  updateNameplate(group);
  group.userData.generator = generator;
  group.userData.color = color;
  group.userData.kind = "generated_building";
  group.userData.dimensions = estimateDimensions(group);
}

function createGeneratedGroup({ generator, color, name, locked = false, preview = false, showNameplate = false } = {}) {
  const normalized = normalizeGenerator(generator);
  const group = new THREE.Group();
  group.name = name || nextId(normalized.type);
  group.userData.id = group.name;
  group.userData.locked = locked;
  group.userData.preview = preview;
  group.userData.nonExport = preview;
  group.userData.showNameplate = showNameplate;
  rebuildGeneratedGroup(group, normalized, color || createInputs.color.value || "#25c9be");
  if (preview) makePreview(group);
  if (!locked && !preview) editableGroup.add(group);
  return group;
}

function makePreview(group) {
  group.traverse((child) => {
    if (child.material) {
      const wasArray = Array.isArray(child.material);
      const materials = wasArray ? child.material : [child.material];
      child.material = materials.map((material) => {
        const clone = material.clone();
        clone.transparent = true;
        clone.opacity = Math.min(clone.opacity ?? 1, 0.42);
        clone.depthWrite = false;
        return clone;
      });
      if (!wasArray) child.material = child.material[0];
    }
  });
}

function estimateDimensions(object) {
  const box = measureBuiltBounds(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return [Math.round(size.x), Math.round(size.z), Math.round(size.y)];
}

function measureBuiltBounds(object) {
  const box = new THREE.Box3();
  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    if (!child.isMesh || child.userData.footprint || child.userData.overlapZone || child.userData.nameplate) return;
    const childBox = new THREE.Box3().setFromObject(child);
    box.union(childBox);
  });
  return box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 1, 10)) : box;
}

function measureLocalBuiltBounds(group) {
  const box = new THREE.Box3();
  group.children.forEach((child) => {
    if (!child.isMesh || child.userData.footprint || child.userData.overlapZone || child.userData.nameplate) return;
    child.geometry.computeBoundingBox();
    const childBox = child.geometry.boundingBox.clone().applyMatrix4(child.matrix);
    box.union(childBox);
  });
  return box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 1, 10)) : box;
}

function addFootprint(group) {
  const bounds = measureLocalBuiltBounds(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const pad = 14;
  const footprint = new THREE.Mesh(new THREE.BoxGeometry(size.x + pad * 2, 1, size.z + pad * 2), makeFootprintMaterial());
  footprint.name = "Occupied Footprint";
  footprint.position.set(center.x, 0.35, center.z);
  footprint.renderOrder = -1;
  footprint.userData.footprint = true;
  group.add(footprint);
  addEdges(footprint, "#73fff2");
  addSiteGuide(group, center, size, pad);
  group.userData.footprint = { width: size.x + pad * 2, depth: size.z + pad * 2 };
}

function addSiteGuide(group, center, size, pad) {
  const material = makeFootprintMaterial(0.2);
  const pathA = new THREE.Mesh(new THREE.BoxGeometry(size.x + pad, 0.6, 3), material);
  const pathB = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, size.z + pad), material.clone());
  pathA.position.set(center.x, 1.05, center.z);
  pathB.position.set(center.x, 1.08, center.z);
  pathA.userData.footprint = true;
  pathB.userData.footprint = true;
  group.add(pathA, pathB);
}

function getFootprintBox(object) {
  const footprint = object.children.find((child) => child.userData.footprint);
  return footprint ? new THREE.Box3().setFromObject(footprint) : null;
}

function updateFootprintOverlaps() {
  clearGroup(overlapGroup);
  updateGroundExtensions();
  const items = editableGroup.children.map((object) => ({ object, box: getFootprintBox(object) })).filter((item) => item.box);
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (items[i].object.userData.generator?.type === items[j].object.userData.generator?.type) continue;
      addOverlapZone(items[i].box, items[j].box);
    }
  }
}

function addOverlapZone(a, b) {
  const minX = Math.max(a.min.x, b.min.x);
  const maxX = Math.min(a.max.x, b.max.x);
  const minZ = Math.max(a.min.z, b.min.z);
  const maxZ = Math.min(a.max.z, b.max.z);
  if (maxX <= minX || maxZ <= minZ) return;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 1.2, maxZ - minZ), makeFootprintMaterial(0.5));
  mesh.name = "Unbuilt Overlap Zone";
  mesh.position.set((minX + maxX) / 2, 0.55, (minZ + maxZ) / 2);
  mesh.userData.overlapZone = true;
  mesh.userData.nonExport = true;
  overlapGroup.add(mesh);
  addEdges(mesh, "#d8fffb");
}

function updateGroundExtensions() {
  clearGroup(extensionGroup);
  const boxes = editableGroup.children.map(getFootprintBox).filter(Boolean);
  if (!boxes.length) return;
  const bounds = boxes.reduce((acc, box) => acc.union(box), new THREE.Box3());
  const margin = 80;
  const minX = Math.min(BASE_BOUNDS.minX, bounds.min.x - margin);
  const maxX = Math.max(BASE_BOUNDS.maxX, bounds.max.x + margin);
  const minZ = Math.min(BASE_BOUNDS.minZ, bounds.min.z - margin);
  const maxZ = Math.max(BASE_BOUNDS.maxZ, bounds.max.z + margin);
  if (maxZ > BASE_BOUNDS.maxZ) addExtensionRect((minX + maxX) / 2, (BASE_BOUNDS.maxZ + maxZ) / 2, maxX - minX, maxZ - BASE_BOUNDS.maxZ);
  if (minZ < BASE_BOUNDS.minZ) addExtensionRect((minX + maxX) / 2, (minZ + BASE_BOUNDS.minZ) / 2, maxX - minX, BASE_BOUNDS.minZ - minZ);
  if (maxX > BASE_BOUNDS.maxX) addExtensionRect((BASE_BOUNDS.maxX + maxX) / 2, 0, maxX - BASE_BOUNDS.maxX, BASE_BOUNDS.maxZ - BASE_BOUNDS.minZ);
  if (minX < BASE_BOUNDS.minX) addExtensionRect((minX + BASE_BOUNDS.minX) / 2, 0, BASE_BOUNDS.minX - minX, BASE_BOUNDS.maxZ - BASE_BOUNDS.minZ);
}

function addExtensionRect(x, z, w, d) {
  if (w <= 1 || d <= 1) return;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), new THREE.MeshBasicMaterial({ color: "#05323a", transparent: true, opacity: 0.48, depthWrite: false }));
  mesh.name = "Extended Ground";
  mesh.position.set(x, -0.65, z);
  mesh.userData.nonExport = true;
  extensionGroup.add(mesh);
  addEdges(mesh, "#1ce7db");
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

function updateNameplate(group) {
  const old = group.children.find((child) => child.userData.nameplate);
  if (old) {
    group.remove(old);
    disposeObject(old);
  }
  if (!group.name || !group.userData.showNameplate || group.userData.preview || group.userData.locked) return;
  const bounds = measureLocalBuiltBounds(group);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeNameplateTexture(group.name),
    transparent: true,
    depthTest: false,
    depthWrite: false
  }));
  sprite.name = "Nameplate";
  sprite.position.set(center.x, bounds.max.y + 118, center.z);
  sprite.scale.set(Math.max(130, Math.min(230, group.name.length * 22)), 116, 1);
  sprite.renderOrder = 1000;
  sprite.userData.nameplate = true;
  sprite.userData.nonExport = true;
  group.add(sprite);
}

function readGeneratorFromCreatePanel() {
  return normalizeGenerator({
    type: createInputs.type.value,
    count: createInputs.count.value,
    width: createInputs.width.value,
    depth: createInputs.depth.value,
    height: createInputs.height.value,
    spacing: createInputs.spacing.value,
    heightVariance: createInputs.variance.value,
    seed: createInputs.seed.value
  });
}

function readGeneratorFromInspector() {
  return normalizeGenerator({
    type: inputs.genType.value,
    count: inputs.genCount.value,
    width: inputs.genWidth.value,
    depth: inputs.genDepth.value,
    height: inputs.genHeight.value,
    spacing: inputs.genSpacing.value,
    heightVariance: inputs.genVariance.value,
    seed: inputs.genSeed.value
  });
}

function writeCreateDefaultsForType(type) {
  const next = normalizeGenerator({ ...generatorDefaults[type], seed: createInputs.seed.value || generatorDefaults[type].seed });
  createInputs.count.value = next.count;
  createInputs.width.value = next.width;
  createInputs.depth.value = next.depth;
  createInputs.height.value = next.height;
  createInputs.spacing.value = next.spacing;
  createInputs.variance.value = next.heightVariance;
}

function writeGeneratorToInspector(generator) {
  const normalized = normalizeGenerator(generator);
  inputs.genType.value = normalized.type;
  inputs.genCount.value = normalized.count;
  inputs.genWidth.value = normalized.width;
  inputs.genDepth.value = normalized.depth;
  inputs.genHeight.value = normalized.height;
  inputs.genSpacing.value = normalized.spacing;
  inputs.genVariance.value = normalized.heightVariance;
  inputs.genSeed.value = normalized.seed;
}

function setInspectorEnabled(enabled) {
  Object.values(inputs).forEach((input) => {
    input.disabled = !enabled || input === inputs.kind;
  });
  ["apply-props", "regenerate-object", "copy-object", "reset-rotation", "stick-ground", "delete-object"].forEach((id) => {
    document.querySelector(`#${id}`).disabled = !enabled;
  });
  interiorUi.enterButton.disabled = !enabled;
}

function syncInspector() {
  if (!selected) {
    setInspectorEnabled(false);
    inputs.name.value = "";
    inputs.kind.value = "";
    return;
  }
  setInspectorEnabled(true);
  inputs.name.value = selected.name;
  inputs.kind.value = typeLabels[selected.userData.generator?.type] || selected.userData.kind || "生成建筑";
  inputs.x.value = Math.round(selected.position.x);
  inputs.y.value = Math.round(selected.position.y);
  inputs.z.value = Math.round(selected.position.z);
  inputs.rot.value = Math.round(THREE.MathUtils.radToDeg(selected.rotation.y));
  inputs.scale.value = Number(selected.scale.x.toFixed(2));
  inputs.color.value = selected.userData.color || "#25c9be";
  writeGeneratorToInspector(selected.userData.generator);
}

function renderObjectList() {
  objectListEl.innerHTML = "";
  if (!editableGroup.children.length) {
    const empty = document.createElement("small");
    empty.textContent = "还没有建筑";
    objectListEl.append(empty);
    return;
  }
  editableGroup.children.forEach((object) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("active", object === selected);
    button.dataset.id = object.userData.id;
    button.innerHTML = `${object.name}<small>${typeLabels[object.userData.generator?.type] || "生成建筑"}  X:${Math.round(object.position.x)} Z:${Math.round(object.position.z)}</small>`;
    button.addEventListener("click", () => selectObject(object));
    objectListEl.append(button);
  });
}

function ensureInterior(building) {
  if (!building.userData.interior) {
    const record = serializeScene([building]).objects[0];
    building.userData.interior = createInteriorForBuilding(record);
  }
  return building.userData.interior;
}

function enterInteriorMode() {
  if (!selected) return setStatus("请先选择一个全景体块");
  currentInteriorBuilding = selected;
  selectedInteriorElementId = null;
  ensureInterior(currentInteriorBuilding);
  appMode = "interior";
  app.classList.add("interior-active");
  interiorUi.shell.classList.remove("hidden");
  transform.detach();
  setTransformHelperVisible(false);
  selectionMarker.visible = false;
  hiddenForInterior = scene.children
    .filter((child) => child !== interiorGroup && !child.isLight)
    .map((child) => [child, child.visible]);
  hiddenForInterior.forEach(([child]) => { child.visible = false; });
  interiorGroup.visible = true;
  setCameraPreset("topdown");
  camera.position.set(0, -360, 540);
  orbit.target.set(0, 0, 0);
  orbit.update();
  renderInteriorMode();
  setStatus(`内部模式：${currentInteriorBuilding.name}`);
}

function exitInteriorMode() {
  if (appMode !== "interior") return;
  appMode = "panorama";
  hiddenForInterior.forEach(([child, visible]) => { child.visible = visible; });
  hiddenForInterior = [];
  interiorGroup.visible = false;
  clearGroup(interiorGroup);
  interiorUi.shell.classList.add("hidden");
  app.classList.remove("interior-active");
  selectedInteriorElementId = null;
  interiorDragState = null;
  if (currentInteriorBuilding) selectObject(currentInteriorBuilding);
  currentInteriorBuilding = null;
  setCameraPreset("dispatch");
  setStatus("已返回全景模式");
}

function renderInteriorMode() {
  clearGroup(interiorGroup);
  if (!currentInteriorBuilding) return;
  const interior = ensureInterior(currentInteriorBuilding);
  const floor = getActiveFloor(interior);
  interiorUi.buildingName.textContent = currentInteriorBuilding.name;
  interiorUi.floorTitle.textContent = floor ? `${currentInteriorBuilding.name} / ${floor.name}` : "内部模式";
  renderInteriorFloorList(interior);
  renderInteriorFloor(floor, currentInteriorBuilding.userData.dimensions || [160, 110, 90]);
  if (interiorViewMode === "stack") renderInteriorStack(interior);
  syncInteriorElementInspector();
}

function renderInteriorFloorList(interior) {
  interiorUi.floorList.innerHTML = "";
  listInteriorFloors(interior).forEach((floor) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.toggle("active", floor.id === interior.activeFloorId);
    const groupLabel = floor.groupId ? "标准层组" : floor.isDetached ? "独立层" : "独立模板";
    button.innerHTML = `${floor.name}<small>${groupLabel} / Level ${floor.level}</small>`;
    button.addEventListener("click", () => {
      interior.activeFloorId = floor.id;
      selectedInteriorElementId = null;
      renderInteriorMode();
    });
    interiorUi.floorList.append(button);
  });
}

function renderInteriorFloor(floor, dimensions) {
  if (!floor) return;
  const width = Math.max(90, Math.min(280, dimensions[0] || 160));
  const depth = Math.max(70, Math.min(230, dimensions[1] || 110));
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, 2, depth),
    new THREE.MeshBasicMaterial({ color: "#05323a", transparent: true, opacity: 0.5, depthWrite: false })
  );
  base.name = "Interior Floor Plate";
  base.position.y = -1;
  interiorGroup.add(base);
  addEdges(base, "#1ce7db");
  [...(floor.corridors || []), ...(floor.rooms || []), ...(floor.facilities || [])].forEach((element) => {
    addInteriorElementMesh(element);
  });
}

function addInteriorElementMesh(element) {
  const height = element.kind === "facility" ? 14 : element.kind === "corridor" ? 3 : 7;
  const geometry = element.kind === "facility"
    ? new THREE.CylinderGeometry(Math.max(5, element.w / 2), Math.max(5, element.w / 2), height, 18)
    : new THREE.BoxGeometry(Math.max(4, element.w), height, Math.max(4, element.d));
  const material = makeMaterial(element.color || "#25c9be", element.id === selectedInteriorElementId ? 0.92 : element.kind === "corridor" ? 0.48 : 0.72);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = element.name;
  mesh.position.set(element.x || 0, height / 2, element.z || 0);
  mesh.userData.interiorElementId = element.id;
  mesh.userData.interiorKind = element.kind;
  interiorGroup.add(mesh);
  addEdges(mesh, element.id === selectedInteriorElementId ? "#fff6d7" : "#d8fffb");
}

function renderInteriorStack(interior) {
  const floors = listInteriorFloors(interior);
  floors.forEach((floor, index) => {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(58, 3, 42),
      new THREE.MeshBasicMaterial({ color: floor.id === interior.activeFloorId ? "#f7d46a" : "#25c9be", transparent: true, opacity: 0.42 })
    );
    slab.name = `Stack ${floor.name}`;
    slab.position.set(180, 10 + index * 14, -70);
    interiorGroup.add(slab);
    addEdges(slab, floor.id === interior.activeFloorId ? "#fff6d7" : "#73fff2");
  });
}

function setInteriorElementInputsEnabled(enabled) {
  Object.values(interiorUi.elementInputs).forEach((input) => {
    input.disabled = !enabled || input === interiorUi.elementInputs.kind;
  });
  ["apply-element", "copy-element", "delete-element"].forEach((action) => {
    interiorUi.shell.querySelector(`[data-interior-action='${action}']`).disabled = !enabled;
  });
}

function syncInteriorElementInspector() {
  const floor = getActiveFloor(currentInteriorBuilding?.userData.interior);
  const element = findInteriorElement(floor, selectedInteriorElementId);
  if (!element) {
    setInteriorElementInputsEnabled(false);
    Object.values(interiorUi.elementInputs).forEach((input) => { input.value = ""; });
    return;
  }
  setInteriorElementInputsEnabled(true);
  interiorUi.elementInputs.name.value = element.name || "";
  interiorUi.elementInputs.type.value = element.type || "";
  interiorUi.elementInputs.status.value = element.status || "";
  interiorUi.elementInputs.x.value = Math.round(element.x || 0);
  interiorUi.elementInputs.z.value = Math.round(element.z || 0);
  interiorUi.elementInputs.w.value = Math.round(element.w || 8);
  interiorUi.elementInputs.d.value = Math.round(element.d || 8);
  interiorUi.elementInputs.color.value = element.color || "#25c9be";
  interiorUi.elementInputs.kind.value = interiorElementKinds[element.kind] || element.kind;
}

function selectInteriorElement(id) {
  selectedInteriorElementId = id;
  renderInteriorMode();
}

function addInteriorObject(kind) {
  if (!currentInteriorBuilding) return;
  const floor = getActiveFloor(ensureInterior(currentInteriorBuilding));
  if (!floor) return;
  pushHistory();
  const element = addInteriorElement(floor, kind);
  selectedInteriorElementId = element.id;
  renderInteriorMode();
  setStatus(`已新增${interiorElementKinds[element.kind]}：${element.name}`);
}

function applyInteriorElementInspector() {
  if (!currentInteriorBuilding || !selectedInteriorElementId) return;
  const floor = getActiveFloor(ensureInterior(currentInteriorBuilding));
  const element = findInteriorElement(floor, selectedInteriorElementId);
  if (!element) return;
  pushHistory();
  updateInteriorElement(floor, element.id, {
    name: interiorUi.elementInputs.name.value.trim() || element.name,
    type: interiorUi.elementInputs.type.value.trim() || element.type,
    status: interiorUi.elementInputs.status.value.trim() || element.status,
    x: Number(interiorUi.elementInputs.x.value) || 0,
    z: Number(interiorUi.elementInputs.z.value) || 0,
    w: Math.max(4, Number(interiorUi.elementInputs.w.value) || element.w || 8),
    d: Math.max(4, Number(interiorUi.elementInputs.d.value) || element.d || 8),
    color: interiorUi.elementInputs.color.value || element.color
  });
  renderInteriorMode();
  setStatus(`已应用室内属性：${element.name}`);
}

function copyInteriorElement() {
  if (!currentInteriorBuilding || !selectedInteriorElementId) return;
  const floor = getActiveFloor(ensureInterior(currentInteriorBuilding));
  const element = findInteriorElement(floor, selectedInteriorElementId);
  if (!element) return;
  pushHistory();
  const target = element.kind === "room" ? "rooms" : element.kind === "corridor" ? "corridors" : "facilities";
  const copy = { ...element, id: `${element.id}_copy_${Date.now()}`, name: `${element.name}_copy`, x: element.x + 12, z: element.z + 12 };
  floor[target].push(copy);
  selectedInteriorElementId = copy.id;
  renderInteriorMode();
  setStatus(`已复制室内对象：${copy.name}`);
}

function deleteInteriorElement() {
  if (!currentInteriorBuilding || !selectedInteriorElementId) return;
  const floor = getActiveFloor(ensureInterior(currentInteriorBuilding));
  const element = findInteriorElement(floor, selectedInteriorElementId);
  if (!element) return;
  pushHistory();
  removeInteriorElement(floor, selectedInteriorElementId);
  selectedInteriorElementId = null;
  renderInteriorMode();
  setStatus(`已删除室内对象：${element.name}`);
}

function detachInteriorFloor() {
  if (!currentInteriorBuilding) return;
  pushHistory();
  const floor = detachActiveFloor(ensureInterior(currentInteriorBuilding));
  selectedInteriorElementId = null;
  renderInteriorMode();
  setStatus(floor?.isDetached ? `已拆分楼层：${floor.name}` : "当前楼层已经是独立层");
}

function resetCurrentInterior() {
  if (!currentInteriorBuilding) return;
  pushHistory();
  const record = serializeScene([currentInteriorBuilding]).objects[0];
  currentInteriorBuilding.userData.interior = createInteriorForBuilding({ ...record, interior: null });
  selectedInteriorElementId = null;
  renderInteriorMode();
  setStatus(`已重置内部：${currentInteriorBuilding.name}`);
}

function setInteriorViewMode(mode) {
  interiorViewMode = mode === "stack" ? "stack" : "floor";
  interiorUi.shell.querySelectorAll("[data-interior-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.interiorView === interiorViewMode);
  });
  renderInteriorMode();
}

function captureSceneData() {
  return JSON.parse(JSON.stringify(serializeScene(editableGroup.children)));
}

function pushHistory() {
  undoStack.push(captureSceneData());
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
}

function restoreSceneData(sceneData) {
  if (appMode === "interior") exitInteriorMode();
  editableGroup.children.slice().forEach((child) => {
    editableGroup.remove(child);
    disposeObject(child);
  });
  transform.detach();
  selected = null;
  sceneData?.objects?.forEach(createFromRecord);
  updateSelectionMarker();
  syncInspector();
  renderObjectList();
  updateFootprintOverlaps();
}

function setSavePickerStatus(message) {
  if (savePickerUi?.status) savePickerUi.status.textContent = message;
}

function renderSaveList() {
  savePickerUi.list.innerHTML = "";
  savePickerUi.saves.forEach((save) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "save-list-item";
    button.classList.toggle("active", save.id === savePickerUi.selectedSaveId);
    button.innerHTML = `
      <strong>${save.locked ? "[LOCK] " : ""}${save.title}</strong>
      <small>${save.updatedAt ? new Date(save.updatedAt).toLocaleString() : "未保存"}</small>
    `;
    button.addEventListener("click", () => {
      savePickerUi.selectedSaveId = save.id;
      renderSaveList();
      setSavePickerStatus(save.locked ? "该存档需要密码。" : "该存档没有密码，可以直接打开。");
    });
    savePickerUi.list.append(button);
  });
}

async function refreshSaveList() {
  const payload = await listSaves();
  savePickerUi.saves = payload.saves || [];
  savePickerUi.selectedSaveId = savePickerUi.selectedSaveId || payload.activeSaveId || savePickerUi.saves[0]?.id || null;
  renderSaveList();
  setSavePickerStatus(savePickerUi.saves.length ? "请选择一个存档并打开。" : "还没有存档，请创建一个。");
}

async function openSelectedSave() {
  const saveId = savePickerUi.selectedSaveId;
  if (!saveId) {
    setSavePickerStatus("请先选择一个存档。");
    return;
  }
  const password = savePickerUi.password.value;
  const payload = await loadArchiveScene({ saveId, password });
  currentSaveAccess = { saveId: payload.save.id, title: payload.save.title, locked: payload.save.locked, password };
  restoreSceneData(payload.scene || { version: 2, objects: [] });
  savePickerUi.shell.classList.add("hidden");
  undoStack = [];
  redoStack = [];
  setStatus(`已打开存档：${currentSaveAccess.title}`);
}

async function createNewSave() {
  const title = savePickerUi.title.value.trim() || `新存档 ${new Date().toLocaleString()}`;
  const password = savePickerUi.newPassword.value;
  const payload = await createSave({ title, password, scene: { version: 2, objects: [] } });
  savePickerUi.title.value = "";
  savePickerUi.newPassword.value = "";
  savePickerUi.password.value = password;
  savePickerUi.selectedSaveId = payload.save.id;
  await refreshSaveList();
  await openSelectedSave();
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
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
  for (let index = 0; index < 16; index += 1) {
    const type = randomChoice(types);
    const base = generatorDefaults[type];
    const angle = index * 0.72;
    const ring = index % 2 ? 260 : 150;
    const x = Math.round(Math.cos(angle) * ring + (Math.random() - 0.5) * 70);
    const z = Math.round(Math.sin(angle) * ring + (Math.random() - 0.5) * 70);
    objects.push({
      id: `test_${type}_${index + 1}`,
      name: `测试-${typeLabels[type] || type}-${index + 1}`,
      kind: "generated_building",
      color: randomChoice(colors),
      position: [x, 0, z],
      rotation: [0, Math.random() * Math.PI * 0.35, 0],
      scale: [1, 1, 1],
      dimensions: [base.width, base.depth, base.height],
      showNameplate: index % 3 === 0,
      generator: {
        ...base,
        count: Math.max(1, Math.min(18, Math.round(base.count * (0.75 + Math.random() * 0.6)))),
        heightVariance: Math.min(0.5, base.heightVariance + Math.random() * 0.12),
        seed: `local-test-${Date.now()}-${index}`
      },
      interior: null
    });
  }
  return { version: 2, savedAt: new Date().toISOString(), testOnly: true, objects };
}

function openTestScene() {
  currentSaveAccess = { saveId: "__test__", title: "测试 JSON", locked: false, password: "", testOnly: true };
  restoreSceneData(createTestSceneData());
  savePickerUi.shell.classList.add("hidden");
  undoStack = [];
  redoStack = [];
  setStatus("已打开测试 JSON：随机地图仅用于本机测试，保存前请选择或创建正式存档");
}

function selectObject(object) {
  selected = object?.userData.locked ? null : object;
  transform.detach();
  setTransformHelperVisible(Boolean(selected) && transform.getMode() !== "translate");
  if (selected) transform.attach(selected);
  updateSelectionMarker();
  syncInspector();
  renderObjectList();
}

function updateSelectionMarker() {
  if (!selected) {
    selectionMarker.visible = false;
    return;
  }
  const box = new THREE.Box3().setFromObject(selected);
  const size = new THREE.Vector3();
  box.getSize(size);
  const radius = Math.max(18, Math.max(size.x, size.z) * 0.62);
  selectionMarker.visible = true;
  selectionMarker.position.set(selected.position.x, 2.2, selected.position.z);
  selectionMarker.scale.set(radius, radius, 1);
}

function getSnapSize() {
  return Math.max(1, Number(snapControls.size.value) || 10);
}

function snapValue(value, event) {
  if (!snapControls.enabled.checked || event?.shiftKey) return value;
  const size = getSnapSize();
  return Math.round(value / size) * size;
}

function pointerToNdc(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function intersectGround(event, plane = groundPlane) {
  pointerToNdc(event);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function hitEditable(event) {
  pointerToNdc(event);
  const hits = raycaster.intersectObjects(editableGroup.children, true);
  if (!hits.length) return null;
  let object = hits[0].object;
  while (object.parent && object.parent !== editableGroup) object = object.parent;
  return object.userData.locked ? null : object;
}

function hitInteriorElement(event) {
  pointerToNdc(event);
  const hits = raycaster.intersectObjects(interiorGroup.children, true);
  const hit = hits.find((item) => item.object.userData.interiorElementId);
  return hit?.object.userData.interiorElementId || null;
}

function beginInteriorDrag(event, id) {
  if (!currentInteriorBuilding || !id) return;
  const point = intersectGround(event);
  const floor = getActiveFloor(ensureInterior(currentInteriorBuilding));
  const element = findInteriorElement(floor, id);
  if (!point || !element) return;
  interiorDragState = {
    id,
    before: captureSceneData(),
    offset: new THREE.Vector3(point.x - element.x, 0, point.z - element.z),
    moved: false
  };
  orbit.enabled = false;
  canvas.classList.add("dragging");
  canvas.setPointerCapture?.(event.pointerId);
  setStatus(`拖动室内对象：${element.name}`);
}

function updateInteriorDrag(event) {
  if (!interiorDragState || !currentInteriorBuilding) return;
  const point = intersectGround(event);
  const floor = getActiveFloor(ensureInterior(currentInteriorBuilding));
  const element = findInteriorElement(floor, interiorDragState.id);
  if (!point || !element) return;
  const nextX = snapValue(point.x - interiorDragState.offset.x, event);
  const nextZ = snapValue(point.z - interiorDragState.offset.z, event);
  interiorDragState.moved ||= nextX !== element.x || nextZ !== element.z;
  element.x = nextX;
  element.z = nextZ;
  renderInteriorMode();
}

function endInteriorDrag(event) {
  if (!interiorDragState) return;
  if (interiorDragState.moved) {
    undoStack.push(interiorDragState.before);
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  }
  interiorDragState = null;
  orbit.enabled = true;
  canvas.classList.remove("dragging");
  canvas.releasePointerCapture?.(event.pointerId);
}

function beginPlacement() {
  cancelPlacement();
  const generator = readGeneratorFromCreatePanel();
  const preview = createGeneratedGroup({
    generator,
    color: createInputs.color.value,
    name: "Placement Preview",
    preview: true
  });
  scene.add(preview);
  placementState = { preview, generator, color: createInputs.color.value };
  canvas.classList.add("placing");
  setStatus(`进入放置模式：${typeLabels[generator.type]}，在地图上点击落点`);
}

function updatePlacement(event) {
  if (!placementState) return;
  const point = intersectGround(event);
  if (!point) return;
  placementState.preview.position.set(snapValue(point.x, event), 0, snapValue(point.z, event));
}

function commitPlacement(event) {
  if (!placementState) return;
  updatePlacement(event);
  const { preview, generator, color } = placementState;
  pushHistory();
  const object = createGeneratedGroup({ generator, color });
  object.position.copy(preview.position);
  cancelPlacement();
  selectObject(object);
  updateFootprintOverlaps();
  setStatus(`已放置：${object.name}`);
}

function cancelPlacement() {
  if (!placementState) return;
  scene.remove(placementState.preview);
  disposeObject(placementState.preview);
  placementState = null;
  canvas.classList.remove("placing");
}

function beginDirectDrag(event, object) {
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -object.position.y);
  const point = intersectGround(event, dragPlane);
  if (!point) return;
  dragState = {
    object,
    plane: dragPlane,
    offset: new THREE.Vector3(point.x - object.position.x, 0, point.z - object.position.z),
    before: captureSceneData(),
    moved: false
  };
  orbit.enabled = false;
  canvas.classList.add("dragging");
  canvas.setPointerCapture?.(event.pointerId);
  setStatus(`拖动中：${object.name}`);
}

function updateDirectDrag(event) {
  if (!dragState) return;
  const point = intersectGround(event, dragState.plane);
  if (!point) return;
  const nextX = snapValue(point.x - dragState.offset.x, event);
  const nextZ = snapValue(point.z - dragState.offset.z, event);
  dragState.moved ||= nextX !== dragState.object.position.x || nextZ !== dragState.object.position.z;
  dragState.object.position.x = nextX;
  dragState.object.position.z = nextZ;
  updateSelectionMarker();
  syncInspector();
  renderObjectList();
  updateFootprintOverlaps();
}

function endDirectDrag(event) {
  if (!dragState) return;
  const object = dragState.object;
  if (dragState.moved) {
    undoStack.push(dragState.before);
    redoStack = [];
  }
  dragState = null;
  orbit.enabled = true;
  canvas.classList.remove("dragging");
  canvas.releasePointerCapture?.(event.pointerId);
  setStatus(`已移动：${object.name}`);
}

function applyInspector() {
  if (!selected) return;
  pushHistory();
  const nextName = inputs.name.value.trim();
  selected.name = nextName || selected.name;
  if (nextName) selected.userData.showNameplate = true;
  selected.position.set(Number(inputs.x.value) || 0, Number(inputs.y.value) || 0, Number(inputs.z.value) || 0);
  selected.rotation.y = THREE.MathUtils.degToRad(Number(inputs.rot.value) || 0);
  const scale = Math.max(0.05, Number(inputs.scale.value) || 1);
  selected.scale.setScalar(scale);
  rebuildGeneratedGroup(selected, readGeneratorFromInspector(), inputs.color.value);
  syncInspector();
  updateSelectionMarker();
  renderObjectList();
  updateFootprintOverlaps();
  setStatus(`已应用属性：${selected.name}`);
}

function regenerateSelected() {
  if (!selected) return;
  pushHistory();
  rebuildGeneratedGroup(selected, readGeneratorFromInspector(), inputs.color.value);
  syncInspector();
  updateSelectionMarker();
  renderObjectList();
  updateFootprintOverlaps();
  setStatus(`已重新生成：${selected.name}`);
}

function copySelected() {
  if (!selected) return;
  pushHistory();
  const clone = createGeneratedGroup({
    generator: { ...selected.userData.generator },
    color: selected.userData.color,
    name: `${selected.name}_copy`,
    showNameplate: selected.userData.showNameplate
  });
  clone.userData.interior = cloneInterior(selected.userData.interior);
  clone.rotation.copy(selected.rotation);
  clone.scale.copy(selected.scale);
  clone.position.copy(selected.position);
  clone.position.x += getSnapSize() * 3;
  clone.position.z += getSnapSize() * 3;
  selectObject(clone);
  updateFootprintOverlaps();
  setStatus(`已复制：${clone.name}`);
}

function resetRotation() {
  if (!selected) return;
  selected.rotation.set(0, 0, 0);
  syncInspector();
  updateSelectionMarker();
  setStatus(`已重置旋转：${selected.name}`);
}

function stickToGround() {
  if (!selected) return;
  const box = new THREE.Box3().setFromObject(selected);
  selected.position.y -= box.min.y;
  syncInspector();
  updateSelectionMarker();
  setStatus(`已贴地：${selected.name}`);
}

function deleteSelected() {
  if (!selected) return;
  pushHistory();
  const doomed = selected;
  transform.detach();
  editableGroup.remove(doomed);
  disposeObject(doomed);
  selected = null;
  updateSelectionMarker();
  syncInspector();
  renderObjectList();
  updateFootprintOverlaps();
  setStatus(`已删除：${doomed.name}`);
}

function clearAllObjects() {
  if (!editableGroup.children.length) return;
  pushHistory();
  restoreSceneData({ version: 2, objects: [] });
  setStatus("已清空全部可编辑建筑");
}

function undoChange() {
  if (!undoStack.length) return setStatus("没有可撤回的操作");
  const current = captureSceneData();
  const previous = undoStack.pop();
  redoStack.push(current);
  restoreSceneData(previous);
  setStatus("已撤回");
}

function redoChange() {
  if (!redoStack.length) return setStatus("没有可反撤回的操作");
  const current = captureSceneData();
  const next = redoStack.pop();
  undoStack.push(current);
  restoreSceneData(next);
  setStatus("已反撤回");
}

function setTransformMode(mode) {
  transform.setMode(mode);
  setTransformHelperVisible(Boolean(selected) && mode !== "translate");
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  setStatus(mode === "translate" ? "移动模式：可直接拖动建筑" : mode === "rotate" ? "旋转模式：使用精确轴控" : "缩放模式：使用精确轴控");
}

function setTransformHelperVisible(visible) {
  transformHelper.visible = visible;
  transformHelper.traverse((child) => {
    child.visible = visible;
  });
}

function setCameraPreset(name) {
  const preset = cameras[name];
  if (!preset) return;
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
  setStatus(cameraControlMode === "pan" ? "镜头平移模式：左键拖空白处移动地图" : "镜头旋转模式：左键拖空白处旋转视角");
}

function createLegacyGenerator(record) {
  const dimensions = record.dimensions ?? [42, 42, 72];
  if (record.kind === "building_tower") return { ...generatorDefaults.tower_cluster, count: 1, width: dimensions[0] || 44, depth: dimensions[1] || 44, height: dimensions[2] || 132 };
  if (record.kind === "building_hq") return { ...generatorDefaults.ring_hq, width: dimensions[0] || 130, depth: dimensions[1] || 130, height: dimensions[2] || 48 };
  if (record.kind === "marker_dispatch") return { ...generatorDefaults.mission_marker, width: dimensions[0] || 36, depth: dimensions[1] || 36, height: dimensions[2] || 24 };
  return { ...generatorDefaults.office_block, count: 1, width: dimensions[0] || 72, depth: dimensions[1] || 72, height: dimensions[2] || 72 };
}

function createFromRecord(record) {
  const legacyKinds = ["building_block", "building_tower", "building_hq", "marker_dispatch"];
  const isLegacyRecord = !record.generator || legacyKinds.includes(record.kind);
  const generator = record.generator ? normalizeGenerator(record.generator) : createLegacyGenerator(record);
  const sourcePosition = record.position ?? [0, 0, 0];
  const position = isLegacyRecord ? [sourcePosition[0] ?? 0, 0, sourcePosition[2] ?? 0] : [sourcePosition[0] ?? 0, Math.max(0, sourcePosition[1] ?? 0), sourcePosition[2] ?? 0];
  const object = createGeneratedGroup({
    generator,
    color: record.color || "#25c9be",
    name: record.name || record.id || nextId(generator.type),
    showNameplate: Boolean(record.showNameplate)
  });
  applyRecordToObject(object, { ...record, kind: "generated_building", generator, position });
  rememberId(object.userData.id);
  return object;
}

async function saveCurrentScene() {
  const sceneData = serializeScene(editableGroup.children);
  const path = await saveScene(sceneData);
  setStatus(`已保存：${path}`);
}

async function loadSavedScene() {
  const sceneData = await loadScene();
  editableGroup.children.slice().forEach((child) => {
    editableGroup.remove(child);
    disposeObject(child);
  });
  transform.detach();
  selected = null;
  if (sceneData?.objects) {
    sceneData.objects.forEach(createFromRecord);
    selectObject(null);
  }
  renderObjectList();
  updateFootprintOverlaps();
  undoStack = [];
  redoStack = [];
  setStatus(sceneData ? `已读取场景：${sceneData.objects?.length ?? 0} 个对象` : "暂无保存场景，保留当前底板");
}

async function exportCurrentScreenshot() {
  renderer.render(scene, camera);
  const path = await exportScreenshot(renderer);
  setStatus(`PNG 已导出：${path}`);
}

function removeNameplatesFromClone(root) {
  root.traverse((child) => {
    child.children.slice().forEach((nested) => {
      if (nested.userData.nameplate) child.remove(nested);
    });
  });
}

function createExportScene() {
  const exportRoot = new THREE.Group();
  exportRoot.name = "Dispatch Map Export";
  scene.children.forEach((child) => {
    if (child.userData.nonExport) return;
    const clone = child.clone(true);
    removeNameplatesFromClone(clone);
    exportRoot.add(clone);
  });
  const exportScene = new THREE.Scene();
  exportScene.add(exportRoot);
  return exportScene;
}

async function exportCurrentGltf() {
  const exportScene = createExportScene();
  const path = await exportGltf(exportScene);
  setStatus(`glTF 已导出：${path}`);
}

async function exportCurrentViewer() {
  editableGroup.children.forEach(ensureInterior);
  const sceneData = serializeScene(editableGroup.children);
  const payload = await exportViewer(createExportScene(), sceneData);
  setStatus(`观看网页已导出：${payload.htmlPath}`);
}

async function saveCurrentArchive() {
  if (!currentSaveAccess?.saveId) {
    savePickerUi.shell.classList.remove("hidden");
    setSavePickerStatus("请先打开或创建一个存档。");
    return;
  }
  const sceneData = serializeScene(editableGroup.children);
  const payload = await saveArchiveScene(sceneData, currentSaveAccess);
  currentSaveAccess = { ...currentSaveAccess, ...payload.save };
  setStatus(`已保存存档：${currentSaveAccess.title}`);
}

async function loadArchivePicker() {
  savePickerUi.shell.classList.remove("hidden");
  await refreshSaveList();
  setStatus("请选择要打开的存档");
}

async function exportCurrentArchiveViewer() {
  if (!currentSaveAccess?.saveId) {
    savePickerUi.shell.classList.remove("hidden");
    setSavePickerStatus("导出观看页前，请先打开一个存档。");
    return;
  }
  editableGroup.children.forEach(ensureInterior);
  const sceneData = serializeScene(editableGroup.children);
  const payload = await exportViewer(createExportScene(), sceneData, currentSaveAccess);
  setStatus(`观看网页已导出：${payload.htmlPath}`);
}

function wireUi() {
  savePickerUi.open.addEventListener("click", () => openSelectedSave().catch((error) => setSavePickerStatus(error.message)));
  savePickerUi.refresh.addEventListener("click", () => refreshSaveList().catch((error) => setSavePickerStatus(error.message)));
  savePickerUi.create.addEventListener("click", () => createNewSave().catch((error) => setSavePickerStatus(error.message)));
  savePickerUi.test.addEventListener("click", openTestScene);
  createInputs.type.addEventListener("change", () => writeCreateDefaultsForType(createInputs.type.value));
  document.querySelector("[data-action='place-generated']").addEventListener("click", beginPlacement);
  document.querySelector("[data-action='save']").addEventListener("click", () => saveCurrentArchive().catch((error) => setStatus(error.message)));
  document.querySelector("[data-action='load']").addEventListener("click", () => loadArchivePicker().catch((error) => setStatus(error.message)));
  document.querySelector("[data-action='undo']").addEventListener("click", undoChange);
  document.querySelector("[data-action='redo']").addEventListener("click", redoChange);
  document.querySelector("[data-action='clear-all']").addEventListener("click", clearAllObjects);
  document.querySelector("[data-action='screenshot']").addEventListener("click", () => exportCurrentScreenshot().catch((error) => setStatus(error.message)));
  document.querySelector("[data-action='gltf']").addEventListener("click", () => exportCurrentGltf().catch((error) => setStatus(error.message)));
  document.querySelector("[data-action='viewer']").addEventListener("click", () => exportCurrentArchiveViewer().catch((error) => setStatus(error.message)));
  document.querySelectorAll("[data-camera]").forEach((button) => button.addEventListener("click", () => setCameraPreset(button.dataset.camera)));
  document.querySelectorAll("[data-camera-mode]").forEach((button) => button.addEventListener("click", () => setCameraControlMode(button.dataset.cameraMode)));
  document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => setTransformMode(button.dataset.mode)));
  document.querySelector("#apply-props").addEventListener("click", applyInspector);
  document.querySelector("#regenerate-object").addEventListener("click", regenerateSelected);
  document.querySelector("#copy-object").addEventListener("click", copySelected);
  document.querySelector("#reset-rotation").addEventListener("click", resetRotation);
  document.querySelector("#stick-ground").addEventListener("click", stickToGround);
  document.querySelector("#delete-object").addEventListener("click", deleteSelected);
  interiorUi.enterButton.addEventListener("click", enterInteriorMode);
  interiorUi.shell.querySelector("[data-interior-action='back']").addEventListener("click", exitInteriorMode);
  interiorUi.shell.querySelector("[data-interior-action='save']").addEventListener("click", () => saveCurrentArchive().catch((error) => setStatus(error.message)));
  interiorUi.shell.querySelector("[data-interior-action='reset']").addEventListener("click", resetCurrentInterior);
  interiorUi.shell.querySelector("[data-interior-action='detach-floor']").addEventListener("click", detachInteriorFloor);
  interiorUi.shell.querySelector("[data-interior-action='apply-element']").addEventListener("click", applyInteriorElementInspector);
  interiorUi.shell.querySelector("[data-interior-action='copy-element']").addEventListener("click", copyInteriorElement);
  interiorUi.shell.querySelector("[data-interior-action='delete-element']").addEventListener("click", deleteInteriorElement);
  interiorUi.shell.querySelectorAll("[data-interior-add]").forEach((button) => {
    button.addEventListener("click", () => addInteriorObject(button.dataset.interiorAdd));
  });
  interiorUi.shell.querySelectorAll("[data-interior-view]").forEach((button) => {
    button.addEventListener("click", () => setInteriorViewMode(button.dataset.interiorView));
  });
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointerleave", onPointerUp);
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (appMode === "interior") {
        exitInteriorMode();
        return;
      }
      cancelPlacement();
      setStatus("已取消放置");
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveCurrentArchive().catch((error) => setStatus(error.message));
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoChange();
      return;
    }
    if (event.ctrlKey && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redoChange();
      return;
    }
    if (appMode === "interior") {
      if (event.key === "Delete") deleteInteriorElement();
      return;
    }
    if (event.key.toLowerCase() === "w") setTransformMode("translate");
    if (event.key.toLowerCase() === "e") setTransformMode("rotate");
    if (event.key.toLowerCase() === "r") setTransformMode("scale");
    if (event.key === "Delete") deleteSelected();
  });
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  if (appMode === "interior") {
    const id = hitInteriorElement(event);
    selectInteriorElement(id);
    if (id) beginInteriorDrag(event, id);
    return;
  }
  if (placementState) {
    commitPlacement(event);
    return;
  }
  if (transform.dragging) return;
  const hit = hitEditable(event);
  if (!hit) {
    selectObject(null);
    return;
  }
  selectObject(hit);
  if (transform.getMode() === "translate") beginDirectDrag(event, hit);
}

function onPointerMove(event) {
  if (appMode === "interior") updateInteriorDrag(event);
  if (placementState) updatePlacement(event);
  if (dragState) updateDirectDrag(event);
}

function onPointerUp(event) {
  if (appMode === "interior") endInteriorDrag(event);
  endDirectDrag(event);
}

function animate() {
  orbit.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

async function init() {
  addLightRig();
  addGrid();
  addBaseMap();
  wireUi();
  resize();
  setCameraPreset("dispatch");
  setCameraControlMode("orbit");
  setInspectorEnabled(false);
  await loadSavedScene().catch((error) => setStatus(`读取失败：${error.message}`));
  setStatus("就绪：生成建筑后可直接拖动");
  animate();
}

init();
