import type { SearchIndex } from './search'
import type { PdfTextPosition } from './text-selection'

export interface WholeDocumentSelection {
  text: string
  pages: number[]
  anchor: PdfTextPosition
  focus: PdfTextPosition
  items: { page: number; item: number; from: number; to: number; pageOffset: number }[]
}

/** 全文选区来自文档索引，不依赖当前挂载的页面；页面顺序和删除状态以阅读器为准。 */
export function wholeDocumentSelection(index: SearchIndex, pageOrder: readonly number[]): WholeDocumentSelection | null {
  const pages: number[] = []
  const texts: string[] = []
  const items: WholeDocumentSelection['items'] = []
  let anchor: PdfTextPosition | undefined
  let focus: PdfTextPosition | undefined
  for (const origIdx of pageOrder) {
    const entry = index[origIdx]
    if (!entry?.text.trim()) continue
    pages.push(origIdx + 1)
    texts.push(entry.text)
    entry.items.forEach((item, itemIndex) => {
      const length = item.end - item.start
      if (length <= 0) return
      const position = { page: origIdx + 1, item: itemIndex, offset: 0, pageOffset: item.start }
      anchor ??= position
      focus = { ...position, offset: length, pageOffset: item.end }
      items.push({ page: origIdx + 1, item: itemIndex, from: 0, to: length, pageOffset: item.start })
    })
  }
  return anchor && focus ? { text: texts.join('\n\n'), pages, anchor, focus, items } : null
}
