import React, { useEffect, useRef, useState } from 'react'
import {
  PAGE_MARK,
  TOTAL_PAGES_MARK,
  type HeaderFooter,
  type HfImage,
  type HfParagraph,
  type Run,
} from '@genoffice/docx-engine'
import { useI18n } from '../i18n/locale'
import { spellcheckEnabled } from '../spellcheck-pref'
import {
  hfCellGeometry,
  hfCellParaStyle,
  hfCellSegStyle,
  hfCellTabLines,
  hfDeclaredStrutPt,
  hfLeadIndentCss,
  hfRowStyle,
  hfSegLeftCss,
  hfTabLeadNeedsStrut,
  hfTabLines,
  hfTabOverflowPx,
  hfBoxAnchorEl,
  hfTextBoxClass,
  hfTextBoxStyle,
  hfUsesLegacyHash,
  paraBorderCss,
  paraBorderPadding,
  type HfStripGeom,
  type HfTabLayout,
  hfParaLineHeightCss,
  hfParaIndentStyle,
  hfStackedSpacingPx,
} from '../editor/hf-dom'
import { applyHfText, hfEditText, hfParasOf, PAGE_TOKEN } from '../editor/hf-text'
import { dkStyleProps } from '../editor/dark-page'
import { INLINE_RULE_CLASS, inlineRuleStyle } from '../editor/inline-rule'
import { textColorValue } from '../editor/text-color'
import { textOutlineCssValue } from '../editor/text-outline'
import { cssRunFontFamily, fontKerningCss, runLetterSpacingCss } from '../line-metrics'

export type HfValue = HeaderFooter

function runStyle(run: Run): React.CSSProperties {
  const style: React.CSSProperties = {}
  if (run.bold) style.fontWeight = 600
  else if (run.bold === false) style.fontWeight = 'normal'
  if (run.italic) style.fontStyle = 'italic'
  else if (run.italic === false) style.fontStyle = 'normal'
  if (run.underline) style.textDecoration = 'underline'
  if (run.strike) style.textDecoration = `${style.textDecoration ?? ''} line-through`.trim()
  // authored color stays the declaration; the --dk-c twin feeds the dark page
  if (run.color) {
    style.color = textColorValue(run.color)
    if (run.color !== 'auto') Object.assign(style, dkStyleProps({ color: run.color }))
  }
  if (run.sizeHalfPoints) style.fontSize = `${run.sizeHalfPoints / 2}pt`
  const letterSpacing = runLetterSpacingCss(run)
  if (letterSpacing) style.letterSpacing = letterSpacing
  const kerning = fontKerningCss(run)
  if (kerning) style.fontKerning = kerning
  if (run.font || run.fontAscii) style.fontFamily = cssRunFontFamily(run.fontAscii, run.font)
  if (run.textOutline) style.WebkitTextStroke = textOutlineCssValue(run.textOutline)
  if (run.caps === 'all') style.textTransform = 'uppercase'
  else if (run.caps === 'small') style.fontVariantCaps = 'small-caps'
  else if (run.caps === 'none') {
    style.textTransform = 'none'
    style.fontVariantCaps = 'normal'
  }
  return style
}

/** document content colors (w:shd / w:pBdr) plus their dark-page twins; mirrors makeGapHfEl */
function paraStyle(para: HfParagraph): React.CSSProperties {
  const style: React.CSSProperties = {}
  const lh = hfParaLineHeightCss(para)
  if (lh) style.lineHeight = lh
  if (para.bidi) style.direction = 'rtl'
  Object.assign(style, hfParaIndentStyle(para))
  if (para.align) {
    style.textAlign =
      para.align === 'left' || para.align === 'center' || para.align === 'right'
        ? para.align
        : 'justify'
  }
  // frame placement wins over the paragraph's own jc (mirrors makeGapHfEl)
  if (para.frameXAlign) style.textAlign = para.frameXAlign
  const shdBg = para.shadingDisplay ?? para.shadingFill
  if (shdBg) {
    style.backgroundColor = `#${shdBg}`
    Object.assign(style, dkStyleProps({ background: `#${shdBg}` }))
  } else if (para.shadingClear) style.backgroundColor = 'transparent'
  if (para.borders) {
    const line = (side: 't' | 'b' | 'l' | 'r') => paraBorderCss(para.borderLines?.[side])
    const borders: Partial<Record<'t' | 'b' | 'l' | 'r', string>> = {}
    if (para.borders.includes('t')) style.borderTop = borders.t = line('t')
    if (para.borders.includes('b')) style.borderBottom = borders.b = line('b')
    if (para.borders.includes('l')) style.borderLeft = borders.l = line('l')
    if (para.borders.includes('r')) style.borderRight = borders.r = line('r')
    Object.assign(style, dkStyleProps({ borders }))
    Object.assign(style, paraBorderPadding(para.borders, para.borderLines))
  }
  return style
}

