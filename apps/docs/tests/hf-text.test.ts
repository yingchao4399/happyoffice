import { describe, expect, it } from 'vitest'
import { PAGE_MARK, TOTAL_PAGES_MARK, type HeaderFooter } from '@genoffice/docx-engine'
import { applyHfText, hfEditText, insertHfRuns } from '../src/renderer/editor/hf-text'

describe('hfEditText', () => {
  it('renders paragraphs as lines with field sentinels as tokens', () => {
    const value: HeaderFooter = {
      text: '',
      paras: [
        { align: 'left', runs: [{ text: 'Confidential' }] },
        { align: 'center', runs: [{ text: `Page ${PAGE_MARK} of ${TOTAL_PAGES_MARK}` }] },
      ],
    }
    expect(hfEditText(value)).toBe('Confidential\nPage {PAGE} of {NUMPAGES}')
  })

  it('falls back to the legacy single line and appends the page mark', () => {
    expect(hfEditText({ text: 'Draft', pageNumber: true })).toBe(`Draft {PAGE}`)
    expect(hfEditText({ text: '' })).toBe('')
  })

  it('skips layout-table rows', () => {
    const value: HeaderFooter = {
      text: '',
      paras: [
        { runs: [], cells: [{ paras: [[{ text: 'cell' }]] }] },
        { align: 'right', runs: [{ text: 'visible' }] },
      ],
    }
    expect(hfEditText(value)).toBe('visible')
  })
})

describe('applyHfText', () => {
  it('keeps per-line paragraph format and first-run styling', () => {
    const value: HeaderFooter = {
      text: '',
      paras: [
        { align: 'left', runs: [{ text: 'old', bold: true }] },
        { align: 'right', runs: [{ text: 'other' }] },
      ],
    }
    const next = applyHfText(value, 'new first\nnew second')
    expect(next.paras).toEqual([
      { align: 'left', runs: [{ text: 'new first', bold: true }] },
      { align: 'right', runs: [{ text: 'new second' }] },
    ])
    expect(next.text).toBe('new firstnew second')
  })

  it('converts tokens back to field sentinels', () => {
    const next = applyHfText(null, '{PAGE} / {NUMPAGES}')
    expect(next.paras?.[0]?.runs[0]?.text).toBe(`${PAGE_MARK} / ${TOTAL_PAGES_MARK}`)
    expect(next.pageNumber).toBe(true)
  })

  it('does not recreate a page field after its token is deleted', () => {
    const base: HeaderFooter = { text: PAGE_MARK, pageNumber: true, paras: [{ runs: [{ text: PAGE_MARK }] }] }
    expect(applyHfText(base, '').pageNumber).toBe(false)
    expect(hfEditText(applyHfText(base, 'Only text'))).toBe('Only text')
  })

  it('splices cells rows back at their original positions', () => {
    const value: HeaderFooter = {
      text: '',
      paras: [
        { runs: [], cells: [{ paras: [[{ text: 'logo row' }]] }] },
        { align: 'center', runs: [{ text: 'title' }] },
      ],
    }
    const next = applyHfText(value, 'edited title')
    expect(next.paras?.[0]?.cells).toBeTruthy()
    expect(next.paras?.[1]?.runs[0]?.text).toBe('edited title')
  })

  it('extra lines reuse the last template; empty text clears', () => {
    const value: HeaderFooter = {
      text: '',
      paras: [{ align: 'right', runs: [{ text: 'one', italic: true }] }],
    }
    const next = applyHfText(value, 'a\nb')
    expect(next.paras).toEqual([
      { align: 'right', runs: [{ text: 'a', italic: true }] },
      { align: 'right', runs: [{ text: 'b', italic: true }] },
    ])
    const cleared = applyHfText(value, '')
    expect(cleared.text).toBe('')
    expect(cleared.paras).toEqual([{ align: 'right', runs: [] }])
  })
})


describe('header/footer fields survive editing', () => {
  const value: HeaderFooter = { text:'Date: 2026-10-26!',paras:[{ align:'right',runs:[{ text:'Date: ' },{ text:'2026-10-26',instrField:'DATE' },{ text:'!' }] }] }
  it('keeps an unchanged field when editing the surrounding text', () => {
    const next = applyHfText(value,'Date: 2026-10-26! edited')
    expect(next.paras?.[0].runs.find(r => r.instrField === 'DATE')?.text).toBe('2026-10-26')
    expect(next.paras?.[0].runs.filter(r => r.instrField).length).toBe(1)
  })
  it('does not turn edited literal text into a field', () => {
    const next = applyHfText(value,'Date: replacement!')
    expect(next.paras?.[0].runs.some(r => r.instrField)).toBe(false)
  })
  it('inserts at the selected position and retains the field on its right', () => {
    const next = insertHfRuns(value,[{ text:PAGE_MARK }],6,6)
    expect(next.text).toBe('Date: '+PAGE_MARK+'2026-10-26!')
    expect(next.paras?.[0].runs.find(r => r.instrField === 'DATE')?.text).toBe('2026-10-26')
    expect(next.pageNumber).toBe(true)
  })
  it('maps visible page tokens to the correct offsets', () => {
    const base: HeaderFooter = { text:PAGE_MARK+' title',paras:[{runs:[{text:PAGE_MARK},{text:' title'}]}] }
    expect(insertHfRuns(base,[{text:' X'}],6,6).text).toBe(PAGE_MARK+' X title')
  })
})
