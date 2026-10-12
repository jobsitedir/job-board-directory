# Data fields

| Field | Meaning |
| --- | --- |
| schema_version | Record format version |
| domain | Canonical website domain and filename |
| name | Website name |
| website | Website homepage |
| profile | JobSiteDir profile link |
| site_type | Basic website type, or null |
| primary_country | Main service country, or null; not visitor geography |
| primary_industry | Main industry, or null |
| description | At most one short sentence, or null |
| logo / screenshot | Optional image path, notice and capture date |

Image paths are relative to the website JSON file. Null means not recorded or not distributed. Capture dates are independent of release dates. No record contains traffic metrics, collection sources or full profiles.

The manifest lists file checksums, count, version, cutoff and schema version.
