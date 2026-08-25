import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

export async function exportScreenshot(renderer) {
  renderer.renderLists.dispose();
  const dataUrl = renderer.domElement.toDataURL("image/png");
  const response = await fetch("/api/export-screenshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: `dispatch_editor_${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      dataUrl
    })
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "截图导出失败");
  return payload.path;
}

export async function exportGltf(scene) {
  const { isBinary, content } = await parseGltf(scene);
  const response = await fetch("/api/export-gltf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: `dispatch_editor_${new Date().toISOString().replace(/[:.]/g, "-")}.${isBinary ? "glb" : "gltf"}`,
      binary: isBinary,
      content
    })
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "glTF 导出失败");
  return payload.path;
}

export async function exportViewer(scene, sceneData, access = {}) {
  const { isBinary, content } = await parseGltf(scene);
  const response = await fetch("/api/export-viewer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene: sceneData, binary: isBinary, content, saveId: access.saveId, password: access.password })
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "观看网页导出失败");
  return payload;
}

function parseGltf(scene) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      (result) => {
        try {
          const isBinary = result instanceof ArrayBuffer;
          const content = isBinary
            ? btoa(String.fromCharCode(...new Uint8Array(result)))
            : JSON.stringify(result, null, 2);
          resolve({ isBinary, content });
        } catch (error) {
          reject(error);
        }
      },
      reject,
      { binary: false, onlyVisible: true }
    );
  });
}
