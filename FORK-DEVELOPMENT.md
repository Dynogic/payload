# Fork Development Workflow

Guide for building this fork and publishing via GitHub Releases.

## Prerequisites

- Node.js >= 20.9.0
- pnpm 10.27.0+
- GitHub CLI (`brew install gh`)

## Building Packages

### Incremental Build (fast, uses cache)

```bash
pnpm build
```

### Force Build (clean + rebuild everything)

```bash
pnpm bf
```

### Force Build Single Package

```bash
pnpm turbo run build --filter=@payloadcms/ui --force
```

## Publishing to GitHub Releases

### 1. Build and Pack

```bash
pnpm build
pnpm script:pack --all --dest ./packed
```

### 2. Create a New Release

```bash
gh release create v3.71.1.1 ./packed/*.tgz \
  --title "v3.71.1.1" \
  --notes "Fix: description of changes" \
  --repo Dynogic/payload
```

### 3. Or Update an Existing Release

To replace a single package in an existing release:

```bash
gh release upload v3.71.1 ./packed/payloadcms-ui-*.tgz --clobber --repo Dynogic/payload
```

## Using in Local Projects

In your project's `package.json`, reference the GitHub release URLs:

```json
{
  "dependencies": {
    "payload": "https://github.com/Dynogic/payload/releases/download/v3.71.1/payload-3.71.1.tgz",
    "@payloadcms/db-mongodb": "https://github.com/Dynogic/payload/releases/download/v3.71.1/payloadcms-db-mongodb-3.71.1.tgz",
    "@payloadcms/next": "https://github.com/Dynogic/payload/releases/download/v3.71.1/payloadcms-next-3.71.1.tgz",
    "@payloadcms/plugin-cloud-storage": "https://github.com/Dynogic/payload/releases/download/v3.71.1/payloadcms-plugin-cloud-storage-3.71.1.tgz",
    "@payloadcms/richtext-lexical": "https://github.com/Dynogic/payload/releases/download/v3.71.1/payloadcms-richtext-lexical-3.71.1.tgz",
    "@payloadcms/translations": "https://github.com/Dynogic/payload/releases/download/v3.71.1/payloadcms-translations-3.71.1.tgz",
    "@payloadcms/ui": "https://github.com/Dynogic/payload/releases/download/v3.71.1/payloadcms-ui-3.71.1.tgz"
  }
}
```

Then run `npm install` in your project.

### Force Reinstall

If npm doesn't pick up the new release, clear cache and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Syncing with Upstream

```bash
# Fetch latest from upstream
git fetch payloadcms

# Merge into your branch
git merge payloadcms/main

# Resolve any conflicts, then rebuild and publish
pnpm build
pnpm script:pack --all --dest ./packed
gh release create vX.X.X ./packed/*.tgz --title "vX.X.X" --notes "Sync with upstream"
```

## Full Update Workflow

```bash
# 1. Sync with upstream (if needed)
git fetch payloadcms && git merge payloadcms/main

# 2. Build (use --force if changes aren't picked up)
pnpm build

# 3. Pack
pnpm script:pack --all --dest ./packed

# 4. Create GitHub release
gh release create v3.71.1.1 ./packed/*.tgz \
  --title "v3.71.1.1" \
  --notes "Description of changes" \
  --repo Dynogic/payload

# 5. In your project, update package.json URLs to new version and reinstall
npm install
```

## Viewing Releases

```bash
# List all releases
gh release list --repo Dynogic/payload

# View a specific release
gh release view v3.71.1 --repo Dynogic/payload
```
