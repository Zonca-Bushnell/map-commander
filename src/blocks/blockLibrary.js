import * as THREE from "three";

export const typeLabels = {
  office_block: "\u5199\u5b57\u697c\u4f53\u5757",
  dense_city_block: "\u5bc6\u96c6\u8857\u533a",
  long_office_bar: "\u957f\u6761\u697c\u7ec4",
  twin_towers: "\u53cc\u5854",
  tower_cluster: "\u5854\u697c\u7fa4",
  podium_complex: "\u88d9\u697c\u7efc\u5408\u4f53",
  dispatch_compound: "\u6d3e\u9063\u5efa\u7b51\u7ec4",
  circular_facility: "\u5706\u5f62\u8bbe\u65bd",
  ring_hq: "\u73af\u5f62\u603b\u90e8",
  mission_marker: "\u4efb\u52a1\u70b9",
  library: "\u56fe\u4e66\u9986",
  mega_hq_tower: "\u8d85\u9ad8\u603b\u90e8\u5927\u697c",
  rocket_launch_site: "\u706b\u7bad\u53d1\u5c04\u533a",
  port: "\u6e2f\u53e3",
  freight_depot: "\u6258\u8fd0\u90e8\u95e8",
  warehouse: "\u4ed3\u5e93",
  research_lab: "\u7814\u7a76\u6240",
  hospital: "\u5927\u578b\u533b\u9662",
  nasa_research: "NASA\u7814\u7a76\u6240",
  residential_district: "\u5c45\u6c11\u533a"
};

export const generatorDefaults = {
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

export function makeMaterial(color, opacity = 0.82) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.42,
    metalness: 0.08,
    emissive: new THREE.Color(color).multiplyScalar(0.18)
  });
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function normalizeGenerator(source = {}) {
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

export function rebuildGeneratedGroup(group, generatorSource, colorSource) {
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
  group.userData.generator = generator;
  group.userData.color = color;
  group.userData.kind = "generated_building";
  group.userData.dimensions = estimateDimensions(group);
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


export function createBuildingBlock(record = {}, options = {}) {
  const group = new THREE.Group();
  const generator = normalizeGenerator(record.generator || { type: record.kind });
  const color = record.color || options.color || "#25c9be";
  group.name = record.name || record.id || generator.type;
  group.userData.id = record.id || group.name;
  group.userData.kind = "generated_building";
  group.userData.color = color;
  group.userData.generator = generator;
  group.userData.showNameplate = Boolean(record.showNameplate);
  rebuildGeneratedGroup(group, generator, color);
  group.position.fromArray(record.position || [0, 0, 0]);
  group.rotation.set(...(record.rotation || [0, 0, 0]));
  group.scale.fromArray(record.scale || [1, 1, 1]);
  if (options.preview) makePreview(group);
  group.traverse((child) => {
    child.userData.rootRecordId = group.userData.id;
  });
  return group;
}
