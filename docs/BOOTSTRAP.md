# Repository bootstrap
The leader owns https://github.com/shawnmbindosh2006-ai/sih26084-nowcast. Create an empty private repository under @shawnmbindosh2006-ai, then populate it with this starter. If GitHub already created README.md, clone that repository and copy these starter contents over it before committing; do not force push unrelated history.

PowerShell after extracting and cloning:
git add .
git commit -m "Add team assignments and prototype contracts"
git push origin main
git switch -c develop
git push -u origin develop

The initial main upload is a bootstrap exception performed by the leader. All later prototype work uses feature branches and PRs.
Invite manishj2007, bluebvrrie, devanandabipin and anamikapvivekan05-ops through Settings -> Collaborators -> Add people. Acceptance is required before private access works. Check actual usernames and account matches. Do not give co-owner/admin status or share login credentials.

Protect main where the plan supports enforcement: require PRs, one approving review, Code Owner approval, stale approval dismissal, resolved conversations and no force push/deletion. Keep owner-only CODEOWNERS on main. Configure develop without owner-only Code Owner enforcement so Manish can coordinate independently. Require smoke checks only after a real application CI job exists and has run successfully. Do not require a nonexistent check. GitHub Free private restrictions are described in CONTRIBUTING.md.

No application is implemented by this starter. Manish supplies working launch scripts and an integrated release.
