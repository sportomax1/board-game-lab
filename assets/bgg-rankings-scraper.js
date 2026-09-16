(async () => {
  const clean = el => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const headerKey = text => String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const csvEscape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const formatTime = ms => {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  const recordCount = Number(prompt(
    "How many top-ranked BGG games should I export?",
    "1000"
  ));

  if (!Number.isInteger(recordCount) || recordCount < 1) {
    throw new Error("Enter a whole number greater than zero.");
  }

  const pageCount = Math.ceil(recordCount / 100);

  if (recordCount > 10000 && !confirm(
    `${recordCount.toLocaleString()} games requires ${pageCount} pages. Continue?`
  )) return;

  const startedAt = new Date().toISOString();
  const started = performance.now();
  const sourceUrl = new URL(location.href);
  const games = [];
  const pageTiming = [];

  for (let page = 1; page <= pageCount; page++) {
    const pageStarted = performance.now();

    const pageUrl = new URL(sourceUrl);
    pageUrl.pathname = `/browse/boardgame/page/${page}`;
    pageUrl.searchParams.set("sort", "rank");

    const response = await fetch(pageUrl, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(`Could not fetch page ${page}: HTTP ${response.status}`);
    }

    const doc = new DOMParser().parseFromString(await response.text(), "text/html");

    const table = [...doc.querySelectorAll("table")].find(table =>
      /Geek Rating/i.test(table.textContent) &&
      table.querySelector('a[href*="/boardgame/"]')
    );

    if (!table) {
      throw new Error(`Could not find the BGG rankings table on page ${page}.`);
    }

    const headerRow = [...table.querySelectorAll("tr")].find(row =>
      [...row.querySelectorAll("th")].some(th => /Geek Rating/i.test(clean(th)))
    );

    const headers = [...headerRow.querySelectorAll("th")].map((th, index) =>
      clean(th) || `column_${index + 1}`
    );

    const pageGames = [];

    for (const row of table.querySelectorAll("tr")) {
      const cells = [...row.querySelectorAll(":scope > td")];

      const gameLink = [...row.querySelectorAll('a[href*="/boardgame/"]')]
        .find(link =>
          /\/boardgame\/(\d+)(?:\/|$)/.test(link.href) &&
          clean(link)
        );

      if (!gameLink || !cells.length) continue;

      const rank = Number(clean(cells[0]).replace(/[^\d]/g, ""));
      if (!rank || rank > recordCount) continue;

      const tableValues = Object.fromEntries(
        cells.map((cell, index) => [
          headerKey(headers[index] || `column_${index + 1}`),
          clean(cell)
        ])
      );

      const title = clean(gameLink);
      const titleCellText = clean(gameLink.closest("td"));
      const yearPublished = titleCellText.match(/\((\d{4})\)/)?.[1] || "";

      const ratingCell = cells.find(cell => cell.matches("td.collection_rating"));
      const statusCell = cells.find(cell => cell.matches("td.collection_status"));
      const playsCell = cells.find(cell => cell.matches("td.collection_plays"));
      const shopCell = cells.find(cell => cell.matches("td.collection_shop"));

      pageGames.push({
        rank,
        bgg_id: Number(gameLink.href.match(/\/boardgame\/(\d+)(?:\/|$)/)?.[1]),
        title,
        year_published: yearPublished,
        description: titleCellText
          .replace(title, "")
          .replace(/^\s*\(\d{4}\)\s*/, "")
          .trim(),
        geek_rating: tableValues.geekrating || "",
        average_rating: tableValues.avgrating || "",
        number_of_voters: tableValues.numvoters || "",
        your_rating:
          clean(ratingCell?.querySelector(".ratingtext")) ||
          (clean(ratingCell) === "N/A" ? "N/A" : ""),
        your_rating_last_updated: clean(ratingCell?.querySelector(".sf.darkgray")),
        collection_status: clean(statusCell),
        your_plays: clean(playsCell).replace(/\u00a0/g, " "),
        shop_offers: clean(shopCell),
        bgg_url: gameLink.href,
        thumbnail_url: row.querySelector("img")?.getAttribute("src") || "",
        source_page: page
      });
    }

    const pageMs = performance.now() - pageStarted;
    const elapsedMs = performance.now() - started;
    const estimatedRemainingMs = (elapsedMs / page) * (pageCount - page);

    pageGames.forEach(game => {
      game.page_fetch_seconds = (pageMs / 1000).toFixed(3);
    });

    games.push(...pageGames);

    pageTiming.push({
      page,
      records: pageGames.length,
      page_seconds: +(pageMs / 1000).toFixed(2),
      cumulative_seconds: +(elapsedMs / 1000).toFixed(2),
      estimated_remaining_seconds: +(estimatedRemainingMs / 1000).toFixed(2)
    });

    console.log(
      `Page ${page}/${pageCount}: ${pageGames.length} records in ${formatTime(pageMs)} ` +
      `| elapsed ${formatTime(elapsedMs)} | ETA ${formatTime(estimatedRemainingMs)}`
    );
  }

  const collectionMs = performance.now() - started;

  const output = games
    .sort((a, b) => a.rank - b.rank)
    .slice(0, recordCount)
    .map(game => ({
      ...game,
      collection_started_at: startedAt,
      collection_duration_seconds: (collectionMs / 1000).toFixed(3)
    }));

  const columns = [
    ["Rank", "rank"],
    ["BGG ID", "bgg_id"],
    ["Title", "title"],
    ["Year Published", "year_published"],
    ["Description", "description"],
    ["Geek Rating", "geek_rating"],
    ["Average Rating", "average_rating"],
    ["Number of Voters", "number_of_voters"],
    ["Your Rating", "your_rating"],
    ["Your Rating Last Updated", "your_rating_last_updated"],
    ["Collection Status", "collection_status"],
    ["Your Plays", "your_plays"],
    ["Shop Offers", "shop_offers"],
    ["BGG URL", "bgg_url"],
    ["Thumbnail URL", "thumbnail_url"],
    ["Source Page", "source_page"],
    ["Page Fetch Seconds", "page_fetch_seconds"],
    ["Collection Started At", "collection_started_at"],
    ["Collection Duration Seconds", "collection_duration_seconds"]
  ];

  const csv = [
    columns.map(([label]) => csvEscape(label)).join(","),
    ...output.map(game =>
      columns.map(([, field]) => csvEscape(game[field])).join(",")
    )
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `bgg-top-${output.length}.csv`
  });

  link.click();
  URL.revokeObjectURL(link.href);

  try {
    await navigator.clipboard.writeText(csv);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = csv;
    textarea.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  console.table(pageTiming);
  console.log(
    `Done — ${output.length.toLocaleString()} records in ${formatTime(collectionMs)}. ` +
    `CSV downloaded and copied.`
  );
})();