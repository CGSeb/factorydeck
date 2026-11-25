# Git host: GitHub

Issues, pull requests and CI for this repository live on GitHub. Every operation goes through the [GitHub CLI](https://cli.github.com/), `gh`, with `--repo`, because the Windows `gh.exe` cannot read a git repository inside WSL. The factorydeck skills name the operations below in **bold**; run the command written here. `/setup-factory` wrote this file and checked each command against the installed `gh`; edit it when your setup differs.

- CLI: `gh.exe` (the Windows GitHub CLI, called from WSL)
- Repository: `CGSeb/factorydeck`
- A change request is a **pull request**, numbered in the same space as issues.

Pass multi-line text as a file (`--body-file <file>`); with a Windows `gh.exe` under WSL, convert the path with `wslpath -w` first.

## Issues

- **List the queue**: `gh.exe issue list --repo CGSeb/factorydeck --label <spec> --label <ready> --state open --json number,title --jq 'sort_by(.title)'`
- **Read an issue**: `gh.exe issue view --repo CGSeb/factorydeck <n> --json number,title,body,labels,state`
- **List open issues of a label**: `gh.exe issue list --repo CGSeb/factorydeck --label <label> --state open --limit 100 --search "sort:updated-desc" --json number,title,body` (the 100 most recently updated)
- **Open blockers**: `gh.exe api repos/CGSeb/factorydeck/issues/<n>/dependencies/blocked_by --jq '[.[] | select(.state == "open") | .number]'`
- **Add a blocker**: `gh.exe api -X POST repos/CGSeb/factorydeck/issues/<n>/dependencies/blocked_by -F issue_id=<id>`, where `<id>` is the blocker's database id: `gh.exe api repos/CGSeb/factorydeck/issues/<blocker> --jq .id`, not its number.
- **Create an issue**: `gh.exe issue create --repo CGSeb/factorydeck --title "<title>" --label <label> --body-file <file>`
- **Edit an issue body**: `gh.exe issue edit --repo CGSeb/factorydeck <n> --body-file <file>` (replaces the whole body: read it with **Read an issue** right before).
- **Comment on an issue**: `gh.exe issue comment --repo CGSeb/factorydeck <n> --body-file <file>`
- **Move an issue's labels**: `gh.exe issue edit --repo CGSeb/factorydeck <n> --remove-label <from> --add-label <to>`
- **Hand an issue to the person**: `gh.exe issue edit --repo CGSeb/factorydeck <n> --add-assignee <person>`
- **List labels**: `gh.exe label list --repo CGSeb/factorydeck --limit 200`
- **Create a label**: `gh.exe label create --repo CGSeb/factorydeck <label> --description "<role>"`

## Pull requests

- **Open a pull request**: `gh.exe pr create --repo CGSeb/factorydeck --base main --head <branch> --title "<title>" --body-file <file>`
- **Update a pull request's body**: `gh.exe pr edit --repo CGSeb/factorydeck <pr> --body-file <file>`
- **Merged pull requests of a branch**: `gh.exe pr list --repo CGSeb/factorydeck --head <branch> --state merged --json number --jq length`
- **Pull request facts**: `gh.exe pr view --repo CGSeb/factorydeck <pr> --json state,isDraft,baseRefName,headRefName,headRefOid,statusCheckRollup,files,closingIssuesReferences`. Passing check conclusions: `SUCCESS`, `NEUTRAL`, `SKIPPED`.
- **Commits behind main**: `gh.exe api repos/CGSeb/factorydeck/compare/main...<head sha> --jq .behind_by`
- **Pull request diff**: `gh.exe pr diff --repo CGSeb/factorydeck <pr>`
- **Read pull request comments**: `gh.exe pr view --repo CGSeb/factorydeck <pr> --comments`
- **Comment on a pull request**: `gh.exe pr comment --repo CGSeb/factorydeck <pr> --body-file <file>`
- **Merge a pull request**: `gh.exe pr merge --repo CGSeb/factorydeck <pr> --squash --delete-branch --subject "<title>" --match-head-commit <head sha>` (`--merge` or `--rebase` for the other merge methods). GitHub refuses it if the branch moved since `<head sha>`.
- **Hand a pull request to the person**: `gh.exe pr edit --repo CGSeb/factorydeck <pr> --add-assignee <person>`. GitHub does not let an author request its own review; the person finds it under « Assigned to you ».

A pull request body containing `Closes #<n>` closes issue `<n>` when it merges.

## CI

- **Watch CI**: `gh.exe pr checks --repo CGSeb/factorydeck <pr> --watch`. « no checks reported » means no CI ran.
- **Failed CI log**: `gh.exe run view --repo CGSeb/factorydeck <run id> --log-failed` (the run id is in the failing check's link).

## Main branch protection

- **Protect the main branch**: `gh.exe api -X PUT repos/CGSeb/factorydeck/branches/main/protection --input <file>` with `{"required_status_checks": {"strict": true, "contexts": [<check names>]}, "enforce_admins": false, "required_pull_request_reviews": null, "restrictions": null}`. Needs admin rights; private repositories need a paid plan.
