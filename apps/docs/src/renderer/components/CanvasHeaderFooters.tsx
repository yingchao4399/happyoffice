import React from 'react'
import type { HeaderFooter, HfImage, SectionSettings } from '@genoffice/docx-engine'
import { HeaderFooterArea } from './HeaderFooterArea'
import { hfStripGeom } from '../editor/hf-dom'
import type { HfView } from '../doc-state'

export interface CanvasHfPart {
  value: HeaderFooter | null
  images?: HfImage[]
  view: HfView
  sectionIndex: number
}

export interface CanvasHfPage {
  top: number
  left: number
  width: number
  height: number
  pageIndex: number
  pageNo: string | number
  pageTotal: number
  settings: SectionSettings
  header: CanvasHfPart
  footer: CanvasHfPart
}

export interface HfEditingTarget {
  pageIndex: number
  kind: 'header' | 'footer'
  sectionIndex: number
  view: HfView
}

/** 每页独立纸张坐标；编辑器不放在 ProseMirror 分页占位符的正文流内。 */
export function CanvasHeaderFooters({ pages, active, readOnly, onActivate, onCommit, onExit }: {
  pages: CanvasHfPage[]
  active: HfEditingTarget | null
  readOnly: boolean
  onActivate: (target: HfEditingTarget) => void
  onCommit: (target: HfEditingTarget, value: HeaderFooter) => void
  onExit: () => void
}) {
  return <div className={`canvas-hf-layer${active ? ' canvas-hf-mode' : ''}`}>
    {pages.map(page => <div className="canvas-hf-page" key={page.pageIndex} data-hf-page-index={page.pageIndex}
      style={{ top: page.top, left: page.left, width: page.width, height: page.height }}>
      {(['header', 'footer'] as const).map(kind => {
        const part = page[kind]
        const target = { pageIndex: page.pageIndex, kind, sectionIndex: part.sectionIndex, view: part.view }
        const editing = active?.pageIndex === page.pageIndex && active.kind === kind
        const margin = (kind === 'header' ? page.settings.marginTop : page.settings.marginBottom) / 15
        const distance = (kind === 'header' ? page.settings.headerDist ?? 720 : page.settings.footerDist ?? 720) / 15
        const insetLeft = page.settings.marginLeft / 15
        return <React.Fragment key={kind}>
          {!readOnly && <div className={`canvas-hf-hit canvas-hf-hit-${kind}`} data-hf-kind={kind}
            style={{ height: Math.min(page.height / 2, Math.max(48, margin, distance + 24)) }}
            onDoubleClick={event => { event.preventDefault(); event.stopPropagation(); onActivate(target) }} />}
          <HeaderFooterArea kind={kind} value={part.value ?? { text: '' }} images={part.images}
            readOnly={readOnly} editing={editing} pageNo={page.pageNo} pageTotal={page.pageTotal}
            onEditingChange={next => next ? onActivate(target) : onExit()}
            onCommit={value => onCommit(target, value)}
            style={{ width: Math.max(1, page.width - insetLeft - page.settings.marginRight / 15), left: insetLeft,
              transform: 'none', top: kind === 'header' ? distance : 'auto', bottom: kind === 'footer' ? distance : 'auto' }}
            boxGeom={{ ...hfStripGeom(page.settings), stripLeft: insetLeft }} />
        </React.Fragment>
      })}
    </div>)}
  </div>
}
