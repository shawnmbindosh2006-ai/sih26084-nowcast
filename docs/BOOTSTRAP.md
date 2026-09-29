# Repository bootstrap
Repository: https://github.com/shawnmbindosh2006-ai/sih26084-nowcast

The starter structure is introduced through a bootstrap pull request to main. After it is merged, update the local main branch before creating develop:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c develop
git push -u origin develop
```

If develop already exists, switch to it and pull with --ff-only instead of recreating it. Create module feature branches from the latest develop and submit feature pull requests to develop. Release pull requests target main.

Require peer review and owner review for main releases. Configure branch protection when the repository plan supports enforcement; CODEOWNERS alone does not block unreviewed merges. Require CI checks only after those jobs exist and have run successfully. Do not force-push shared branches or change access or visibility without explicit authorization.

This starter contains interfaces, documentation and illustrative metadata. It does not implement a runnable application. Launch scripts, dependency locks and an integrated demonstration are subsequent deliverables.
