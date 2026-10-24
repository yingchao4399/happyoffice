import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lang } from '@genoffice/i18n'

const load = vi.hoisted(() => vi.fn<(_: Lang) => Promise<void>>())
vi.mock('../src/renderer/i18n/language-packs', () => ({
  loadLanguage: load,
  translate: (lang: Lang, key: string) => `${lang}:${key}`,
}))
import { getLang, LocaleProvider, setModuleLang, useI18n } from '../src/renderer/i18n/locale'

let root: Root | undefined
let container: HTMLDivElement | undefined
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
function mount() {
  let changed!: (lang: Lang) => void
  const unsubscribe = vi.fn()
  Object.defineProperty(window, 'desktop', { configurable: true, value: {
    onLanguageChanged: (callback: typeof changed) => { changed = callback; return unsubscribe },
  } })
  function CurrentLanguage() { return createElement('span', null, useI18n().lang) }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  setModuleLang('zh')
  act(() => root!.render(createElement(LocaleProvider, {
    initial: 'zh', children: createElement(CurrentLanguage),
  })))
  return { change: (lang: Lang) => act(() => changed(lang)), unsubscribe }
}
afterEach(() => {
  if (root) act(() => root!.unmount())
  root = undefined
  container?.remove()
  container = undefined
  vi.restoreAllMocks()
  load.mockReset()
})

describe('异步语言切换', () => {
  it('较慢的旧请求不会覆盖用户最后选中的语言', async () => {
    const french = deferred(), japanese = deferred()
    load.mockImplementation((lang) => lang === 'fr' ? french.promise : japanese.promise)
    const view = mount()
    view.change('fr'); view.change('ja')
    await act(async () => { japanese.resolve(); await japanese.promise })
    expect(container!.textContent).toBe('ja')
    await act(async () => { french.resolve(); await french.promise })
    expect(container!.textContent).toBe('ja')
    expect(getLang()).toBe('ja')
    expect(document.documentElement.lang).toBe('ja-JP')
  })
  it('卸载后不再更改全局语言并取消订阅', async () => {
    const pending = deferred()
    load.mockReturnValue(pending.promise)
    const view = mount()
    view.change('fr')
    act(() => root!.unmount()); root = undefined
    await act(async () => { pending.resolve(); await pending.promise })
    expect(getLang()).toBe('zh')
    expect(view.unsubscribe).toHaveBeenCalledOnce()
  })
  it('资源失败时保留上一完整语言并处理拒绝', async () => {
    load.mockRejectedValue(new Error('MISSING_LANGUAGE_CHUNK'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = mount()
    await act(async () => view.change('fr'))
    expect(container!.textContent).toBe('zh')
    expect(getLang()).toBe('zh')
  })
})
