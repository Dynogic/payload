import { createRequire } from 'module'
import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vitest/config'

// Use process.cwd() to be safe in both CJS and ESM contexts within Vitest
const ROOT_DIR = process.cwd()
const figmaPath = path.resolve(ROOT_DIR, '../enterprise-plugins/packages/figma/src/index.ts')
const hasFigma = fs.existsSync(figmaPath)

// Resolve graphql to a single copy to avoid duplicate-instance issues (instanceof checks fail).
// pnpm's isolated linker means graphql isn't hoisted to root node_modules, so we resolve
// the actual path from packages/graphql where it's a direct dependency.
// https://github.com/vitest-dev/vitest/issues/4605
const _require = createRequire(path.resolve(ROOT_DIR, 'packages/graphql/package.json'))
// graphql 17's `exports` has no `./package.json` entry, so resolve the package's own entry
// (index.js at the package root) instead (fork #114).
const graphqlDir = path.dirname(_require.resolve('graphql'))

console.log('[Dev Setup] Checking for local Figma plugin at:', figmaPath)
if (hasFigma) {
  console.log('[Dev Setup] Using local @payloadcms/figma source')
} else {
  console.log('[Dev Setup] Local Figma plugin NOT found, using node_modules')
}

export default defineConfig({
  resolve: {
    alias: {
      ...(hasFigma ? { '@payloadcms/figma': figmaPath } : {}),
    },
  },
  test: {
    watch: false, // too troublesome especially with the in memory DB setup
    // Retry failed tests up to 2 times in CI to handle flaky tests (e.g. due to timing-sensitive int tests like job queues, installation failures due to temporary network issues)
    retry: process.env.CI ? 2 : 0,
    server: {
      deps: {
        inline: [/@payloadcms\/figma/],
      },
    },
    projects: [
      {
        esbuild: {
          jsx: 'automatic',
        },
        test: {
          include: ['packages/**/*.spec.ts'],
          name: 'unit',
          environment: 'node',
          execArgv: ['--expose-gc'],
        },
      },
      {
        resolve: {
          alias: [
            { find: /^graphql\/(.*)/, replacement: graphqlDir + '/$1' },
            { find: /^graphql$/, replacement: path.join(graphqlDir, 'index.js') },
            ...(hasFigma ? [{ find: '@payloadcms/figma', replacement: figmaPath }] : []),
          ],
        },
        test: {
          include: ['test/**/*int.spec.ts'],
          name: 'int',
          environment: 'node',
          fileParallelism: false,
          hookTimeout: 90000,
          testTimeout: 90000,
          setupFiles: ['./test/vitest.setup.ts'],
          // Root-level `server.deps.inline` is not inherited by projects. Without
          // this, @payloadcms/figma (used by PAYLOAD_DATABASE=content-api) is
          // externalized, and its static `import ... from 'payload'` falls to
          // Node's loader, which cannot read payload's .ts source exports.
          //
          // graphql-http and graphql-scalars are inlined too (fork #114): externalized, they import
          // graphql 17's ESM build (index.mjs) while the alias above hands Payload's source the CJS
          // build (index.js), and graphql-http's validate() then rejects Payload's schema as coming
          // "from another module or realm". Inlined, they go through the same alias.
          server: {
            deps: {
              inline: [/@payloadcms\/figma/, /graphql-http/, /graphql-scalars/],
            },
          },
        },
      },
      {
        test: {
          include: ['test/evals/**/*.spec.ts'],
          name: 'eval',
          environment: 'node',
          fileParallelism: false,
          globalSetup: ['test/evals/globalSetup.ts'],
          // 10 minutes per test: LLM call (~60-120s) + tsc wait + scorer + buffer.
          testTimeout: 600000,
        },
      },
    ],
  },
})
