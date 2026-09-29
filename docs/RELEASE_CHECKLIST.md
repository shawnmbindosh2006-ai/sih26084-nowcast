# Release candidate acceptance
- Fresh clone can run the CPU fixture without accounts, GPU, model downloads or online basemap tiles.
- Windows instructions, tested dependency locks and exact local URLs exist.
- Observed/forecast frames, mode, timestamps, sources and supported leads are visible.
- Model/data provenance is reproducible; inference cannot read future targets.
- Unsupported hazards/probabilities are unavailable/null; no invented 6-hour or Indian validation claim.
- API/frontend/model smoke checks and module checks pass; results are recorded.
- Release includes small sample/config, download manifests, checksum, demo evidence and known limitations.
- Manish provides an integration report; Shawn approves develop -> main.
