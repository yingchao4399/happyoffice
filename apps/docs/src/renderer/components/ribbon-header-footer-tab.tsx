import React, { useEffect, useRef, useState } from 'react'
import { PAGE_MARK, TOTAL_PAGES_MARK, type HeaderFooter, type SectionSettings } from '@genoffice/docx-engine'
import { useDismissablePopover } from '@genoffice/ui'
import { IconCaret, IconFooter, IconHeader, IconPageNumber } from './icons'
import { useI18n } from '../i18n/locale'
import { applyHfText, hfEditText, hfParasOf, insertHfRuns } from '../editor/hf-text'
import { hfHasPageField, hfWithoutPageMarks } from '../editor/hf-dom'
import { HfTemplateGallery, HfPageNumberMenu, HfDateMenu } from './hf-galleries'
import { hfNumberRuns, type HfNumberStyle, type HfDocumentInfo } from '../editor/hf-presets'

type Kind = 'header' | 'footer'

// 距离输入允许输入完整小数；失焦或回车才提交，避免每个字符被 toFixed 覆盖。
function DistanceInput({ label, value, onCommit, disabled }: {
  label: string; value: number; onCommit: (value: string) => void; disabled: boolean
}) {
  const [text, setText] = useState((value * 2.54 / 1440).toFixed(2))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText((value * 2.54 / 1440).toFixed(2)) }, [value])
  return <input disabled={disabled} aria-label={label} type="number" min="0" step="0.1" value={text}
    onFocus={() => { focused.current = true }} onChange={event => setText(event.target.value)}
    onInput={event => setText(event.currentTarget.value)}
    onBlur={event => { const entered = event.currentTarget.value; focused.current = false; onCommit(entered); if (!entered.trim() || !Number.isFinite(Number(entered))) setText((value * 2.54 / 1440).toFixed(2)) }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
}

