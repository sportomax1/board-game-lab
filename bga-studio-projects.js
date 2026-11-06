/* BGA Manage Games SPA — local-only snapshot dashboard */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const DB_NAME = "bgl-bga-manage-games";
const DB_STORE = "snapshots";
const FALLBACK_KEY = "bgl-bga-manage-games-v1";
const MAX_SNAPSHOTS = 25;
let snapshots = [];
let selectedIndex = 0;
let displayedRows = [];
let exporterCode = "";

function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function safeUrl(value, project = false) {
  try {
    const u = new URL(String(value));
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (project && (u.hostname !== "studio.boardgamearena.com" ||
      !u.pathname.endsWith("/studiogame") || !u.searchParams.get("game"))) return "";
    return u.href;
  } catch { return ""; }
}
function msg(value, type = "") {
  $("message").textContent = value;
  $("message").className = "status " + type;
}
function column(row, names) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n) &&
        row[n] !== null && row[n] !== undefined) return row[n];
  }
  return "";
}
function csvParse(input) {
  const text = String(input).replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/).find(v => v.trim()) || "";
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : ",";
  const data = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      if (field === "") quoted = true;
      else field += c;
    } else if (c === sep) {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, "")); field = "";
      if (row.some(v => v.trim())) data.push(row);
      row = [];
    } else if (c !== "\r") field += c;
  }
  if (quoted) throw Error("Unclosed quoted value in CSV");
  row.push(field);
  if (row.some(v => v.trim())) data.push(row);
  if (data.length < 2) throw Error("CSV contains no project rows");
  const headers = data.shift().map(h => clean(h));
  if (!headers.includes("Game ID") && !headers.includes("Studio Project URL")) {
    throw Error("This does not look like a Manage Games export. Expected Game ID or Studio Project URL; the Available Licences TSV belongs in the licensing checker.");
  }
  return data.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}
