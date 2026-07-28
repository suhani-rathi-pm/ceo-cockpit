"""Shared load -> score -> classify sequence, used by both run.py (the
scoring/classification report) and run_outreach.py (drafting).
"""

from pathlib import Path

import pandas as pd

from pipeline.classify import ClassificationResult, classify
from pipeline.datasources.numbers_source import NumbersDataSource
from pipeline.scoring import score_touchpoints

DATA_DIR = Path(__file__).parent.parent


def build(today: pd.Timestamp) -> tuple[pd.DataFrame, ClassificationResult]:
    source = NumbersDataSource(DATA_DIR)
    touchpoints = source.load_touchpoints()
    scored = score_touchpoints(touchpoints)
    result = classify(scored, today)
    return scored, result
