import { PAGE_MARK, TOTAL_PAGES_MARK, type HeaderFooter, type HfParagraph, type Run } from '@genoffice/docx-engine'
import type { TFunc } from '../i18n/locale'

export type HfTemplateId = 'blank' | 'columns' | 'title' | 'rule' | 'band' | 'titleDate' | 'page' | 'pageTotal'
export const HF_TEMPLATES: HfTemplateId[] = ['blank', 'columns', 'title', 'rule', 'band', 'titleDate', 'page', 'pageTotal']
export type HfNumberStyle = 'plain' | 'total' | 'dash' | 'accent'
export const HF_NUMBER_STYLES: HfNumberStyle[] = ['plain', 'total', 'dash', 'accent']
export interface HfDocumentInfo { title?: string; author?: string; subject?: string; keywords?: string; description?: string }
export const hfValue = (paras: HfParagraph[]): HeaderFooter => ({
  text: paras.map(p => p.runs.map(r => r.text).join('')).join('\n'),
  pageNumber: paras.some(p => p.runs.some(r => r.text.includes(PAGE_MARK))), paras,
})
export function hfNumberRuns(style: HfNumberStyle, t: TFunc): Run[] {
  if (style === 'total') return [{ text: t('ribbonHfPagePrefix') }, { text: PAGE_MARK }, { text: t('ribbonHfPageOf') }, { text: TOTAL_PAGES_MARK }, { text: t('ribbonHfPageSuffix') }]
  if (style === 'dash') return [{ text: '— ' }, { text: PAGE_MARK }, { text: ' —' }]
  return [{ text: PAGE_MARK, ...(style === 'accent' ? { bold: true, color: '4472C4', sizeHalfPoints: 28 } : {}) }]
}
export function hfTemplate(id: HfTemplateId, kind: 'header' | 'footer', width: number, t: TFunc, info: HfDocumentInfo = {}): HeaderFooter {
  const placeholder = t('ribbonHfTemplateText')
  const title: Run = info.title ? { text: info.title, instrField: 'DOCPROPERTY Title' } : { text: placeholder }
  const para: HfParagraph = { align: 'center', runs: [{ text: placeholder }] }
  if (id === 'blank') return hfValue([para])
  if (id === 'columns') return hfValue([{ align: 'left', tabStops: [{ pos: Math.round(width / 2), val: 'center' }, { pos: width, val: 'right' }], runs: [{ text: `${placeholder}\t${placeholder}\t${placeholder}` }] }])
  if (id === 'title' || id === 'titleDate') { para.align = 'left'; para.runs = [title] }
  if (id === 'titleDate') {
    para.tabStops = [{ pos: width, val: 'right' }]
    para.runs.push({ text: '\t' }, { text: new Date().toLocaleDateString(), instrField: 'DATE' })
  }
  if (id === 'rule' || id === 'titleDate') {
    const side = kind === 'header' ? 'b' : 't'
    para.borders = side; para.borderLines = { [side]: { color: '4472C4', szPt: .75, spacePt: 4 } }
  }
  if (id === 'band') { para.shadingFill = 'E8EEF7'; para.runs = [{ text: placeholder, bold: true, color: '24486E' }]; para.spaceBefore = 80; para.spaceAfter = 80 }
  if (id === 'page' || id === 'pageTotal') para.runs = hfNumberRuns(id === 'page' ? 'plain' : 'total', t)
  return hfValue([para])
}
export const HF_DATE_FORMATS = [
  { id: 'date', options: { year: 'numeric', month: 'numeric', day: 'numeric' }, code: 'yyyy/M/d' },
  { id: 'long', options: { year: 'numeric', month: 'long', day: 'numeric' }, code: 'yyyy年M月d日' },
  { id: 'weekday', options: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }, code: 'yyyy年M月d日dddd' },
  { id: 'iso', options: null, code: 'yyyy-MM-dd' },
  { id: 'month', options: { year: 'numeric', month: 'long' }, code: 'yyyy年M月' },
  { id: 'time', options: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }, code: 'HH:mm:ss' },
  { id: 'shortTime', options: { hour: '2-digit', minute: '2-digit', hour12: false }, code: 'HH:mm' },
  { id: 'dateTime', options: { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }, code: 'yyyy/M/d HH:mm' },
] satisfies Array<{ id: string; options: Intl.DateTimeFormatOptions | null; code: string }>
export function hfDateText(id: string, locale: string, now = new Date()): string {
  const format = HF_DATE_FORMATS.find(f => f.id === id) ?? HF_DATE_FORMATS[0]
  if (format.id === 'iso') return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  return new Intl.DateTimeFormat(locale, format.options!).format(now)
}