export function HeaderFooterTab({ hasDoc, header, footer, onHeader, onFooter, onPageNumFormat,
  titlePg, onTitlePg, evenOddHf, onEvenOddHf, section, onSection, onExit, activeKind = 'header',
  onNavigate, canPrevious = false, canNext = false, filePath = null, documentInfo = {},
}: {
  filePath?: string | null
  documentInfo?: HfDocumentInfo
  hasDoc: boolean
  header: HeaderFooter | null
  footer: HeaderFooter | null
  onHeader: (next: HeaderFooter) => void
  onFooter: (next: HeaderFooter) => void
  onPageNumFormat: () => void
  titlePg: boolean
  onTitlePg: (value: boolean) => void
  evenOddHf: boolean
  onEvenOddHf: (value: boolean) => void
  section: SectionSettings | null
  onSection: (next: SectionSettings) => void
  onExit: () => void
  activeKind?: Kind
  onNavigate?: (direction: 'previous' | 'next' | 'switch') => void
  canPrevious?: boolean
  canNext?: boolean
}) {
  const { t } = useI18n()
  const [menu, setMenu] = useState<string | null>(null)
  const [infoKey, setInfoKey] = useState('TITLE')
  const [infoValue, setInfoValue] = useState('')
  const [snippetName, setSnippetName] = useState('')
  const [templateError, setTemplateError] = useState(false)
  const [snippets, setSnippets] = useState<Array<{ name: string; value: HeaderFooter }>>(() => { try { return JSON.parse(localStorage.getItem('aidocs.hfTemplates') ?? '[]').filter((v: { name?: string; value?: HeaderFooter }) => typeof v.name === 'string' && typeof v.value?.text === 'string').slice(0,30) } catch { return [] } })
  const [text, setText] = useState('')
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center')
  const [lineColor, setLineColor] = useState('#444444')
  const [lineWidth, setLineWidth] = useState('0.75')
  const [lineSpace, setLineSpace] = useState('3')
  const rootRef = useRef<HTMLDivElement>(null)
  useDismissablePopover(menu !== null, () => setMenu(null), { inside: () => rootRef.current ? [rootRef.current] : [] })
  const current = (kind: Kind) => (kind === 'header' ? header : footer) ?? { text: '' }
  const commit = (kind: Kind, value: HeaderFooter) => (kind === 'header' ? onHeader : onFooter)(value)
  const toggle = (name: string) => {
    setTemplateError(false)
    if (name === 'header' || name === 'footer') {
      const value = current(name)
      setText(hfEditText(value))
      const found = hfParasOf(value).find(p => !p.cells)?.align
      setAlign(found === 'left' || found === 'right' ? found : 'center')
    }
    if (name === 'line') {
      const border = hfParasOf(current('header')).find(p => !p.cells)?.borderLines?.b
      setLineColor('#' + (border?.color ?? '444444'))
      setLineWidth(String(border?.szPt ?? .75))
      setLineSpace(String(border?.spacePt ?? 3))
    }
    setMenu(value => value === name ? null : name)
  }
  const saveSnippets = (next: typeof snippets) => {
    try {
      localStorage.setItem('aidocs.hfTemplates', JSON.stringify(next))
      setSnippets(next); setTemplateError(false)
      return true
    } catch {
      setTemplateError(true)
      return false
    }
  }
  const insertRuns = (runs: Parameters<typeof insertHfRuns>[1]) => {
    const el = document.querySelector<HTMLElement>('.canvas-hf-page .page-hf-editing .page-hf-edit-surface')
    const start = el?.dataset.hfStart !== undefined ? Number(el.dataset.hfStart) : undefined
    const end = el?.dataset.hfEnd !== undefined ? Number(el.dataset.hfEnd) : start
    if (el) el.dataset.hfPendingCaret = String((start ?? hfEditText(current(activeKind)).length) +
      runs.map(run => run.text).join('').replaceAll(PAGE_MARK, '{PAGE}').replaceAll(TOTAL_PAGES_MARK, '{NUMPAGES}').length)
    commit(activeKind,insertHfRuns(current(activeKind),runs,start,end))
    setMenu(null)
  }
  const updateField = (instr: string | undefined,cached: string) => insertRuns([{ text:cached,...(instr ? { instrField:instr } : {}) }])
  const pageNumber = (position: Kind | 'current', alignment: 'left' | 'center' | 'right', style: HfNumberStyle = 'plain') => {
    if (position === 'current') { insertRuns(hfNumberRuns(style,t)); return }
    const kind = position
    const cleaned = hfWithoutPageMarks(current(kind))
    const paras = hfParasOf(cleaned).filter(p => p.cells || p.runs.some(run => run.text.trim()))
    paras.push({ align: alignment, runs: hfNumberRuns(style,t) })
    commit(kind, { ...cleaned, text: paras.map(p => p.runs.map(run => run.text).join('')).join('\n'), pageNumber: true, paras })
    if (kind !== activeKind) onNavigate?.('switch')
    setMenu(null)
  }
  const applyLine = (enabled: boolean) => {
    const target = current('header')
    const paras = hfParasOf(target).map(p => ({ ...p, runs: [...p.runs] }))
    let para = paras.find(p => !p.cells)
    if (!para) { para = { align: 'center', runs: [] }; paras.push(para) }
    para.borders = [...new Set((para.borders ?? '').replaceAll('b', '') + (enabled ? 'b' : ''))].join('')
    para.borderLines = { ...para.borderLines }
    if (enabled) para.borderLines.b = { color: lineColor.replace('#', ''),
      szPt: Math.min(12, Math.max(.25, Number(lineWidth) || .75)), spacePt: Math.min(31, Math.max(0, Number(lineSpace) || 0)) }
    else delete para.borderLines.b
    commit('header', { ...target, paras })
    setMenu(null)
  }
  const updateDistance = (key: 'headerDist' | 'footerDist', value: string) => {
    if (!section || value.trim() === '') return
    const cm = Number(value)
    if (!Number.isFinite(cm)) return
    onSection({ ...section, [key]: Math.min(Math.floor(section.pageHeight / 3), Math.max(0, Math.round(cm * 1440 / 2.54))) })
  }
  const textMenu = (kind: Kind) => <div className="hf-menu hf-design-menu" data-rb-panel="">
    <div className="hf-menu-title">{t(kind === 'header' ? 'ribbonHeaderTip' : 'ribbonFooterTip')}</div>
    <textarea autoFocus rows={3} value={text} onChange={e => setText(e.target.value)} />
    <label>{t('ribbonGroupAlignment')}<select value={align} onChange={e => setAlign(e.target.value as typeof align)}>
      <option value="left">{t('ribbonAlignLeftTip')}</option><option value="center">{t('ribbonAlignCenterTip')}</option><option value="right">{t('ribbonAlignRightTip')}</option>
    </select></label>
    <div className="hf-menu-actions"><button className="btn-primary" onClick={() => {
      const next = applyHfText(current(kind), text)
      next.paras = next.paras?.map(p => p.cells ? p : { ...p, align })
      commit(kind, next); setMenu(null)
    }}>{t('ribbonApply')}</button><button onClick={() => { commit(kind, { text: '', paras: [], replaceContent: true }); setMenu(null) }}>{t('ribbonHfRemove')}</button></div>
  </div>
  return <div className="header-footer-ribbon-body" ref={rootRef}>
    <div className="ribbon-group"><div className="ribbon-group-items">
      {(['header', 'footer'] as const).map(kind => <div className="rb-split-wrap" key={kind}>
        <button className="rb-big" disabled={!hasDoc} aria-expanded={menu === kind} onClick={() => toggle(kind)}>
          <span className="rb-big-icon">{kind === 'header' ? <IconHeader size={26} /> : <IconFooter size={26} />}<IconCaret /></span>
          <span>{t(kind === 'header' ? 'ribbonHeader' : 'ribbonFooter')}</span>
        </button>{menu === kind && <HfTemplateGallery kind={kind} width={(section?.pageWidth ?? 11906) - (section?.marginLeft ?? 1440) - (section?.marginRight ?? 1440)} info={documentInfo} onApply={value => { commit(kind,{ ...value, replaceContent:true }); if (kind !== activeKind) onNavigate?.('switch'); setMenu(null) }} onEdit={() => { if (kind !== activeKind) onNavigate?.('switch'); toggle(kind); setMenu(kind + '-edit') }} onRemove={() => { commit(kind,{ text:'',paras:[],replaceContent:true }); setMenu(null) }} />}{menu === kind + '-edit' && textMenu(kind)}
      </div>)}
      <div className="rb-split-wrap"><button className="rb-big" disabled={!hasDoc} aria-expanded={menu === 'number'} onClick={() => toggle('number')}>
        <span className="rb-big-icon"><IconPageNumber size={26} /><IconCaret /></span><span>{t('ribbonPageNumber')}</span>
      </button>{menu === 'number' && <HfPageNumberMenu onApply={pageNumber} onFormat={() => { setMenu(null); onPageNumFormat() }} onRemove={() => { if (hfHasPageField(header)) onHeader(hfWithoutPageMarks(header!)); if (hfHasPageField(footer)) onFooter(hfWithoutPageMarks(footer!)); setMenu(null) }} />}</div>
      <div className="rb-split-wrap"><button className="rb-big" disabled={!hasDoc} onClick={() => toggle('line')} aria-expanded={menu === 'line'}>
        <span className="rb-big-icon hf-line-icon">―<IconCaret /></span><span>{t('ribbonHfLine')}</span>
      </button>{menu === 'line' && <div className="hf-menu hf-design-menu" data-rb-panel="">
        <div className="hf-menu-title">{t('ribbonHfLine')}</div>
        <label>{t('ribbonBorderColor')}<input aria-label={t('ribbonBorderColor')} type="color" value={lineColor} onChange={e => setLineColor(e.target.value)} /></label>
        <label>{t('ribbonBorderWidth')}<input aria-label={t('ribbonBorderWidth')} type="number" min="0.25" max="12" step="0.25" value={lineWidth} onChange={e => setLineWidth(e.target.value)} /> pt</label>
        <label>{t('ribbonHfLineSpacing')}<input aria-label={t('ribbonHfLineSpacing')} type="number" min="0" max="31" step="1" value={lineSpace} onChange={e => setLineSpace(e.target.value)} /> pt</label>
        <div className="hf-menu-actions"><button className="btn-primary" onClick={() => applyLine(true)}>{t('ribbonApply')}</button><button onClick={() => applyLine(false)}>{t('ribbonNoBorders')}</button></div>
      </div>}</div>
    </div><div className="ribbon-group-label">{t('ribbonGroupHeaderFooter')}</div></div>
    <div className="ribbon-sep" />
    <div className="ribbon-group"><div className="ribbon-group-items hf-ribbon-field-items">
      <div className="rb-split-wrap"><button className="rb-small" disabled={!hasDoc} onClick={() => toggle('date')}>{t('ribbonFieldDate')} / {t('ribbonFieldTime')} <IconCaret /></button>
        {menu === 'date' && <HfDateMenu onInsert={(cached,instr) => updateField(instr,cached)} />}
      </div>
      <div className="rb-split-wrap"><button className="rb-small" disabled={!hasDoc} onClick={() => toggle('info')}>{t('ribbonHfDocumentInfo')} <IconCaret /></button>
        {menu === 'info' && <div className="layout-menu" data-rb-panel="">{([
          ['AUTHOR','ribbonHfAuthor',documentInfo.author], ['FILENAME','ribbonFieldFileName',filePath?.split(/[\\/]/).pop() ?? document.title], ['FILENAME \\p','ribbonHfFilePath',filePath], ['TITLE','ribbonHfDocTitle',documentInfo.title], ['SUBJECT','ribbonHfSubject',documentInfo.subject], ['KEYWORDS','ribbonHfKeywords',documentInfo.keywords], ['COMMENTS','ribbonHfDescription',documentInfo.description],
        ] as const).map(([key,label,value]) => <button key={key} onClick={() => { setInfoKey(key); setInfoValue(value ?? ''); setMenu('info-edit') }}>{t(label)}</button>)}</div>}
        {menu === 'info-edit' && <div className="hf-menu hf-design-menu" data-rb-panel=""><div className="hf-menu-title">{t('ribbonHfDocumentInfo')} · {infoKey}</div><input aria-label={t('ribbonHfFieldValue')} value={infoValue} placeholder={t('ribbonHfMissingProperty')} onChange={e => setInfoValue(e.target.value)} /><div className="hf-menu-actions"><button className="btn-primary" disabled={!infoValue.trim()} onClick={() => updateField(infoKey,infoValue)}>{t('ribbonInsert')}</button></div></div>}
      </div>
      <div className="rb-split-wrap"><button className="rb-small" disabled={!hasDoc} onClick={() => toggle('parts')}>{t('ribbonHfDocumentParts')} <IconCaret /></button>
        {menu === 'parts' && <div className="hf-menu hf-design-menu" data-rb-panel=""><div className="hf-menu-title">{t('ribbonHfSavedTemplates')}</div><div className="hf-saved-templates">{snippets.length === 0 && <p>{t('ribbonHfNoTemplates')}</p>}{snippets.map((item,index) => <div key={item.name}><button onClick={() => { commit(activeKind,structuredClone(item.value)); setMenu(null) }}>{item.name}</button><button aria-label={t('ribbonHfDeleteTemplate')} onClick={() => { const next = snippets.filter((_,i) => i !== index); saveSnippets(next) }}>×</button></div>)}</div>{templateError && <p role="alert">{t('ribbonHfTemplateSaveFailed')}</p>}<input aria-label={t('ribbonHfTemplateName')} placeholder={t('ribbonHfTemplateName')} value={snippetName} maxLength={80} onChange={e => setSnippetName(e.target.value)} /><div className="hf-menu-actions"><button className="btn-primary" disabled={!snippetName.trim()} onClick={() => { const next = [{ name: snippetName.trim(), value: current(activeKind) },...snippets.filter(item => item.name !== snippetName.trim())].slice(0,30); if (saveSnippets(next)) { setSnippetName(''); setMenu(null) } }}>{t('ribbonHfSaveTemplate')}</button></div></div>}
      </div>
      <div className="rb-split-wrap"><button className="rb-small" disabled={!hasDoc} onClick={() => toggle('field')}>{t('ribbonField')} <IconCaret /></button>
        {menu === 'field' && <div className="layout-menu" data-rb-panel=""><button onClick={() => updateField('PAGE', PAGE_MARK)}>{t('ribbonPageNumber')}</button><button onClick={() => updateField('NUMPAGES', TOTAL_PAGES_MARK)}>{t('ribbonHfTotalPages')}</button><button onClick={() => updateField('FILENAME', filePath?.split(/[\\/]/).pop() ?? document.title)}>{t('ribbonFieldFileName')}</button><button onClick={() => updateField('DATE',new Date().toLocaleDateString())}>{t('ribbonFieldDate')}</button><button onClick={() => updateField('TIME',new Date().toLocaleTimeString())}>{t('ribbonFieldTime')}</button><button onClick={() => setMenu('info')}>{t('ribbonHfDocumentInfo')}…</button></div>}
      </div>
    </div><div className="ribbon-group-label">{t('ribbonGroupInsert')}</div></div>
    <div className="ribbon-sep" />
    <div className="ribbon-group"><div className="ribbon-group-items hf-ribbon-field-items">
      <button className="rb-small" disabled={!hasDoc || !onNavigate} onClick={() => onNavigate?.('switch')}>{t('ribbonHfSwitch')}</button>
      <button className="rb-small" disabled={!hasDoc || !canPrevious} onClick={() => onNavigate?.('previous')}>{t('ribbonHfPrevious')}</button>
      <button className="rb-small" disabled={!hasDoc || !canNext} onClick={() => onNavigate?.('next')}>{t('ribbonHfNext')}</button>
    </div><div className="ribbon-group-label">{t('ribbonHfNavigate')}</div></div>
    <div className="ribbon-sep" />
    <div className="ribbon-group"><div className="ribbon-group-items hf-ribbon-options">
      <label><input type="checkbox" disabled={!hasDoc} checked={titlePg} onChange={e => onTitlePg(e.target.checked)} />{t('ribbonDiffFirstPage')}</label>
      <label><input type="checkbox" disabled={!hasDoc} checked={evenOddHf} onChange={e => onEvenOddHf(e.target.checked)} />{t('ribbonDiffOddEven')}</label>
    </div><div className="ribbon-group-label">{t('ribbonGroupOptions')}</div></div>
    <div className="ribbon-sep" />
    <div className="ribbon-group"><div className="ribbon-group-items hf-ribbon-options">
      <label className="hf-distance-control">{t('ribbonHeaderDistance')}<DistanceInput disabled={!hasDoc} label={t('ribbonHeaderDistance')} value={section?.headerDist ?? 720} onCommit={value => updateDistance('headerDist', value)} /></label>
      <label className="hf-distance-control">{t('ribbonFooterDistance')}<DistanceInput disabled={!hasDoc} label={t('ribbonFooterDistance')} value={section?.footerDist ?? 720} onCommit={value => updateDistance('footerDist', value)} /></label>
    </div><div className="ribbon-group-label">{t('ribbonHfPosition')}</div></div>
    <div className="ribbon-sep" /><button className="rb-big hf-close-button" disabled={!hasDoc} onClick={onExit}>
      <span className="rb-big-icon"><IconCaret size={24} /></span><span>{t('ribbonCloseHeaderFooter')}</span>
    </button>
  </div>
}
