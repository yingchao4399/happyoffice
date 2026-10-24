import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCtxItems } from '../src/renderer/context-menu-items'
import * as styleActions from '../src/renderer/style-actions'
import { t } from '../src/renderer/i18n/locale'
import type { ActionCtx } from '../src/renderer/action-context'
import { selectAllElements } from '../src/renderer/select-all'

vi.mock('../src/renderer/konva-adapter', () => ({ isEditableText: () => false }))
vi.mock('../src/renderer/clipboard-actions', () => ({}))
vi.mock('../src/renderer/slide-actions', () => ({}))
vi.mock('../src/renderer/show-actions', () => ({}))
vi.mock('../src/renderer/arrange-actions', () => ({}))
vi.mock('../src/renderer/insert-actions', () => ({}))
vi.mock('../src/renderer/picture-edit-actions', () => ({}))
vi.mock('../src/renderer/table-actions', () => ({}))
vi.mock('../src/renderer/style-actions', () => ({
  onBackground: vi.fn().mockResolvedValue(undefined),
}))

function makeThumbCtx(index: number) {
  return {
    ctxMenu: { kind: 'thumb', x: 0, y: 0, index },
    slides: [{}, {}, {}],
    sections: [],
    selectedIds: [],
    slide: null,
    current: 0,
    hasClipboard: false,
    canPasteSlide: false,
    setCurrent: vi.fn(),
    openBgFormat: vi.fn(),
  } as unknown as ActionCtx & {
    setCurrent: ReturnType<typeof vi.fn>
    openBgFormat: ReturnType<typeof vi.fn>
  }
}

describe('thumbnail context-menu background entries', () => {
  beforeEach(() => vi.clearAllMocks())

  it('change-background-picture opens the picker for the clicked slide', () => {
    const ctx = makeThumbCtx(2)
    const item = buildCtxItems(ctx).find((i) => i?.label === t('appCtxChangeBgImage'))
    expect(item).toBeTruthy()
    item?.onClick?.()
    expect(ctx.setCurrent).toHaveBeenCalledWith(2)
    expect(styleActions.onBackground).toHaveBeenCalledWith(ctx, {
      kind: 'image',
      mode: 'stretch',
      pick: true,
      slideIndex: 2,
    })
  })

  it('format-background selects the clicked slide then opens the pane', () => {
    const ctx = makeThumbCtx(1)
    const item = buildCtxItems(ctx).find((i) => i?.label === t('appCtxFormatBackground'))
    expect(item).toBeTruthy()
    item?.onClick?.()
    expect(ctx.setCurrent).toHaveBeenCalledWith(1)
    expect(ctx.openBgFormat).toHaveBeenCalled()
  })
})

describe('common context-menu commands', () => {
  function context(kind: string): ActionCtx {
    return {
      ...makeThumbCtx(0),
      ctxMenu: { kind, x: 0, y: 0, index: 0, targetId: 'text', sectionId: 'section' },
      slide: { nodes: [
        { type: 'text', sourceId: 'text' },
        { type: 'picture', sourceId: 'image' },
        { type: 'shape', sourceId: 'decoration', decoration: true },
        { type: 'picture', sourceId: 'background', background: true },
        { type: 'placeholder-chip', sourceId: 'placeholder' },
      ] },
      setSelectedIds: vi.fn(), setFindOpen: vi.fn(),
      undo: vi.fn().mockResolvedValue(undefined), redo: vi.fn().mockResolvedValue(undefined),
      canUndo: true, canRedo: false,
    } as unknown as ActionCtx
  }

  it.each(['canvas', 'element'])('selects copyable page objects in the %s menu', (kind) => {
    const ctx = context(kind)
    const select = buildCtxItems(ctx).find((item) => item?.label === t('appCtxSelectAll'))!
    expect(select).toBeTruthy()
    select.onClick!()
    expect(ctx.setSelectedIds).toHaveBeenCalledWith(['text', 'image'])
  })

  it.each(['canvas', 'element', 'thumb', 'section'])('uses document history and the original find pane in %s', (kind) => {
    const ctx = context(kind)
    const items = buildCtxItems(ctx)
    const undo = items.find((item) => item?.label === t('ribbonUndo'))!
    const redo = items.find((item) => item?.label === t('ribbonRedo'))!
    expect(undo.disabled).toBe(false)
    expect(redo.disabled).toBe(true)
    undo.onClick!()
    expect(ctx.undo).toHaveBeenCalledOnce()
    items.find((item) => item?.label === t('ribbonFindReplace'))!.onClick!()
    expect(ctx.setFindOpen).toHaveBeenCalledWith(true)
    ctx.canUndo = false; ctx.canRedo = true
    const updated = buildCtxItems(ctx)
    expect(updated.find((item) => item?.label === t('ribbonUndo'))!.disabled).toBe(true)
    expect(updated.find((item) => item?.label === t('ribbonRedo'))!.disabled).toBe(false)
    updated.find((item) => item?.label === t('ribbonRedo'))!.onClick!()
    expect(ctx.redo).toHaveBeenCalledOnce()
  })

  it('clears stale object selection when the page has no selectable objects', () => {
    const ctx = context('canvas')
    ctx.slide = undefined
    selectAllElements(ctx)
    expect(ctx.setSelectedIds).toHaveBeenCalledWith([])
  })
})
