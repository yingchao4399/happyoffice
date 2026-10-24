import { afterEach, describe, expect, it } from 'vitest'
import { pdfTextPosition, selectedPdfTextSlices, suppressPdfClickSelection } from '../src/renderer/text-selection'

afterEach(() => { document.body.replaceChildren(); window.getSelection()?.removeAllRanges() })

function fixture() {
  const scroll = document.createElement('div')
  scroll.innerHTML = '<div class="pdf-page" data-page="1"><button>不可进入选区的控件</button><div class="textLayer"><span>FIRST paragraph</span><span>SECOND column</span></div></div><div class="pdf-page" data-page="2"><div class="pdf-ocr-layer"><span>扫描文本</span><span>下一片段</span></div></div>'
  document.body.append(scroll)
  return { scroll, nodes: [...scroll.querySelectorAll('.textLayer span,.pdf-ocr-layer span')].map(span => span.firstChild!) }
}

describe('PDF 字符选区', () => {
  it('跨段只取首尾字符片段，不选择段落或整页 DOM', () => {
    const { scroll, nodes } = fixture()
    const range = document.createRange()
    range.setStart(nodes[0]!, 6); range.setEnd(nodes[1]!, 6)
    const slices = selectedPdfTextSlices(scroll, range)
    expect(slices.map(slice => slice.range.toString())).toEqual(['paragraph', 'SECOND'])
    expect(slices.map(({ page, item, from, to }) => ({ page, item, from, to }))).toEqual([
      { page: 1, item: 0, from: 6, to: 15 }, { page: 1, item: 1, from: 0, to: 6 },
    ])
    expect(slices.every(slice => slice.range.commonAncestorContainer.nodeType === Node.TEXT_NODE)).toBe(true)
  })

  it('跨页和 OCR 保持原页码、文本项及页内字符偏移', () => {
    const { scroll, nodes } = fixture()
    const range = document.createRange()
    range.setStart(nodes[1]!, 7); range.setEnd(nodes[2]!, 2)
    expect(selectedPdfTextSlices(scroll, range).map(slice => [slice.page, slice.range.toString()])).toEqual([[1, 'column'], [2, '扫描']])
    expect(pdfTextPosition(nodes[1]!, 0)).toEqual({ page: 1, item: 1, offset: 0, pageOffset: 15 })
    expect(pdfTextPosition(nodes[2]!, 2)).toEqual({ page: 2, item: 0, offset: 2, pageOffset: 2 })
    expect(pdfTextPosition(scroll.querySelector('button')!.firstChild!, 1)).toBeNull()
  })

  it('双栏、旋转、缩放不改变源文本范围，反向选择保留 anchor/focus', () => {
    const { scroll, nodes } = fixture()
    scroll.style.transform = 'rotate(90deg) scale(1.75)'
    const selection = window.getSelection()!
    selection.setBaseAndExtent(nodes[1]!, 6, nodes[0]!, 6)
    expect(pdfTextPosition(selection.anchorNode, selection.anchorOffset)).toEqual({ page: 1, item: 1, offset: 6, pageOffset: 21 })
    expect(pdfTextPosition(selection.focusNode, selection.focusOffset)).toEqual({ page: 1, item: 0, offset: 6, pageOffset: 6 })
    expect(selectedPdfTextSlices(scroll, selection.getRangeAt(0)).map(slice => slice.range.toString())).toEqual(['paragraph', 'SECOND'])
  })

  it('小抖动仅影响单击，保留双击、三击和 Shift 扩选', () => {
    const end = { clientX: 12, clientY: 21, detail: 1, shiftKey: false }
    expect(suppressPdfClickSelection([10, 20], end)).toBe(true)
    expect(suppressPdfClickSelection([10, 20], { ...end, detail: 2 })).toBe(false)
    expect(suppressPdfClickSelection([10, 20], { ...end, detail: 3 })).toBe(false)
    expect(suppressPdfClickSelection([10, 20], { ...end, shiftKey: true })).toBe(false)
    expect(suppressPdfClickSelection([10, 20], { ...end, clientX: 20 })).toBe(false)
  })
})
