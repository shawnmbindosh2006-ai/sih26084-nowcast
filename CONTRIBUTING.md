# Contribution workflow
1. Accept collaborator invitation. Configure your own Git author identity and use a verified/noreply GitHub email for credit.
2. Clone https://github.com/shawnmbindosh2006-ai/sih26084-nowcast.git; fetch; switch develop; pull --ff-only. If develop does not yet exist, wait for the coordinator's initial branch or start locally without pushing main.
3. Create your branch: feature/manish-model, feature/harinandana-data, feature/devananda-api or feature/anamika-dashboard.
4. Commit small meaningful checkpoints. Push your branch. Open a draft PR to develop early; mark ready when evidence and tests exist.
5. Manish reviews other contributors. Manish's own PR receives peer review. Resolve comments before merging develop.
6. Manish opens develop -> main release PR. Shawn approves the release candidate. Owner-only CODEOWNERS on main can require Shawn's review when branch protection is supported and enabled. Nobody bypasses this process.
7. No force push or shared branch deletion. No secrets, credentials, datasets, weights or giant videos. Store manifests/checksums and external download instructions. Do not run npm or model dependencies in the leader's global environment.

## Shared paths
contracts/, docs/CONTRACT.md and dependency changes must be coordinated. Manish reconciles Python application/model environments; Devananda owns requirements-app.txt, Anamika owns web/package-lock.json. During the first demo prefer a separate model adapter process if legacy dependencies conflict.

## Branch enforcement
Private GitHub Free may not enforce protected branches or CODEOWNERS. The process then remains a team convention. For enforced private owner approval use an eligible personal plan or appropriate organization plan; do not purchase or switch public without Shawn's decision. If staying Free with strict separation, consider contributor-owned repositories and an owner-only canonical repository at the cost of extra integration work.
