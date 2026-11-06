/* BGA Studio Manage Games exporter — run ONLY on https://studio.boardgamearena.com/studio
   Downloads CSV for Board Game Lab's bga-studio-projects.html.
   Runs entirely in the logged-in browser; does not send data anywhere. */
(async () => {
  "use strict";

  const validPage = location.hostname === "studio.boardgamearena.com" &&
    location.pathname.replace(/\/+$/, "") === "/studio";
  if (!validPage) {
    alert("Wrong page. Open https://studio.boardgamearena.com/studio (Manage Games), then run the script there.");
    return;
  }

  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const csvSafe = value => {
    const s = String(value ?? "");
    return /^[=+\-@\t\r\n]/.test(s) ? "'" + s : s;
  };
  const csvCell = value => '"' + csvSafe(value).replace(/"/g, '""') + '"';
  const safeUrl = (src, base = location.href) => {
    try {
      const u = new URL(src, base);
      return /^https?:$/.test(u.protocol) ? u.href : "";
    } catch { return ""; }
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // The Studio page renders a linked card for each game. Do not depend on
  // optional CSS classes or the unrelated /licensing table.
  const collectCards = () => [...document.querySelectorAll('a[href*="studiogame?game="]')]
    .filter(a => {
      try {
        const u = new URL(a.href, location.href);
        return u.hostname === "studio.boardgamearena.com" &&
          u.pathname.endsWith("/studiogame") && !!u.searchParams.get("game");
      } catch { return false; }
    });

  let cards = collectCards();
  for (let i = 0; i < 16 && !cards.length; i++) {
    await sleep(300);
    cards = collectCards();
  }
  if (!cards.length) {
    alert("No BGA Manage Games cards found. Let the page finish loading and retry. No file was exported.");
    return;
  }

  const exportedAt = new Date().toISOString();
  const projects = [];
  const seen = new Set();
  for (const card of cards) {
    const u = new URL(card.href, location.href);
    const gameId = u.searchParams.get("game") || "";
    if (!gameId || seen.has(gameId)) continue;
    seen.add(gameId);

    const heading = card.querySelector("h3") ||
      card.querySelector("h2") || card.querySelector("h4");
    const titleClone = heading?.cloneNode(true);
    titleClone?.querySelectorAll("img").forEach(el => el.remove());
    const headingText = clean(titleClone?.textContent || "");
    const explicitStage = clean(heading?.querySelector(".smalltext")?.textContent || "");
    const match = headingText.match(/\(([^()]*)\)\s*$/);
    const stage = clean(explicitStage || match?.[1] || "").
      replace(/^\(/, "").replace(/\)$/, "") || "unknown";
    const gameName = clean(headingText.replace(/\s*\([^()]*\)\s*$/, "")) || gameId;

    const imgs = [...card.querySelectorAll("img")];
    const thumb = card.querySelector("img.game_box") ||
      imgs.find(img => !/status-(?:red|orange|green)/i.test(img.src || "") &&
        (img.alt === gameId || /(?:en_75|default_box)/i.test(img.src || ""))) ||
      imgs.find(img => !/status-(?:red|orange|green)/i.test(img.src || ""));
    const statusImg = imgs.find(img => /status-(?:red|orange|green)/i.test(img.src || ""));

    // On this page the three .grid labels frequently precede three value spans.
    const gridCells = [...card.querySelectorAll(".grid > span")];
    const labels = gridCells.filter(el => el.classList.contains("label"))
      .map(el => clean(el.textContent).replace(/:$/, "").toLowerCase());
    const values = gridCells.filter(el => !el.classList.contains("label"))
      .map(el => clean(el.textContent));
    const valueFor = label => {
      const ix = labels.indexOf(label.toLowerCase());
      return ix < 0 ? "" : (values[ix] || "");
    };

    // Fallback for alternative markup: labels followed by the three values.
    const lines = String(card.innerText || card.textContent || "")
      .split(/\r?\n/).map(clean).filter(Boolean);
    const lastLabel = lines.findIndex(v => /^last project check\s*:?\s*$/i.test(v));
    const following = lastLabel < 0 ? [] : lines.slice(lastLabel + 1)
      .filter(v => !/^(local version|public version|last project check)\s*:?\s*$/i.test(v));
    const localVersion = valueFor("Local version") || following[0] || "";
    const publicVersion = valueFor("Public version") || following[1] || "";
    const check = valueFor("Last project check") || following[2] || "";
    const checkIssues = /⚠/.test(check) ?
      (Number(check.match(/\d+/)?.[0]) || 0) : /✅|✔/.test(check) ? 0 : null;
    const checkResult = /⚠/.test(check) ? "warning" :
      /✅|✔/.test(check) ? "passed" : "unknown";
    const indicator = (statusImg?.src || "").match(/status-(red|orange|green)/i)?.[1]?.toLowerCase() || "";

    const attributes = Object.fromEntries(
      [...card.attributes].map(a => [a.name, a.value])
    );
    projects.push({
      "Thumbnail URL": safeUrl(thumb?.src || ""),
      "Thumbnail Formula (Sheets/Excel)": thumb?.src ?
        '=IMAGE("' + safeUrl(thumb.src).replace(/"/g, '""') + '")' : "",
      "Name": gameName,
      "Status": stage,
      "Local Version Date": localVersion,
      "Public Version": publicVersion,
      "Last Project Check": check,
      "Game ID": gameId,
      "Studio Project URL": u.href,
      "Visibility Icon": safeUrl(statusImg?.src || ""),
      "Visibility Indicator": indicator,
      "Card Text": clean(card.innerText || card.textContent),
      "Link Attributes (JSON)": JSON.stringify(attributes),
      "Page URL": location.href,
      "Exported At": exportedAt,
      "Warning Count": checkIssues === null ? "" : checkIssues,
      "Check Result": checkResult
    });
  }

  if (!projects.length) {
    alert("No valid BGA projects found. Nothing exported.");
    return;
  }
  const columns = [
    "Thumbnail URL", "Thumbnail Formula (Sheets/Excel)", "Name",
    "Status", "Local Version Date", "Public Version",
    "Last Project Check", "Game ID", "Studio Project URL",
    "Visibility Icon", "Visibility Indicator", "Card Text",
    "Link Attributes (JSON)", "Page URL", "Exported At",
    "Warning Count", "Check Result"
  ];
  const csv = [columns.map(csvCell).join(","),
    ...projects.map(p => columns.map(key => csvCell(p[key])).join(","))].join("\r\n");

  // Download is the primary output; clipboard is a convenience only.
  const downloadUrl = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = "bga-studio-manage-games-" + exportedAt.slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
  window.BGA_STUDIO_MANAGE_GAMES_ROWS = projects;
  window.BGA_STUDIO_MANAGE_GAMES_CSV = csv;

  let copied = false;
  try { await navigator.clipboard.writeText(csv); copied = true; }
  catch { /* File download is still available. */ }
  console.table(projects.map(p => ({
    game: p["Game ID"], stage: p.Status,
    version: p["Public Version"], check: p["Last Project Check"]
  })));
  console.log("[BGA Manage Games] Exported " + projects.length +
    " projects. CSV downloaded; clipboard " + (copied ? "copied." : "not available."));
  alert("Export complete: " + projects.length +
    " games. Import the CSV into Board Game Lab → BGA Manage Games." +
    (copied ? "\nCSV also copied to clipboard." : ""));
})();