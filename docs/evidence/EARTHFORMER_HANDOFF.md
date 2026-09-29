# Earthformer and learned-model handoff — SIH26084

Checked 2026-09-30 by Shawn. This records a bounded investigation, not learned-model inference.

## Demo decision

Use the synthetic EventBundle → CPU persistence → API → dashboard path after integration review and a local run. Display **persistence baseline**, not AI forecast. Do not advertise Earthformer, 0–6 hour skill, Indian validation, or calibrated hazards.

## Verified official candidate

- Source: https://github.com/amazon-science/earth-forecasting-transformer at commit 7732b03bdb366110563516c3502315deab4c2026 (cloned and inspected).
- Official pretrained SEVIR config: scripts/cuboid_transformer/sevir/earthformer_sevir_v1.yaml. Input is 13 VIL frames at 384×384×1; output is 12 future VIL frames; NTHWC layout; five-minute cadence; maximum horizon 60 minutes.
- The official runner uses preprocess=True and rescale_method="01". Its VIL loader specifies raw uint8 and normalization by 1/255. The team's arbitrary-unit demo_intensity fixture is not a valid Earthformer input.
- Official file: earthformer_sevir.pt from s3://earthformer/pretrained_checkpoints/earthformer_sevir.pt. The README HTTPS link returned HTTP 403 Forbidden in this attempt. The file was not obtained; SHA256 and checkpoint-specific terms remain unverified. The repository states Apache-2.0 for its code.
- Upstream documents a Python 3.9 / older CUDA stack. Shawn's Windows laptop has an 8 GB RTX 4060, but WSL is absent and the default Python 3.14.5 has no PyTorch stack. Runtime compatibility was not tested because verified weights were unavailable.

## Evidence boundary

No official checkpoint download, pretrained inference, prediction arrays, runtime/VRAM measurement, or real-event metric was produced. No small archived SEVIR event with held-out future truth was obtained. Do not report synthetic-fixture MAE/RMSE/CSI/POD/FAR as weather skill. SEVIR VIL is not rainfall mm/h, and US SEVIR results do not establish Indian performance. Hail, lightning, downburst and cloudburst remain unavailable with null probabilities.

## Manish handoff

Keep the persistence demo independent of Earthformer. If official weights become legitimately accessible, record exact URL, terms, bytes and SHA256 in a separate environment. Verify VIL encoding and 1/255 scaling, [B,13,384,384,1] → [B,12,384,384,1], five-minute UTC leads and held-out targets. A model handoff should contain observed history, predicted arrays, timestamps, source/config/checkpoint provenance, device, runtime and peak VRAM; future targets must stay outside inference input.

PPT-safe statement: “A reproducible CPU persistence baseline is demonstrated on synthetic data. Earthformer was investigated as a learned VIL candidate, but official weights were inaccessible; no learned inference or Indian validation is claimed.”

PR #7 was inspected separately: its draft source fixes the previously reproduced event-ID collision and validates EventBundle registration before advertising persistence. Its description reports 41 combined Python tests and an HTTP dashboard smoke; those are Manish's results, not an independent clean-machine run by Shawn.

Sources: https://github.com/amazon-science/earth-forecasting-transformer ; https://github.com/amazon-science/earth-forecasting-transformer/blob/7732b03bdb366110563516c3502315deab4c2026/scripts/cuboid_transformer/sevir/earthformer_sevir_v1.yaml ; https://github.com/MIT-AI-Accelerator/neurips-2020-sevir
