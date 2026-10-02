(() => {
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

  // Prevent spreadsheet formula injection from page text.
  const spreadsheetSafe = value => {
    const text = String(value ?? "");
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  };

  const csvCell = value =>
    `"${spreadsheetSafe(value).replaceAll('"', '""')}"`;

  const gameCards = [...document.querySelectorAll("a.bga-link")]
    .filter(card =>
      card.querySelector("img.game_box") &&
      /Local version:/.test(card.innerText || "") &&
      /Public version:/.test(card.innerText || "")
    );

  const rows = gameCards.map(card => {
    const title = card.querySelector("h3");
    const thumbnail = card.querySelector("img.game_box");
    const statusIcon = [...(title?.querySelectorAll("img") || [])]
      .find(img => !img.classList.contains("game_box"));

    const titleCopy = title?.cloneNode(true);
    titleCopy?.querySelectorAll("img, .smalltext").forEach(el => el.remove());

    const name = clean(titleCopy?.textContent);
    const status = clean(title?.querySelector(".smalltext")?.textContent)
      .replace(/^\(|\)$/g, "");

    // BGA uses a grid: first three cells are labels, next three cells are values.
    const gridCells = [...card.querySelectorAll(".grid > span")];
    const labels = gridCells
      .filter(cell => cell.classList.contains("label"))
      .map(cell => clean(cell.textContent).replace(/:$/, ""));
    const values = gridCells
      .filter(cell => !cell.classList.contains("label"))
      .map(cell => clean(cell.textContent));

    const getValue = label => {
      const index = labels.findIndex(x => x.toLowerCase() === label.toLowerCase());
      return index >= 0 ? values[index] ?? "" : "";
    };

    const url = new URL(card.href, location.origin);
    const gameId = url.searchParams.get("game") || "";

    const attributes = Object.fromEntries(
      [...card.attributes].map(a => [a.name, a.value])
    );

    return {
      "Thumbnail URL": thumbnail?.src || "",
      "Thumbnail Formula (Sheets/Excel)": thumbnail?.src
        ? `=IMAGE("${thumbnail.src}")`
        : "",
      "Name": name,
      "Status": status,
      "Local Version Date": getValue("Local version"),
      "Public Version": getValue("Public version"),
      "Last Project Check": getValue("Last project check"),
      "Game ID": gameId,
      "Studio Project URL": url.href,
      "Visibility Icon": statusIcon?.src || "",
      "Visibility Indicator": statusIcon?.src
        ? statusIcon.src.match(/status-([^.]+)/)?.[1] || ""
        : "",
      "Card Text": clean(card.innerText),
      "Link Attributes (JSON)": JSON.stringify(attributes),
      "Page URL": location.href,
      "Exported At": new Date().toISOString(),
    };
  });

  const columns = [
    "Thumbnail URL",
    "Thumbnail Formula (Sheets/Excel)",
    "Name",
    "Status",
    "Local Version Date",
    "Public Version",
    "Last Project Check",
    "Game ID",
    "Studio Project URL",
    "Visibility Icon",
    "Visibility Indicator",
    "Card Text",
    "Link Attributes (JSON)",
    "Page URL",
    "Exported At",
  ];

  const csv = [
    columns.map(csvCell).join(","),
    ...rows.map(row => columns.map(column => csvCell(row[column])).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8",
  });

  const downloadUrl = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: downloadUrl,
    download: `bga-studio-games-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
  });

  link.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

  console.table(rows);
  console.log(`Downloaded ${rows.length} BGA Studio projects.`);
})();