"""Update service: APK updates + OTA web bundle updates.

OTA workflow (no Play Store / no rebuild):
  1. Frontend dev: edit code, then run `python publish_update.py` from project root
     -> builds `dist/`, renames assets to stable names, writes `updates/manifest.json`
  2. Restart backend -> it serves `/api/updates/manifest` and `/api/updates/bundle/*`
  3. Mobile app (or web) on launch + on user click of "Check for updates"
     -> fetches manifest, if newer version -> downloads bundle.js + bundle.css
     -> caches to localStorage and reloads the page
"""
from __future__ import annotations
import json
import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from fastapi.responses import FileResponse, JSONResponse

from config import settings

log = logging.getLogger("finera.updates")

UPDATES_DIR = Path(__file__).resolve().parent.parent / "updates"


def _parse_version(v: str) -> tuple[int, ...]:
    parts: list[int] = []
    for chunk in v.replace("v", "").split("."):
        digits = "".join(c for c in chunk if c.isdigit())
        if digits:
            parts.append(int(digits))
    return tuple(parts) or (0,)


def get_update_info(current_version: str) -> dict:
    latest = settings.app_version
    cur = _parse_version(current_version)
    new = _parse_version(latest)
    update_available = new > cur
    min_supported = _parse_version(settings.update_force_below)
    force_update = cur < min_supported
    return {
        "latest_version": latest,
        "current_version": current_version,
        "update_available": update_available or force_update,
        "force_update": force_update,
        "url": settings.apk_download_url,
        "notes": settings.update_notes,
    }


# ---------------------------------------------------------------------------
# OTA bundle manifest + serving
# ---------------------------------------------------------------------------
def _manifest_path() -> Path:
    return UPDATES_DIR / "manifest.json"


def read_bundle_manifest() -> Optional[dict]:
    p = _manifest_path()
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as e:
        log.error("Failed to read bundle manifest: %s", e)
        return None


def get_ota_manifest(current_version: str) -> dict:
    """Returns OTA manifest: if newer version available, includes bundle URLs."""
    bundle = read_bundle_manifest()
    cur = _parse_version(current_version)
    min_supported = _parse_version(settings.update_force_below)

    if not bundle:
        return {
            "latest_version": settings.app_version,
            "current_version": current_version,
            "update_available": False,
            "force_update": cur < min_supported,
            "notes": settings.update_notes,
            "js_url": None,
            "css_url": None,
        }

    latest = bundle.get("version", settings.app_version)
    new = _parse_version(latest)
    update_available = new > cur
    force_update = cur < min_supported

    base = settings.bundle_base_url.rstrip("/") if settings.bundle_base_url else ""
    js_name = bundle.get("js", "bundle.js")
    css_name = bundle.get("css", "bundle.css")

    return {
        "latest_version": latest,
        "current_version": current_version,
        "update_available": update_available or force_update,
        "force_update": force_update,
        "notes": bundle.get("notes", settings.update_notes),
        "js_url": f"{base}/api/updates/bundle/{js_name}" if update_available or force_update else None,
        "css_url": f"{base}/api/updates/bundle/{css_name}" if update_available or force_update else None,
        "checksum": bundle.get("checksum"),
    }


def serve_bundle_file(filename: str) -> FileResponse:
    # Prevent path traversal
    safe = Path(filename).name
    target = UPDATES_DIR / safe
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Bundle file not found")
    return FileResponse(target, media_type="application/javascript" if safe.endswith(".js") else "text/css")
