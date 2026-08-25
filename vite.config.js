import { defineConfig } from "vite";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DATA_ROOT = process.env.MAP_COMMANDER_DATA_DIR
  ? path.resolve(process.env.MAP_COMMANDER_DATA_DIR)
  : path.join(PROJECT_DIR, "data");
const MAP_ROOT = DATA_ROOT;
const SCENE_PATH = path.join(MAP_ROOT, "scene", "dispatch_city.scene.json");
const SAVES_DIR = path.join(MAP_ROOT, "saves");
const SAVE_MANIFEST_PATH = path.join(SAVES_DIR, "manifest.json");
const RENDERS_DIR = path.join(MAP_ROOT, "renders");
const MODELS_DIR = path.join(MAP_ROOT, "models");
const VIEWER_DIR = path.join(MAP_ROOT, "viewer");
const VIEWER_TEMPLATE_DIR = path.join(PROJECT_DIR, "src", "viewer-export");

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function safeName(name, fallback) {
  return String(name || fallback).replace(/[^\w.-]+/g, "_").slice(0, 80) || fallback;
}

function saveIdFromTitle(title) {
  const ascii = String(title || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${ascii || "save"}-${Date.now().toString(36)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password || ""), salt, 32).toString("hex");
  return { salt, hash };
}

function hasPassword(save) {
  return Boolean(save?.password?.salt && save?.password?.hash);
}

function verifySavePassword(save, password) {
  if (!hasPassword(save)) return true;
  if (!password) return false;
  const next = hashPassword(password, save.password.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(save.password.hash, "hex"));
}

function publicSave(save) {
  return {
    id: save.id,
    title: save.title,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    locked: hasPassword(save)
  };
}

