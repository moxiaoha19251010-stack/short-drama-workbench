#!/usr/bin/env python3
"""Project the frozen Drama v2 shot script into a provider-neutral plan."""

from __future__ import annotations

import argparse
import importlib
import json
import re
import sys
from pathlib import Path


DEFAULT_TOOLS_ROOT = Path(r"C:\Basic Memory short-video\tools")


def _load_drama_schema(tools_root: Path):
    root = str(tools_root)
    if root not in sys.path:
        sys.path.insert(0, root)
    return importlib.import_module("drama_schema")


def _read_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _seconds(value: str, schema) -> tuple[float | None, float | None]:
    parsed = schema.time_range(str(value or ""))
    if not parsed:
        return None, None
    return float(parsed[0]), float(parsed[1])


def _asset_kind(asset_id: str) -> str:
    if asset_id.startswith("DR-"):
        return "character"
    if asset_id.startswith("SCENE_"):
        return "scene"
    if asset_id.startswith("PROP_"):
        return "prop"
    if asset_id.startswith("CROWD-"):
        return "crowd"
    return "prop"


def _named_assets(value: str, schema) -> tuple[list[dict], list[str]]:
    entries, invalid = schema.parse_shot_named_assets(str(value or ""))
    result = []
    for item in entries:
        asset_id = str(item.get("id") or "")
        if not asset_id.startswith(("DR-", "SCENE_", "PROP_", "CROWD-")):
            continue
        result.append({"id": asset_id, "name": str(item.get("name") or "")})
    return result, invalid


def _references(value: str, schema) -> tuple[list[dict], list[str]]:
    entries = schema.parse_shot_reference_line(str(value or ""))
    result = []
    invalid = []
    for item in entries:
        if not item.get("valid"):
            invalid.append(str(item.get("raw") or ""))
            continue
        asset_id = str(item.get("id") or "")
        if asset_id.startswith("TRIG_"):
            continue
        result.append(
            {
                "number": int(item["number"]),
                "id": asset_id,
                "name": str(item.get("name") or ""),
                "kind": _asset_kind(asset_id),
            }
        )
    return result, invalid


def _audio_entries(value: str, lock: dict, schema) -> tuple[list[dict], list[str]]:
    entries = schema.parse_shot_audio_line(str(value or ""))
    result = []
    invalid = []
    for item in entries:
        if not item.get("valid"):
            invalid.append(str(item.get("raw") or ""))
            continue
        speaker_id = str(item["id"])
        row = lock.get(speaker_id) or {}
        file_path = Path(str(row.get("file") or "")).name
        result.append(
            {
                "slot": int(item["slot"]),
                "speaker_id": speaker_id,
                "name": str(item.get("name") or row.get("name") or speaker_id),
                "duration_sec": float(item.get("duration") or row.get("duration") or 0),
                "file_name": file_path,
            }
        )
    return result, invalid


def _dialogue_entries(voices: list[dict]) -> list[dict]:
    result = []
    for voice in voices:
        mode = str(voice.get("mode") or "")
        result.append(
            {
                "speaker_id": str(voice.get("speaker") or ""),
                "mode": "off_screen" if "画外" in mode else "on_screen",
                "text": str(voice.get("line") or ""),
                "start_sec": voice.get("start"),
                "end_sec": voice.get("end"),
            }
        )
    return result


def _shot_entries(shots: list[dict], schema) -> list[dict]:
    result = []
    for index, shot in enumerate(shots, start=1):
        start, end = _seconds(str(shot.get("time") or ""), schema)
        result.append(
            {
                "id": index,
                "start_sec": start if start is not None else 0,
                "end_sec": end if end is not None else 0,
                "shot_size": str(shot.get("size") or ""),
                "action": str(shot.get("action") or ""),
                "cut_reason": str(shot.get("reason") or ""),
            }
        )
    return result


def _segments(unit: dict, duration: int) -> tuple[list[dict], str]:
    declared = str(unit.get("h3_split") or "").strip()
    if not declared:
        body = str(unit.get("text") or "")
        match = re.search(r"(?m)^-\s*生成分段\s*[：:]\s*(.+)$", body)
        if match:
            declared = match.group(1).strip()
    segments = []
    for match in re.finditer(
        r"([A-Z])\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})",
        declared,
    ):
        segments.append(
            {
                "id": match.group(1),
                "start_sec": int(match.group(2)) * 60 + int(match.group(3)),
                "end_sec": int(match.group(4)) * 60 + int(match.group(5)),
            }
        )
    if segments:
        return segments, declared
    return [{"id": "A", "start_sec": 0, "end_sec": duration}], declared


