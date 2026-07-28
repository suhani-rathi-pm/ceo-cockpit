"""Deterministic per-touchpoint scoring rubric.

per_touchpoint_score = seniority_weight x opportunity_weight x adjusted_rating

All weights/tiers below were given directly by the user -- do not adjust
without new instructions.
"""

import pandas as pd

# Contact seniority, derived from title text (contacts/touchpoints also carry
# a pre-computed seniority_tier column, but it disagrees with this rule for
# "Head of X" titles -- see conversation notes. This rule is the source of
# truth going forward.
SENIORITY_RULES = [
    (5, ["ceo", "coo", "cfo", "president", "founder", "chief"]),
    (4, ["vp", "svp", "evp", "vice president"]),
    (3, ["director", "head of"]),
    (2, ["manager"]),
]


def seniority_weight_from_title(title) -> int:
    text = (title or "").lower()
    for weight, keywords in SENIORITY_RULES:
        if any(keyword in text for keyword in keywords):
            return weight
    return 1


OPPORTUNITY_WEIGHTS = {
    "$1M+": 5,
    "$250k-1M": 4,
    "$50-250k": 3,
    "<$50k": 2,
    "Unknown": 1,
    "None identified": 0,
}

EMAIL_PLACEHOLDER_RATING = 2.5


def score_touchpoints(touchpoints: pd.DataFrame) -> pd.DataFrame:
    df = touchpoints.copy()

    df["seniority_weight"] = df["contact_title"].apply(seniority_weight_from_title)

    unmapped = set(df["est_opportunity_size"].unique()) - set(OPPORTUNITY_WEIGHTS)
    if unmapped:
        raise ValueError(f"est_opportunity_size has unmapped values: {unmapped}")
    df["opportunity_weight"] = df["est_opportunity_size"].map(OPPORTUNITY_WEIGHTS)

    star = df["star_rating"].fillna(EMAIL_PLACEHOLDER_RATING)
    df["adjusted_rating"] = star * df["crm_credibility_multiplier"]

    df["touchpoint_score"] = (
        df["seniority_weight"] * df["opportunity_weight"] * df["adjusted_rating"]
    )

    return df
