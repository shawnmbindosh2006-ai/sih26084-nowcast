"""Bounded public SEVIR catalog/object probe. Never downloads an entire bucket."""
import argparse
import csv
import hashlib
from http.client import HTTPException
import json
from pathlib import Path
from urllib.request import Request, urlopen

from .fixture import write_json

BASE = "https://sevir.s3.us-west-2.amazonaws.com/"
MAX_BUDGET = 1_000_000_000


def size(url):
    with urlopen(Request(url, method="HEAD"), timeout=30) as response:
        value = response.headers.get("Content-Length")
        if value is None:
            raise ValueError("object size unknown; download blocked")
        return int(value)


def fetch(url, destination, expected_size, budget):
    if expected_size < 0 or expected_size > budget:
        raise ValueError("download exceeds remaining budget")
    count, digest = 0, hashlib.sha256()
    # Exclusive creation preserves existing downloads and interrupted evidence.
    with Path(destination).open("xb") as output:
        with urlopen(url, timeout=30) as response:
            while chunk := response.read(min(1024 * 1024, budget - count + 1)):
                count += len(chunk)
                if count > budget or count > expected_size:
                    raise ValueError("response exceeded inspected size/budget; partial file retained")
                digest.update(chunk)
                output.write(chunk)
    if count != expected_size:
        raise ValueError("incomplete download; partial file retained")
    return {"bytes": count, "sha256": digest.hexdigest()}


def investigate(directory, budget=MAX_BUDGET, download=False, event_id="S858968"):
    if not isinstance(budget, int) or not 0 < budget <= MAX_BUDGET:
        raise ValueError("budget must be 1..1,000,000,000 bytes; increasing needs Manish review")
    root = Path(directory)
    root.mkdir(parents=True, exist_ok=False)
    manifest = {"source": "https://registry.opendata.aws/sevir/",
                "utilities": "https://github.com/MIT-AI-Accelerator/eie-sevir",
                "terms": "AWS registry states no restrictions on use of this data",
                "event_id": event_id, "budget_bytes": budget,
                "catalog": {"url": BASE + "CATALOG.csv"}, "objects": [],
                "status": "investigating", "normalization": None, "checkpoint": None}
    try:
        cat = manifest["catalog"]
        cat["head_bytes"] = size(cat["url"])
        cat.update(fetch(cat["url"], root / "CATALOG.csv", cat["head_bytes"], budget))
        remaining = budget - cat["bytes"]
        with (root / "CATALOG.csv").open(encoding="utf-8", newline="") as stream:
            rows = [r for r in csv.DictReader(stream) if r["id"] == event_id and r["img_type"] == "vil"]
        if len(rows) != 1:
            raise ValueError("selected event must have exactly one VIL catalog row")
        row = rows[0]
        key = "data/" + row["file_name"]
        obj = {"event_id": event_id, "key": key, "url": BASE + key,
               "catalog_row": row, "sha256": None, "status": "not_downloaded"}
        manifest["objects"].append(obj)
        obj["head_bytes"] = size(obj["url"])
        if obj["head_bytes"] > remaining:
            obj["status"] = "blocked_budget"
        elif download:
            obj.update(fetch(obj["url"], root / "selected-vil.h5", obj["head_bytes"], remaining))
            obj["status"] = "downloaded_container_not_converted"
        else:
            obj["status"] = "inspected_only"
        manifest["status"] = obj["status"]
    except (OSError, ValueError, KeyError, HTTPException) as exc:
        manifest.update(status="blocked_access_or_catalog", error=str(exc))
    finally:
        write_json(root / "manifest.json", manifest)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory")
    parser.add_argument("--budget-bytes", type=int, default=MAX_BUDGET)
    parser.add_argument("--event-id", default="S858968")
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    print(json.dumps(investigate(args.directory, args.budget_bytes, args.download, args.event_id), indent=2))
