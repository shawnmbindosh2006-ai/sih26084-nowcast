# Contribution workflow
1. Configure your own Git author identity and a verified or GitHub noreply email.
2. Clone https://github.com/shawnmbindosh2006-ai/sih26084-nowcast.git. Fetch and update develop with a fast-forward-only pull. If develop does not exist, wait until the bootstrap pull request is merged and develop is created from updated main.
3. Create a feature branch for your module: feature/manish-model, feature/harinandana-data, feature/devananda-api or feature/anamika-dashboard.
4. Commit small, meaningful changes and open a pull request to develop. Include run commands, evidence, checks and limitations.
5. Obtain peer review and resolve comments before merging. Changes to main use a release pull request and repository-owner review.
6. Do not force-push or delete shared branches. Keep secrets, credentials, large datasets, model weights and large videos outside Git. Commit manifests, checksums and reproducible download instructions instead. Use isolated application and model environments.

## Shared paths
Coordinate contracts/, docs/CONTRACT.md and dependency changes before integration. The model contributor reconciles application and model environments; the API contributor maintains requirements-app.txt, and the frontend contributor maintains web/package-lock.json. Use a separate model adapter process when legacy dependencies conflict.

## Branch enforcement
Private GitHub Free repositories may not enforce protected branches or CODEOWNERS. Review requirements remain the documented workflow when technical enforcement is unavailable. Do not change repository visibility, purchase a plan or alter access without explicit authorization. CODEOWNERS identifies the repository owner; it does not itself enforce approval.
