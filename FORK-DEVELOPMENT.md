# Fork Development Workflow

Guide for building this Payload CMS fork and publishing via GitHub Releases to `Dynogic/payload`.

## Prerequisites

- Node.js >= 20.9.0
- pnpm 10.27.0+
- GitHub CLI (`brew install gh`)

## Versioning Scheme

The fork uses a 4-segment version: `v<upstream-version>.<fork-patch>`

- Upstream `3.76.1` → fork releases `v3.76.1.1`, `v3.76.1.2`, `v3.76.1.3`, ...
- When upstream bumps (e.g. `3.76.1` → `3.77.0`), reset fork patch to `.1` → `v3.77.0.1`

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

> If the upstream version changed since the last release, set `NEXT` manually (e.g. `NEXT=v3.77.0.1`).

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

```bash
gh release create "$NEXT" ./packed/*.tgz \
  --title "$NEXT" \
  --notes "Description of changes" \
  --repo Dynogic/payload
```

### Step 5: Update the consuming project

**Ask the user for the absolute path to their project's `package.json`** (e.g. `/Users/agua/myproject/package.json`).

Then find all Dynogic/payload release URLs in that file and replace the old version tag with `$NEXT`. The URLs follow this pattern:

```
https://github.com/Dynogic/payload/releases/download/<VERSION_TAG>/package-name.tgz
```

Only the version tag in the download path changes — the tgz filename stays the same.

```bash
# Replace the old release tag with the new one in package.json
# Example: v3.76.1.3 → v3.76.1.4
OLD_TAG="$LATEST"   # from Step 1
NEW_TAG="$NEXT"     # from Step 1
PROJECT_PKG="/path/to/project/package.json"  # ask the user for this

sed -i '' "s|/download/${OLD_TAG}/|/download/${NEW_TAG}/|g" "$PROJECT_PKG"
```

Then reinstall dependencies:

```bash
cd "$(dirname "$PROJECT_PKG")" && npm install
```

> **Note:** The tgz filenames use the upstream version (e.g. `payload-3.76.1.tgz`), not the fork patch version. Only the release tag in the download URL path changes between fork releases.

## Other Operations

### Update a single package in an existing release

```bash
pnpm turbo run build --filter=@payloadcms/ui --force
pnpm script:pack --all --dest ./packed
gh release upload v3.76.1.3 ./packed/payloadcms-ui-*.tgz --clobber --repo Dynogic/payload
```

### Sync with upstream

```bash
git fetch payloadcms
git merge payloadcms/main
# Resolve any conflicts, then follow the Release Workflow above
```

### View releases

```bash
gh release list --repo Dynogic/payload
gh release view v3.76.1.3 --repo Dynogic/payload
```
