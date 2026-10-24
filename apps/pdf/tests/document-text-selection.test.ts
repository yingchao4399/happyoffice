import { describe, expect, it } from 'vitest'
import { wholeDocumentSelection } from '../src/renderer/document-text-selection'
import type { PageEntry } from '../src/renderer/search'

const page = (text: string): PageEntry => ({ text, lower: text.toLowerCase(), items: text ? [{ start: 0, end: text.length, x: 10, y: 20, w: 120, h: 18 }] : [] })
describe('全文逻辑选区', () => {
  it('包含未挂载的末页，保留换行与页内字符定位', () => {
    const index = Array.from({ length: 220 }, (_, i) => page('PAGE ' + (i + 1)))
    const selection = wholeDocumentSelection(index, index.map((_, i) => i))!
    expect(selection.pages).toHaveLength(220)
    expect(selection.text).toContain('PAGE 220')
    expect(selection.text).toContain('PAGE 1\n\nPAGE 2')
    expect(selection.anchor).toEqual({ page: 1, item: 0, offset: 0, pageOffset: 0 })
    expect(selection.focus).toEqual({ page: 220, item: 0, offset: 8, pageOffset: 8 })
    expect(selection.items).toHaveLength(220)
  })
  it('遵循重排，不包含已删除页或空白页', () => {
    const selection = wholeDocumentSelection([page('FIRST'), page('DELETED'), page('LAST'), page('')], [2, 3, 0])!
    expect(selection.text).toBe('LAST\n\nFIRST')
    expect(selection.pages).toEqual([3, 1])
    expect(selection.anchor.page).toBe(3)
    expect(selection.focus.page).toBe(1)
  })
  it('OCR 索引更新后包含识别文字，不编造空页文本', () => {
    const index = [page('DIGITAL'), page('')]
    expect(wholeDocumentSelection(index, [0, 1])?.pages).toEqual([1])
    index[1] = page('扫描文字')
    expect(wholeDocumentSelection(index, [0, 1])?.text).toBe('DIGITAL\n\n扫描文字')
    expect(wholeDocumentSelection([page('')], [0])).toBeNull()
  })
})
