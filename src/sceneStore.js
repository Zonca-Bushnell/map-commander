import * as THREE from "three";
import { cloneInterior } from "./interiorData.js";

export const SCENE_VERSION = 2;

export function objectToRecord(object) {
  return {
    id: object.userData.id,
    name: object.name,
    kind: object.userData.kind,
    color: object.userData.color ?? "#27d8cc",
    position: object.position.toArray(),
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: object.scale.toArray(),
    dimensions: object.userData.dimensions ? [...object.userData.dimensions] : null,
    showNameplate: Boolean(object.userData.showNameplate),
    generator: object.userData.generator ? { ...object.userData.generator } : null,
    interior: cloneInterior(object.userData.interior)
  };
}

export function serializeScene(editables) {
  return {
    version: SCENE_VERSION,
    savedAt: new Date().toISOString(),
    objects: editables.map(objectToRecord)
  };
}

export function applyRecordToObject(object, record) {
  object.name = record.name || object.name;
  object.userData.id = record.id || object.userData.id;
  object.userData.kind = record.kind || object.userData.kind;
  object.userData.color = record.color ?? object.userData.color ?? "#27d8cc";
  object.userData.generator = record.generator ? { ...record.generator } : object.userData.generator;
  object.userData.dimensions = record.dimensions ? [...record.dimensions] : object.userData.dimensions;
  object.userData.showNameplate = Boolean(record.showNameplate);
  object.userData.interior = cloneInterior(record.interior);
  object.position.fromArray(record.position ?? [0, 0, 0]);
  object.rotation.set(...(record.rotation ?? [0, 0, 0]));
  object.scale.fromArray(record.scale ?? [1, 1, 1]);
}

export async function saveScene(scene) {
  const response = await fetch("/api/save-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene })
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "保存失败");
  return payload.path;
}

export async function loadScene() {
  const response = await fetch("/api/load-scene");
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "读取失败");
  return payload.scene;
}

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
