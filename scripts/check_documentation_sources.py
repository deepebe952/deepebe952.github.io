#!/usr/bin/env python3
"""Verify documentation provenance and launch examples without running task code.

Defaults to the sibling infrathon checkout and the paper archive named by
data/task_metrics.json. Override their locations with --repo and --paper.
Only Git metadata, JSON, source bytes and ZIP members are read. Shell examples
are checked with bash -n; GPU, Docker and task launch commands are never run.

Budget checks deliberately recognize the documented launch forms, not arbitrary
shell programs: --hours/--timeout, or --config pointing to a file copied from a
template and updated by the documented TASK_TIMEOUT sed substitution.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import subprocess
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]
PROJECT = "https://github.com/deepebe952/infrathon"
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
LAUNCHER = re.compile(r"(?:\./)?launch/[^/\s]+/run\.sh\Z")
COMMAND_FIELDS = (
    "config_setup", "launch_setup", "launch_command", "scratch_setup",
    "after_pull_command", "test_commands",
)


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def project_identity(value: str) -> str:
    """Normalize GitHub HTTPS, SSH and SCP-style origin URLs without networking."""
    value = re.sub(r"^git@github\.com:", "https://github.com/", value.strip())
    value = re.sub(r"^ssh://git@github\.com/", "https://github.com/", value)
    return value.rstrip("/").removesuffix(".git")


def shell_lines(script: str) -> list[list[str]]:
    """Tokenize documented simple commands; discard comments and continuations."""
    return [tokens for line in script.replace("\\\n", "").splitlines()
            if (tokens := shlex.split(line, comments=True, posix=True))]


class Audit:
    def __init__(self, repo: Path):
        self.repo = repo.resolve()
        self.errors: list[str] = []
        self.hashes: dict[str, str] = {}
        self.source_references = 0
        self.shell_examples = 0

    def require(self, condition: bool, message: str) -> bool:
        if not condition:
            self.errors.append(message)
        return condition

    def path(self, relative, where: str) -> Path | None:
        if not isinstance(relative, str) or not relative:
            self.errors.append(f"{where}: missing relative source path")
            return None
        name = PurePosixPath(relative)
        if name.is_absolute() or ".." in name.parts or "\\" in relative:
            self.errors.append(f"{where}: source path must stay inside the checkout: {relative}")
            return None
        path = (self.repo / relative).resolve()
        if not path.is_relative_to(self.repo):
            self.errors.append(f"{where}: source symlink leaves the checkout: {relative}")
            return None
        if not path.is_file():
            self.errors.append(f"{where}: missing source file {relative}")
            return None
        return path

    def source(self, relative, expected, where: str) -> None:
        self.source_references += 1
        path = self.path(relative, where)
        if not self.require(isinstance(expected, str) and bool(SHA256.fullmatch(expected)),
                            f"{where}: missing or invalid SHA-256 for {relative}"):
            return
        if path is not None:
            if relative not in self.hashes:
                self.hashes[relative] = sha256(path.read_bytes())
            self.require(self.hashes[relative] == expected,
                         f"{where}: SHA-256 mismatch for {relative}")

    def git(self, *args: str) -> str:
        result = subprocess.run(["git", "-C", str(self.repo), *args],
                                capture_output=True, text=True, check=False)
        if result.returncode:
            raise ValueError(f"cannot read Git {' '.join(args)} from --repo")
        return result.stdout.strip()

    def metadata(self, records: list[tuple[str, dict]]) -> None:
        head = self.git("rev-parse", "HEAD")
        origin = project_identity(self.git("remote", "get-url", "origin"))
        self.require(origin == PROJECT, "--repo origin does not identify the documented infrathon project")
        for name, record in records:
            self.require(record.get("project") == PROJECT, f"{name}: unexpected source project")
            revision = record.get("revision")
            self.require(isinstance(revision, str) and bool(re.fullmatch(r"[0-9a-f]{40}", revision)),
                         f"{name}: expected a full Git revision")
            self.require(revision == head, f"{name}: recorded revision differs from --repo HEAD ({head})")
            # --repo may relocate the checkout; the stored project location remains portable.
            self.require(record.get("checkout") == "../infrathon", f"{name}: unexpected checkout metadata")

    def shell_syntax(self, guide: dict, key: str) -> None:
        # Do not inherit BASH_ENV, ENV or shell options that could source user code.
        env = {"PATH": os.environ.get("PATH", os.defpath), "LC_ALL": "C"}
        for field in COMMAND_FIELDS:
            script = guide.get(field)
            if not script:
                continue
            if not self.require(isinstance(script, str), f"{key}.{field}: expected shell text"):
                continue
            result = subprocess.run(["bash", "--noprofile", "--norc", "-n"],
                                    input=script + "\n", capture_output=True,
                                    text=True, env=env, check=False)
            self.shell_examples += 1
            self.require(result.returncode == 0,
                         f"{key}.{field}: bash -n failed: {result.stderr.strip()}")

    def config_budgets(self, script: str, key: str) -> dict[str, int | None]:
        """Track copied config files and the explicit timeout edits, in order."""
        configs: dict[str, int | None] = {}
        edited: set[str] = set()
        for tokens in shell_lines(script):
            if tokens[0] == "cp" and len(tokens) == 3:
                source, destination = tokens[1:]
                path = self.path(source, f"{key}.config_setup")
                if path is None:
                    continue
                values = re.findall(r"^\s*TASK_TIMEOUT\s*=\s*([0-9]+)\s*(?:#.*)?$",
                                    path.read_text(encoding="utf-8"), re.M)
                configs[destination] = int(values[-1]) if values else None
                edited.discard(destination)
            elif tokens[:2] == ["sed", "-i"] and len(tokens) == 4:
                change = re.fullmatch(r"s/\^TASK_TIMEOUT=\.\*/TASK_TIMEOUT=([0-9]+)/", tokens[2])
                destination = tokens[3]
                if change and self.require(destination in configs,
                                           f"{key}: timeout edit precedes its config copy"):
                    # sed cannot create the setting if the template did not contain it.
                    if self.require(configs[destination] is not None,
                                    f"{key}: copied template has no numeric TASK_TIMEOUT"):
                        configs[destination] = int(change.group(1))
                        edited.add(destination)
        return {path: value for path, value in configs.items() if path in edited}

    def launch(self, guide: dict, task: dict) -> None:
        key, level, hours = task["key"], task["level"], task["budget_h"]
        expected = {"operator": 12, "module": 24, "system": 24}.get(level)
        self.require(expected is not None and hours == expected,
                     f"{key}: registry budget must match the paper's 12h operator / 24h module-system rule")
        declared = guide.get("launcher")
        if declared is not None:
            self.path(declared, f"{key}.launcher")
        script = guide.get("launch_command")
        if not self.require(isinstance(script, str) and bool(script.strip()),
                            f"{key}: missing launch_command"):
            return
        configs = self.config_budgets(guide.get("config_setup", ""), key)
        launched = []
        for tokens in shell_lines(script):
            launchers = [(i, token) for i, token in enumerate(tokens) if LAUNCHER.fullmatch(token)]
            if not launchers:
                self.errors.append(f"{key}: unrecognized launch command; expected launch/<task>/run.sh")
                continue
            if not self.require(len(launchers) == 1, f"{key}: expected one launcher per command"):
                continue
            index, launcher = launchers[0]
            self.path(launcher, f"{key}.launch_command")
            launched.append(launcher.removeprefix("./"))
            options = tokens[index + 1:]
            durations = []
            config_path = None
            for i, option in enumerate(options):
                if option not in ("--hours", "--timeout", "--config"):
                    continue
                if not self.require(i + 1 < len(options), f"{key}: {option} has no value"):
                    continue
                value = options[i + 1]
                if option == "--config":
                    config_path = value
                elif self.require(value.isdigit(), f"{key}: {option} must explicitly name the paper budget"):
                    durations.append(int(value) * (3600 if option == "--hours" else 1))
            if durations:
                self.require(all(value == hours * 3600 for value in durations),
                             f"{key}: launch budget differs from the paper's {hours} hours")
            else:
                self.require(config_path in configs and configs[config_path] == hours * 3600,
                             f"{key}: launch/config_setup does not explicitly set the paper's {hours}-hour budget")
        self.require(bool(launched), f"{key}: no launcher found")
        if declared is not None:
            self.require(set(launched) == {declared.removeprefix("./")},
                         f"{key}: launch_command does not match launcher metadata")


def check_sources(audit: Audit, guides: dict, metrics: dict, setup: dict) -> None:
    expected_hashes = metrics["documentation"]["source_sha256"]
    for path, digest in expected_hashes.items():
        audit.source(path, digest, "task_metrics.documentation.source_sha256")
    for key, guide in guides["tasks"].items():
        audit.require(bool(guide.get("sources")), f"{key}: no guide sources")
        for source in guide.get("sources", []):
            audit.source(source.get("doc"), source.get("sha256"), f"task_guides.{key}.sources")
    for key, metric in metrics["tasks"].items():
        audit.require(bool(metric.get("sources")), f"{key}: no metric sources")
        for source in metric.get("sources", []):
            path = source.get("doc")
            audit.source(path, expected_hashes.get(path), f"task_metrics.{key}.sources")
    for source in setup["sources"]:
        audit.source(source.get("path"), source.get("sha256"), "setup_sources.sources")


def check_tasks(audit: Audit, guides: dict, metrics: dict, registry: dict) -> None:
    tasks = registry["tasks"]
    keys = [task["key"] for task in tasks]
    audit.require(len(keys) == len(set(keys)) == 25, "data/tasks.json must contain 25 unique task keys")
    for name, rows in (("task_guides", guides["tasks"]), ("task_metrics", metrics["tasks"])):
        audit.require(set(rows) == set(keys), f"{name}: task keys differ from data/tasks.json")
    public = read_json(audit.repo / "scripts/infrathon/tasks.json")["tasks"]
    directories = [row["directory"] for row in guides["tasks"].values()]
    audit.require(len(directories) == len(set(directories)) == 25, "guides must map to 25 unique task directories")
    audit.require(set(directories) == {f"tasks/latest/{name}" for name in public},
                  "guide directories differ from the public release registry")
    for task in tasks:
        key = task["key"]
        if key not in guides["tasks"]:
            continue
        guide = guides["tasks"][key]
        config = f"{guide['directory']}/tasks/{guide['task_id']}.json"
        path = audit.path(config, f"{key}.task_id")
        if path is not None:
            audit.require(read_json(path).get("task_id") == guide["task_id"],
                          f"{key}: task_id differs from the task configuration")
        audit.shell_syntax(guide, key)
        audit.launch(guide, task)


def check_paper(audit: Audit, paper: Path, metrics: dict) -> None:
    # These are current manifests. Archived PDF/digitization metadata is deliberately
    # not compared with the current manuscript.
    experimental = read_json(ROOT / "data/experimental_figures.json")
    behavior = read_json(ROOT / "data/behavior_original_figures.json")
    records = [
        ("task_metrics.paper", metrics["paper"]["archive"], metrics["paper"]["sha256"]),
        ("experimental_figures", experimental["source"], experimental["source_sha256"]),
        ("behavior_original_figures", behavior["source_archive"], behavior["source_archive_sha256"]),
    ]
    archive_hash = sha256(paper.read_bytes())
    for name, filename, expected in records:
        audit.require(filename == metrics["paper"]["archive"], f"{name}: current paper archive names disagree")
        audit.require(archive_hash == expected, f"{name}: paper archive SHA-256 mismatch")
    member = behavior["source_tex"]
    with zipfile.ZipFile(paper) as archive:
        if not audit.require(archive.namelist().count(member) == 1,
                             f"paper: expected exactly one {member} member"):
            return
        tex_hash = sha256(archive.read(member))
    for name, record in (("experimental_figures", experimental), ("behavior_original_figures", behavior)):
        audit.require(tex_hash == record["main_tex_sha256"], f"{name}: main.tex SHA-256 mismatch")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", type=Path, default=ROOT.parent / "infrathon",
                        help="public source checkout (default: sibling ../infrathon)")
    parser.add_argument("--paper", type=Path,
                        help="Overleaf ZIP (default: sibling archive recorded in task_metrics.json)")
    args = parser.parse_args(argv)
    audit = Audit(args.repo)
    try:
        if not shutil.which("bash") or not shutil.which("git"):
            raise ValueError("bash and git are required for read-only syntax and revision checks")
        guides = read_json(ROOT / "data/task_guides.json")
        metrics = read_json(ROOT / "data/task_metrics.json")
        setup = read_json(ROOT / "data/setup_sources.json")
        registry = read_json(ROOT / "data/tasks.json")
        audit.metadata([("task_guides.source", guides["source"]),
                        ("task_metrics.documentation", metrics["documentation"]),
                        ("setup_sources", setup)])
        check_sources(audit, guides, metrics, setup)
        check_tasks(audit, guides, metrics, registry)
        check_paper(audit, args.paper or ROOT.parent / metrics["paper"]["archive"], metrics)
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile) as exc:
        audit.errors.append(f"cannot complete source audit: {exc}")
    for error in audit.errors:
        print(f"error: {error}", file=sys.stderr)
    if audit.errors:
        print(f"Documentation sources: FAIL ({len(audit.errors)} errors)")
        return 1
    print(f"Documentation sources: OK — 25 tasks, {len(audit.hashes)} source files "
          f"({audit.source_references} references), {audit.shell_examples} shell examples; "
          "project/revision, task IDs, launch budgets and paper ZIP/main.tex hashes match.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
