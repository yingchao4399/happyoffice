import React from 'react'
import type { HeaderFooter, SectionSettings } from '@genoffice/docx-engine'
import { IconCaret, IconFooter, IconHeader, IconPageNumber } from './icons'
import { useI18n } from '../i18n/locale'

type Kind = 'header' | 'footer'

export function HeaderFooterTab({
  hasDoc,
  header,
  footer,
  onHeader,
  onFooter,
  onPageNumFormat,
  titlePg,
  onTitlePg,
  evenOddHf,
  onEvenOddHf,
  section,
  onSection,
  onExit,
}: {
  hasDoc: boolean
  header: HeaderFooter | null
  footer: HeaderFooter | null
  onHeader: (next: HeaderFooter) => void
  onFooter: (next: HeaderFooter) => void
  onPageNumFormat: () => void
  titlePg: boolean
  onTitlePg: (v: boolean) => void
  evenOddHf: boolean
  onEvenOddHf: (v: boolean) => void
  section: SectionSettings | null
  onSection: (next: SectionSettings) => void
  onExit: () => void
}) {
  const { t } = useI18n()

  const updateField = (kind: Kind, instr: string, cached: string) => {
    const current = kind === 'header' ? header : footer
    const target = current ?? { text: '' }
    const paras = target.paras?.length ? target.paras.map((p) => ({ ...p, runs: p.runs ? [...p.runs] : p.runs })) : [{ align: 'center' as const, runs: [] }]
    const first = paras.find((p) => !p.cells) ?? paras[0]
    if (!first || first.cells) return
    first.runs = [...(first.runs ?? []), { text: cached, instrField: instr }]
    const next = { ...target, text: paras.filter((p) => !p.cells).map((p) => (p.runs ?? []).map((r) => r.text).join('')).join(''), paras }
    ;(kind === 'header' ? onHeader : onFooter)(next)
  }

  const appendLine = (kind: Kind) => {
    const current = kind === 'header' ? header : footer
    const next = current ?? { text: '' }
    const paras = next.paras?.length ? [...next.paras] : [{ align: 'center' as const, runs: [] }]
    paras.push({ align: 'center' as const, borders: 'b', runs: [{ text: '' }] })
    ;(kind === 'header' ? onHeader : onFooter)({ ...next, paras })
  }

  const insertPageNumber = (kind: Kind, align: 'left' | 'center' | 'right') => {
    const next: HeaderFooter = {
      text: '#',
      pageNumber: true,
      paras: [{ align, runs: [{ text: '#' }] }],
    }
    ;(kind === 'header' ? onHeader : onFooter)(next)
  }

  const updateDistance = (kind: 'headerDist' | 'footerDist', value: string) => {
    const cm = Number(value)
    if (!Number.isFinite(cm)) return
    onSection({ ...(section ?? {} as SectionSettings), [kind]: Math.max(0, Math.round(cm * 567)) })
  }

  return (
    <div className="header-footer-ribbon-body">
      <div className="ribbon-group">
        <div className="ribbon-group-items">
          <button className="rb-big" disabled={!hasDoc} onClick={() => onHeader({ ...(header ?? { text: '' }) })}>
            <span className="rb-big-icon"><IconHeader size={26} /></span>
            <span>{t('ribbonHeader')}</span>
          </button>
          <button className="rb-big" disabled={!hasDoc} onClick={() => onFooter({ ...(footer ?? { text: '' }) })}>
            <span className="rb-big-icon"><IconFooter size={26} /></span>
            <span>{t('ribbonFooter')}</span>
          </button>
          <button className="rb-big" disabled={!hasDoc} onClick={() => insertPageNumber('footer', 'center')}>
            <span className="rb-big-icon"><IconPageNumber size={26} /></span>
            <span>{t('ribbonPageNumber')}</span>
          </button>
        </div>
        <div className="ribbon-group-label">{t('ribbonGroupHeaderFooter')}</div>
      </div>
      <div className="ribbon-sep" />
      <div className="ribbon-group">
        <div className="ribbon-group-items hf-ribbon-field-items">
          <button className="rb-small" disabled={!hasDoc} onClick={() => updateField('header', 'DATE', new Date().toLocaleDateString())}>{t('ribbonFieldDate')}</button>
          <button className="rb-small" disabled={!hasDoc} onClick={() => updateField('header', 'TIME', new Date().toLocaleTimeString())}>{t('ribbonFieldTime')}</button>
          <button className="rb-small" disabled={!hasDoc} onClick={() => updateField('header', 'FILENAME', t('ribbonFieldFileName'))}>{t('ribbonFieldFileName')}</button>
          <button className="rb-small" disabled={!hasDoc} onClick={() => appendLine('header')}>{t('ribbonBorderBottom')}</button>
        </div>
        <div className="ribbon-group-label">{t('ribbonGroupInsert')}</div>
      </div>
      <div className="ribbon-sep" />
      <div className="ribbon-group">
        <div className="ribbon-group-items hf-ribbon-options">
          <button className={`rb-small ${titlePg ? 'active' : ''}`} disabled={!hasDoc} onClick={() => onTitlePg(!titlePg)}>{titlePg ? '✓ ' : ''}{t('ribbonDiffFirstPage')}</button>
          <button className={`rb-small ${evenOddHf ? 'active' : ''}`} disabled={!hasDoc} onClick={() => onEvenOddHf(!evenOddHf)}>{evenOddHf ? '✓ ' : ''}{t('ribbonDiffOddEven')}</button>
          <label className="hf-distance-control">{t('ribbonHeaderDistance')}<input type="number" min="0" step="0.1" value={((section?.headerDist ?? 720) / 567).toFixed(2)} onChange={(e) => updateDistance('headerDist', e.target.value)} /></label>
          <label className="hf-distance-control">{t('ribbonFooterDistance')}<input type="number" min="0" step="0.1" value={((section?.footerDist ?? 720) / 567).toFixed(2)} onChange={(e) => updateDistance('footerDist', e.target.value)} /></label>
        </div>
        <div className="ribbon-group-label">{t('ribbonGroupOptions')}</div>
      </div>
      <div className="ribbon-sep" />
      <button className="rb-big hf-close-button" disabled={!hasDoc} onClick={onExit}>
        <span className="rb-big-icon"><IconCaret size={24} /></span>
        <span>{t('ribbonCloseHeaderFooter')}</span>
      </button>
    </div>
  )
}