/**
 * Header / footer zone on the page: renders the rich paragraphs,
 * double-click enters in-place editing (plain text per paragraph; each line
 * keeps its paragraph format and first-run styling), blur commits. PAGE /
 * NUMPAGES sentinels edit as visible {PAGE} / {NUMPAGES} tokens.
 */
export function HeaderFooterArea({
  kind,
  value,
  images,
  readOnly,
  onCommit,
  onEditingChange,
  pageNo,
  pageTotal,
  style,
  boxGeom,
  editing: controlledEditing,
}: {
  kind: 'header' | 'footer'
  value: HfValue
  /** logo and other images in the part, display-only (text edits do not affect their saved bytes) */
  images?: HfImage[]
  readOnly?: boolean
  onCommit: (next: HfValue) => void
  /** notify the shell so the contextual 页眉和页脚 ribbon can appear */
  onEditingChange?: (editing: boolean) => void
  /** Page number shown for '#' (may be a section-formatted string); the continuous-flow canvas has no real page number, defaults to 1 */
  pageNo?: number | string
  /** Total page count shown for TOTAL_PAGES_MARK (NUMPAGES field), defaults to 1 */
  pageTotal?: number
  /** geometry override: on differing-width sections the strip is pinned to its own section's box */
  style?: React.CSSProperties
  /** page geometry: floating textboxes render at their anchor position (absent: stacked) */
  boxGeom?: HfStripGeom
  /** 页编辑模式由文档管理；点 Ribbon、菜单或设置框时不会退出。 */
  editing?: boolean
}) {
  const { t } = useI18n()
  const [localEditing, setLocalEditing] = useState(false)
  const editing = controlledEditing ?? localEditing
  const setEditing = (next: boolean) => {
    if (controlledEditing === undefined) setLocalEditing(next)
    onEditingChange?.(next)
  }
  const valueRef = useRef(value)
  valueRef.current = value
  const editRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef(false)
  const initialTextRef = useRef('')
  const paras = hfParasOf(value)

  // The editing surface is a standalone element: content is injected here and React
  // does not manage its children; after commit the whole element unmounts, so text
  // nodes produced while typing don't linger (keeps section/variant switches clean)
  useEffect(() => {
    if (!editing) return
    const el = editRef.current
    if (!el) return
    // table-row (cells) paragraphs stay out of the text editing flow
    el.innerText = hfEditText(value)
    cancelRef.current = false
    initialTextRef.current = el.innerText
    el.focus()
    const sel = window.getSelection()
    if (sel) {
      sel.selectAllChildren(el)
      sel.collapseToEnd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  useEffect(() => {
    if (controlledEditing !== undefined) return
    onEditingChange?.(editing)
    return () => onEditingChange?.(false)
  }, [editing, onEditingChange, controlledEditing])

  // 工具栏修改字段、页码、横线后同步当前编辑面；自己输入时不重置光标。
  useEffect(() => {
    const el = editRef.current
    if (!editing || !el) return
    const text = hfEditText(value)
    if (el.innerText === text) return
    el.innerText = text
    initialTextRef.current = text
    if (el.dataset.hfPendingCaret !== undefined) {
      const offset = Math.min(text.length, Number(el.dataset.hfPendingCaret))
      delete el.dataset.hfPendingCaret
      el.focus({ preventScroll: true })
      const selection = window.getSelection(), range = document.createRange()
      range.selectNodeContents(el); range.collapse(false)
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode: node => node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
      })
      let remaining = offset, node: Node | null
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (remaining <= (node.textContent?.length ?? 0)) { range.setStart(node,remaining); range.collapse(true); break }
          remaining -= node.textContent?.length ?? 0
        } else {
          if (remaining === 0) { range.setStartBefore(node); range.collapse(true); break }
          remaining--
        }
      }
      selection?.removeAllRanges(); selection?.addRange(range)
      el.dataset.hfStart = el.dataset.hfEnd = String(offset)
    }
  }, [value, editing])

  useEffect(() => {
    if (!editing) return
    const remember = () => {
      const el = editRef.current,selection = window.getSelection()
      if (!el || !selection?.rangeCount) return
      const range = selection.getRangeAt(0)
      if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return
      const offset = (container: Node,index: number) => {
        const before = document.createRange(); before.selectNodeContents(el); before.setEnd(container,index)
        const measure = document.createElement('div')
        measure.style.cssText = 'position:fixed;left:-100000px;top:0;white-space:pre-wrap;pointer-events:none'
        measure.append(before.cloneContents()); document.body.append(measure)
        const length = measure.innerText.length; measure.remove(); return length
      }
      el.dataset.hfStart = String(offset(range.startContainer,range.startOffset))
      el.dataset.hfEnd = String(offset(range.endContainer,range.endOffset))
    }
    document.addEventListener('selectionchange',remember)
    remember()
    return () => document.removeEventListener('selectionchange',remember)
  },[editing])

  const commit = () => {
    const el = editRef.current
    if (controlledEditing === undefined) setEditing(false)
    if (!el) return
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    if (el.innerText === initialTextRef.current) return
    onCommit(applyHfText(value, el.innerText))
  }

  const display = (text: string) => {
    const t = text
      .replaceAll(TOTAL_PAGES_MARK, String(pageTotal ?? 1))
      .replaceAll(PAGE_MARK, String(pageNo ?? 1))
    return hfUsesLegacyHash(value) ? t.replace('#', String(pageNo ?? 1)) : t
  }

  // run-declared strip strut (shrink-only), mirroring makeGapHfEl so the
  // preview/export strips lay out like the canvas gaps and the push-down probe
  const strutPt = hfDeclaredStrutPt(paras)
  const hasBoxes = boxGeom != null && paras.some((p) => p.box)
  const tabOver = Math.max(
    0,
    ...paras.map((p) => (p.cells ? 0 : hfTabOverflowPx(hfTabLines(p, display) ?? [], boxGeom))),
  )
  return (
    <div
      className={`page-hf page-hf-${kind}${editing ? ' page-hf-editing' : ''}${hasBoxes ? ' page-hf-has-boxes' : ''}`}
      style={{
        ...(strutPt != null ? { fontSize: `min(${strutPt}pt, var(--hf-default-fs, 10.5pt))` } : {}),
        ...(tabOver > 0 ? { ['--hf-tab-over' as string]: `${tabOver.toFixed(1)}px` } : {}),
        ...style,
      }}
      data-tip={
        readOnly
          ? undefined
          : t(kind === 'header' ? 'appDblclickEditHeader' : 'appDblclickEditFooter') +
            (value.pageNumber
              ? hfUsesLegacyHash(value)
                ? t('appHfPageNumHint')
                : t('appHfPageNumHint').replace('#', PAGE_TOKEN)
              : '')
      }
      data-hf-label={t(kind === 'header' ? 'ribbonHeader' : 'ribbonFooter')}
      onDoubleClick={() => {
        if (!readOnly && !editing) {
          // Notify the shell in the same user gesture.  The effect below keeps
          // the notification correct for keyboard/variant changes, but waiting
          // for that effect here leaves the Ribbon on Home for one render and
          // makes the contextual tab appear to be unresponsive.
          setEditing(true)
        }
      }}
    >
      {!value.replaceContent && images && images.some((im) => !im.floating) && (
        <div
          className="page-hf-images"
          contentEditable={false}
          style={
            images.find((im) => !im.floating)?.align === 'right'
              ? { justifyContent: 'flex-end' }
              : images.find((im) => !im.floating)?.align === 'center'
                ? { justifyContent: 'center' }
                : undefined
          }
        >
          {images
            .filter((img) => !img.floating)
            .map((img, i) => (
              <img
                key={i}
                src={img.dataUrl}
                alt=""
                draggable={false}
                style={{
                  ...(img.widthPx ? { width: img.widthPx } : {}),
                  ...(img.heightPx ? { height: img.heightPx } : {}),
                }}
              />
            ))}
        </div>
      )}
      {editing ? (
        <div
          ref={editRef}
          className="page-hf-edit-surface"
          contentEditable
          spellCheck={spellcheckEnabled()}
          suppressContentEditableWarning
          style={paras.find(p => !p.cells) ? paraStyle(paras.find(p => !p.cells)!) : undefined}
          onInput={() => {
            const el = editRef.current
            if (!el || controlledEditing === undefined) return
            const next = applyHfText(valueRef.current, el.innerText)
            valueRef.current = next
            initialTextRef.current = el.innerText
            onCommit(next)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              if (controlledEditing === undefined) cancelRef.current = true
              setEditing(false)
            }
          }}
        />
      ) : (
        <HfContent kind={kind} paras={paras} display={display} boxGeom={boxGeom} />
      )}
    </div>
  )
}

