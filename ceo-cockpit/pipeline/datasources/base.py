"""Contract every data source must satisfy.

A DataSource's only job is to produce one enriched touchpoint table with a
fixed set of columns. Everything downstream (scoring, classification,
drafting) depends only on this schema, not on where the rows came from.
Swap NumbersDataSource for a NotionDataSource later by implementing the
same interface -- no other module needs to change.
"""

import pandas as pd

REQUIRED_COLUMNS = [
    "touchpoint_id",
    "touchpoint_type",
    "touchpoint_date",
    "company_name",
    "contact_name",
    "contact_title",
    "crm_owner",
    "star_rating",
    "est_opportunity_size",
    "misc_comments",
    "crm_credibility_multiplier",
    "icp_fit",
]


class DataSource:
    def load_touchpoints(self) -> pd.DataFrame:
        raise NotImplementedError
