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

  // Download without inserting the anchor into BGA's document.
  // A connected synthetic <a>.click() bubbles to Dojo's global navigation
  // handler and can trigger a spurious scriptError/navigation.
  const fileName = "bga-studio-manage-games-" + exportedAt.slice(0, 10) + ".csv";
  const downloadCSV = () => {
    const href = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    // Do not append the anchor to document.body.
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
  };

  window.BGA_STUDIO_MANAGE_GAMES_ROWS = projects;
  window.BGA_STUDIO_MANAGE_GAMES_CSV = csv;
  downloadCSV();

  // Console scripts often lack a user-activation gesture, so browsers may
  // reject navigator.clipboard.writeText(). Supply an explicit Copy button.
  document.getElementById("bga-manage-export-actions")?.remove();

  const actions = document.createElement("section");
  actions.id = "bga-manage-export-actions";
  actions.setAttribute("role", "dialog");
  actions.setAttribute("aria-label", "BGA Manage Games export");
  actions.style.cssText = [
    "position:fixed", "right:16px", "bottom:16px", "z-index:2147483647",
    "width:min(540px,calc(100vw - 32px))", "max-height:80vh", "overflow:auto",
    "font:13px/1.4 system-ui,sans-serif", "color:#213246",
    "background:#fff", "border:1px solid #bacbd8", "border-radius:12px",
    "box-shadow:0 15px 50px #0004", "padding:15px"
  ].join(";");
  actions.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">',
    ' <strong style="font-size:15px">BGA Manage Games export</strong>',
    ' <button type="button" data-action="close" style="border:0;background:#eef2f5;border-radius:6px;padding:5px 10px;cursor:pointer">Close</button>',
    "</div>",
    '<p data-action="note" style="margin:8px 0;color:#526675"></p>',
    '<div style="display:flex;gap:8px;flex-wrap:wrap">',
    ' <button type="button" data-action="copy" style="background:#315e7b;color:#fff;border:0;border-radius:7px;padding:9px 12px;font-weight:700;cursor:pointer">Copy CSV</button>',
    ' <button type="button" data-action="download" style="background:#edf2f6;border:1px solid #cbd8e2;border-radius:7px;padding:9px 12px;cursor:pointer">Download again</button>',
    ' <button type="button" data-action="select" style="background:#edf2f6;border:1px solid #cbd8e2;border-radius:7px;padding:9px 12px;cursor:pointer">Select CSV manually</button>',
    "</div>",
    '<textarea data-action="csv" readonly spellcheck="false" aria-label="Exported CSV" style="display:block;width:100%;height:88px;resize:vertical;margin-top:10px;border:1px solid #ced9e1;border-radius:7px;padding:8px;font:11px/1.5 monospace"></textarea>',
    '<div data-action="message" style="font-size:11px;color:#49657a;margin-top:6px" role="status" aria-live="polite"></div>'
  ].join("");

  const $ = selector => actions.querySelector('[data-action="' + selector + '"]');
  const textarea = $("csv");
  textarea.value = csv;
  $("note").textContent = projects.length +
    " projects exported to " + fileName + ". Click Copy CSV to allow clipboard access, or import the downloaded file into Board Game Lab.";
  $("message").textContent = "If copying is blocked, use Select CSV manually, then Ctrl+C.";

  // Prevent BGA's delegated page click handlers from receiving panel clicks.
  actions.addEventListener("click", event => event.stopPropagation());
  $("close").addEventListener("click", () => actions.remove());
  $("download").addEventListener("click", downloadCSV);
  $("select").addEventListener("click", () => {
    textarea.focus();
    textarea.select();
    $("message").textContent = "CSV selected. Press Ctrl+C (or Cmd+C on Mac), then paste it into Board Game Lab.";
  });
  $("copy").addEventListener("click", async () => {
    let copied = false;
    // Must be invoked from the user's real button click.
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(csv);
        copied = true;
      }
    } catch { /* Fall back to document.execCommand. */ }
    if (!copied) {
      textarea.focus();
      textarea.select();
      try { copied = !!document.execCommand("copy"); }
      catch { /* Manual selection always remains available. */ }
    }
    $("message").textContent = copied ?
      "CSV copied (" + projects.length + " projects). Paste into the dashboard." :
      "Browser blocked automatic copying. CSV is selected: press Ctrl+C (or Cmd+C), or import the downloaded CSV file.";
  });
  document.body.appendChild(actions);

  console.table(projects.map(p => ({
    game: p["Game ID"], stage: p.Status,
    version: p["Public Version"], check: p["Last Project Check"]
  })));
  console.log("[BGA Manage Games] Exported " + projects.length +
    " projects. CSV downloaded. Use the floating Copy CSV button for clipboard; " +
    "or run copy(window.BGA_STUDIO_MANAGE_GAMES_CSV) in Chrome DevTools.");
})();