function normalize(row) {
  let id = clean(column(row, ["gameId", "game_id", "Game ID"]));
  const incoming = clean(column(row, ["projectUrl", "studio_project_url", "Studio Project URL"]));
  if (!id && incoming) {
    try { id = new URL(incoming).searchParams.get("game") || ""; } catch {}
  }
  if (!id) return null;
  const suppliedUrl = safeUrl(incoming, true);
  const projectUrl = suppliedUrl ||
    "https://studio.boardgamearena.com/studiogame?game=" + encodeURIComponent(id);
  const check = clean(column(row, ["projectCheck", "lastProjectCheck", "Last Project Check"]));
  const rawIssues = column(row, ["warningCount", "Warning Count"]);
  let warningCount = rawIssues === "" || rawIssues === null || rawIssues === undefined ?
    (/⚠/.test(check) ? Number(check.match(/\d+/)?.[0] || 0) : null) : Number(rawIssues);
  if (!Number.isFinite(warningCount) || warningCount < 0) warningCount = null;
  const rawResult = clean(column(row, ["checkResult", "Check Result"])).toLowerCase();
  const checkResult = ["warning", "passed", "unknown"].includes(rawResult) ? rawResult :
    /⚠/.test(check) ? "warning" : /✅|✔/.test(check) ? "passed" : "unknown";
  const stage = clean(column(row, ["stage", "status", "Status"])).toLowerCase() || "unknown";
  const visibility = clean(column(row, ["visibility", "Visibility Indicator"])).toLowerCase();
  return {
    gameId: id,
    name: clean(column(row, ["name", "Name"])) || id,
    stage,
    visibility: ["red", "orange", "green"].includes(visibility) ? visibility : "unknown",
    thumbnailUrl: safeUrl(column(row, ["thumbnailUrl", "Thumbnail URL"])),
    localVersion: clean(column(row, ["localVersion", "Local Version Date"])),
    publicVersion: clean(column(row, ["publicVersion", "Public Version"])),
    projectCheck: check,
    warningCount,
    checkResult,
    projectUrl
  };
}
function parseImport(text) {
  if (!String(text).trim()) throw Error("No data supplied");
  let records, exportedAt;
  const trimmed = String(text).trim();
  if (trimmed[0] === "{" || trimmed[0] === "[") {
    const raw = JSON.parse(trimmed);
    records = Array.isArray(raw) ? raw : raw.projects || raw.rows;
    exportedAt = raw.exportedAt || raw.exported_at;
    if (!Array.isArray(records)) throw Error("JSON must contain an array of projects or rows");
  } else {
    records = csvParse(text);
    exportedAt = column(records[0] || {}, ["Exported At"]);
  }
  const map = new Map();
  for (const row of records) {
    const normalized = normalize(row);
    if (normalized) map.set(normalized.gameId, normalized);
  }
  const projects = [...map.values()];
  if (!projects.length) throw Error("No valid Manage Games project IDs found");
  return { projects, exportedAt: clean(exportedAt) || new Date().toISOString() };
}
function openDB() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) {
          req.result.createObjectStore(DB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}
let dbPromise = openDB();
async function loadSnapshots() {
  const db = await dbPromise;
  if (db) {
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const req = tx.objectStore(DB_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }
  try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) || "[]"); }
  catch { return []; }
}
async function persist() {
  const db = await dbPromise;
  if (db) {
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        const store = tx.objectStore(DB_STORE);
        store.clear();
        for (const snapshot of snapshots) store.put(snapshot);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return;
    } catch {}
  }
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshots));
}
function snapshotSort() {
  snapshots.sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || "") ||
    String(b.id).localeCompare(String(a.id)));
  snapshots = snapshots.slice(0, MAX_SNAPSHOTS);
}
async function importText(text) {
  const parsed = parseImport(text);
  const now = new Date().toISOString();
  snapshots.unshift({
    id: now + "-" + Math.floor(Math.random() * 1000000),
    exportedAt: parsed.exportedAt,
    savedAt: now,
    projects: parsed.projects
  });
  snapshotSort();
  selectedIndex = 0;
  await persist();
  $("pasteData").value = "";
  render();
  msg("Imported " + parsed.projects.length + " projects. Snapshot saved in this browser.", "success");
}
function selected() { return snapshots[selectedIndex] || null; }
function comparison() {
  const current = selected();
  const older = snapshots[selectedIndex + 1] || null;
  const markers = new Map();
  const details = [];
  if (!current || !older) return { markers, details, older: false };
  const oldMap = new Map(older.projects.map(p => [p.gameId, p]));
  const newIds = new Set(current.projects.map(p => p.gameId));
  for (const p of current.projects) {
    const prev = oldMap.get(p.gameId);
    if (!prev) { markers.set(p.gameId, ["New project"]); details.push(p.name + ": added"); continue; }
    const change = [];
    if (p.stage !== prev.stage) change.push("Stage: " + prev.stage + " → " + p.stage);
    if (p.publicVersion !== prev.publicVersion) change.push("Public version changed");
    if (p.localVersion !== prev.localVersion) change.push("Local version changed");
    if (p.checkResult !== prev.checkResult || p.warningCount !== prev.warningCount) change.push("Check changed");
    if (p.visibility !== prev.visibility) change.push("Visibility changed");
    if (change.length) { markers.set(p.gameId, change); details.push(p.name + ": " + change.join(", ")); }
  }
  for (const p of older.projects) {
    if (!newIds.has(p.gameId)) details.push(p.name + ": removed");
  }
  return { markers, details, older: true };
}
function stageClass(stage) {
  if (stage.includes("public alpha")) return "public";
  if (stage.includes("private alpha")) return "private";
  if (stage.includes("beta")) return "beta";
  if (stage.includes("released")) return "released";
  if (stage.includes("not deployed")) return "none";
  return "";
}
function node(tag, cls = "", text = "") {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.textContent = text;
  return e;
}
function cell(tr, value, cls = "") {
  const td = node("td", cls);
  if (value instanceof Node) td.appendChild(value);
  else td.textContent = String(value ?? "");
  tr.appendChild(td);
  return td;
}
function drawRow(p, changed) {
  const tr = document.createElement("tr");
  const game = node("div", "game-cell");
  if (p.thumbnailUrl) {
    const img = node("img", "thumb");
    img.src = p.thumbnailUrl; img.alt = ""; img.loading = "lazy";
    img.onerror = () => img.remove();
    game.appendChild(img);
  }
  const titleWrap = node("div");
  const a = node("a", "name", p.name);
  a.href = p.projectUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
  titleWrap.appendChild(a);
  titleWrap.appendChild(node("div", "id", p.gameId));
  game.appendChild(titleWrap);
  cell(tr, game);
  const stagePill = node("span", "pill " + stageClass(p.stage), p.stage);
  cell(tr, stagePill);
  const visibility = node("span", "", p.visibility === "red" ? "Hidden" :
    p.visibility === "orange" ? "Blocked" : p.visibility === "green" ? "Playable" : "Unknown");
  visibility.prepend(node("span", "dot " + (p.visibility === "unknown" ? "" : p.visibility)));
  cell(tr, visibility);
  cell(tr, p.localVersion || "—", "code");
  cell(tr, p.publicVersion || "—", "code");
  const check = node("span", "check " + p.checkResult,
    p.projectCheck || (p.checkResult === "warning" ? "Warning" : "—"));
  cell(tr, check);
  const changedBox = node("div");
  for (const detail of (changed || [])) {
    changedBox.appendChild(node("div", detail === "New project" ? "new" : "change", detail));
  }
  cell(tr, changedBox);
  return tr;
}
function filtered() {
  const snap = selected();
  if (!snap) return [];
  const term = clean($("search").value).toLowerCase();
  const stage = $("stage").value, check = $("check").value;
  const visibility = $("visibility").value;
  const rows = snap.projects.filter(p =>
    (!term || (p.name + " " + p.gameId).toLowerCase().includes(term)) &&
    (!stage || p.stage === stage) &&
    (!check || p.checkResult === check) &&
    (!visibility || p.visibility === visibility)
  );
  const sort = $("sort").value;
  rows.sort((a, b) => {
    if (sort === "warnings") {
      const aNum = a.checkResult === "warning" ? (a.warningCount || 1) : 0;
      const bNum = b.checkResult === "warning" ? (b.warningCount || 1) : 0;
      if (bNum !== aNum) return bNum - aNum;
      return (b.localVersion || "").localeCompare(a.localVersion || "");
    }
    if (sort === "recent") return (b.localVersion || "").localeCompare(a.localVersion || "");
    if (sort === "stage") return a.stage.localeCompare(b.stage) || a.name.localeCompare(b.name);
    if (sort === "name-desc") return b.name.localeCompare(a.name);
    return a.name.localeCompare(b.name);
  });
  return rows;
}
function renderTable() {
  const snap = selected();
  if (!snap) return;
  const change = comparison();
  displayedRows = filtered();
  const body = $("rows");
  const frag = document.createDocumentFragment();
  for (const p of displayedRows) frag.appendChild(drawRow(p, change.markers.get(p.gameId)));
  body.replaceChildren(frag);
  $("noMatches").hidden = displayedRows.length > 0;
  $("matchCount").textContent = displayedRows.length + " of " +
    snap.projects.length + " games";
}
function render() {
  const snap = selected();
  $("dashboard").hidden = !snap;
  $("empty").hidden = !!snap;
  if (!snap) return;
  $("kTotal").textContent = snap.projects.length;
  $("kPublic").textContent = snap.projects.filter(p => p.stage.includes("public alpha")).length;
  $("kPrivate").textContent = snap.projects.filter(p => p.stage.includes("private alpha")).length;
  $("kBeta").textContent = snap.projects.filter(p => p.stage.includes("beta") ||
    p.stage.includes("released")).length;
  $("kWarn").textContent = snap.projects.filter(p => p.checkResult === "warning").length;
  $("kNone").textContent = snap.projects.filter(p => p.stage.includes("not deployed")).length;

  const dropdown = $("historySelect");
  const existingIndex = selectedIndex;
  dropdown.replaceChildren();
  snapshots.forEach((s, i) => {
    const opt = new Option(
      (s.exportedAt || s.savedAt || "Snapshot").replace("T", " ").slice(0, 19) +
      " · " + s.projects.length + " games", String(i));
    dropdown.add(opt);
  });
  dropdown.value = String(existingIndex);
  $("snapshotMeta").textContent = "Exported " + (snap.exportedAt || "unknown") +
    " · Imported " + (snap.savedAt || "unknown") +
    " · " + snapshots.length + " local snapshot(s)";

  const stage = $("stage"), previousStage = stage.value;
  const stages = [...new Set(snap.projects.map(p => p.stage))].sort();
  stage.replaceChildren(new Option("All stages", ""));
  stages.forEach(s => stage.add(new Option(s, s)));
  stage.value = stages.includes(previousStage) ? previousStage : "";

  const diffs = comparison();
  $("diffSummary").textContent = diffs.older ?
    diffs.details.length + " differences from previous snapshot" :
    "Import another snapshot to track changes";
  const changeList = $("changeList");
  changeList.replaceChildren();
  for (const detail of diffs.details.slice(0, 15)) {
    changeList.appendChild(node("span", "diff", detail));
  }
  if (diffs.details.length > 15)
    changeList.appendChild(node("span", "diff", "+" + (diffs.details.length - 15) + " more"));
  renderTable();
}
function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function downloadCSV() {
  const headers = ["Game ID", "Name", "Status", "Visibility Indicator",
    "Local Version Date", "Public Version", "Last Project Check",
    "Warning Count", "Check Result", "Thumbnail URL", "Studio Project URL", "Exported At"];
  const keys = ["gameId", "name", "stage", "visibility", "localVersion",
    "publicVersion", "projectCheck", "warningCount", "checkResult",
    "thumbnailUrl", "projectUrl", "exportedAt"];
  const data = [headers.map(csvCell).join(",")];
  for (const p of displayedRows) {
    data.push(keys.map(k => csvCell(k === "exportedAt" ? selected()?.exportedAt : p[k])).join(","));
  }
  const blob = new Blob(["\uFEFF", data.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = node("a");
  a.href = href;
  a.download = "bga-manage-games-filtered-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}
async function showScript(shouldShow = true) {
  if (!exporterCode) {
    const res = await fetch("./tools/bga-studio-export-console.js", { cache: "no-store" });
    if (!res.ok) throw Error("Could not load console script (HTTP " + res.status + ")");
    exporterCode = await res.text();
  }
  $("scriptText").value = exporterCode;
  $("scriptPanel").hidden = !shouldShow;
  $("showScript").setAttribute("aria-expanded", String(shouldShow));
  $("showScript").textContent = shouldShow ? "Hide script" : "Show script";
  return exporterCode;
}
async function importFromFile() {
  const input = $("csvFile");
  if (!input.files?.length) return;
  try {
    await importText(await input.files[0].text());
  } catch (e) { msg("Import failed: " + e.message, "error"); }
  finally { input.value = ""; }
}
function wire() {
  $("csvFile").addEventListener("change", importFromFile);
  $("importPaste").addEventListener("click", async () => {
    try { await importText($("pasteData").value); }
    catch (e) { msg("Import failed: " + e.message, "error"); }
  });
  $("resetPaste").addEventListener("click", () => { $("pasteData").value = ""; });
  $("copyScript").addEventListener("click", async () => {
    try {
      const source = await showScript(true);
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(source);
          copied = true;
        }
      } catch {}
      if (!copied) {
        $("scriptText").focus();
        $("scriptText").select();
        try { copied = document.execCommand("copy"); } catch {}
      }
      msg(copied ? "Console script copied. Paste it on the BGA Manage Games page." :
        "Script loaded below. Select all in the script box and copy it manually.",
        copied ? "success" : "");
    } catch (e) { msg(e.message, "error"); }
  });
  $("showScript").addEventListener("click", async () => {
    const shouldShow = $("scriptPanel").hidden;
    try { await showScript(shouldShow); }
    catch (e) { msg(e.message, "error"); }
  });
  $("historySelect").addEventListener("change", e => {
    selectedIndex = Number(e.target.value) || 0;
    render();
  });
  $("exportCsv").addEventListener("click", downloadCSV);
  $("clearHistory").addEventListener("click", async () => {
    if (!confirm("Delete ALL saved BGA Manage Games snapshots from this browser?")) return;
    snapshots = []; selectedIndex = 0;
    try { await persist(); render(); msg("Local snapshots deleted.", "success"); }
    catch (e) { msg("Could not clear local snapshots: " + e.message, "error"); }
  });
  ["search", "stage", "check", "visibility", "sort"].forEach(id =>
    $(id).addEventListener(id === "search" ? "input" : "change", renderTable));
}
async function init() {
  wire();
  try {
    snapshots = await loadSnapshots();
    if (!Array.isArray(snapshots)) snapshots = [];
    snapshots = snapshots.filter(s => s && Array.isArray(s.projects));
    snapshotSort();
    render();
  } catch (e) {
    msg("Could not access saved data: " + e.message + ". CSV import still available.", "error");
  }
}
init();
})();