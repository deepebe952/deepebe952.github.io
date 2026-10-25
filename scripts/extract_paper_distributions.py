#!/usr/bin/env python3
"""Recover Figure 5's plotted values from the supplied PDF's vector paths.

Optional update tool: pip install pymupdf; pass the October 25 paper PDF.
The committed data keeps this dependency out of the website build. Values are
digitized approximations, not original token/action logs or task identities.
"""
import hashlib
import json
import math
import statistics
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
COLORS = dict(zip(
    ("#2f80ed", "#78ad00", "#f39c00", "#f2545b", "#8b50d8", "#168c91"),
    ("sol", "claude", "qwen", "deepseek", "glm", "astra"),
))


def color(rgb):
    return "#" + "".join(f"{round(c * 255):02x}" for c in rgb) if rgb else None


def extract(path):
    page = pymupdf.open(path)[10]
    assert "Interaction before the first scored submission" in page.get_text()
    paths = [d for d in page.get_drawings() if 135 < d["rect"].y0 < 266]
    frames = sorted((d["rect"] for d in paths if d["type"] == "f"
                     and color(d["fill"]) == "#ffffff" and d["rect"].height > 100), key=lambda r: r.x0)
    assert len(frames) == 3, "Expected three log-axis panels in Figure 5"
    out = {}
    for key, frame, exponent in zip(("elapsed", "tokens", "actions"), frames, (-1, 0, 1)):
        inside = [d for d in paths if frame.x0 <= (d["rect"].x0 + d["rect"].x1) / 2 <= frame.x1]
        ticks = sorted(d["rect"].x0 for d in inside if d["type"] == "s"
                       and d["rect"].width == 0 and d["rect"].height > 100)
        assert len(ticks) == 3 and abs(ticks[2] - 2 * ticks[1] + ticks[0]) < .001
        value = lambda x: 10 ** (exponent + (x - ticks[0]) / (ticks[1] - ticks[0]))
        models = {}
        for hex_color, model in COLORS.items():
            dots = [d for d in inside if d["type"] == "f" and color(d["fill"]) == hex_color]
            medians = [d for d in inside if d["type"] == "fs" and color(d["fill"]) == hex_color]
            bars = [d for d in inside if d["type"] == "s" and color(d["color"]) == hex_color]
            assert len(dots) == (24 if model == "glm" else 25), (key, model, len(dots))
            assert len(medians) == len(bars) == 1
            points = sorted(value((d["rect"].x0 + d["rect"].x1) / 2) for d in dots)
            mid = medians[0]["rect"]
            median = value((mid.x0 + mid.x1) / 2)
            q1, q3 = value(bars[0]["rect"].x0), value(bars[0]["rect"].x1)
            # Independent geometry checks: the median and IQR must agree with dots.
            assert math.isclose(statistics.median(points), median, rel_tol=.00001)
            def quantile(q):
                pos = (len(points) - 1) * q
                lo = int(pos)
                return points[lo] + (points[math.ceil(pos)] - points[lo]) * (pos - lo)
            assert math.isclose(q1, quantile(.25), rel_tol=.00001)
            assert math.isclose(q3, quantile(.75), rel_tol=.00001)
            models[model] = {"points": [float(f"{v:.6g}") for v in points],
                             "median": float(f"{median:.6g}"),
                             "q1": float(f"{q1:.6g}"), "q3": float(f"{q3:.6g}")}
        out[key] = models
    assert round(out["actions"]["sol"]["median"]) == 71
    # Figure 5 plots 248; the prose in Section 4.4 instead says 253.
    assert round(out["actions"]["qwen"]["median"]) == 248
    return {"source": "Paper Figure 5, page 11, October 25 revision",
            "pdf_sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            "method": "Approximate values recovered from vector marker centers and logarithmic axis ticks; no task identities are inferred.",
            "units": {"elapsed": "hours", "tokens": "thousand visible output tokens", "actions": "agent actions"},
            "metrics": out}


if __name__ == "__main__":
    result = extract(sys.argv[1])
    target = ROOT / "data/tokens.json"
    data = json.loads(target.read_text())
    data["first_score_distributions"] = result
    target.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("Recovered 149 observations, six medians and six IQRs per metric from Figure 5.")
