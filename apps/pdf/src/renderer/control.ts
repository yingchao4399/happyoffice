/** Request/reply the shell relays from `genoffice open --page` and `genoffice selection`. */
import type { PdfTextPosition } from './text-selection'
export type ControlRequest =
  { cmd: 'goto'; target: { kind: string; page?: number } } | { cmd: 'selection' }

export type ControlReply =
  | { status: 'ok'; result: Record<string, unknown> }
  | { status: 'not_ready' }
  | {
      status: 'error'
      error: { reason: string; message: string; detail?: Record<string, unknown> }
    }

export interface PdfControlState {
  loaded: boolean
  pageCount: number
  currentPage: number
  scrollToPage: (page: number) => void
  selectedText: () => string
  selectionInfo?: () => {
    page?: number
    lastPage?: number
    anchorOffset?: number
    focusOffset?: number
    anchor?: PdfTextPosition | null
    focus?: PdfTextPosition | null
    items?: { page: number; item: number; from: number; to: number; pageOffset: number }[]
    sourceRect?: { x: number; y: number; width: number; height: number }
  } | null
}

export function handlePdfControl(req: ControlRequest, state: PdfControlState): ControlReply {
  if (!state.loaded || state.pageCount === 0) return { status: 'not_ready' }
  if (req.cmd === 'selection') {
    const text = state.selectedText()
    const info = state.selectionInfo?.() ?? null
    return {
      status: 'ok',
      result: {
        page: info?.page ?? state.currentPage,
        ...(info?.lastPage ? { lastPage: info.lastPage } : {}),
        ...(info?.anchorOffset !== undefined ? { anchorOffset: info.anchorOffset } : {}),
        ...(info?.focusOffset !== undefined ? { focusOffset: info.focusOffset } : {}),
        ...(info?.sourceRect ? { sourceRect: info.sourceRect } : {}),
        ...(info?.anchor ? { anchor: info.anchor } : {}),
        ...(info?.focus ? { focus: info.focus } : {}),
        ...(info?.items ? { items: info.items } : {}),
        ...(text ? { text } : {}),
      },
    }
  }
  const { page } = req.target
  if (page === undefined || !Number.isInteger(page) || page < 1 || page > state.pageCount) {
    return {
      status: 'error',
      error: {
        reason: 'out_of_range',
        message: `page ${page} is out of range (the document has ${state.pageCount} pages)`,
        detail: { valid_range: `1-${state.pageCount}` },
      },
    }
  }
  state.scrollToPage(page)
  return { status: 'ok', result: { page } }
}
