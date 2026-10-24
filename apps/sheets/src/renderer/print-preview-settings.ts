import type { EffectivePageSetup } from './print-settings'

export interface SheetPrintPreferences {
  scope: 'document' | 'used' | 'selection'
  orientation: 'portrait' | 'landscape'
  paperSize: number
  margins: 'document' | 'normal' | 'narrow' | 'wide'
  scaling: 'document' | 'actual' | 'fit-sheet' | 'fit-columns' | 'custom'
  scale: number
  gridlines: boolean
  headings: boolean
}

export function initialPrintPreferences(setup: EffectivePageSetup): SheetPrintPreferences {
  return { scope: 'document', orientation: setup.orientation, paperSize: setup.paperSize,
    margins: 'document', scaling: 'document', scale: setup.scale,
    gridlines: setup.printGridlines, headings: setup.printHeadings }
}

export function setupForPrint(
  original: EffectivePageSetup, preferences: SheetPrintPreferences, selectedArea: string | null,
): EffectivePageSetup {
  const presets = {
    normal: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    narrow: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    wide: { left: 1, right: 1, top: 1, bottom: 1, header: 0.5, footer: 0.5 },
  }
  return { ...original, orientation: preferences.orientation, paperSize: preferences.paperSize,
    margins: preferences.margins === 'document' ? original.margins : presets[preferences.margins],
    printAreas: preferences.scope === 'used' ? [] : preferences.scope === 'selection' && selectedArea ? [selectedArea] : original.printAreas,
    ...(preferences.scaling === 'document' ? {} : preferences.scaling === 'fit-sheet'
      ? { fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
      : preferences.scaling === 'fit-columns' ? { fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      : { fitToPage: false, scale: preferences.scaling === 'actual' ? 100 : preferences.scale }),
    printGridlines: preferences.gridlines, printHeadings: preferences.headings }
}

/// 返回连续页段；与 Electron 相同，from/to 均从零开始。
export function parsePrintPageRanges(input: string, total: number): Array<{ from: number; to: number }> | null {
  if (!Number.isInteger(total) || total < 1 || !input.trim()) return null
  const pages = new Set<number>()
  for (const part of input.split(/[,，]/)) {
    const match = /^\s*(\d+)\s*(?:[-–]\s*(\d+)\s*)?$/.exec(part)
    if (!match) return null
    const from = Number(match[1]), to = Number(match[2] ?? match[1])
    if (from < 1 || to < from || to > total) return null
    for (let page = from; page <= to; page++) pages.add(page - 1)
  }
  const ranges: Array<{ from: number; to: number }> = []
  for (const page of [...pages].sort((a, b) => a - b)) {
    const last = ranges[ranges.length - 1]
    if (last && last.to + 1 === page) last.to = page
    else ranges.push({ from: page, to: page })
  }
  return ranges.length ? ranges : null
}
