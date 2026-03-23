"""
enrich_pubmeeple.py — Offline BGG enrichment for pubmeeple.csv

Reads pubmeeple.csv, looks up each unique game on the BGG XML API2,
and writes pubmeeple.csv back with two new columns: objectid, thumbnail.

Usage:
    python enrich_pubmeeple.py            # enriches in-place
    python enrich_pubmeeple.py --dry-run  # writes to pubmeeple_enriched.csv

Respects BGG rate limits (~1 req/sec). Caches results so re-runs skip
games that already have data.
"""

import csv, sys, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET

INPUT  = "pubmeeple.csv"
OUTPUT = "pubmeeple.csv"          # overwrite by default
DRY    = "--dry-run" in sys.argv
if DRY:
    OUTPUT = "pubmeeple_enriched.csv"

BGG_SEARCH = "https://boardgamegeek.com/xmlapi2/search?type=boardgame&exact=1&query={}"
BGG_THING  = "https://boardgamegeek.com/xmlapi2/thing?id={}"
RATE_LIMIT = 1.1  # seconds between API calls


def bgg_get(url: str, retries: int = 4) -> ET.Element | None:
    """Fetch a BGG XML endpoint with retry on HTTP 202 / 429."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "pubmeeple-enricher/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status == 202:
                    time.sleep(3)
                    continue
                return ET.fromstring(resp.read())
        except urllib.error.HTTPError as e:
            if e.code in (202, 429, 503):
                time.sleep(3 * (attempt + 1))
                continue
            print(f"  HTTP {e.code} for {url}")
            return None
        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(2)
    return None


def search_game(name: str) -> tuple[str, str]:
    """Return (objectid, thumbnail_url) for a game name, or ('','')."""
    encoded = urllib.parse.quote(name, safe="")

    # 1) Exact search
    root = bgg_get(BGG_SEARCH.format(encoded))
    if root is None:
        return ("", "")
    item = root.find("item")

    # 2) If exact search fails, try non-exact
    if item is None:
        non_exact_url = BGG_SEARCH.format(encoded).replace("&exact=1", "")
        time.sleep(RATE_LIMIT)
        root = bgg_get(non_exact_url)
        if root is None:
            return ("", "")
        item = root.find("item")

    if item is None:
        return ("", "")

    obj_id = item.get("id", "")
    if not obj_id:
        return ("", "")

    # 3) Fetch thing for thumbnail
    time.sleep(RATE_LIMIT)
    thing_root = bgg_get(BGG_THING.format(obj_id))
    if thing_root is None:
        return (obj_id, "")

    thing_item = thing_root.find("item")
    if thing_item is None:
        return (obj_id, "")

    thumb_el = thing_item.find("thumbnail")
    img_el = thing_item.find("image")
    thumb = ""
    if thumb_el is not None and thumb_el.text:
        thumb = thumb_el.text.strip()
    elif img_el is not None and img_el.text:
        thumb = img_el.text.strip()

    return (obj_id, thumb)


def main():
    # ---- Read existing CSV ----
    with open(INPUT, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)

    # Detect whether columns already exist
    h_lower = [h.strip().lower() for h in header]
    has_objectid  = "objectid"  in h_lower
    has_thumbnail = "thumbnail" in h_lower

    oid_col   = h_lower.index("objectid")  if has_objectid  else None
    thumb_col = h_lower.index("thumbnail") if has_thumbnail else None

    if not has_objectid:
        header.append("objectid")
    if not has_thumbnail:
        header.append("thumbnail")

    # Pad short rows
    expected_len = len(header)
    for row in rows:
        while len(row) < expected_len:
            row.append("")

    oid_col   = h_lower.index("objectid")  if has_objectid  else len(header) - 2
    thumb_col = h_lower.index("thumbnail") if has_thumbnail else len(header) - 1

    # ---- Deduplicate game names ----
    name_col = h_lower.index("item") if "item" in h_lower else 3
    unique_names = {}
    for row in rows:
        name = row[name_col].strip().strip('"')
        if name and name not in unique_names:
            # Check if already enriched
            existing_oid   = row[oid_col].strip()   if oid_col   < len(row) else ""
            existing_thumb = row[thumb_col].strip()  if thumb_col < len(row) else ""
            unique_names[name] = (existing_oid, existing_thumb)

    need_lookup = {n for n, (oid, th) in unique_names.items() if not oid or not th}
    already_done = len(unique_names) - len(need_lookup)

    print(f"Total rows: {len(rows)}")
    print(f"Unique games: {len(unique_names)}")
    print(f"Already enriched: {already_done}")
    print(f"Need lookup: {len(need_lookup)}")
    if DRY:
        print(f"Output: {OUTPUT} (dry-run)")

    # ---- Batch lookup: fetch up to 20 IDs at once for thumbnails ----
    cache = dict(unique_names)  # name -> (oid, thumb)
    pending = list(need_lookup)
    total = len(pending)

    # Phase 1: search for objectids (one at a time due to BGG search API)
    ids_to_fetch_thumbs = []  # (name, objectid)
    for i, name in enumerate(pending):
        existing_oid, existing_thumb = cache.get(name, ("", ""))
        if existing_oid and not existing_thumb:
            # Already have ID, just need thumbnail
            ids_to_fetch_thumbs.append((name, existing_oid))
            print(f"  [{i+1}/{total}] {name} — have ID {existing_oid}, need thumb")
            continue

        print(f"  [{i+1}/{total}] Searching: {name} ...", end=" ", flush=True)
        oid, thumb = search_game(name)
        if oid:
            cache[name] = (oid, thumb)
            print(f"ID={oid}  thumb={'yes' if thumb else 'no'}")
            if not thumb:
                ids_to_fetch_thumbs.append((name, oid))
        else:
            cache[name] = ("", "")
            print("NOT FOUND")
        time.sleep(RATE_LIMIT)

    # Phase 2: batch-fetch thumbnails for IDs that are missing them (20 at a time)
    if ids_to_fetch_thumbs:
        print(f"\nBatch-fetching {len(ids_to_fetch_thumbs)} thumbnails...")
        batch_size = 20
        for batch_start in range(0, len(ids_to_fetch_thumbs), batch_size):
            batch = ids_to_fetch_thumbs[batch_start:batch_start+batch_size]
            ids_str = ",".join(oid for _, oid in batch)
            root = bgg_get(BGG_THING.format(ids_str))
            if root is not None:
                for item_el in root.findall("item"):
                    bid = item_el.get("id", "")
                    thumb_el = item_el.find("thumbnail")
                    img_el = item_el.find("image")
                    thumb = ""
                    if thumb_el is not None and thumb_el.text:
                        thumb = thumb_el.text.strip()
                    elif img_el is not None and img_el.text:
                        thumb = img_el.text.strip()
                    # Find matching name(s)
                    for name, oid in batch:
                        if oid == bid:
                            old_oid, _ = cache[name]
                            cache[name] = (old_oid or bid, thumb)
            time.sleep(RATE_LIMIT)

    # ---- Write back ----
    enriched = 0
    for row in rows:
        name = row[name_col].strip().strip('"')
        if name in cache:
            oid, thumb = cache[name]
            row[oid_col]   = oid
            row[thumb_col] = thumb
            if oid or thumb:
                enriched += 1

    with open(OUTPUT, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"\nDone! Enriched {enriched}/{len(rows)} rows → {OUTPUT}")


if __name__ == "__main__":
    main()
