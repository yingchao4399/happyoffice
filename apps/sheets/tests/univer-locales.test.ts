import { LocaleType } from '@univerjs/core'
import { describe, expect, it, vi } from 'vitest'
import type { UniverRuntime } from '../src/renderer/univer-state'

import {
  insertRowsBelowLocale,
  numberAsTextAlertLocale,
  univerLocaleFor,
  applyUniverLocale,
} from '../src/renderer/univer-locales'

describe('live workbook language changes', () => {
  function runtime() {
    const locale = { load: vi.fn(), setLocale: vi.fn() }
    return { locale, value: { univer: { __getInjector: () => ({ get: () => locale }) } } as unknown as UniverRuntime }
  }

  it('switches a loaded Chinese grid back to the startup English pack', async () => {
    const { locale, value } = runtime()
    await applyUniverLocale(value, 'zh')
    expect(locale.setLocale).toHaveBeenLastCalledWith(LocaleType.ZH_CN)
    await applyUniverLocale(value, 'en')
    expect(locale.setLocale).toHaveBeenLastCalledWith(LocaleType.EN_US)
    expect(locale.load).toHaveBeenCalledOnce()
  })

  it('does not let a pending Chinese import overwrite a newer English request', async () => {
    const { locale, value } = runtime()
    const older = applyUniverLocale(value, 'zh')
    await applyUniverLocale(value, 'en')
    await older
    expect(locale.setLocale.mock.calls).toEqual([[LocaleType.EN_US]])
    expect(locale.load).not.toHaveBeenCalled()
  })

  it('does not touch the disposed runtime after the language effect is canceled', async () => {
    const { locale, value } = runtime()
    const controller = new AbortController()
    const pending = applyUniverLocale(value, 'zh', controller.signal)
    controller.abort()
    await pending
    expect(locale.load).not.toHaveBeenCalled()
    expect(locale.setLocale).not.toHaveBeenCalled()
  })
})

describe('univerLocaleFor', () => {
  it('maps every app language Univer has packs for', () => {
    expect(univerLocaleFor('zh')).toBe(LocaleType.ZH_CN)
    expect(univerLocaleFor('zh-TW')).toBe(LocaleType.ZH_TW)
    expect(univerLocaleFor('ja')).toBe(LocaleType.JA_JP)
    expect(univerLocaleFor('ko')).toBe(LocaleType.KO_KR)
    expect(univerLocaleFor('ar')).toBe(LocaleType.AR_SA)
  })

  it('falls back to English where Univer ships no pack', () => {
    for (const lang of ['en', 'th', 'nl', 'ms', 'he', 'hi']) {
      expect(univerLocaleFor(lang)).toBeNull()
    }
  })

  it('zh packs resolve and localize the DV rule name', async () => {
    const pack = (await import('@univerjs/preset-sheets-data-validation/locales/zh-CN')) as {
      default: Record<string, { list?: { name?: string } }>
    }
    expect(pack.default['sheets-data-validation']?.list?.name).toBe('值必须是列表中的值')
  })
})

describe('numberAsTextAlertLocale', () => {
  it('replaces the "Error" titles and keeps the rest of the namespaces', async () => {
    const core = (await import('@univerjs/preset-sheets-core/locales/en-US')).default as Record<
      string,
      Record<string, unknown>
    >
    const coreUi = core['sheets-ui'] as { info: Record<string, string> }
    const patched = numberAsTextAlertLocale(core)
    const numfmt = patched['sheets-numfmt-ui'] as { info: Record<string, string> }
    const ui = patched['sheets-ui'] as { info: Record<string, string> }
    expect(numfmt.info.error).toBe('Number stored as text')
    expect(ui.info.error).toBe('Number stored as text')
    expect(numfmt.info.forceStringInfo).toMatch(/stored as text/)
    expect(ui.info.forceStringInfo).toBe(numfmt.info.forceStringInfo)
    expect(Object.keys(numfmt).length).toBe(Object.keys(core['sheets-numfmt-ui'] ?? {}).length)
    expect(Object.keys(ui).length).toBe(Object.keys(coreUi).length)
    for (const key of Object.keys(coreUi.info)) {
      expect(ui.info).toHaveProperty(key)
    }
  })

  it('localizes the title from the numfmt pack', async () => {
    const core = (await import('@univerjs/preset-sheets-core/locales/zh-CN')).default as Record<
      string,
      Record<string, unknown>
    >
    const patched = numberAsTextAlertLocale(core)
    const coreNumfmt = core['sheets-numfmt-ui'] as { info: Record<string, string> }
    const title = (patched['sheets-numfmt-ui'] as { info: Record<string, string> }).info.error
    expect(title).not.toBe(coreNumfmt.info.error)
    expect(title).toBe(coreNumfmt.info.forceStringInfo)
    expect((patched['sheets-ui'] as { info: Record<string, string> }).info.error).toBe(title)
  })
})

describe('insertRowsBelowLocale', () => {
  it('rewords the English insert-rows-after entry to "rows below"', async () => {
    const core = (await import('@univerjs/preset-sheets-core/locales/en-US')).default as Record<
      string,
      Record<string, unknown>
    >
    const patched = insertRowsBelowLocale(core)
    const rightClick = (patched['sheets-ui'] as { rightClick: Record<string, string> }).rightClick
    const coreRightClick = (core['sheets-ui'] as { rightClick: Record<string, string> }).rightClick
    expect(rightClick.insertRowsAfterSuffix).toBe('rows below')
    expect(rightClick.insertRowsAboveSuffix).toBe(coreRightClick.insertRowsAboveSuffix)
    expect(Object.keys(rightClick).length).toBe(Object.keys(coreRightClick).length)
  })

  it('composes with the number-as-text patch (both survive the shallow merge)', async () => {
    const core = (await import('@univerjs/preset-sheets-core/locales/en-US')).default as Record<
      string,
      Record<string, unknown>
    >
    const patched = insertRowsBelowLocale(numberAsTextAlertLocale(core))
    const ui = patched['sheets-ui'] as {
      info: Record<string, string>
      rightClick: Record<string, string>
    }
    expect(ui.info.error).toBe('Number stored as text')
    expect(ui.rightClick.insertRowsAfterSuffix).toBe('rows below')
  })

  it('leaves translated packs untouched', async () => {
    const core = (await import('@univerjs/preset-sheets-core/locales/zh-CN')).default as Record<
      string,
      Record<string, unknown>
    >
    const patched = insertRowsBelowLocale(core)
    expect(patched['sheets-ui']).toBe(core['sheets-ui'])
  })
})