function HfContent({
  kind,
  paras,
  display,
  boxGeom,
}: {
  kind: 'header' | 'footer'
  paras: HfParagraph[]
  display: (text: string) => string
  boxGeom?: HfStripGeom
}) {
  const spacing = hfStackedSpacingPx(paras)
  const margins = (i: number): React.CSSProperties => ({
    ...(spacing[i].top ? { marginTop: `${spacing[i].top}px` } : {}),
    ...(spacing[i].bottom ? { marginBottom: `${spacing[i].bottom}px` } : {}),
  })
  const renderPara = (para: HfParagraph, i: number) =>
    para.cells ? (
      // layout-table row: read-only flex columns (excluded from text editing)
      <div
        key={i}
        className="page-hf-para page-hf-row"
        style={{ ...hfRowStyle(para.row), ...margins(i) }}
      >
        {para.cells.map((cell, j) => {
          const geom = hfCellGeometry(cell)
          const spans = (runs: Run[]) =>
            runs.map((run, l) => (
              <span key={l} style={runStyle(run)}>
                {run.image?.rule && (
                  <span
                    className={INLINE_RULE_CLASS}
                    style={inlineRuleStyle({
                      ...run.image.rule,
                      sizeHalfPoints: run.sizeHalfPoints,
                    })}
                  />
                )}
                {run.image && !run.image.rule && (
                  <img
                    className="page-hf-cell-img"
                    src={run.image.dataUrl}
                    alt=""
                    draggable={false}
                    style={{
                      ...(run.image.widthPx ? { width: run.image.widthPx } : {}),
                      ...(run.image.heightPx ? { height: run.image.heightPx } : {}),
                    }}
                  />
                )}
                {display(run.text)}
              </span>
            ))
          return (
            <div
              key={j}
              className="page-hf-cell"
              style={{
                ...geom.style,
                // document content colors (w:shd / borders) plus their dark-page twins
                ...(cell.fill ? { backgroundColor: `#${cell.fill}` } : {}),
                ...dkStyleProps({
                  ...(cell.fill ? { background: `#${cell.fill}` } : {}),
                  borders: geom.borders,
                }),
              }}
            >
              {/* one block line per cell paragraph (mirrors makeGapHfEl) */}
              {(cell.paras.length > 0 ? cell.paras : [[]]).map((runs, k) => {
                const props = cell.paraProps?.[k]
                const tabLines = hfCellTabLines(runs, props, geom, para.row, display)
                if (!tabLines) {
                  return (
                    <div key={k} className="page-hf-cell-para" style={hfCellParaStyle(props)}>
                      {runs.length === 0 ? ' ' : null}
                      {spans(runs)}
                    </div>
                  )
                }
                return tabLines.map((line, m) => (
                  <div
                    key={`${k}-${m}`}
                    className="page-hf-cell-para page-hf-tabbed"
                    style={{
                      ...hfCellParaStyle(props, {
                        first: m === 0,
                        last: m === tabLines.length - 1,
                      }),
                      textAlign: 'left',
                      ...(line.minHeightPt ? { minHeight: `${line.minHeightPt}pt` } : {}),
                    }}
                  >
                    {spans(line.lead)}
                    {line.segments.map((seg, n) => (
                      <span
                        key={`t${n}`}
                        className={`page-hf-tabseg page-hf-tabseg-${seg.anchor}`}
                        style={hfCellSegStyle(seg)}
                      >
                        {spans(seg.runs)}
                      </span>
                    ))}
                  </div>
                ))
              })}
            </div>
          )
        })}
      </div>
    ) : (
      (() => {
        const tabLines = hfTabLines(para, display)
        if (!tabLines) {
          return (
            <div
              key={i}
              className={`page-hf-para${para.frameXAlign ? ' page-hf-frame' : ''}`}
              style={{
                ...paraStyle(para),
                ...margins(i),
                ...(para.runs.length === 0 && para.emptyRunSizeHalfPoints
                  ? { fontSize: `${para.emptyRunSizeHalfPoints / 2}pt` }
                  : {}),
              }}
            >
              {para.runs.length === 0 ? ' ' : null}
              {para.runs.map((run, j) => (
                <span key={j} style={runStyle(run)}>
                  {display(run.text)}
                </span>
              ))}
            </div>
          )
        }
        // tab layout happens in left-aligned space; w:jc becomes an explicit shift
        const lineStyle = (tabbed: HfTabLayout): React.CSSProperties => {
          const leadIndent = hfLeadIndentCss(tabbed)
          return {
            ...(tabbed.minHeightPt ? { minHeight: `${tabbed.minHeightPt}pt` } : {}),
            textAlign: 'left',
            ...(leadIndent ? { textIndent: leadIndent } : {}),
          }
        }
        const lineContent = (tabbed: HfTabLayout) => (
          <>
            {hfTabLeadNeedsStrut(tabbed) ? '\u200b' : null}
            {tabbed.lead.map((run, j) => (
              <span key={j} style={runStyle(run)}>
                {display(run.text)}
              </span>
            ))}
            {tabbed.segments.map((seg, k) => (
              <span
                key={`t${k}`}
                className={`page-hf-tabseg page-hf-tabseg-${seg.anchor}`}
                style={{ left: hfSegLeftCss(seg, tabbed) }}
              >
                {seg.runs.map((run, j) => (
                  <span key={j} style={runStyle(run)}>
                    {display(run.text)}
                  </span>
                ))}
              </span>
            ))}
          </>
        )
        const frame = para.frameXAlign ? ' page-hf-frame' : ''
        if (tabLines.length === 1) {
          return (
            <div
              key={i}
              className={`page-hf-para page-hf-tabbed${frame}`}
              style={{ ...paraStyle(para), ...margins(i), ...lineStyle(tabLines[0]) }}
            >
              {lineContent(tabLines[0])}
            </div>
          )
        }
        // a w:br paragraph stacks one positioned line per break inside the
        // paragraph block (which keeps the spacing and borders)
        return (
          <div
            key={i}
            className={`page-hf-para${frame}`}
            style={{ ...paraStyle(para), ...margins(i) }}
          >
            {tabLines.map((tabbed, m) => (
              <div key={m} className="page-hf-tabbed" style={lineStyle(tabbed)}>
                {lineContent(tabbed)}
              </div>
            ))}
          </div>
        )
      })()
    )
  // consecutive paragraphs of one floating textbox render inside a positioned
  // box (Word draws them at the anchor); everything else stacks as strip lines.
  // A box sharing its paragraph with text hangs off that paragraph instead.
  const indices = paras.map((_, i) => i)
  const hostedBy = new Map<number, React.ReactNode[]>()
  const out: React.ReactNode[] = []
  for (let i = 0; i < paras.length;) {
    const box = paras[i].box
    const css = box && boxGeom ? hfTextBoxStyle(box, kind, boxGeom) : null
    if (!css) {
      out.push(indices[i])
      i += 1
      continue
    }
    const items: React.ReactNode[] = []
    const start = i
    for (; i < paras.length && paras[i].box?.id === box?.id; i += 1) {
      items.push(renderPara(paras[i], i))
    }
    const node = (
      <div key={`box${start}`} className={hfTextBoxClass(box!)} style={css}>
        {items}
      </div>
    )
    const anchor = hfBoxAnchorEl(box!, indices)
    if (anchor != null) hostedBy.set(anchor, [...(hostedBy.get(anchor) ?? []), node])
    else out.push(node)
  }
  return (
    <>
      {out.map((item) => {
        if (typeof item !== 'number') return item
        const el = renderPara(paras[item], item) as React.ReactElement<{
          className?: string
          children?: React.ReactNode
        }>
        const hosted = hostedBy.get(item)
        if (!hosted) return el
        return React.cloneElement(
          el,
          { className: `${el.props.className ?? ''} page-hf-anchor` },
          el.props.children,
          ...hosted,
        )
      })}
    </>
  )
}