function viewerPasswordHash(password) {
  return crypto.createHash("sha256").update(String(password || ""), "utf8").digest("hex");
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureSaveManifest() {
  await fs.mkdir(SAVES_DIR, { recursive: true });
  try {
    const manifest = JSON.parse(await fs.readFile(SAVE_MANIFEST_PATH, "utf8"));
    if (Array.isArray(manifest.saves)) return manifest;
  } catch {
    // Rebuild below.
  }

  const now = new Date().toISOString();
  const defaultSave = {
    id: "default",
    title: "榛樿瀛樻。",
    sceneFile: "default.scene.json",
    createdAt: now,
    updatedAt: now,
    password: null
  };
  const defaultScenePath = path.join(SAVES_DIR, defaultSave.sceneFile);
  if (await pathExists(SCENE_PATH)) {
    await fs.copyFile(SCENE_PATH, defaultScenePath);
  } else {
    await fs.writeFile(defaultScenePath, JSON.stringify({ version: 2, savedAt: now, objects: [] }, null, 2), "utf8");
  }
  const manifest = { version: 1, activeSaveId: defaultSave.id, saves: [defaultSave] };
  await fs.writeFile(SAVE_MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

async function writeSaveManifest(manifest) {
  await fs.mkdir(SAVES_DIR, { recursive: true });
  await fs.writeFile(SAVE_MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

async function getSaveById(saveId) {
  const manifest = await ensureSaveManifest();
  const save = manifest.saves.find((item) => item.id === saveId) || manifest.saves.find((item) => item.id === manifest.activeSaveId) || manifest.saves[0];
  return { manifest, save };
}

function getSaveScenePath(save) {
  return path.join(SAVES_DIR, save.sceneFile || `${save.id}.scene.json`);
}

async function copyViewerRuntime() {
  await fs.mkdir(path.join(VIEWER_DIR, "vendor", "addons", "controls"), { recursive: true });
  await fs.mkdir(path.join(VIEWER_DIR, "vendor", "addons", "loaders"), { recursive: true });
  await fs.mkdir(path.join(VIEWER_DIR, "vendor", "addons", "utils"), { recursive: true });
  await Promise.all([
    fs.copyFile(path.join(VIEWER_TEMPLATE_DIR, "index.html"), path.join(VIEWER_DIR, "dispatch_city_viewer.html")),
    fs.copyFile(path.join(VIEWER_TEMPLATE_DIR, "viewer.js"), path.join(VIEWER_DIR, "viewer.js")),
    fs.copyFile(path.join(VIEWER_TEMPLATE_DIR, "viewer.css"), path.join(VIEWER_DIR, "viewer.css")),
    fs.copyFile(path.join(PROJECT_DIR, "node_modules", "three", "build", "three.module.js"), path.join(VIEWER_DIR, "vendor", "three.module.js")),
    fs.copyFile(path.join(PROJECT_DIR, "node_modules", "three", "examples", "jsm", "controls", "OrbitControls.js"), path.join(VIEWER_DIR, "vendor", "addons", "controls", "OrbitControls.js")),
    fs.copyFile(path.join(PROJECT_DIR, "node_modules", "three", "examples", "jsm", "loaders", "GLTFLoader.js"), path.join(VIEWER_DIR, "vendor", "addons", "loaders", "GLTFLoader.js")),
    fs.copyFile(path.join(PROJECT_DIR, "node_modules", "three", "examples", "jsm", "utils", "BufferGeometryUtils.js"), path.join(VIEWER_DIR, "vendor", "addons", "utils", "BufferGeometryUtils.js"))
  ]);
}

async function writeViewerData(scene, content, binary, viewerAccess = {}) {
  const modelName = binary ? "dispatch_city_viewer.glb" : "dispatch_city_viewer.gltf";
  const modelPath = path.join(VIEWER_DIR, modelName);
  await fs.mkdir(VIEWER_DIR, { recursive: true });
  if (binary) await fs.writeFile(modelPath, Buffer.from(content, "base64"));
  else await fs.writeFile(modelPath, typeof content === "string" ? content : JSON.stringify(content, null, 2), "utf8");
  await fs.writeFile(path.join(VIEWER_DIR, "dispatch_city_viewer.scene.json"), JSON.stringify(scene, null, 2), "utf8");

  const modelBuffer = await fs.readFile(modelPath);
  const mime = binary ? "model/gltf-binary" : "model/gltf+json";
  const dataModule = [
    `export const VIEWER_SCENE = ${JSON.stringify(scene, null, 2)};`,
    `export const VIEWER_MODEL_URL = "data:${mime};base64,${modelBuffer.toString("base64")}";`,
    `export const VIEWER_ACCESS = ${JSON.stringify(viewerAccess, null, 2)};`
  ].join("\n\n");
  await fs.writeFile(path.join(VIEWER_DIR, "viewer-data.js"), dataModule, "utf8");
  await writeStandaloneViewerHtml(scene, modelBuffer, binary, viewerAccess);
  return modelPath;
}

function jsDataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
}

async function writeStandaloneViewerHtml(scene, modelBuffer, binary, viewerAccess = {}) {
  const [css, viewerJs, threeJs, orbitJs, gltfLoaderSource, bufferGeometryUtilsJs] = await Promise.all([
    fs.readFile(path.join(VIEWER_TEMPLATE_DIR, "viewer.css"), "utf8"),
    fs.readFile(path.join(VIEWER_TEMPLATE_DIR, "viewer.js"), "utf8"),
    fs.readFile(path.join(PROJECT_DIR, "node_modules", "three", "build", "three.module.js"), "utf8"),
    fs.readFile(path.join(PROJECT_DIR, "node_modules", "three", "examples", "jsm", "controls", "OrbitControls.js"), "utf8"),
    fs.readFile(path.join(PROJECT_DIR, "node_modules", "three", "examples", "jsm", "loaders", "GLTFLoader.js"), "utf8"),
    fs.readFile(path.join(PROJECT_DIR, "node_modules", "three", "examples", "jsm", "utils", "BufferGeometryUtils.js"), "utf8")
  ]);
  const gltfLoaderJs = gltfLoaderSource.replace("../utils/BufferGeometryUtils.js", "three/addons/utils/BufferGeometryUtils.js");
  const runtime = viewerJs.replace(/^import[^\n]+\n/gm, "").trimStart();
  const mime = binary ? "model/gltf-binary" : "model/gltf+json";
  const moduleCode = [
    'import * as THREE from "three";',
    'import { OrbitControls } from "three/addons/controls/OrbitControls.js";',
    'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";',
    `const VIEWER_SCENE = ${JSON.stringify(scene, null, 2)};`,
    `const VIEWER_MODEL_URL = "data:${mime};base64,${modelBuffer.toString("base64")}";`,
    `const VIEWER_ACCESS = ${JSON.stringify(viewerAccess, null, 2)};`,
    runtime
  ].join("\n");
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dispatch Map Viewer</title>
    <style>${css}</style>
    <script type="importmap">
      ${JSON.stringify({
        imports: {
          three: jsDataUrl(threeJs),
          "three/addons/controls/OrbitControls.js": jsDataUrl(orbitJs),
          "three/addons/loaders/GLTFLoader.js": jsDataUrl(gltfLoaderJs),
          "three/addons/utils/BufferGeometryUtils.js": jsDataUrl(bufferGeometryUtilsJs)
        }
      }, null, 8)}
    </script>
  </head>
  <body>
    <canvas id="viewer-scene"></canvas>
    <div class="hud">
      <strong>DISPATCH MAP VIEWER</strong>
      <span id="viewer-status">鍒濆鍖栦腑...</span>
    </div>
    <div class="controls">
      <button data-camera="dispatch">Dispatch</button>
      <button data-camera="topdown">Topdown</button>
      <button data-camera="lowOblique">Low Oblique</button>
      <button data-camera-mode="orbit">鏃嬭浆妯″紡</button>
      <button data-camera-mode="pan">骞崇Щ妯″紡</button>
      <button data-action="toggle-labels">鍚嶇О/绠ご</button>
      <button data-action="reset">閲嶇疆瑙嗚</button>
    </div>
    <script type="module">${moduleCode}</script>
  </body>
</html>`;
  await fs.writeFile(path.join(VIEWER_DIR, "dispatch_city_viewer.html"), html, "utf8");
}

function dispatchMapApiPlugin() {
  return {
    name: "dispatch-map-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!req.url?.startsWith("/api/")) return next();

          const parsedUrl = new URL(req.url, "http://localhost");

          if (req.method === "GET" && parsedUrl.pathname === "/api/project-info") {
            return sendJson(res, 200, { mapRoot: MAP_ROOT, scenePath: SCENE_PATH, savesDir: SAVES_DIR, rendersDir: RENDERS_DIR, modelsDir: MODELS_DIR });
          }

          if (req.method === "GET" && parsedUrl.pathname === "/api/list-saves") {
            const manifest = await ensureSaveManifest();
            return sendJson(res, 200, {
              ok: true,
              activeSaveId: manifest.activeSaveId,
              saves: manifest.saves.map(publicSave)
            });
          }

          if (req.method === "POST" && parsedUrl.pathname === "/api/create-save") {
            const body = await readJsonBody(req);
            const manifest = await ensureSaveManifest();
            const now = new Date().toISOString();
            const save = {
              id: saveIdFromTitle(body.title),
              title: String(body.title || "New Save").trim().slice(0, 60) || "New Save",
              sceneFile: `${Date.now().toString(36)}.scene.json`,
              createdAt: now,
              updatedAt: now,
              password: body.password ? hashPassword(body.password) : null
            };
            const emptyScene = { version: 2, savedAt: now, objects: [] };
            await fs.writeFile(getSaveScenePath(save), JSON.stringify(body.scene || emptyScene, null, 2), "utf8");
            manifest.saves.push(save);
            manifest.activeSaveId = save.id;
            await writeSaveManifest(manifest);
            return sendJson(res, 200, { ok: true, save: publicSave(save), scene: body.scene || emptyScene });
          }

          if (req.method === "GET" && parsedUrl.pathname === "/api/load-scene") {
            const saveId = parsedUrl.searchParams.get("saveId");
            const password = parsedUrl.searchParams.get("password") || "";
            const { manifest, save } = await getSaveById(saveId);
            if (!save) return sendJson(res, 404, { ok: false, error: "Save not found" });
            if (!verifySavePassword(save, password)) return sendJson(res, 403, { ok: false, error: "Password required or incorrect" });
            try {
              const scenePath = getSaveScenePath(save);
              const scene = JSON.parse(await fs.readFile(scenePath, "utf8"));
              manifest.activeSaveId = save.id;
              await writeSaveManifest(manifest);
              return sendJson(res, 200, { ok: true, scene, path: scenePath, save: publicSave(save) });
            } catch (error) {
              if (error.code === "ENOENT") return sendJson(res, 200, { ok: true, scene: null, path: getSaveScenePath(save), save: publicSave(save) });
              throw error;
            }
          }

          if (req.method === "POST" && parsedUrl.pathname === "/api/save-scene") {
            const body = await readJsonBody(req);
            const { manifest, save } = await getSaveById(body.saveId);
            if (!save) return sendJson(res, 404, { ok: false, error: "Save not found" });
            if (!verifySavePassword(save, body.password || "")) return sendJson(res, 403, { ok: false, error: "Password required or incorrect" });
            const scenePath = getSaveScenePath(save);
            save.updatedAt = new Date().toISOString();
            manifest.activeSaveId = save.id;
            await fs.mkdir(path.dirname(scenePath), { recursive: true });
            await fs.writeFile(scenePath, JSON.stringify(body.scene ?? body, null, 2), "utf8");
            await writeSaveManifest(manifest);
            return sendJson(res, 200, { ok: true, path: scenePath, save: publicSave(save) });
          }

          if (req.method === "POST" && parsedUrl.pathname === "/api/export-screenshot") {
            const body = await readJsonBody(req);
            const fileName = safeName(body.fileName, `dispatch_editor_${Date.now()}.png`);
            const target = path.join(RENDERS_DIR, fileName.endsWith(".png") ? fileName : `${fileName}.png`);
            const data = String(body.dataUrl || "").replace(/^data:image\/png;base64,/, "");
            await fs.mkdir(RENDERS_DIR, { recursive: true });
            await fs.writeFile(target, Buffer.from(data, "base64"));
            return sendJson(res, 200, { ok: true, path: target });
          }

          if (req.method === "POST" && parsedUrl.pathname === "/api/export-gltf") {
            const body = await readJsonBody(req);
            const extension = body.binary ? ".glb" : ".gltf";
            const fileName = safeName(body.fileName, `dispatch_editor_${Date.now()}${extension}`);
            const target = path.join(MODELS_DIR, fileName.endsWith(extension) ? fileName : `${fileName}${extension}`);
            await fs.mkdir(MODELS_DIR, { recursive: true });
            if (body.binary) await fs.writeFile(target, Buffer.from(body.content, "base64"));
            else await fs.writeFile(target, typeof body.content === "string" ? body.content : JSON.stringify(body.content, null, 2), "utf8");
            return sendJson(res, 200, { ok: true, path: target });
          }

          if (req.method === "POST" && parsedUrl.pathname === "/api/export-viewer") {
            const body = await readJsonBody(req);
            if (body.saveId === "__test__") {
              const viewerAccess = { saveId: "__test__", title: "娴嬭瘯 JSON", locked: false, passwordHash: null, testOnly: true };
              await copyViewerRuntime();
              const modelPath = await writeViewerData(body.scene ?? {}, body.content, Boolean(body.binary), viewerAccess);
              return sendJson(res, 200, {
                ok: true,
                viewerDir: VIEWER_DIR,
                htmlPath: path.join(VIEWER_DIR, "dispatch_city_viewer.html"),
                modelPath
              });
            }
            const { save } = await getSaveById(body.saveId);
            if (save && !verifySavePassword(save, body.password || "")) return sendJson(res, 403, { ok: false, error: "Password required or incorrect" });
            const viewerAccess = save ? {
              saveId: save.id,
              title: save.title,
              locked: hasPassword(save),
              passwordHash: hasPassword(save) ? viewerPasswordHash(body.password || "") : null
            } : { locked: false };
            await copyViewerRuntime();
            const modelPath = await writeViewerData(body.scene ?? {}, body.content, Boolean(body.binary), viewerAccess);
            return sendJson(res, 200, {
              ok: true,
              viewerDir: VIEWER_DIR,
              htmlPath: path.join(VIEWER_DIR, "dispatch_city_viewer.html"),
              modelPath
            });
          }

          return sendJson(res, 404, { ok: false, error: "Unknown API endpoint" });
        } catch (error) {
          return sendJson(res, 500, { ok: false, error: error.message });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [dispatchMapApiPlugin()],
  server: {
    host: "127.0.0.1",
    port: 5177
  }
});

