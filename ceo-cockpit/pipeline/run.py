"""Entry point: load -> score -> classify -> print/save.

Run from the ceo-cockpit directory with the venv active:
    python3 -m pipeline.run
"""

from pathlib import Path

import pandas as pd

from pipeline.build import build

OUTPUT_DIR = Path(__file__).parent.parent / "outputs"

DISPLAY_COLUMNS = [
    "company_name",
    "lead_classification",
    "final_score",
    "raw_score",
    "icp_fit",
    "icp_multiplier",
    "last_touchpoint_date",
    "days_since_last_touch",
    "touchpoint_count",
]


def format_table(df: pd.DataFrame) -> str:
    if df.empty:
        return "  (none)"
    out = df[DISPLAY_COLUMNS].copy()
    out["last_touchpoint_date"] = out["last_touchpoint_date"].dt.strftime("%Y-%m-%d")
    out["final_score"] = out["final_score"].round(1)
    out["raw_score"] = out["raw_score"].round(1)
    return out.to_string(index=False)


def main():
    today = pd.Timestamp.today().normalize()
    scored, result = build(today)

    all_scored = pd.concat([result.prioritized, result.active_accounts])
    distribution = all_scored["final_score"].describe(
        percentiles=[0.1, 0.25, 0.3, 0.5, 0.7, 0.75, 0.9]
    )
    threshold = all_scored["final_score"].median()
    n_pipeline = (all_scored["lead_classification"] == "near-term pipeline").sum()
    n_keep_in_touch = (all_scored["lead_classification"] == "keep-in-touch").sum()

    sections = []
    sections.append(f"Run date: {today.date()}")
    sections.append(
        f"lead_classification split: top 50% by final_score >= {threshold:.1f} "
        f"= near-term pipeline ({n_pipeline}), rest = keep-in-touch ({n_keep_in_touch})"
    )
    sections.append("")
    sections.append(f"PRIORITIZED / ACTION ITEMS ({len(result.prioritized)} companies)")
    sections.append(f"  most recent touchpoint within last {7} days")
    sections.append(format_table(result.prioritized))
    sections.append("")
    sections.append(f"ACTIVE ACCOUNTS ({len(result.active_accounts)} companies)")
    sections.append(format_table(result.active_accounts))
    sections.append("")
    sections.append(
        f"EXCLUDED ({len(result.excluded)} companies, last touchpoint 60+ days ago; "
        f"'CRM marked inactive' rule not applied -- no such field exists in the source data)"
    )
    if not result.excluded.empty:
        excl = result.excluded[["company_name", "last_touchpoint_date", "days_since_last_touch"]].copy()
        excl["last_touchpoint_date"] = excl["last_touchpoint_date"].dt.strftime("%Y-%m-%d")
        sections.append(excl.to_string(index=False))
    else:
        sections.append("  (none)")
    sections.append("")
    sections.append("FINAL_SCORE DISTRIBUTION (prioritized + active accounts, n={})".format(len(all_scored)))
    sections.append(distribution.round(1).to_string())

    report = "\n".join(sections)
    print(report)

    OUTPUT_DIR.mkdir(exist_ok=True)
    out_path = OUTPUT_DIR / f"run_{today.date()}.txt"
    out_path.write_text(report)
    print(f"\nSaved to {out_path}")


if __name__ == "__main__":
    main()
