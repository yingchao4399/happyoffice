import { describe, expect, it } from 'vitest'
import { initialPrintPreferences, parsePrintPageRanges, setupForPrint } from '../src/renderer/print-preview-settings'
import { resolveEffectivePageSetup } from '../src/renderer/print-settings'
import { workbookPrintRequestSchema } from '../src/shared/desktop-api'
import { printOptionsFor } from '../src/main/print-options'

describe('本次打印参数', () => {
  const setup = resolveEffectivePageSetup({ orientation: 'landscape', printArea: 'B2:F20', scale: 80 }, null, null)
  it('保留源文档设置，不把打印调参写回源对象', () => {
    const settings = initialPrintPreferences(setup)
    expect(setupForPrint(setup, settings, 'C3:D4')).toEqual(setup)
    const adjusted = setupForPrint(setup, { ...settings, scope: 'selection', margins: 'narrow', scaling: 'fit-columns', orientation: 'portrait' }, 'C3:D4')
    expect(adjusted).toMatchObject({ printAreas: ['C3:D4'], orientation: 'portrait', fitToWidth: 1, fitToHeight: 0, fitToPage: true })
    expect(adjusted.margins.left).toBe(0.25)
    expect(setup.printAreas).toEqual(['B2:F20'])
    expect(setup.orientation).toBe('landscape')
    expect(setup.scale).toBe(80)
  })
  it('区分整个使用范围、实际大小和整表一页', () => {
    const settings = initialPrintPreferences(setup)
    expect(setupForPrint(setup, { ...settings, scope: 'used', scaling: 'actual' }, null)).toMatchObject({ printAreas: [], fitToPage: false, scale: 100 })
    expect(setupForPrint(setup, { ...settings, scaling: 'fit-sheet' }, null)).toMatchObject({ fitToPage: true, fitToWidth: 1, fitToHeight: 1 })
  })
  it('页码范围去重、排序、合并为 Electron 的零基连续页段', () => {
    expect(parsePrintPageRanges('5, 1-3，3–4, 8', 8)).toEqual([{ from: 0, to: 4 }, { from: 7, to: 7 }])
    for (const invalid of ['', '0', '1-9', '3-1', '1.2', '1,,2', '-2', '1-2-3']) expect(parsePrintPageRanges(invalid, 8)).toBeNull()
  })
  it('验证并向系统打印传递份数、单双面、颜色、逐份和页码', () => {
    const request = workbookPrintRequestSchema.parse({ fileName: 'book.pdf', html: '<html></html>',
      pageSize: 'A4', landscape: false, margins: { top: 0, left: 0, right: 0, bottom: 0 }, scale: 1,
      copies: 3, color: false, duplexMode: 'longEdge', collate: true, pageRanges: [{ from: 1, to: 2 }] })
    expect(printOptionsFor(request)).toMatchObject({ copies: 3, color: false, duplexMode: 'longEdge', collate: true, pageRanges: [{ from: 1, to: 2 }] })
    expect(workbookPrintRequestSchema.safeParse({ ...request, copies: 0 }).success).toBe(false)
    expect(workbookPrintRequestSchema.safeParse({ ...request, pageRanges: [{ from: 3, to: 1 }] }).success).toBe(false)
  })
})
