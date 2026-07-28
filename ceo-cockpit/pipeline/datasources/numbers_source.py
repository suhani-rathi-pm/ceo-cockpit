"""Dev/test data source: reads the dummy CRM data from local Apple Numbers
files. Will be replaced by a NotionDataSource later -- nothing outside this
file should need to change when that happens.
"""

from pathlib import Path

import pandas as pd
from numbers_parser import Document

from .base import DataSource


class NumbersDataSource(DataSource):
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)

    def _read_table(self, filename: str) -> pd.DataFrame:
        doc = Document(self.data_dir / filename)
        table = doc.sheets[0].tables[0]
        rows = table.rows(values_only=True)
        header, *data = rows
        return pd.DataFrame(data, columns=header)

    def load_touchpoints(self) -> pd.DataFrame:
        crms = self._read_table("crms.numbers")
        touchpoints = self._read_table("touchpoints.numbers")

        touchpoints["touchpoint_date"] = pd.to_datetime(touchpoints["touchpoint_date"])

        touchpoints = touchpoints.merge(
            crms[["crm_owner", "crm_credibility_multiplier"]],
            on="crm_owner",
            how="left",
        )

        return touchpoints
