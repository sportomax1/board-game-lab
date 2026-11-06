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
let exporterPromise = null;
let viewMode = "swimlanes";
try { viewMode = localStorage.getItem("bga-manage-view") === "table" ? "table" : "swimlanes"; } catch {}

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
  $("message").className = "message-inline " + type;
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
  $("pastePanel").hidden = true;
  $("pasteToggle").setAttribute("aria-expanded", "false");
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
const SWIMLANE_ORDER = [
  ["not deployed", "Not deployed", "none"],
  ["private alpha", "Private Alpha", "private"],
  ["public alpha", "Public Alpha", "public"],
  ["beta", "Beta", "beta"],
  ["released", "Released", "released"],
  ["other", "Other", ""]
];
function laneKey(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("not deployed")) return "not deployed";
  if (s.includes("private alpha")) return "private alpha";
  if (s.includes("public alpha")) return "public alpha";
  if (s.includes("beta")) return "beta";
  if (s.includes("released")) return "released";
  return "other";
}
function makeSwimCard(p, changed) {
  const article = node("article", "swim-card");
  const top = node("div", "swim-top");
  if (p.thumbnailUrl) {
    const image = node("img", "thumb");
    image.src = p.thumbnailUrl;
    image.alt = "";
    image.loading = "lazy";
    image.onerror = () => image.remove();
    top.appendChild(image);
  }
  const nameBox = node("div", "swim-name");
  const nameLink = node("a", "", p.name);
  nameLink.href = p.projectUrl;
  nameLink.target = "_blank";
  nameLink.rel = "noopener noreferrer";
  nameBox.appendChild(nameLink);
  nameBox.appendChild(node("div", "id", p.gameId));
  top.appendChild(nameBox);
  article.appendChild(top);

  const flags = node("div", "swim-flags");
  const checkText = p.projectCheck || "Check unavailable";
  const checkLabel = p.checkResult === "warning" ? checkText :
    p.checkResult === "passed" ? "✓ Check passed" : checkText;
  flags.appendChild(node("span", "flag " +
    (p.checkResult === "warning" ? "warn" :
      p.checkResult === "passed" ? "passed" : "unknown"), checkLabel));
  const visibilityText = p.visibility === "red" ? "Hidden" :
    p.visibility === "orange" ? "Blocked" :
    p.visibility === "green" ? "Playable" : "Visibility ?";
  const vTag = node("span", "flag", visibilityText);
  vTag.prepend(node("span", "dot " + (p.visibility === "unknown" ? "" : p.visibility)));
  flags.appendChild(vTag);
  article.appendChild(flags);

  const meta = node("div", "swim-meta");
  if (p.localVersion) meta.appendChild(node("span", "", "Local: " + p.localVersion));
  if (p.publicVersion) meta.appendChild(node("span", "", "Public: " + p.publicVersion));
  article.appendChild(meta);
  if (changed?.length) {
    article.appendChild(node("div", "swim-change", changed.join(" · ")));
  }
  return article;
}
function renderSwimlanes(rows, changeMarkers) {
  const board = $("swimlanes");
  const groups = new Map(SWIMLANE_ORDER.map(([k]) => [k, []]));
  for (const p of rows) groups.get(laneKey(p.stage)).push(p);
  const frag = document.createDocumentFragment();
  for (const [key, title, css] of SWIMLANE_ORDER) {
    const items = groups.get(key);
    if (key === "other" && !items.length && !$("stage").value) continue;
    const lane = node("section", "lane " + css);
    lane.setAttribute("aria-label", title + " — " + items.length + " projects");
    const head = node("div", "lane-head");
    head.appendChild(node("strong", "", title));
    head.appendChild(node("span", "lane-count", String(items.length)));
    lane.appendChild(head);
    const cards = node("div", "lane-cards");
    if (!items.length) cards.appendChild(node("div", "lane-empty", "No projects"));
    for (const p of items) cards.appendChild(makeSwimCard(p, changeMarkers.get(p.gameId)));
    lane.appendChild(cards);
    frag.appendChild(lane);
  }
  board.replaceChildren(frag);
}
function setView(mode) {
  viewMode = mode === "table" ? "table" : "swimlanes";
  try { localStorage.setItem("bga-manage-view", viewMode); } catch {}
  const swim = viewMode === "swimlanes";
  $("viewSwimlanes").classList.toggle("active", swim);
  $("viewTable").classList.toggle("active", !swim);
  $("viewSwimlanes").setAttribute("aria-pressed", String(swim));
  $("viewTable").setAttribute("aria-pressed", String(!swim));
  $("swimlanes").hidden = !swim;
  $("tablePanel").hidden = swim;
}
function renderContent() {
  const snap = selected();
  if (!snap) { displayedRows = []; return; }
  const change = comparison();
  displayedRows = filtered();
  $("matchCount").textContent = displayedRows.length + " of " +
    snap.projects.length + " games";
  $("noMatches").hidden = displayedRows.length > 0;
  $("swimlanes").hidden = viewMode !== "swimlanes" || !displayedRows.length;
  $("tablePanel").hidden = viewMode !== "table" || !displayedRows.length;
  const frag = document.createDocumentFragment();
  for (const p of displayedRows) frag.appendChild(drawRow(p, change.markers.get(p.gameId)));
  $("rows").replaceChildren(frag);
  renderSwimlanes(displayedRows, change.markers);
}
function render() {
  const snap = selected();
  $("dashboard").hidden = !snap;
  $("empty").hidden = !!snap;
  $("copyCsv").disabled = !snap;
  $("exportCsv").disabled = !snap;
  setView(viewMode);
  if (!snap) return;
  $("currentSnapshotLabel").textContent = (snap.exportedAt || snap.savedAt || "").replace("T"," ").slice(0,19);
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
  renderContent();
}
function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function filteredCSV() {
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
  return data.join("\r\n");
}
function downloadCSV() {
  if (!selected()) return;
  const blob = new Blob(["\uFEFF", filteredCSV()], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = node("a");
  a.href = href;
  a.download = "bga-manage-games-filtered-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
  msg("Downloaded " + displayedRows.length + " visible games.", "success");
}
async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  let copied = false;
  try { copied = !!document.execCommand("copy"); } catch {}
  area.remove();
  return copied;
}
function exporterSource() {
  if (exporterCode) return Promise.resolve(exporterCode);
  if (!exporterPromise) {
    exporterPromise = fetch("./tools/bga-studio-export-console.js", {cache:"no-store"})
      .then(response => {
        if (!response.ok) throw Error("Script unavailable (HTTP " + response.status + ")");
        return response.text();
      })
      .then(value => { exporterCode = value; return value; })
      .catch(error => { exporterPromise = null; throw error; });
  }
  return exporterPromise;
}
async function copyScript() {
  try {
    // This fetch is started proactively when the SPA loads, keeping the
    // actual clipboard write inside the user's real click when cached.
    const source = exporterCode || await exporterSource();
    const copied = await copyText(source);
    if (copied) {
      $("scriptFallback").hidden = true;
      msg("Scraper copied. Open BGA Studio, press F12 → Console, and paste it.", "success");
    } else {
      $("scriptText").value = source;
      $("scriptFallback").hidden = false;
      $("scriptText").focus();
      $("scriptText").select();
      msg("Clipboard blocked. Script selected below; press Ctrl+C.", "error");
    }
  } catch (error) { msg(error.message, "error"); }
}
async function copyCSV() {
  if (!selected()) return;
  const csv = filteredCSV();
  const copied = await copyText(csv);
  if (copied) {
    msg("Copied " + displayedRows.length + " filtered games as CSV.", "success");
  } else {
    $("pastePanel").hidden = false;
    $("pasteToggle").setAttribute("aria-expanded", "true");
    $("pasteData").value = csv;
    $("pasteData").focus();
    $("pasteData").select();
    msg("Clipboard blocked. CSV selected in the paste field; press Ctrl+C.", "error");
  }
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
  $("pasteToggle").addEventListener("click", () => {
    const show = $("pastePanel").hidden;
    $("pastePanel").hidden = !show;
    $("pasteToggle").setAttribute("aria-expanded", String(show));
    if (show) $("pasteData").focus();
  });
  $("importPaste").addEventListener("click", async () => {
    try { await importText($("pasteData").value); }
    catch (error) { msg("Import failed: " + error.message, "error"); }
  });
  $("resetPaste").addEventListener("click", () => { $("pasteData").value = ""; });
  $("copyScript").addEventListener("click", copyScript);
  $("copyCsv").addEventListener("click", copyCSV);
  $("exportCsv").addEventListener("click", downloadCSV);
  $("viewSwimlanes").addEventListener("click", () => { setView("swimlanes"); renderContent(); });
  $("viewTable").addEventListener("click", () => { setView("table"); renderContent(); });
  $("historySelect").addEventListener("change", event => {
    selectedIndex = Number(event.target.value) || 0;
    render();
  });
  $("clearHistory").addEventListener("click", async () => {
    if (!confirm("Delete ALL saved BGA Manage Games snapshots from this browser?")) return;
    snapshots = []; selectedIndex = 0;
    try { await persist(); render(); msg("Local snapshots deleted.", "success"); }
    catch (error) { msg("Could not clear snapshots: " + error.message, "error"); }
  });
  ["search", "stage", "check", "visibility", "sort"].forEach(id =>
    $(id).addEventListener(id === "search" ? "input" : "change", renderContent));
  // Proactive fetch avoids losing clipboard user-activation while waiting on
  // a network request after clicking Copy scraper script.
  exporterSource().catch(() => {});
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