def _project_defaults(
    project: dict,
    project_id_arg: str,
    default_provider_arg: str,
) -> tuple[str, str, dict]:
    generation = project.get("generation") or {}
    project_id = (
        project_id_arg
        or str(project.get("project_id") or "")
        or "external-shot-script"
    )
    default_provider = (
        default_provider_arg
        or str(generation.get("default_provider") or "")
        or "generic-video"
    )
    overrides = generation.get("unit_overrides") or {}
    if not isinstance(overrides, dict):
        overrides = {}
    return project_id, default_provider, overrides


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parse a frozen Drama v2 shot script into generation/plan.json"
    )
    parser.add_argument("project_dir", help="项目目录")
    parser.add_argument("--script", help="镜头剧本路径；默认项目目录/章01_镜头剧本.md")
    parser.add_argument("--project-json", help="项目 JSON 路径；默认项目目录/project.json")
    parser.add_argument("--project-id", default="", help="没有 project.json 时使用")
    parser.add_argument("--default-provider", default="", help="覆盖默认 provider")
    parser.add_argument(
        "--tools-root",
        default=str(DEFAULT_TOOLS_ROOT),
        help="drama_schema.py 所在目录",
    )
    args = parser.parse_args()

    project_dir = Path(args.project_dir).expanduser().resolve()
    script_path = (
        Path(args.script).expanduser().resolve()
        if args.script
        else project_dir / "章01_镜头剧本.md"
    )
    if not script_path.is_file():
        raise FileNotFoundError(f"找不到镜头剧本：{script_path}")

    project_json_path = (
        Path(args.project_json).expanduser().resolve()
        if args.project_json
        else project_dir / "project.json"
    )
    project = _read_json(project_json_path)
    schema = _load_drama_schema(Path(args.tools_root))
    text = script_path.read_text(encoding="utf-8")
    lock, invalid_lock = schema.parse_voice_audio_lock(text)
    units = schema.parse_script_units(schema.section(text, 1))
    if not units:
        raise ValueError("镜头剧本没有可解析的 Uxx 单元")

    project_id, default_provider, unit_overrides = _project_defaults(
        project,
        args.project_id,
        args.default_provider,
    )
    warnings = [f"角色音频锁无法解析：{item}" for item in invalid_lock]
    plan_units = []
    for uid, unit in units.items():
        start, end = _seconds(str(unit.get("time") or ""), schema)
        duration = int(round((end - start))) if start is not None and end is not None else 0
        if duration <= 0:
            duration = int((project.get("format") or {}).get("unit_seconds") or 10)
        segments, declared_split = _segments(unit, duration)
        cast, invalid_cast = _named_assets(unit.get("chars"), schema)
        assets, invalid_assets = _named_assets(unit.get("assets"), schema)
        references, invalid_refs = _references(unit.get("refs"), schema)
        audio, invalid_audio = _audio_entries(
            schema.kv_value_with_note(str(unit.get("text") or ""), "角色音频"),
            lock,
            schema,
        )
        for item in invalid_cast:
            warnings.append(f"{uid} 出场无法解析：{item}")
        for item in invalid_assets:
            warnings.append(f"{uid} 资产无法解析：{item}")
        for item in invalid_refs:
            warnings.append(f"{uid} 参考图无法解析：{item}")
        for item in invalid_audio:
            warnings.append(f"{uid} 角色音频无法解析：{item}")

        plan_units.append(
            {
                "id": uid,
                "duration_sec": duration,
                "time": str(unit.get("time") or ""),
                "segments": segments,
                "shots": _shot_entries(unit.get("shots") or [], schema),
                "cast": cast,
                "scene": str(unit.get("scene") or ""),
                "assets": assets,
                "references": references,
                "audio": audio,
                "dialogue": _dialogue_entries(unit.get("voices") or []),
                "sound": str(unit.get("sound") or ""),
                "change": str(unit.get("change") or ""),
                "entry_anchor": str(unit.get("entry") or ""),
                "exit_anchor": str(unit.get("exit") or ""),
                "trigger": str(unit.get("trigger") or ""),
                "link": str(unit.get("link") or ""),
                **({"declared_split": declared_split} if declared_split else {}),
            }
        )

    plan = {
        "schema": "short-drama-generation/v1",
        "project_id": project_id,
        "source_script": script_path.name,
        "default_provider": default_provider,
        "unit_overrides": unit_overrides,
        "warnings": warnings,
        "units": plan_units,
    }
    output_dir = project_dir / "generation"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "plan.json"
    output_path.write_text(
        json.dumps(plan, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"PLAN_WRITTEN {output_path}")


if __name__ == "__main__":
    main()
