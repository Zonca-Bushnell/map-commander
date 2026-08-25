export async function listSaves() {
  const response = await fetch("/api/list-saves");
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "读取存档列表失败");
  return payload;
}

export async function createSave({ title, password, scene }) {
  const response = await fetch("/api/create-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, password, scene })
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "创建存档失败");
  return payload;
}

export async function loadArchiveScene(access = {}) {
  const params = new URLSearchParams();
  if (access.saveId) params.set("saveId", access.saveId);
  if (access.password) params.set("password", access.password);
  const response = await fetch(`/api/load-scene?${params.toString()}`);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "读取存档失败");
  return payload;
}

export async function saveArchiveScene(scene, access = {}) {
  const response = await fetch("/api/save-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scene, saveId: access.saveId, password: access.password })
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "保存存档失败");
  return payload;
}
