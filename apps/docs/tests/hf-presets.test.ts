import { describe, expect, it } from 'vitest'
import { buildBlankDocx, parseDocx, saveDocx, readSections, PAGE_MARK, TOTAL_PAGES_MARK } from '@genoffice/docx-engine'
import { HF_TEMPLATES,hfTemplate,hfNumberRuns,hfDateText } from '../src/renderer/editor/hf-presets'
import { hfMenuEn } from '../src/renderer/editor/hf-menu-strings'
import { applyHfText,hfEditText } from '../src/renderer/editor/hf-text'
import type { TFunc } from '../src/renderer/i18n/locale'
const t = ((key: string) => hfMenuEn[key as keyof typeof hfMenuEn] ?? key) as TFunc

describe('header/footer gallery DOCX round trips', () => {
  for (const kind of ['header','footer'] as const) for (const id of HF_TEMPLATES) it(`${kind}: ${id}`, async () => {
    const value = hfTemplate(id,kind,9000,t,{title:'Actual document title'})
    const bytes = await buildBlankDocx()
    const parsed = await parseDocx(bytes)
    const saved = await saveDocx(parsed,[],{[kind]:value})
    const reopened = await parseDocx(saved)
    const section = readSections(reopened)[0]
    const rid = (kind === 'header' ? section.headerRefs : section.footerRefs).default!
    const part = reopened.hfParts?.[rid]
    expect(part?.paras.map(p => p.runs.map(r => r.text).join('')).join('\n')).toBe(value.text)
    if (id === 'columns') expect(part?.paras[0].tabStops?.map(s => [s.pos,s.val])).toEqual([[4500,'center'],[9000,'right']])
    if (id === 'pageTotal') expect(part?.text).toContain(TOTAL_PAGES_MARK)
    if (id === 'band') expect(part?.paras[0].shadingFill).toBe('E8EEF7')
    if (id === 'title') expect(part?.paras[0].runs[0].instrField).toBe('DOCPROPERTY Title')
  })
  it('retains accent page-number styling when saved and reopened', async () => {
    const parsed = await parseDocx(await buildBlankDocx())
    const saved = await saveDocx(parsed,[],{footer:{text:PAGE_MARK,pageNumber:true,paras:[{runs:hfNumberRuns('accent',t)}]}})
    const reopened = await parseDocx(saved)
    expect(reopened.footerParas?.[0].runs.find(r => r.text.includes(PAGE_MARK))).toMatchObject({bold:true,color:'4472C4',sizeHalfPoints:28})
  })
  it('keeps separate PAGE and NUMPAGES markers', () => {
    const runs = hfNumberRuns('total',t)
    expect(runs.some(r => r.text === PAGE_MARK)).toBe(true)
    expect(runs.some(r => r.text === TOTAL_PAGES_MARK)).toBe(true)
  })
  it('formats local calendar dates without UTC date rollover', () => {
    expect(hfDateText('iso','en-US',new Date(2026,9,26,0,1))).toBe('2026-10-26')
  })
  it('keeps title field and tab alignment while editing its neighboring date', () => {
    const value = hfTemplate('titleDate','header',9000,t,{title:'Actual title'})
    const next = applyHfText(value,hfEditText(value)+' extra')
    expect(next.paras?.[0].runs.find(r => r.instrField === 'DOCPROPERTY Title')?.text).toBe('Actual title')
    expect(next.paras?.[0].tabStops?.[0].pos).toBe(9000)
  })
})
