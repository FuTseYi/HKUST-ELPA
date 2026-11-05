#!/usr/bin/env python3
"""Render reviewed JSON question data into standalone browser scripts.

The reviewed JSON files are the canonical source for browser question data.
"""
import argparse
import json
from pathlib import Path


FIELDS = {
    "questions": (
        ("banks", "BANKS"),
        ("pastQuestionIds", "PAST_QUESTION_IDS"),
        ("legacyQuestionAliases", "LEGACY_QUESTION_ALIASES"),
    ),
    "appearances": (("data", "ELPA_APPEARANCES"),),
    "advice": (("data", "ELPA_ADVICE"),),
    "taxonomy": (("data", "ELPA_TAXONOMY"),),
}


def load_dataset(root: Path, name: str):
    value = json.loads((root / f"{name}.json").read_text(encoding="utf-8"))
    if name == "questions":
        if not isinstance(value, dict) or set(value) != {
            "banks", "pastQuestionIds", "legacyQuestionAliases"
        }:
            raise ValueError("questions.json: incomplete or unexpected data fields")
        return value
    if (name == "advice" and not isinstance(value, list)) or (
        name != "advice" and not isinstance(value, dict)
    ):
        raise ValueError(f"{name}.json: invalid data type")
    return {"data": value}


def verify_references(datasets):
    questions = datasets["questions"]
    banks = questions["banks"]
    if not isinstance(banks, dict) or not all(
        isinstance(bank, dict) and isinstance(bank.get("items"), list)
        for bank in banks.values()
    ):
        raise ValueError("questions.json: invalid banks")
    ids = [f"{key}-{item['num']}" for key, bank in banks.items()
           for item in bank["items"]]
    if len(set(ids)) != len(ids):
        raise ValueError("questions.json: duplicate IDs")
    known = set(ids)
    if not isinstance(questions["pastQuestionIds"], list) or not all(
        id_ in known for id_ in questions["pastQuestionIds"]
    ):
        raise ValueError("questions.json: missing historical IDs")
    aliases = questions["legacyQuestionAliases"]
    if not isinstance(aliases, dict) or not all(
        old in known and new in known for old, new in aliases.items()
    ):
        raise ValueError("questions.json: broken historical aliases")
    if not all(id_ in known for id_ in datasets["appearances"]["data"]):
        raise ValueError("appearances.json: unknown question ID")


def render(input_dir: Path, output_dir: Path):
    datasets = {name: load_dataset(input_dir, name) for name in FIELDS}
    verify_references(datasets)
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, variables in FIELDS.items():
        data = datasets[name]
        text = "".join(
            "const " + variable + " = " +
            json.dumps(data[key], ensure_ascii=False, separators=(",", ":")) +
            ";\n"
            for key, variable in variables
        )
        (output_dir / f"{name}.js").write_text(text, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path,
                        help="Directory containing the four reviewed JSON files")
    parser.add_argument("--output", required=True, type=Path,
                        help="Generated browser script directory")
    args = parser.parse_args()
    render(args.input, args.output)


if __name__ == "__main__":
    main()
