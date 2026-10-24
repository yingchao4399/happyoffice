import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const here = dirname(fileURLToPath(import.meta.url))

// harfbuzzjs ≥1.x seals its subpaths behind the exports map, and the raw
// Emscripten factory (dist/harfbuzz.js) must be bundled directly — the public
// entry has a top-level await that cannot go into the CJS main bundle. Which
// copy npm hoists where is not stable (root vs apps/slides/node_modules), so
// resolve it through Node from this app's directory instead of hardcoding a
// relative node_modules path.
const slidesRequire = createRequire(join(here, 'src/main/index.ts'))
const harfbuzzDist = dirname(slidesRequire.resolve('harfbuzzjs', { paths: [join(here, 'src/main')] }))
const harfbuzzAlias = {
  'harfbuzzjs/dist/harfbuzz.js': join(harfbuzzDist, 'harfbuzz.js'),
  'harfbuzzjs/dist/harfbuzz.wasm': join(harfbuzzDist, 'harfbuzz.wasm'),
}

// Pin resolution to this repo's workspace sources (matches tsconfig paths;
// avoids bundling stale implementations when node_modules links point elsewhere)
const workspaceAlias = {
  // Subpath before the bare name: string aliases are prefix replacements
  '@genoffice/pptx-engine/table-grid': resolve(
    here,
    '../../packages/pptx-engine/src/table-grid.ts',
  ),
  '@genoffice/pptx-engine/identity': resolve(here, '../../packages/pptx-engine/src/identity.ts'),
  '@genoffice/pptx-engine/named-action': resolve(
    here,
    '../../packages/pptx-engine/src/named-action.ts',
  ),
  '@genoffice/pptx-engine/custgeom': resolve(here, '../../packages/pptx-engine/src/custgeom.ts'),
  '@genoffice/pptx-engine/background-promote': resolve(
    here,
    '../../packages/pptx-engine/src/background-promote.ts',
  ),
  '@genoffice/pptx-engine': resolve(here, '../../packages/pptx-engine/src/index.ts'),
  '@genoffice/pptx-ops/op-docs': resolve(here, '../../packages/pptx-ops/src/op-docs.ts'),
  '@genoffice/pptx-ops/font-size': resolve(here, '../../packages/pptx-ops/src/font-size.ts'),
  '@genoffice/pptx-ops': resolve(here, '../../packages/pptx-ops/src/index.ts'),
  '@genoffice/pptx-render/preset-geometry': resolve(
    here,
    '../../packages/pptx-render/src/preset-geometry.ts',
  ),
  '@genoffice/pptx-render': resolve(here, '../../packages/pptx-render/src/index.ts'),
  '@genoffice/pipelines/slides/layout-audit': resolve(
    here,
    '../../packages/pipelines/src/slides/layout-audit.ts',
  ),
  '@genoffice/pipelines/slides': resolve(here, '../../packages/pipelines/src/slides/index.ts'),
  // Metafile (EMF/WMF) rasterizer shared with the docs engine (renderer-only: needs canvas)
  '@genoffice/docx-engine/metafile': resolve(here, '../../packages/docx-engine/src/metafile.ts'),
  '@genoffice/docx-engine/math': resolve(here, '../../packages/docx-engine/src/math.ts'),
}

export default defineConfig({
  // Main process/preload must bundle @genoffice/* sources (they are pulled in as TS
  // source with extensionless relative imports; externalizing them under Node
  // yields ERR_MODULE_NOT_FOUND).
  main: {
    resolve: { alias: { ...workspaceAlias, ...harfbuzzAlias } },
    // Bundle opentype.js too (the packaged app ships only out/**, so external deps are unresolvable at runtime)
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@genoffice/pptx-engine',
          '@genoffice/pptx-ops',
          '@genoffice/pptx-render',
          '@genoffice/pipelines',
          '@genoffice/ai-search',
          '@genoffice/file-parse',
          '@genoffice/electron-utils',
          'opentype.js',
          // must bundle the raw Emscripten factory via the harfbuzzAlias below;
          // externalizing it would emit require('harfbuzzjs/dist/...') which the
          // exports map seals and the packaged app (no node_modules) cannot serve
          'harfbuzzjs',
        ],
      }),
    ],
  },
  preload: {
    // electron-utils ships raw TS source — must be bundled, not left external
    plugins: [externalizeDepsPlugin({ exclude: ['@genoffice/electron-utils'] })],
  },
  renderer: {
    resolve: { alias: workspaceAlias, dedupe: ['react', 'react-dom'] },
    plugins: [react()],
    server: {
      port: Number(process.env.SLIDES_DEV_PORT) || 5175,
      strictPort: Boolean(process.env.SLIDES_DEV_PORT),
    },
  },
})
