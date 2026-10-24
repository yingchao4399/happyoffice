import { describe, expect, it } from 'vitest'
import { createI18n, LANGS } from '@genoffice/i18n'
import { strings } from '../src/renderer/i18n/strings'
import { loadLanguage, translate, type StringKey } from '../src/renderer/i18n/language-packs'

describe('按需加载原版语言资源', () => {
  it('所有语言加载后保留全部原文、占位符和平台快捷键', async () => {
    const original = createI18n(strings)
    for (const lang of LANGS) {
      await loadLanguage(lang)
      for (const key of Object.keys(strings.zh) as StringKey[]) {
        expect(translate(lang, key, { name: '测试', count: 7 })).toBe(original(lang, key, { name: '测试', count: 7 }))
      }
    }
  })
})
