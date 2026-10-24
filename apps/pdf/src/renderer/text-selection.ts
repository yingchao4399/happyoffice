export interface PdfTextPosition {
  page: number
  item: number
  offset: number
  pageOffset: number
}

export interface PdfTextSlice {
  page: number
  item: number
  from: number
  to: number
  pageOffset: number
  range: Range
}

const textLayerSelector = '.textLayer, .pdf-ocr-layer'

/** 位置始终使用页内最小文本项及字符偏移，缩放和旋转不改变其含义。 */
export function pdfTextPosition(node: Node | null, offset: number): PdfTextPosition | null {
  const element = node instanceof Element ? node : node?.parentElement
  const layer = element?.closest<HTMLElement>(textLayerSelector)
  const page = Number(layer?.closest<HTMLElement>('.pdf-page')?.dataset.page)
  if (!node || !layer || !Number.isInteger(page) || page < 1) return null
  const prefix = document.createRange()
  prefix.setStart(layer, 0)
  prefix.setEnd(node, offset)
  const pageOffset = prefix.toString().length
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
  let item = 0, consumed = 0, current
  while ((current = walker.nextNode())) {
    const length = current.textContent?.length ?? 0
    if (current === node || (node.nodeType !== Node.TEXT_NODE && consumed + length >= pageOffset)) return { page, item, offset: pageOffset - consumed, pageOffset }
    consumed += length; item++
  }
  return null
}

/** 仅为真正选中的文本字符创建 Range，永不把段落、整页或控件 DOM 当成选区。 */
export function selectedPdfTextSlices(scroll: HTMLElement, selection: Range): PdfTextSlice[] {
  const slices: PdfTextSlice[] = []
  for (const layer of scroll.querySelectorAll<HTMLElement>(textLayerSelector)) {
    if (!selection.intersectsNode(layer)) continue
    const page = Number(layer.closest<HTMLElement>('.pdf-page')?.dataset.page)
    if (!Number.isInteger(page) || page < 1) continue
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
    let current, item = 0, pageOffset = 0
    while ((current = walker.nextNode())) {
      const length = current.textContent?.length ?? 0
      if (length && selection.intersectsNode(current)) {
        const from = current === selection.startContainer ? selection.startOffset : 0
        const to = current === selection.endContainer ? selection.endOffset : length
        if (to > from) {
          const range = document.createRange()
          range.setStart(current, from); range.setEnd(current, to)
          slices.push({ page, item, from, to, pageOffset, range })
        }
      }
      pageOffset += length; item++
    }
  }
  return slices
}

/** 单击轻微抖动清除原生选区；双击选词、三击、Shift 扩选和键盘选择应保留。 */
export function suppressPdfClickSelection(start: readonly [number, number] | null, end: { clientX: number; clientY: number; detail: number; shiftKey: boolean }): boolean {
  return Boolean(start && end.detail === 1 && !end.shiftKey && Math.hypot(end.clientX - start[0], end.clientY - start[1]) < 4)
}
