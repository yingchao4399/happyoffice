import { format, platformShortcuts, type Lang, type Params } from '@genoffice/i18n'
import { zh as appZh } from './app/zh'
import { en as appEn } from './app/en'
import { zh as aiZh } from './ai/zh'
import { en as aiEn } from './ai/en'
import { zh as ribbonZh } from './ribbon/zh'
import { en as ribbonEn } from './ribbon/en'
import { editorStrings } from './strings-editor'
import { tableStrings } from './strings-table'
import { zoteroStrings } from './strings-zotero'
import type { strings } from './strings'

export type StringKey = keyof typeof strings.zh
type Dictionary = Record<StringKey, string>
type Shard = Record<string, Record<string, string>>

// 默认及回退语言同步可用，其余语言只在启动选中或切换时加载。
// 文案源仍由原 strings.ts 做完整性类型检查，不复制或改写原版翻译。
const dictionaries: Partial<Record<Lang, Dictionary>> = {
  zh: { ...appZh, ...ribbonZh, ...tableStrings.zh, ...editorStrings.zh, ...aiZh, ...zoteroStrings.zh },
  en: { ...appEn, ...ribbonEn, ...tableStrings.en, ...editorStrings.en, ...aiEn, ...zoteroStrings.en },
}
const appPacks = import.meta.glob<Shard>(['./app/*.ts', '!./app/zh.ts', '!./app/en.ts'])
const aiPacks = import.meta.glob<Shard>(['./ai/*.ts', '!./ai/zh.ts', '!./ai/en.ts'])
const ribbonPacks = import.meta.glob<Shard>(['./ribbon/*.ts', '!./ribbon/zh.ts', '!./ribbon/en.ts'])
const pending = new Map<Lang, Promise<void>>()

export function loadLanguage(lang: Lang): Promise<void> {
  if (dictionaries[lang]) return Promise.resolve()
  const existing = pending.get(lang)
  if (existing) return existing
  const load = Promise.all([
    appPacks[`./app/${lang}.ts`](),
    ribbonPacks[`./ribbon/${lang}.ts`](),
    aiPacks[`./ai/${lang}.ts`](),
  ]).then(([app, ribbon, ai]) => {
    const name = lang === 'zh-TW' ? 'zhTW' : lang
    dictionaries[lang] = {
      ...app[name], ...ribbon[name], ...tableStrings[lang],
      ...editorStrings[lang], ...ai[name], ...zoteroStrings[lang],
    } as Dictionary
  }).finally(() => pending.delete(lang))
  pending.set(lang, load)
  return load
}

export function translate(lang: Lang, key: StringKey, params?: Params): string {
  return platformShortcuts(format((dictionaries[lang] ?? dictionaries.zh!)[key], params))
}
