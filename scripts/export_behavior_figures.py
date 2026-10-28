#!/usr/bin/env python3
"""Export the four original Section 5 figures from the selected Overleaf ZIP.

Usage: python scripts/export_behavior_figures.py manuscript.zip
       python scripts/export_behavior_figures.py --check [manuscript.zip]

Export requires PyMuPDF and converts PDF text to vector glyph paths. Checking
uses only the standard library; optionally pass the archive to also verify the
original PDF bytes and the figures' positions in main.tex without writing files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "site/assets/img"
MANIFEST = ROOT / "data/behavior_original_figures.json"
SECTION_TITLE = "Agent Behavior Analysis"
FIGURES = [
    (9, "5.1", "Do Agents Follow Task Requirements?", "behavior_task_fidelity", "fig:behavior_task_fidelity", 2),
    (10, "5.2", "Do Agents Correctly Test Their Own Optimizations?", "behavior_execution_mismatch", "fig:behavior_execution_mismatch", 2),
    (11, "5.2", "Do Agents Correctly Test Their Own Optimizations?", "behavior_workload_reversal", "fig:behavior_workload_reversal", 3),
    (12, "5.3", "Do Agents Keep Improving over Long Horizons?", "behavior_search", "fig:behavior_optimization", 2),
]


def digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def verify_main(main: bytes) -> None:
    """Check actual figure order, numbering, subsection titles, and labels."""
    text = re.sub(r"(?<!\\)%[^\n]*", "", main.decode())
    before, section = text.split(r"\section{" + SECTION_TITLE + "}", 1)
    assert len(re.findall(r"\\section\{", before)) == 4, "Behavior must be Section 5"
    section = section.split(r"\section{", 1)[0]
    previous_figures = len(re.findall(r"\\begin\{figure\*?\}", before))
    subsection_matches = list(re.finditer(r"\\subsection\{([^}]+)\}", section))
    actual = []
    for figure_index, match in enumerate(re.finditer(
        r"\\begin\{figure\*?\}(.*?)\\end\{figure\*?\}", section, re.S
    ), start=1):
        member = re.findall(r"\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}", match[1])
        labels = re.findall(r"\\label\{([^}]+)\}", match[1])
        assert len(member) == len(labels) == 1, "Expected one original PDF per figure"
        preceding = [item for item in subsection_matches if item.start() < match.start()]
        assert preceding, "Expected a numbered behavior subsection before the figure"
        actual.append((previous_figures + figure_index, f"5.{len(preceding)}", preceding[-1][1], member[0], labels[0]))
    expected = [(number, section, title, f"images/{name}.pdf", label)
                for number, section, title, name, label, _ in FIGURES]
    assert actual == expected, f"Section 5 figure references changed: {actual!r}"


def extract(source: Path) -> None:
    import pymupdf

    archive = source.read_bytes()
    with zipfile.ZipFile(source) as z:
        main = z.read("main.tex")
        verify_main(main)
        manifest = {
            "source_archive": source.name,
            "source_archive_sha256": digest(archive),
            "source_tex": "main.tex",
            "main_tex_sha256": digest(main),
            "section": "5",
            "section_title": SECTION_TITLE,
            "conversion": "PDFs extracted byte-for-byte from the selected Overleaf ZIP; SVGs exported from their single pages with PyMuPDF text_as_path=True. Text is vector glyph paths; no resampling, data digitization, or redrawing.",
            "exporter": "scripts/export_behavior_figures.py",
            "pymupdf_version": pymupdf.VersionBind,
            "dimensions_unit": "pt",
            "figures": [],
        }
        exports = []
        for number, subsection, title, name, label, panels in FIGURES:
            member = f"images/{name}.pdf"
            pdf = z.read(member)
            with pymupdf.open(stream=pdf, filetype="pdf") as document:
                assert len(document) == 1, f"Expected one page: {member}"
                page = document[0]
                svg = page.get_svg_image(text_as_path=True).encode()
                width, height = round(page.rect.width, 4), round(page.rect.height, 4)
            pdf_path, svg_path = f"assets/img/{name}.pdf", f"assets/img/{name}.svg"
            manifest["figures"].append({
                "figure": number, "section": subsection, "section_title": title,
                "figure_label": label, "panels": panels, "source_member": member,
                # Preserve the original manifest's PDF field names for consumers.
                "file": pdf_path, "sha256": digest(pdf),
                "pdf": pdf_path, "svg": svg_path,
                "pdf_sha256": digest(pdf), "svg_sha256": digest(svg),
                "width": width, "height": height,
            })
            exports.extend([(ROOT / "site" / pdf_path, pdf), (ROOT / "site" / svg_path, svg)])
    ASSETS.mkdir(parents=True, exist_ok=True)
    for path, content in exports:
        path.write_bytes(content)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")


def check(source: Path | None = None) -> None:
    manifest = json.loads(MANIFEST.read_text())
    assert manifest["section"] == "5" and manifest["section_title"] == SECTION_TITLE
    assert manifest["source_tex"] == "main.tex" and manifest["dimensions_unit"] == "pt"
    for key in ("source_archive_sha256", "main_tex_sha256"):
        assert re.fullmatch(r"[0-9a-f]{64}", manifest[key]), key
    expected = [(number, section, title, f"images/{name}.pdf", label, panels)
                for number, section, title, name, label, panels in FIGURES]
    actual = [(row["figure"], row["section"], row["section_title"], row["source_member"], row["figure_label"], row["panels"])
              for row in manifest["figures"]]
    assert actual == expected, "Figure and subsection mapping differs from Section 5"
    for row in manifest["figures"]:
        assert row["file"] == row["pdf"] and row["sha256"] == row["pdf_sha256"]
        for extension in ("pdf", "svg"):
            content = (ROOT / "site" / row[extension]).read_bytes()
            assert digest(content) == row[f"{extension}_sha256"], row[extension]
        svg = ET.fromstring((ROOT / "site" / row["svg"]).read_bytes())
        namespace = "{http://www.w3.org/2000/svg}"
        assert svg.tag == namespace + "svg", row["svg"]
        view_box = [float(value) for value in svg.attrib["viewBox"].split()]
        assert view_box[:2] == [0, 0], row["svg"]
        assert math.isclose(view_box[2], row["width"], abs_tol=0.0001), row["svg"]
        assert math.isclose(view_box[3], row["height"], abs_tol=0.0001), row["svg"]
        assert next(svg.iter(namespace + "path"), None) is not None, "Expected vector paths"
        assert next(svg.iter(namespace + "text"), None) is None, "Text must be exported as glyph paths"
        assert next(svg.iter(namespace + "image"), None) is None, "Expected original vector figures, not raster images"
    if source is not None:
        assert digest(source.read_bytes()) == manifest["source_archive_sha256"], "Archive hash differs"
        with zipfile.ZipFile(source) as z:
            main = z.read(manifest["source_tex"])
            assert digest(main) == manifest["main_tex_sha256"], "main.tex hash differs"
            verify_main(main)
            for row in manifest["figures"]:
                assert z.read(row["source_member"]) == (ROOT / "site" / row["pdf"]).read_bytes(), row["source_member"]
    print("Verified Figures 9–12: four original PDFs, four vector-glyph SVGs, dimensions, hashes, and Section 5 mapping."
          + (" Source ZIP and main.tex also verified." if source else ""))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", nargs="?", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check(args.archive)
    elif args.archive:
        extract(args.archive)
        check(args.archive)
    else:
        parser.error("provide an Overleaf ZIP or --check")
