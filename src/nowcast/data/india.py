"""Explicit unavailable adapters until permitted samples and terms are supplied."""
SOURCES = {
    "mosdac_insat": "https://www.mosdac.gov.in/insat-3d",
    "imd_dwr": "https://radarapi.imd.gov.in/dsp/frontend/contact",
    "lightning": "https://api.imd.gov.in/public/api_reference.html",
}


def source_status(name):
    return {"id": name, "availability": "unavailable", "provenance": SOURCES[name],
            "reason": "No permitted raw sample, verified calibration or validated reader supplied"}


def load_india_sample(name, path):
    raise NotImplementedError(f"{source_status(name)['id']}: adapter unavailable; see docs/DATA_ACCESS.md")
