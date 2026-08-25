export const INTERIOR_VERSION = 1;

export const interiorElementKinds = {
  room: "房间",
  corridor: "走廊",
  facility: "设施"
};

export function cloneInterior(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

export function createInteriorForBuilding(record) {
  const generatorType = record.generator?.type || "office_block";
  const dimensions = record.dimensions || [120, 90, record.generator?.height || 90];
  const floorCount = estimateFloorCount(dimensions[2], generatorType);
  const size = {
    width: Math.max(80, Math.min(260, dimensions[0] || record.generator?.width || 120)),
    depth: Math.max(64, Math.min(220, dimensions[1] || record.generator?.depth || 90))
  };
  const templates = createTemplates(generatorType, size, floorCount);
  return {
    version: INTERIOR_VERSION,
    generatedFrom: {
      generatorType,
      dimensions: [...dimensions],
      seed: record.generator?.seed || "interior-01"
    },
    floorGroups: templates.floorGroups,
    floors: templates.floors,
    activeFloorId: templates.activeFloorId
  };
}

export function getActiveFloor(interior) {
  return interior?.floors?.[interior.activeFloorId] || null;
}

export function getInteriorElements(floor) {
  if (!floor) return [];
  return [
    ...(floor.rooms || []),
    ...(floor.corridors || []),
    ...(floor.facilities || [])
  ];
}

export function findInteriorElement(floor, id) {
  return getInteriorElements(floor).find((item) => item.id === id) || null;
}

export function updateInteriorElement(floor, id, next) {
  for (const key of ["rooms", "corridors", "facilities"]) {
    const list = floor[key] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      list[index] = { ...list[index], ...next };
      return list[index];
    }
  }
  return null;
}

export function removeInteriorElement(floor, id) {
  for (const key of ["rooms", "corridors", "facilities"]) {
    const list = floor[key] || [];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) {
      list.splice(index, 1);
      return true;
    }
  }
  return false;
}

export function addInteriorElement(floor, kind) {
  const safeKind = interiorElementKinds[kind] ? kind : "room";
  const target = safeKind === "room" ? "rooms" : safeKind === "corridor" ? "corridors" : "facilities";
  floor[target] ||= [];
  const index = floor[target].length + 1;
  const element = makeElement(safeKind, {
    id: `${safeKind}_${Date.now()}_${index}`,
    name: `${interiorElementKinds[safeKind]} ${index}`,
    type: safeKind === "room" ? "通用区域" : safeKind === "corridor" ? "主通道" : "功能点",
    x: -30 + index * 12,
    z: -20 + index * 8,
    w: safeKind === "facility" ? 14 : safeKind === "corridor" ? 72 : 42,
    d: safeKind === "facility" ? 14 : safeKind === "corridor" ? 16 : 32,
    color: safeKind === "facility" ? "#f7d46a" : safeKind === "corridor" ? "#1f8f9a" : "#25c9be"
  });
  floor[target].push(element);
  return element;
}

export function detachActiveFloor(interior) {
  const floor = getActiveFloor(interior);
  if (!floor || !floor.groupId) return floor;
  const detached = cloneInterior(floor);
  detached.id = `detached_${Date.now()}`;
  detached.name = `${floor.name} 独立`;
  detached.groupId = null;
  detached.isDetached = true;
  interior.floors[detached.id] = detached;
  interior.activeFloorId = detached.id;
  return detached;
}

export function listInteriorFloors(interior) {
  if (!interior?.floors) return [];
  return Object.values(interior.floors).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
}

function estimateFloorCount(height, type) {
  const base = Math.max(3, Math.round((Number(height) || 72) / 18));
  const max = ["mega_hq_tower", "tower_cluster", "office_block", "residential_district"].includes(type) ? 36 : 18;
  return Math.min(max, base);
}

