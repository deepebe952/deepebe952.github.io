#!/usr/bin/env python3
"""Static checks for the published site: local references resolve and the data bundle parses."""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "site"


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs: list[str] = []
        self.ids: set[str] = set()
        self.anchors: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for key in ("src", "href"):
            v = a.get(key)
            if not v:
                continue
            if v.startswith("#"):
                if len(v) > 1:
                    self.anchors.append(v[1:])
            elif not re.match(r"^(https?:|data:|mailto:)", v):
                self.refs.append(v)


def main() -> int:
    errors = []
    n_refs = n_anchors = 0
    pages = sorted(SITE.glob("*.html"))
    for page in pages:
        p = Refs()
        p.feed(page.read_text())
        n_refs += len(p.refs)
        n_anchors += len(p.anchors)
        for ref in p.refs:
            if not (SITE / ref.split("#")[0].split("?")[0]).is_file():
                errors.append(f"{page.name}: missing file {ref}")
        for anchor in p.anchors:
            if anchor not in p.ids:
                errors.append(f"{page.name}: dangling anchor #{anchor}")
    bundle = (SITE / "data/infrathon.js").read_text()
    m = re.search(r"window\.INFRATHON=(\{.*\});\s*$", bundle, re.S)
    if not m:
        errors.append("data/infrathon.js does not assign window.INFRATHON")
    else:
        data = json.loads(m.group(1))
        if len(data["tasks"]) != 25:
            errors.append(f"expected 25 tasks, found {len(data['tasks'])}")
    for f in SITE.rglob("*"):
        if f.is_file() and f.suffix in {".html", ".js", ".css"} and re.search(r"/home/|/data/zy|pyromind_sandbox", f.read_text()):
            errors.append(f"local path leaked into {f.relative_to(SITE)}")
    for e in errors:
        print(f"error: {e}", file=sys.stderr)
    print(f"checked {len(pages)} pages, {n_refs} local references, {n_anchors} anchors: {'FAIL' if errors else 'ok'}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
