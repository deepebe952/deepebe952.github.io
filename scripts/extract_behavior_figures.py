#!/usr/bin/env python3
"""Extract Section 5 figure data from the supplied paper's vector artwork.

Run with a PDF path (requires PyMuPDF) to update data/behavior_figures.json.
Run with no arguments to rebuild site/data/behavior.js from committed JSON.
Only values printed in the paper are marked exact; unlabeled markers are
digitized from vector centers and axis ticks, and remain labeled approximate.
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def hex_color(rgb):
    return "#" + "".join(f"{round(v * 255):02x}" for v in rgb) if rgb else None


def center(path):
    rect = path["rect"]
    return (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2


def inside(path, frame):
    x, y = center(path)
    return frame.x0 <= x <= frame.x1 and frame.y0 <= y <= frame.y1


def grid_y(paths, frame):
    return sorted({d["rect"].y0 for d in paths if inside(d, frame)
                   and d["type"] == "s" and d["rect"].height == 0
                   and abs(d["rect"].width - frame.width) < .01
                   and hex_color(d["color"]) == "#e7ebee"}, reverse=True)


def extract(pdf_path):
    import pymupdf

    pdf = pymupdf.open(pdf_path)
    p8 = next(p for p in pdf if "Narrow validation can miss the required computation." in p.get_text())
    p9 = next(p for p in pdf if "Correct outputs can conceal an incorrectly executed experiment." in p.get_text())
    ds8, ds9 = p8.get_drawings(), p9.get_drawings()
    fig8_frame = next(d["rect"] for d in ds8 if d["type"] == "f" and hex_color(d["fill"]) == "#ffffff"
                      and d["rect"].x0 > 350 and 100 < d["rect"].y0 < 150 and d["rect"].height > 100)
    ys8 = grid_y(ds8, fig8_frame)
    assert len(ys8) == 3
    ratio = lambda y: (ys8[0] - y) / (ys8[0] - ys8[1]) * .5
    errors = {}
    for model, color in (("claude", "#78ad00"), ("deepseek", "#f2545b")):
        dots = sorted((d for d in ds8 if inside(d, fig8_frame) and d["type"] == "fs"
                       and hex_color(d["fill"]) == color), key=lambda d: center(d)[0])
        assert len(dots) == 11
        errors[model] = [round(ratio(center(d)[1]), 5) for d in dots]
        assert all(0 < v < 1 for v in errors[model])

    # Figure 9a's open circles show a second before-repair observation.
    frames9 = [d["rect"] for d in ds9 if d["type"] == "f" and hex_color(d["fill"]) == "#ffffff"
               and d["rect"].x0 < 280 and 100 < d["rect"].y0 < 150 and d["rect"].height > 90]
    assert len(frames9) == 1
    frame9 = frames9[0]
    grid9 = sorted({d["rect"].y0 for d in ds9 if inside(d, frame9) and d["type"] == "s"
                    and d["rect"].height == 0 and abs(d["rect"].width - frame9.width) < .01
                    and hex_color(d["color"]) == "#d5d5d5"}, reverse=True)
    assert len(grid9) == 5
    open_dots = sorted((d for d in ds9 if inside(d, frame9) and d["type"] == "fs"
                        and hex_color(d["fill"]) == "#ffffff" and len(d["items"]) == 8), key=lambda d: center(d)[0])
    assert len(open_dots) == 2
    repeat_before = [round((grid9[0] - center(d)[1]) / (grid9[0] - grid9[1]) * 20, 4) for d in open_dots]

    # Figure 10 has three independent linear axes. Panel a plots splits 1 and 4;
    # panels b/c also plot split 2. Short ticks are separate process medians.
    frames10 = sorted((d["rect"] for d in ds9 if d["type"] == "f" and hex_color(d["fill"]) == "#ffffff"
                       and 350 < d["rect"].y0 < 450 and d["rect"].height > 90), key=lambda r: r.x0)
    assert len(frames10) == 3
    shapes = ["B=1 · N=6.29M · K=6,144 · D=384", "B=4 · N=262,144 · K=1,024 · D=128", "B=1 · N=1.05M · K=8,192 · D=512"]
    titles = ["The ranking reverses", "The ranking is retained", "The two leaders are close"]
    panels = []
    for i, (frame, step) in enumerate(zip(frames10, (2.5, .25, .8))):
        ys = grid_y(ds9, frame)
        assert len(ys) == 4
        value = lambda y: (ys[0] - y) / (ys[0] - ys[1]) * step
        variants = []
        for split, color in ((1, "#326b94"), (2, "#c28c30"), (4, "#528e76")):
            dots = sorted((d for d in ds9 if inside(d, frame) and d["type"] == "fs"
                           and hex_color(d["fill"]) == color and hex_color(d["color"]) == "#ffffff"), key=lambda d: center(d)[0])
            if not dots:
                assert i == 0 and split == 2
                continue
            assert len(dots) == 2
            ticks = sorted((d for d in ds9 if inside(d, frame) and d["type"] == "fs"
                            and hex_color(d["fill"]) == color and d["rect"].width == 0), key=lambda d: center(d)[0])
            assert len(ticks) == 4
            medians = [round(value(center(d)[1]), 6) for d in dots]
            processes = [[round(value(center(d)[1]), 6) for d in ticks[j:j + 2]] for j in (0, 2)]
            for mean, runs in zip(medians, processes):
                assert math.isclose(mean, sum(runs) / 2, rel_tol=.0001)
            variants.append({"split": split, "medians_ms": medians, "process_medians_ms": processes})
        panels.append({"title": titles[i], "shape": shapes[i], "variants": variants})
    # Independent numerical anchors quoted in the paper's discussion.
    for variant, expected in zip(panels[0]["variants"], ([1.745, 8.020], [2.341, 3.695])):
        assert all(abs(a - b) < .001 for a, b in zip(variant["medians_ms"], expected))

    logprob_names = ["Plain A", "Plain B", "4 drafts, breadth 1", "6 drafts, breadth 1", "8 drafts, breadth 1",
                     "6 drafts, breadth 1 + CD2", "6 drafts, breadth 2", "8 drafts, breadth 3", "NGRAM defaults"]
    logprob_values = [2.55, 2.69, 12.94, 13.61, 17.87, 14.13, 2.66, 2.60, 2.36]
    assert all(f"{v:.2f}" in p8.get_text() for v in logprob_values)
    return {
        "source": "Infrathon paper, Section 5, Figures 8–11 (49-page revision)",
        "pdf_sha256": hashlib.sha256(Path(pdf_path).read_bytes()).hexdigest(),
        "digitization": "Unlabeled points and process ticks are recovered from PDF vector coordinates and axis ticks; values remain approximate. Printed numeric labels are transcribed directly.",
        "fig8": {"page": p8.number + 1, "logprob": [{"label": name, "difference_millinats": value, "breadth_one": 2 <= i <= 5}
                                                    for i, (name, value) in enumerate(zip(logprob_names, logprob_values))],
                 "error_tolerance_ratio": errors},
        "fig9": {"page": p9.number + 1, "latency_ms": [{"label": "Forward", "before": 74.23, "after": 25.75, "repeat_before": repeat_before[0]},
                                                         {"label": "Backward", "before": 25.52, "after": 25.34, "repeat_before": repeat_before[1]}],
                 "launches": [{"label": "Residual + norm", "before": 10458, "after": 5229}, {"label": "SwiGLU", "before": 5312, "after": 2656}, {"label": "RoPE", "before": 5312, "after": 2656}]},
        "fig10": {"page": p9.number + 1, "panels": panels},
    }


def bundle(data):
    return "/* Generated by scripts/extract_behavior_figures.py. */\nwindow.INFRATHON_BEHAVIOR=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"


if __name__ == "__main__":
    source = ROOT / "data/behavior_figures.json"
    if len(sys.argv) > 1:
        data = extract(sys.argv[1])
        source.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    else:
        data = json.loads(source.read_text())
    (ROOT / "site/data/behavior.js").write_text(bundle(data))
    print("Wrote native Figure 8–10 data; all vector extraction checks passed.")
