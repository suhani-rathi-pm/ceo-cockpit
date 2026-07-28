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

Companies with missing ICP data (icp_fit not High/Medium/Low) are pulled
out into their own "needs ICP review" bucket entirely -- not ranked or
classified alongside everyone else, since their score isn't comparable
until that gap is filled. They're re-evaluated against the same top-N
cutoff once they have real ICP data.
"""

from dataclasses import dataclass

import pandas as pd

ICP_MULTIPLIERS = {"High": 1.0, "Medium": 0.8, "Low": 0.6}

INACTIVE_AFTER_DAYS = 60
THIS_WEEK_WINDOW_DAYS = 7

# near-term pipeline vs. keep-in-touch: locked in after reviewing the score
# distribution -- rank 6 is the biggest natural gap in the data (144pts
# between #6 and #7), a much cleaner break than the 50/50 median split.
NEAR_TERM_PIPELINE_TOP_N = 6


@dataclass
class ClassificationResult:
    prioritized: pd.DataFrame
    active_accounts: pd.DataFrame
    needs_icp_review: pd.DataFrame  # missing ICP data -- excluded from ranking/classification
    excluded: pd.DataFrame
    company_rollup: pd.DataFrame  # every ranked (non-excluded, ICP-scored) company


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

    grouped["icp_multiplier"] = grouped["icp_fit"].map(ICP_MULTIPLIERS)
    grouped["final_score"] = grouped["raw_score"] * grouped["icp_multiplier"]
    grouped["days_since_last_touch"] = (today - grouped["last_touchpoint_date"]).dt.days

    return grouped


def classify(scored_touchpoints: pd.DataFrame, today: pd.Timestamp) -> ClassificationResult:
    rollup = rollup_companies(scored_touchpoints, today)

    excluded = rollup[rollup["days_since_last_touch"] > INACTIVE_AFTER_DAYS].sort_values(
        "days_since_last_touch", ascending=False
    )
    active = rollup[rollup["days_since_last_touch"] <= INACTIVE_AFTER_DAYS].copy()

    has_icp_fit = active["icp_fit"].isin(ICP_MULTIPLIERS)
    needs_icp_review = active[~has_icp_fit].sort_values("raw_score", ascending=False)
    active = active[has_icp_fit].sort_values("final_score", ascending=False).copy()

    active["rank"] = range(1, len(active) + 1)
    active["lead_classification"] = active["rank"].apply(
        lambda rank: "near-term pipeline" if rank <= NEAR_TERM_PIPELINE_TOP_N else "keep-in-touch"
    )

    is_this_week = active["days_since_last_touch"] <= THIS_WEEK_WINDOW_DAYS
    prioritized = active[is_this_week].sort_values("final_score", ascending=False)
    active_accounts = active[~is_this_week].sort_values("final_score", ascending=False)

    return ClassificationResult(
        prioritized=prioritized,
        active_accounts=active_accounts,
        needs_icp_review=needs_icp_review,
        excluded=excluded,
        company_rollup=active,
    )
