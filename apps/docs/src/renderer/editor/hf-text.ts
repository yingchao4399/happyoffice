/**
 * Plain-text view of a header/footer part, shared by the on-canvas editing
 * surface and the AI set_header_footer tool: paragraphs edit as lines, the
 * invisible PAGE / NUMPAGES field sentinels as visible {PAGE} / {NUMPAGES}
 * tokens. Layout-table rows (cells) and images stay out of the text flow and
 * keep their original content.
 */
import {
  PAGE_MARK,
  TOTAL_PAGES_MARK,
  type HeaderFooter,
  type HfParagraph,
  type Run,
} from '@genoffice/docx-engine'

export const PAGE_TOKEN = '{PAGE}'
export const TOTAL_TOKEN = '{NUMPAGES}'

/** effective paragraphs: rich paras when present, else the legacy single line */
export function hfParasOf(value: HeaderFooter): HfParagraph[] {
  if (value.paras?.length) return value.paras
  const runs: Run[] = value.text ? [{ text: value.text }] : []
  if (value.pageNumber && !value.text.includes('#') && !value.text.includes(PAGE_MARK)) {
    runs.push({ text: runs.length > 0 ? ` ${PAGE_MARK}` : PAGE_MARK })
  }
  return [{ align: 'center', runs }]
}

/** editable text of the part: one line per text paragraph, field sentinels as tokens */
export function hfEditText(value: HeaderFooter): string {
  return hfParasOf(value)
    .filter((p) => !p.cells)
    .map((p) => p.runs.map((r) => r.text).join(''))
    .join('\n')
    .replaceAll(PAGE_MARK, PAGE_TOKEN)
    .replaceAll(TOTAL_PAGES_MARK, TOTAL_TOKEN)
}

/**
 * Map edited lines back onto the part: each line keeps its original
 * paragraph's format and first-run styling (extra lines reuse the last
 * template), cells rows are spliced back at their original positions.
 */
export function applyHfText(value: HeaderFooter | null, text: string): HeaderFooter {
  const base = value ?? { text: '' }
  const paras = hfParasOf(base)
  const lines = text
    .replace(/\n+$/, '')
    .replaceAll(PAGE_TOKEN, PAGE_MARK)
    .replaceAll(TOTAL_TOKEN, TOTAL_PAGES_MARK)
    .split('\n')
  const textParas = paras.filter((p) => !p.cells)
  const templates: HfParagraph[] =
    textParas.length > 0 ? textParas : [{ align: 'center', runs: [] }]
  const edited: HfParagraph[] = lines.map((line, i) => {
    const template = templates[Math.min(i, templates.length - 1)]
    const style = template.runs[0] ?? {}
    // 未改动的域保留独立 run；不能把整行变成 DATE / FILENAME 域。
    const before = template.runs.map(r => r.text).join('')
    if (line === before) return template
    if (!template.runs.some(r => r.instrField)) return { ...template, runs: line === '' ? [] : [{ ...style, text: line }] }
    let prefix = 0, suffix = 0
    while (prefix < before.length && prefix < line.length && before[prefix] === line[prefix]) prefix++
    while (suffix < before.length - prefix && suffix < line.length - prefix && before[before.length - 1 - suffix] === line[line.length - 1 - suffix]) suffix++
    const slice = (from: number, to: number): Run[] => {
      let offset = 0
      return template.runs.flatMap(run => {
        const start = Math.max(0, from - offset), end = Math.min(run.text.length, to - offset)
        offset += run.text.length
        if (end <= start) return []
        return [{ ...run, text: run.text.slice(start, end), ...(start !== 0 || end !== run.text.length ? { instrField: undefined, fldBeginXml: undefined } : {}) }]
      })
    }
    const inserted = line.slice(prefix, line.length - suffix)
    return { ...template, runs: [...slice(0, prefix), ...(inserted ? [{ ...style, instrField: undefined, fldBeginXml: undefined, text: inserted }] : []), ...slice(before.length - suffix, before.length)] }
  })
  const nextParas: HfParagraph[] = []
  let ei = 0
  for (const p of paras) {
    if (p.cells) nextParas.push(p)
    else if (ei < edited.length) nextParas.push(edited[ei++])
  }
  nextParas.push(...edited.slice(ei))
  const nextText = edited.map((p) => p.runs.map((r) => r.text).join('')).join('')
  const pageNumber = nextParas.some(p => [...p.runs, ...(p.cells?.flatMap(c => c.paras.flat()) ?? [])]
    .some(run => run.text.includes(PAGE_MARK) || (base.pageNumber && run.text.includes('#'))))
  return { ...base, text: nextText, paras: nextParas, pageNumber }
}

/** 在保留的文本光标处插入，独立保留字段及两侧格式。偏移使用可见的 {PAGE} 文本。 */
export function insertHfRuns(value: HeaderFooter, inserted: Run[], start?: number, end = start): HeaderFooter {
  const paras = hfParasOf(value).map(p => ({ ...p, runs: [...p.runs] }))
  const raw = (s: string) => s.replaceAll(PAGE_TOKEN,PAGE_MARK).replaceAll(TOTAL_TOKEN,TOTAL_PAGES_MARK)
  const visible = hfEditText(value)
  const from = raw(visible.slice(0,start ?? visible.length)).length
  const to = raw(visible.slice(0,end ?? start ?? visible.length)).length
  let offset = 0, done = false
  for (const para of paras) {
    if (para.cells) continue
    const text = para.runs.map(r => r.text).join('')
    const paraEnd = offset + text.length
    if (!done && from <= paraEnd) {
      const slice = (a: number,b: number) => {
        let pos = 0
        return para.runs.flatMap(run => {
          const left = Math.max(0,a-pos),right = Math.min(run.text.length,b-pos); pos += run.text.length
          return right > left ? [{ ...run,text:run.text.slice(left,right),...(left || right !== run.text.length ? { instrField:undefined,fldBeginXml:undefined } : {}) }] : []
        })
      }
      para.runs = [...slice(0,Math.max(0,from-offset)),...inserted,...slice(Math.max(0,to-offset),text.length)]
      done = true
    } else if (done && offset < to) {
      const left = Math.min(text.length,to-offset)
      let pos = 0
      para.runs = para.runs.flatMap(run => { const begin = Math.max(0,left-pos); pos += run.text.length; return begin < run.text.length ? [{ ...run,text:run.text.slice(begin),...(begin ? { instrField:undefined,fldBeginXml:undefined } : {}) }] : [] })
    }
    offset = paraEnd + 1
  }
  if (!done) paras.push({ align:'center',runs:inserted })
  return { ...value,paras,text:paras.filter(p => !p.cells).map(p => p.runs.map(r => r.text).join('')).join('\n'),pageNumber:paras.some(p => p.runs.some(r => r.text.includes(PAGE_MARK))) }
}
