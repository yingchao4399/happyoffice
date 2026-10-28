import React, { useState } from 'react'
import { PAGE_MARK, TOTAL_PAGES_MARK, type HeaderFooter } from '@genoffice/docx-engine'
import { useI18n } from '../i18n/locale'
import { HF_TEMPLATES, HF_NUMBER_STYLES, HF_DATE_FORMATS, hfTemplate, hfNumberRuns, hfDateText, hfValue, type HfTemplateId, type HfNumberStyle, type HfDocumentInfo } from '../editor/hf-presets'

export function HfPreview({ value, kind }: { value: HeaderFooter; kind: 'header' | 'footer' }) {
  return <span className={`hf-template-paper hf-template-paper-${kind}`} aria-hidden="true">
    <span className="hf-preview-body"><i /><i /><i /></span>
    <span className="hf-preview-content">{value.paras?.map((p, i) => <span key={i} style={{ display: 'block', textAlign: p.align as React.CSSProperties['textAlign'], background: p.shadingFill ? '#' + p.shadingFill : undefined, borderTop: p.borders?.includes('t') ? '1px solid #4472C4' : undefined, borderBottom: p.borders?.includes('b') ? '1px solid #4472C4' : undefined, color: p.runs[0]?.color ? '#' + p.runs[0].color : undefined }}>
      {p.runs.map(r => r.text).join('').replaceAll(PAGE_MARK, '1').replaceAll(TOTAL_PAGES_MARK, '10').split('\t').map((text,j,all) => <span key={j} style={all.length > 1 ? { display:'inline-block',width: `${100/all.length}%`, textAlign: j === 0 ? 'left' : j === all.length-1 ? 'right' : 'center' } : undefined}>{text || '\u00a0'}</span>)}
    </span>)}</span>
  </span>
}
export function HfTemplateGallery({ kind, width, info, onApply, onEdit, onRemove }: {
  kind: 'header' | 'footer'; width: number; info: HfDocumentInfo; onApply: (value: HeaderFooter) => void; onEdit: () => void; onRemove: () => void
}) {
  const { t } = useI18n()
  const names = ['ribbonHfTplBlank','ribbonHfTplColumns','ribbonHfTplTitle','ribbonHfTplRule','ribbonHfTplBand','ribbonHfTplTitleDate','ribbonHfTplPage','ribbonHfTplPageTotal'] as const
  return <div className="hf-menu hf-gallery-menu" data-rb-panel="" role="menu" aria-label={t(kind === 'header' ? 'ribbonHeader' : 'ribbonFooter')}>
    <div className="hf-menu-title">{t('ribbonHfBuiltIn')}</div>
    <div className="hf-template-grid">{HF_TEMPLATES.map((id: HfTemplateId,i) => {
      const value = hfTemplate(id,kind,width,t,info)
      return <button className="hf-template-card" role="menuitem" key={id} data-hf-template={id} onClick={() => onApply(value)}><HfPreview value={value} kind={kind} /><span>{t(names[i])}</span></button>
    })}</div>
    <div className="hf-gallery-actions"><button role="menuitem" onClick={onEdit}>{t(kind === 'header' ? 'ribbonHfEditHeader' : 'ribbonHfEditFooter')}</button><button role="menuitem" onClick={onRemove}>{t(kind === 'header' ? 'ribbonHfRemoveHeader' : 'ribbonHfRemoveFooter')}</button></div>
  </div>
}
export function HfPageNumberMenu({ onApply, onFormat, onRemove }: {
  onApply: (kind: 'header' | 'footer' | 'current', align: 'left' | 'center' | 'right', style: HfNumberStyle) => void; onFormat: () => void; onRemove: () => void
}) {
  const { t } = useI18n()
  const [position,setPosition] = useState<'header' | 'footer' | 'current'>('footer')
  const styleNames = ['ribbonHfPnPlain','ribbonHfTplPageTotal','ribbonHfPnDash','ribbonHfPnAccent'] as const
  const alignNames = ['ribbonAlignLeftTip','ribbonAlignCenterTip','ribbonAlignRightTip'] as const
  return <div className="hf-menu hf-number-menu" data-rb-panel="" role="menu" aria-label={t('ribbonPageNumber')}>
    <div className="hf-number-positions" role="tablist">{(['header','footer','current'] as const).map((kind,i) => <button role="tab" aria-selected={position === kind} className={position === kind ? 'on' : ''} key={kind} onClick={() => setPosition(kind)}>{t((['ribbonHfPnTop','ribbonHfPnBottom','ribbonHfPnCurrent'] as const)[i])}</button>)}</div>
    <div className="hf-number-styles">{HF_NUMBER_STYLES.map((style: HfNumberStyle,i) => <section key={style}><div className="hf-menu-title">{t(styleNames[i])}</div><div className="hf-number-style-row">{(['left','center','right'] as const).filter((_,i) => position !== 'current' || i === 1).map((align,j) => <button className="hf-template-card" role="menuitem" key={align} data-hf-number={`${position}-${style}-${align}`} onClick={() => onApply(position,align,style)}><HfPreview kind={position === 'header' ? 'header' : 'footer'} value={hfValue([{ align, runs: hfNumberRuns(style,t) }])} /><span>{position === 'current' ? t('ribbonInsert') : t(alignNames[j])}</span></button>)}</div></section>)}</div>
    <div className="hf-gallery-actions"><button role="menuitem" onClick={onFormat}>{t('ribbonPnFormat')}</button><button role="menuitem" onClick={onRemove}>{t('ribbonPnRemove')}</button></div>
  </div>
}
export function HfDateMenu({ onInsert }: { onInsert: (text: string, instruction?: string) => void }) {
  const { t,dateLocale } = useI18n()
  const [locale,setLocale] = useState(dateLocale)
  const [format,setFormat] = useState('date')
  const [field,setField] = useState(false)
  const now = new Date()
  const selected = HF_DATE_FORMATS.find(f => f.id === format)!
  return <div className="hf-menu hf-design-menu hf-date-menu" data-rb-panel="">
    <div className="hf-menu-title">{t('ribbonHfDateTime')}</div>
    <label>{t('ribbonHfLanguage')}<select aria-label={t('ribbonHfLanguage')} value={locale} onChange={e => setLocale(e.target.value)}>{[...new Set([dateLocale,'zh-CN','en-US','ja-JP'])].map(value => <option key={value}>{value}</option>)}</select></label>
    <div className="hf-date-formats" role="listbox" aria-label={t('ribbonHfAvailableFormats')}>{HF_DATE_FORMATS.map(f => <button key={f.id} role="option" aria-selected={format === f.id} className={format === f.id ? 'on' : ''} onClick={() => setFormat(f.id)}>{hfDateText(f.id,locale,now)}</button>)}</div>
    <label className="hf-field-checkbox"><input type="checkbox" checked={field} onChange={e => setField(e.target.checked)} />{t('ribbonHfInsertAsField')}</label>
    <div className="hf-menu-actions"><button className="btn-primary" onClick={() => onInsert(hfDateText(format,locale),field ? `${format.toLowerCase().includes('time') ? 'TIME' : 'DATE'} \\@ "${locale.startsWith('zh') ? selected.code : selected.code.replaceAll('年','/').replaceAll('月','/').replaceAll('日','')}" \\l ${locale === 'zh-CN' ? '2052' : locale === 'ja-JP' ? '1041' : '1033'}` : undefined)}>{t('ribbonInsert')}</button></div>
  </div>
}