function createTemplates(type, size, floorCount) {
  const floors = {};
  const floorGroups = [];
  floors.basement = makeFloor("basement", "地下设备层", -1, makeSupportLayout(type, size));
  floors.ground = makeFloor("ground", "首层", 1, makeGroundLayout(type, size));
  floors.standard = makeFloor("standard", floorCount > 5 ? `标准层 2-${floorCount - 2}` : "标准层", 2, makeStandardLayout(type, size), "standard");
  floors.equipment = makeFloor("equipment", "设备/安保层", Math.max(3, floorCount - 1), makeSupportLayout(type, size));
  floors.roof = makeFloor("roof", "顶层", floorCount, makeRoofLayout(type, size));
  if (floorCount > 5) {
    floorGroups.push({
      id: "standard",
      name: `标准层组 2-${floorCount - 2}`,
      templateFloorId: "standard",
      levels: range(2, floorCount - 2)
    });
  }
  return { floors, floorGroups, activeFloorId: "ground" };
}

function makeFloor(id, name, level, layout, groupId = null) {
  return {
    id,
    name,
    level,
    groupId,
    rooms: layout.rooms,
    corridors: layout.corridors,
    facilities: layout.facilities
  };
}

function makeGroundLayout(type, size) {
  if (type === "hospital") return hospitalGround(size);
  if (type === "nasa_research" || type === "research_lab") return labGround(size);
  if (type === "residential_district") return residentialGround(size);
  if (["warehouse", "freight_depot", "port"].includes(type)) return logisticsGround(size);
  return officeGround(size);
}

function makeStandardLayout(type, size) {
  if (type === "hospital") return hospitalWard(size);
  if (type === "nasa_research" || type === "research_lab") return labStandard(size);
  if (type === "residential_district") return residentialStandard(size);
  if (["warehouse", "freight_depot", "port"].includes(type)) return logisticsStandard(size);
  return officeStandard(size);
}

function makeSupportLayout(type, size) {
  return {
    rooms: [
      room("power", "能源/机房", "设备", -size.width * 0.24, 0, size.width * 0.34, size.depth * 0.62, "#159a93"),
      room("security", "安保中控", "安保", size.width * 0.22, -size.depth * 0.18, size.width * 0.34, size.depth * 0.28, "#25c9be"),
      room("storage", type === "hospital" ? "药品/耗材库" : "备件仓储", "仓储", size.width * 0.22, size.depth * 0.2, size.width * 0.34, size.depth * 0.28, "#1f8f9a")
    ],
    corridors: [corridor("support_hall", "设备通道", 0, 0, size.width * 0.78, 14)],
    facilities: [facility("lift", "电梯", "电梯", 0, -size.depth * 0.34), facility("stair", "楼梯", "楼梯", 0, size.depth * 0.34)]
  };
}

function makeRoofLayout(type, size) {
  return {
    rooms: [
      room("roof_control", type === "residential_district" ? "屋顶花园" : "顶层控制室", "控制", 0, -size.depth * 0.16, size.width * 0.46, size.depth * 0.28, "#25c9be"),
      room("roof_equipment", "通讯/空调阵列", "设备", 0, size.depth * 0.22, size.width * 0.64, size.depth * 0.26, "#159a93")
    ],
    corridors: [corridor("roof_walk", "维护通道", 0, 0, size.width * 0.7, 12)],
    facilities: [facility("antenna", "通讯阵列", "通讯", size.width * 0.32, -size.depth * 0.34)]
  };
}

function officeGround(size) {
  return {
    rooms: [
      room("lobby", "大堂", "公共", 0, -size.depth * 0.26, size.width * 0.55, size.depth * 0.28, "#25c9be"),
      room("meeting", "会议中心", "会议", -size.width * 0.25, size.depth * 0.15, size.width * 0.36, size.depth * 0.34, "#159a93"),
      room("security", "门禁安保", "安保", size.width * 0.28, size.depth * 0.12, size.width * 0.28, size.depth * 0.3, "#1f8f9a")
    ],
    corridors: [corridor("main_hall", "主通道", 0, 0, size.width * 0.78, 14)],
    facilities: [facility("lift", "电梯组", "电梯", 0, size.depth * 0.36), facility("gate", "门禁", "门禁", 0, -size.depth * 0.44)]
  };
}

function officeStandard(size) {
  return {
    rooms: [
      room("open_office", "开放办公区", "办公", -size.width * 0.2, -size.depth * 0.12, size.width * 0.46, size.depth * 0.48, "#25c9be"),
      room("conference", "会议室", "会议", size.width * 0.28, -size.depth * 0.2, size.width * 0.28, size.depth * 0.26, "#159a93"),
      room("server", "数据/弱电间", "设备", size.width * 0.28, size.depth * 0.2, size.width * 0.28, size.depth * 0.26, "#1f8f9a")
    ],
    corridors: [corridor("office_hall", "环形走廊", 0, 0, size.width * 0.82, 14)],
    facilities: [facility("lift", "电梯", "电梯", 0, size.depth * 0.38), facility("stair", "楼梯", "楼梯", -size.width * 0.38, size.depth * 0.34)]
  };
}

