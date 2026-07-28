"""Entry point: load -> score -> classify -> draft outreach for top leads.

Scope of "top-scoring leads" (per user decision): companies that are BOTH
in the Prioritized/Action Items table (touched this week) AND classified
near-term pipeline. Everyone else gets no draft.

Requires ANTHROPIC_API_KEY, either exported in your shell or in a
gitignored .env file in the ceo-cockpit directory (see .env.example).

Run from the ceo-cockpit directory with the venv active:
    python3 -m pipeline.run_outreach
"""

import os
import sys
from pathlib import Path

import anthropic
import pandas as pd
from dotenv import load_dotenv

from pipeline.build import build
from pipeline.outreach import draft_all

OUTPUT_DIR = Path(__file__).parent.parent / "outputs"


def main():
    load_dotenv()
    if not os.getenv("ANTHROPIC_API_KEY"):
        sys.exit(
            "ANTHROPIC_API_KEY is not set. Export it in your shell, or put it in a "
            ".env file in the ceo-cockpit directory (see .env.example)."
        )

    today = pd.Timestamp.today().normalize()
    scored, result = build(today)

    targets = result.prioritized[
        result.prioritized["lead_classification"] == "near-term pipeline"
    ]["company_name"].tolist()

    if not targets:
        print("No companies are both this-week-prioritized and near-term pipeline. Nothing to draft.")
        return

    print(f"Drafting outreach for {len(targets)} companies: {', '.join(targets)}\n")

    client = anthropic.Anthropic()
    drafts = draft_all(client, targets, scored)

    sections = [f"Run date: {today.date()}", f"Drafted for {len(targets)} companies", ""]
    for company_name in targets:
        row = result.prioritized[result.prioritized["company_name"] == company_name].iloc[0]
        sections.append("=" * 80)
        sections.append(
            f"{company_name}  |  final_score={row['final_score']:.1f}  |  "
            f"icp_fit={row['icp_fit']}  |  last_touchpoint={row['last_touchpoint_date'].date()}"
        )
        sections.append("")
        sections.append(drafts[company_name])
        sections.append("")

    report = "\n".join(sections)
    print(report)

    OUTPUT_DIR.mkdir(exist_ok=True)
    out_path = OUTPUT_DIR / f"outreach_{today.date()}.txt"
    out_path.write_text(report)
    print(f"\nSaved to {out_path}")


if __name__ == "__main__":
    main()
