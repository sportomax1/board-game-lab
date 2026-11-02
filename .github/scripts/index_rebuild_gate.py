#!/usr/bin/env python3
"""Rebuild a Board Game Lab app index for missing files or first daily app edit."""
from __future__ import annotations
import os
import subprocess
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo

DENVER = ZoneInfo("America/Denver")
EXCLUDE_DIRS = {".git", ".github", "node_modules", "__pycache__", ".vercel",
                "api", "alt", ".vscode"}
APP_SUFFIXES = {".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".css", ".py"}

class IndexedLinks(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paths: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        data = dict(attrs)
        if "app-card" not in (data.get("class") or "").split():
            return
        href = data.get("href")
        if not href:
            return
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc or not parsed.path:
            return
        path = unquote(parsed.path).removeprefix("./")
        if path.startswith("/") or ".." in Path(path).parts:
            return
        self.paths.add(Path(path).as_posix())

def eligible(path: str) -> bool:
    p = Path(path)
    return p.name != "index.html" and bool(p.name) and not any(
        part in EXCLUDE_DIRS for part in p.parts[:-1]
    )

def current_catalog() -> set[str]:
    found = set()
    for root, folders, names in os.walk("."):
        folders[:] = [d for d in folders if d not in EXCLUDE_DIRS]
        for name in names:
            p = Path(root, name)
            if eligible(p.as_posix()):
                found.add(p.as_posix().removeprefix("./"))
    return found

def indexed_catalog() -> set[str]:
    if not Path("index.html").is_file():
        return set()
    parser = IndexedLinks()
    parser.feed(Path("index.html").read_text(encoding="utf-8"))
    return parser.paths

def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], capture_output=True, text=True, check=True
    ).stdout.strip()

def last_index_commit() -> tuple[str, datetime] | None:
    data = git("log", "-1", "--format=%H %ct", "--", "index.html")
    if not data:
        return None
    sha, seconds = data.split()
    return sha, datetime.fromtimestamp(int(seconds), DENVER)

def modified_app_paths_since(commit_sha: str) -> set[str]:
    output = subprocess.run(
        ["git", "diff", "--name-only", "-z", "--diff-filter=ACMRT",
         commit_sha, "HEAD"], capture_output=True, check=True,
    ).stdout.decode("utf-8", errors="replace")
    return {p for p in output.split("\0") if p and eligible(p)
            and Path(p).suffix.lower() in APP_SUFFIXES and Path(p).is_file()}

def decide(
    current: set[str], indexed: set[str], modified: set[str],
    index_updated_today: bool, manual: bool = False,
) -> tuple[bool, str]:
    if manual:
        return True, "Manual rebuild requested"
    missing = current - indexed
    if missing:
        return True, "New/unindexed files: " + ", ".join(sorted(missing)[:8])
    deleted = indexed - current
    if deleted:
        return True, "Missing indexed files: " + ", ".join(sorted(deleted)[:8])
    if not index_updated_today and modified:
        return True, "First index refresh today after app changes: " + ", ".join(sorted(modified)[:8])
    if index_updated_today:
        return False, "Index already refreshed today; skip ordinary app edits"
    return False, "No app changes or missing entries since last index commit"

def run() -> int:
    try:
        current = current_catalog()
        indexed = indexed_catalog()
        last = last_index_commit()
        if last:
            sha, timestamp = last
            updated_today = timestamp.date() == datetime.now(DENVER).date()
            changed = modified_app_paths_since(sha)
        else:
            updated_today, changed = False, set()
        should, reason = decide(current, indexed, changed, updated_today,
                                manual=os.environ.get("INDEX_EVENT") == "workflow_dispatch")
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        print("Index gate error:", exc, flush=True)
        return 1
    print(("REBUILD" if should else "SKIP") + ": " + reason, flush=True)
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as file:
            file.write("rebuild=" + ("true" if should else "false") + "\n")
    return 0

if __name__ == "__main__":
    raise SystemExit(run())
