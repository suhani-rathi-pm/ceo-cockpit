"""Company-level rollup and the two output tables.

A "lead" is a company. Every touchpoint's score rolls up (summed, not
averaged) into one full-history score per company, then an ICP-fit
multiplier is applied on top.

Known-open item, flagged to the user rather than guessed at:
  - No inactive/status field exists in any source table, so the "CRM
    explicitly marked inactive" exclusion rule cannot be applied -- only
    the 60+ day staleness exclusion runs.

"This week" (for the Prioritized/Action Items table) is implemented as
"most recent touchpoint within the trailing 7 days of `today`" -- an
assumption, not something the user specified precisely.

Companies with missing ICP data (icp_fit not High/Medium/Low) are ranked
on raw_score alone -- no multiplier applied, since there's nothing to
discount or reward. This is not the same as treating them as "High" fit;
it just means that factor is excluded from their ranking.
"""

from dataclasses import dataclass

import pandas as pd

ICP_MULTIPLIERS = {"High": 1.0, "Medium": 0.8, "Low": 0.6}
DEFAULT_ICP_MULTIPLIER = 1.0  # missing ICP data: no multiplier applied, rank on raw_score alone

INACTIVE_AFTER_DAYS = 60
THIS_WEEK_WINDOW_DAYS = 7

# near-term pipeline vs. keep-in-touch: top/bottom 50% of final_score among
# active (non-excluded) companies. A placeholder split -- user plans to
# revisit as a different percentile once more runs are seen.
PIPELINE_PERCENTILE = 0.5


@dataclass
class ClassificationResult:
    prioritized: pd.DataFrame
    active_accounts: pd.DataFrame
    excluded: pd.DataFrame
    company_rollup: pd.DataFrame  # every non-excluded company, for distribution stats


def rollup_companies(scored_touchpoints: pd.DataFrame, today: pd.Timestamp) -> pd.DataFrame:
    grouped = (
        scored_touchpoints.groupby("company_name")
        .agg(
            raw_score=("touchpoint_score", "sum"),
            last_touchpoint_date=("touchpoint_date", "max"),
            touchpoint_count=("touchpoint_id", "count"),
            icp_fit=("icp_fit", "first"),
        )
        .reset_index()
    )

    grouped["icp_multiplier"] = grouped["icp_fit"].map(ICP_MULTIPLIERS).fillna(
        DEFAULT_ICP_MULTIPLIER
    )
    grouped["final_score"] = grouped["raw_score"] * grouped["icp_multiplier"]
    grouped["days_since_last_touch"] = (today - grouped["last_touchpoint_date"]).dt.days

    return grouped


def classify(scored_touchpoints: pd.DataFrame, today: pd.Timestamp) -> ClassificationResult:
    rollup = rollup_companies(scored_touchpoints, today)

    excluded = rollup[rollup["days_since_last_touch"] > INACTIVE_AFTER_DAYS].sort_values(
        "days_since_last_touch", ascending=False
    )
    active = rollup[rollup["days_since_last_touch"] <= INACTIVE_AFTER_DAYS].copy()

    threshold = active["final_score"].quantile(1 - PIPELINE_PERCENTILE)
    active["lead_classification"] = active["final_score"].apply(
        lambda score: "near-term pipeline" if score >= threshold else "keep-in-touch"
    )

    is_this_week = active["days_since_last_touch"] <= THIS_WEEK_WINDOW_DAYS
    prioritized = active[is_this_week].sort_values("final_score", ascending=False)
    active_accounts = active[~is_this_week].sort_values("final_score", ascending=False)

    return ClassificationResult(
        prioritized=prioritized,
        active_accounts=active_accounts,
        excluded=excluded,
        company_rollup=active,
    )
