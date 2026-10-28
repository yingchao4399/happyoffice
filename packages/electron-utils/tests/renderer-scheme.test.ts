import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rendererUrl, resolveRendererFile } from '../src/renderer-scheme'

describe('rendererUrl', () => {
  it('builds the scheme URL with the query when no dev server is configured', () => {
    expect(rendererUrl(undefined, 'sheets', { mode: 'tab' })).toBe(
      'genoffice-app://sheets/index.html?mode=tab',
    )
    expect(rendererUrl(undefined, 'docs')).toBe('genoffice-app://docs/index.html')
  })

  it('appends the query to a dev URL that already carries params', () => {
    expect(rendererUrl('http://localhost:5174/?x=1', 'sheets', { mode: 'tab' })).toBe(
      'http://localhost:5174/?x=1&mode=tab',
    )
  })
})

describe('resolveRendererFile', () => {
  const root = resolve('/out/sheets/renderer')
  const roots = new Map([['sheets', root]])

  it('maps the path under the host root', () => {
    expect(resolveRendererFile(roots, 'genoffice-app://sheets/index.html?mode=tab')).toBe(
      resolve(root, 'index.html'),
    )
    expect(resolveRendererFile(roots, 'genoffice-app://sheets/assets/a%20b.js')).toBe(
      resolve(root, 'assets/a b.js'),
    )
  })

  it('keeps dot segments inside the root and rejects unknown hosts and unparsable URLs', () => {
    expect(resolveRendererFile(roots, 'genoffice-app://sheets/../../etc/passwd')).toBe(
      resolve(root, 'etc/passwd'),
    )
    expect(resolveRendererFile(roots, 'genoffice-app://docs/index.html')).toBeNull()
    expect(resolveRendererFile(roots, 'not a url')).toBeNull()
  })
})
