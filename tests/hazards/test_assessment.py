from nowcast.hazards.assessment import assess_hazards


def test_absent_inputs_never_create_hazard_claims():
    hazards = assess_hazards(has_observations=False, has_geography=False)
    assert set(hazards) == {"storm_intensity_proxy", "hail", "lightning", "downburst", "cloudburst"}
    for item in hazards.values():
        assert item["status"] == "unavailable"
        assert item["probability"] is None
        assert item["estimated_arrival_utc"] is None
        assert item["timing_uncertainty_minutes"] is None
        assert not item["zones"]["features"]