function hospitalGround(size) {
  return {
    rooms: [
      room("er", "急诊大厅", "医疗", -size.width * 0.24, -size.depth * 0.2, size.width * 0.38, size.depth * 0.34, "#25c9be"),
      room("pharmacy", "药房", "医疗", size.width * 0.24, -size.depth * 0.2, size.width * 0.3, size.depth * 0.26, "#159a93"),
      room("imaging", "影像检查", "医疗", -size.width * 0.24, size.depth * 0.2, size.width * 0.36, size.depth * 0.3, "#1f8f9a"),
      room("triage", "分诊/候诊", "公共", size.width * 0.24, size.depth * 0.18, size.width * 0.34, size.depth * 0.32, "#32d6cc")
    ],
    corridors: [corridor("medical_hall", "医疗主通道", 0, 0, size.width * 0.84, 16)],
    facilities: [facility("medical", "医疗点", "医疗", 0, -size.depth * 0.42), facility("lift", "病床电梯", "电梯", 0, size.depth * 0.42)]
  };
}

function hospitalWard(size) {
  return {
    rooms: [
      room("ward_a", "病房 A", "医疗", -size.width * 0.28, -size.depth * 0.22, size.width * 0.34, size.depth * 0.28, "#25c9be"),
      room("ward_b", "病房 B", "医疗", size.width * 0.28, -size.depth * 0.22, size.width * 0.34, size.depth * 0.28, "#25c9be"),
      room("icu", "ICU/护理站", "医疗", -size.width * 0.22, size.depth * 0.2, size.width * 0.34, size.depth * 0.3, "#159a93"),
      room("operation", "手术/处置区", "医疗", size.width * 0.26, size.depth * 0.2, size.width * 0.34, size.depth * 0.3, "#1f8f9a")
    ],
    corridors: [corridor("ward_hall", "病区走廊", 0, 0, size.width * 0.86, 14)],
    facilities: [facility("lift", "电梯", "电梯", 0, size.depth * 0.4), facility("medical", "护理站", "医疗", 0, 0)]
  };
}

function labGround(size) {
  return {
    rooms: [
      room("control", "任务控制室", "控制", -size.width * 0.25, -size.depth * 0.18, size.width * 0.38, size.depth * 0.34, "#25c9be"),
      room("clean", "洁净实验室", "实验", size.width * 0.24, -size.depth * 0.18, size.width * 0.34, size.depth * 0.34, "#159a93"),
      room("test", "测试厅", "实验", 0, size.depth * 0.22, size.width * 0.7, size.depth * 0.28, "#1f8f9a")
    ],
    corridors: [corridor("lab_hall", "实验主通道", 0, 0, size.width * 0.84, 14)],
    facilities: [facility("lab", "实验设备", "实验", size.width * 0.36, size.depth * 0.36), facility("gate", "门禁", "门禁", -size.width * 0.36, -size.depth * 0.36)]
  };
}

function labStandard(size) {
  return {
    rooms: [
      room("lab_a", "实验室 A", "实验", -size.width * 0.28, -size.depth * 0.18, size.width * 0.34, size.depth * 0.34, "#25c9be"),
      room("lab_b", "实验室 B", "实验", size.width * 0.28, -size.depth * 0.18, size.width * 0.34, size.depth * 0.34, "#159a93"),
      room("data", "数据中心", "设备", 0, size.depth * 0.24, size.width * 0.58, size.depth * 0.26, "#1f8f9a")
    ],
    corridors: [corridor("lab_loop", "实验走廊", 0, 0, size.width * 0.82, 14)],
    facilities: [facility("lab", "实验设备", "实验", 0, -size.depth * 0.38), facility("lift", "电梯", "电梯", 0, size.depth * 0.38)]
  };
}

