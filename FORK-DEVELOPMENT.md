# Fork Development Workflow

Guide for building this Payload CMS fork and publishing via GitHub Releases to `Dynogic/payload`.

## Prerequisites

- Node.js >= 20.9.0
- pnpm **11.9.0** (the root `packageManager` since the v3.90.2 sync). Run it through
  corepack so the pinned version is used without changing the machine's global
  pnpm: `corepack pnpm install`, `corepack pnpm build` (set
  `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` for unattended runs). `corepack enable` also
  works, but it rewires the global `pnpm` shim for every checkout on the machine.
- GitHub CLI (`brew install gh`)

## Remotes

- `origin` — `Dynogic/payload`, the fork. Branches, tags and releases live here.
- `payloadcms` — `payloadcms/payload`, upstream. Fetch tags from here
  (`git fetch payloadcms --tags`) and merge a release TAG (e.g. `v3.90.2`), never
  `main`.

## Versioning Scheme

The fork uses a 4-segment version: `v<upstream-version>.<fork-patch>`

- Upstream `3.76.1` → fork releases `v3.76.1.1`, `v3.76.1.2`, `v3.76.1.3`, ...
- When upstream bumps (e.g. `3.85.0` → `3.90.2`), reset fork patch to `.1` → `v3.90.2.1`.
  **An upstream bump changes TWO things in the consumer's URLs**: the release tag
  in the path AND the tgz filenames, which carry the upstream version
  (`payload-3.85.0.tgz` → `payload-3.90.2.tgz`). A tag-only `sed` leaves every URL
  pointing at a file that does not exist in the new release.
- Each upstream line gets its own branch, `app-v<upstream>` (e.g. `app-v3.90.2`).

## Release Workflow

Run these steps in order from the repo root. This is the complete process — no other steps are needed.

### Step 1: Determine the next version

```bash
# Get the latest release tag
LATEST=$(gh release list --repo Dynogic/payload --limit 1 --json tagName --jq '.[0].tagName')
echo "Latest: $LATEST"

# Bump the fork patch segment (e.g. v3.76.1.3 → v3.76.1.4)
NEXT=$(echo "$LATEST" | sed 's/v//' | awk -F. '{$NF=$NF+1; print "v"$0}' OFS=.)
echo "Next:   $NEXT"
```

> If the upstream version changed since the last release, set `NEXT` manually (e.g. `NEXT=v3.90.2.1`).
> The latest release may also belong to an older line still being patched (e.g.
> `v3.85.0.55` cut after `v3.90.2.1`), so always check which line you are on.

### Step 2: Build

```bash
pnpm build
```

Use `pnpm bf` instead if cached builds aren't picking up your changes.

### Step 3: Pack

```bash
pnpm script:pack --all --dest ./packed
```

### Step 4: Create the GitHub release

**COMMIT _AND PUSH_ THE FORK CHANGE FIRST.** `gh release create` tags whatever
the branch tip is **on the remote** at that moment — release before the commit
is pushed and the tag points at the _previous_ entry's commit, so the tag names
the wrong source forever (happened to `v3.85.0.26`, `.27` and `.28`; each had to
be moved + force-pushed afterwards). Committing locally is NOT enough: an
unpushed commit is invisible to `gh`. Order: commit the `#NN` change → push the
branch → then release.

> A Claude session may push and tag THIS fork itself when the human allows it
> (they do for fork releases; varig itself is never pushed by Claude). If the
> branch was not pushed first, fix the tag afterwards:
>
> ```bash
> git push origin <branch>
> git tag -f "$NEXT" <sha-of-#NN-commit> && git push -f origin "$NEXT"
> ```
>
> The release ASSETS are unaffected either way — they are packed from the local
> working tree, so they always carry the change.

```bash
gh release create "$NEXT" ./packed/*.tgz \
  --title "$NEXT" \
  --notes "Description of changes" \
  --repo Dynogic/payload
```

### Step 5: Update the consuming project

**Ask the user for the absolute path to their project's `package.json`** (e.g. `/Users/sol/github/varig/package.json` — varig, the usual consumer, lives on this machine alongside this fork).

Then find all Dynogic/payload release URLs in that file and replace the old version tag with `$NEXT`. The URLs follow this pattern:

```
https://github.com/Dynogic/payload/releases/download/<VERSION_TAG>/package-name.tgz
```

Within one upstream line only the version tag in the download path changes; the
tgz filename stays the same. **Across an upstream bump the filename changes too**
(see *Versioning Scheme*), so rewrite both.

```bash
# Replace the old release tag with the new one in package.json
# Example: v3.76.1.3 → v3.76.1.4
OLD_TAG="$LATEST"   # from Step 1
NEW_TAG="$NEXT"     # from Step 1
PROJECT_PKG="/path/to/project/package.json"  # ask the user for this

sed -i '' "s|/download/${OLD_TAG}/|/download/${NEW_TAG}/|g" "$PROJECT_PKG"

# Upstream bump only: the filenames change as well, e.g. 3.85.0 → 3.90.2
sed -i '' -E "s|-3\.85\.0\.tgz|-3.90.2.tgz|g" "$PROJECT_PKG"
```

Then reinstall dependencies:

```bash
cd "$(dirname "$PROJECT_PKG")" && npm install
```

> **Note:** The tgz filenames use the upstream version (e.g. `payload-3.76.1.tgz`), not the fork patch version. Between fork releases on one upstream line only the release tag changes; an upstream bump changes the filenames too.

## Other Operations

### Update a single package in an existing release

```bash
pnpm turbo run build --filter=@payloadcms/ui --force
pnpm script:pack --all --dest ./packed
gh release upload v3.76.1.3 ./packed/payloadcms-ui-*.tgz --clobber --repo Dynogic/payload
```

### Sync with upstream

```bash
git fetch payloadcms --tags
git worktree add ../payload-<new> -b app-v<new> <fork tip>
cd ../payload-<new> && git merge v<new>      # the upstream release TAG, not main
# For each conflict: grep FORK-CHANGES.md for the path and keep every fork behaviour.
# Regenerate pnpm-lock.yaml (take upstream's, then `corepack pnpm install`), never hand-merge it.
# Then sweep: every line the fork adds over the old upstream tag must still be in the
# tree (a clean merge can still drop a fork change when upstream moves the code).
# Log the sync in FORK-CHANGES.md → Upstream sync log, then follow the Release Workflow.
```

### View releases

```bash
gh release list --repo Dynogic/payload
gh release view v3.76.1.3 --repo Dynogic/payload
```
