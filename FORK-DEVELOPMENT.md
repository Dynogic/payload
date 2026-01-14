# Fork Development Workflow

Guide for building this fork and using it in local projects.

## Prerequisites

- Node.js >= 20.9.0
- pnpm 10.27.0+
- Git LFS (`brew install git-lfs && git lfs install`)

## Building Packages

### Incremental Build (fast, uses cache)

```bash
pnpm build
```

### Force Build (clean + rebuild everything)

```bash
pnpm bf
```

## Packing for Local Use

Pack all packages to a single folder:

```bash
pnpm script:pack --all --dest ./packed
```

This creates `.tgz` files in `/packed` for all packages.

## Using in Local Projects

In your project's `package.json`, reference the packed files:

```json
{
  "dependencies": {
    "payload": "file:../payload/packed/payload-*.tgz",
    "@payloadcms/db-mongodb": "file:../payload/packed/payloadcms-db-mongodb-*.tgz",
    "@payloadcms/next": "file:../payload/packed/payloadcms-next-*.tgz",
    "@payloadcms/plugin-cloud-storage": "file:../payload/packed/payloadcms-plugin-cloud-storage-*.tgz",
    "@payloadcms/richtext-lexical": "file:../payload/packed/payloadcms-richtext-lexical-*.tgz",
    "@payloadcms/translations": "file:../payload/packed/payloadcms-translations-*.tgz",
    "@payloadcms/ui": "file:../payload/packed/payloadcms-ui-*.tgz"
  }
}
```

Then run `npm install` in your project.

### Force Reinstall

If `npm install` doesn't pick up changes to the tgz files, force reinstall with:

```bash
npm install ../payload/packed/payload-*.tgz ../payload/packed/payloadcms-db-mongodb-*.tgz ../payload/packed/payloadcms-next-*.tgz ../payload/packed/payloadcms-plugin-cloud-storage-*.tgz ../payload/packed/payloadcms-richtext-lexical-*.tgz ../payload/packed/payloadcms-translations-*.tgz ../payload/packed/payloadcms-ui-*.tgz
```

## Syncing with Upstream

```bash
# Fetch latest from upstream
git fetch payloadcms

# Merge into your branch
git merge payloadcms/main

# Resolve any conflicts, then rebuild and repack
pnpm build
pnpm script:pack --all --dest ./packed
```

## Committing Packed Files

The `packed/` folder is tracked with Git LFS. After packing:

```bash
git add packed/
git commit -m "Update packed packages to vX.X.X"
git push
```

## Full Update Workflow

```bash
# 1. Sync with upstream (if needed)
git fetch payloadcms && git merge payloadcms/main

# 2. Build
pnpm build

# 3. Pack
pnpm script:pack --all --dest ./packed

# 4. Commit packed files
git add packed/ && git commit -m "Update packed packages"

# 5. In your project, force reinstall
cd ../your-project && npm install ../payload/packed/payload-*.tgz ../payload/packed/payloadcms-db-mongodb-*.tgz ../payload/packed/payloadcms-next-*.tgz ../payload/packed/payloadcms-plugin-cloud-storage-*.tgz ../payload/packed/payloadcms-richtext-lexical-*.tgz ../payload/packed/payloadcms-translations-*.tgz ../payload/packed/payloadcms-ui-*.tgz
```