function residentialGround(size) {
  return {
    rooms: [
      room("lobby", "社区大堂", "公共", 0, -size.depth * 0.24, size.width * 0.48, size.depth * 0.28, "#25c9be"),
      room("shop", "便民设施", "公共", -size.width * 0.28, size.depth * 0.18, size.width * 0.32, size.depth * 0.28, "#159a93"),
      room("property", "物业/安保", "安保", size.width * 0.28, size.depth * 0.18, size.width * 0.32, size.depth * 0.28, "#1f8f9a")
    ],
    corridors: [corridor("community_hall", "社区通道", 0, 0, size.width * 0.8, 14)],
    facilities: [facility("lift", "电梯", "电梯", 0, size.depth * 0.38), facility("gate", "门禁", "门禁", 0, -size.depth * 0.42)]
  };
}

function residentialStandard(size) {
  return {
    rooms: [
      room("unit_a", "住户 A", "住宅", -size.width * 0.28, -size.depth * 0.2, size.width * 0.32, size.depth * 0.3, "#25c9be"),
      room("unit_b", "住户 B", "住宅", size.width * 0.28, -size.depth * 0.2, size.width * 0.32, size.depth * 0.3, "#25c9be"),
      room("unit_c", "住户 C", "住宅", -size.width * 0.28, size.depth * 0.2, size.width * 0.32, size.depth * 0.3, "#159a93"),
      room("unit_d", "住户 D", "住宅", size.width * 0.28, size.depth * 0.2, size.width * 0.32, size.depth * 0.3, "#159a93")
    ],
    corridors: [corridor("residential_hall", "电梯走廊", 0, 0, size.width * 0.78, 14)],
    facilities: [facility("lift", "电梯", "电梯", 0, 0), facility("stair", "楼梯", "楼梯", -size.width * 0.42, 0)]
  };
}

function logisticsGround(size) {
  return {
    rooms: [
      room("loading", "装卸区", "仓储", -size.width * 0.24, 0, size.width * 0.44, size.depth * 0.62, "#25c9be"),
      room("sorting", "分拣/调度", "仓储", size.width * 0.26, -size.depth * 0.18, size.width * 0.34, size.depth * 0.32, "#159a93"),
      room("security", "安检/门禁", "安保", size.width * 0.26, size.depth * 0.2, size.width * 0.34, size.depth * 0.28, "#1f8f9a")
    ],
    corridors: [corridor("logistics_lane", "物流通道", 0, 0, size.width * 0.88, 16)],
    facilities: [facility("storage", "货架点", "仓储", -size.width * 0.42, size.depth * 0.34), facility("gate", "出入口", "门禁", size.width * 0.42, -size.depth * 0.34)]
  };
}

function logisticsStandard(size) {
  return {
    rooms: [
      room("storage_a", "仓储 A", "仓储", -size.width * 0.25, -size.depth * 0.18, size.width * 0.38, size.depth * 0.34, "#25c9be"),
      room("storage_b", "仓储 B", "仓储", size.width * 0.25, -size.depth * 0.18, size.width * 0.38, size.depth * 0.34, "#159a93"),
      room("ops", "调度室", "控制", 0, size.depth * 0.23, size.width * 0.52, size.depth * 0.26, "#1f8f9a")
    ],
    corridors: [corridor("storage_hall", "仓储走廊", 0, 0, size.width * 0.84, 14)],
    facilities: [facility("storage", "货架点", "仓储", 0, -size.depth * 0.38), facility("lift", "货梯", "电梯", 0, size.depth * 0.38)]
  };
}

function makeElement(kind, options) {
  return {
    id: options.id,
    kind,
    name: options.name,
    type: options.type || interiorElementKinds[kind],
    status: options.status || "正常",
    color: options.color || "#25c9be",
    x: Math.round(options.x || 0),
    z: Math.round(options.z || 0),
    w: Math.round(options.w || 32),
    d: Math.round(options.d || 24)
  };
}

function room(id, name, type, x, z, w, d, color) {
  return makeElement("room", { id, name, type, x, z, w, d, color });
}

function corridor(id, name, x, z, w, d) {
  return makeElement("corridor", { id, name, type: "走廊", x, z, w, d, color: "#1f8f9a" });
}

function facility(id, name, type, x, z) {
  return makeElement("facility", { id, name, type, x, z, w: 16, d: 16, color: "#f7d46a" });
}

function range(start, end) {
  const values = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}
