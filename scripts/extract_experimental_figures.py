#!/usr/bin/env python3
"""Export the seven Section 4 figures from the explicitly selected Overleaf ZIP.

Usage: python extract_experimental_figures.py manuscript.zip
       python extract_experimental_figures.py --check

Extraction requires PyMuPDF. The committed SVGs contain vector glyphs, so the
website does not depend on the manuscript's fonts or a PDF viewer. --check only
uses the standard library and verifies the committed provenance and assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "site/assets/img/experimental-results"
MANIFEST = ROOT / "data/experimental_figures.json"
FIGURES = [
    (2, "4.1", "leaderboard", "rank_performance", 6),
    (3, "4.2", "results", "task_trajectories", 12),
    (4, "4.3", "long-vs-short", "long_vs_short_runs", 12),
    (5, "4.4", "ranking-budget", "ranking_variability", 3),
    (6, "4.5", "first-score", "first_scored_submission", 3),
    (7, "4.6", "second-half", "second_half_gains", 3),
    (8, "4.7", "interactions", "token_turn_cost", 2),
]


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract(source: Path) -> None:
    import pymupdf

    archive = source.read_bytes()
    with zipfile.ZipFile(source) as z:
        main = z.read("main.tex")
        text = main.decode()
        section = text.split(r"\section{Experimental Results}", 1)[1].split(r"\section{Agent Behavior Analysis}", 1)[0]
        actual = re.findall(r"\\includegraphics\[[^\]]*\]\{images/([^}]+)\.pdf\}", section)
        assert actual == [row[3] for row in FIGURES], actual
        assert "all 84 individual trajectories" in section
        assert "Claude's short runs win on both operators and ORPO" in section
        ASSETS.mkdir(parents=True, exist_ok=True)
        manifest = {
            "source": source.name,
            "source_sha256": digest(archive),
            "main_tex_sha256": digest(main),
            "method": "Original one-page figure PDFs from Overleaf, converted to SVG with vector glyphs; no resampling or data digitization.",
            "figures": [],
        }
        for number, subsection, anchor, name, panels in FIGURES:
            pdf = z.read(f"images/{name}.pdf")
            document = pymupdf.open(stream=pdf, filetype="pdf")
            assert len(document) == 1
            page = document[0]
            svg = page.get_svg_image(text_as_path=True).encode()
            (ASSETS / f"{name}.pdf").write_bytes(pdf)
            (ASSETS / f"{name}.svg").write_bytes(svg)
            manifest["figures"].append({
                "figure": number, "section": subsection, "anchor": anchor,
                "source_member": f"images/{name}.pdf", "panels": panels,
                "pdf": f"assets/img/experimental-results/{name}.pdf",
                "svg": f"assets/img/experimental-results/{name}.svg",
                "pdf_sha256": digest(pdf), "svg_sha256": digest(svg),
                "width": round(page.rect.width, 4), "height": round(page.rect.height, 4),
            })
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")


def check() -> None:
    manifest = json.loads(MANIFEST.read_text())
    assert [x["figure"] for x in manifest["figures"]] == list(range(2, 9))
    assert [x["panels"] for x in manifest["figures"]] == [6, 12, 12, 3, 3, 3, 2]
    for row in manifest["figures"]:
        for extension in ("pdf", "svg"):
            content = (ROOT / "site" / row[extension]).read_bytes()
            assert digest(content) == row[f"{extension}_sha256"], row[extension]
    print("Verified Figures 2–8: seven source PDFs, seven vector SVGs, and source hashes.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", nargs="?", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.archive:
        extract(args.archive)
    elif not args.check:
        parser.error("provide an Overleaf ZIP or --check")
    check()
