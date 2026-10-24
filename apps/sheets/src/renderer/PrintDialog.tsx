import { useEffect, useMemo, useRef, useState } from 'react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { WorkbookExportPdfRequest } from '../shared/desktop-api'
import type { SheetPrintSession } from './page-layout-actions'
import { useI18n } from './i18n/locale'
import { initialPrintPreferences, parsePrintPageRanges, setupForPrint } from './print-preview-settings'
import './print-dialog.css'

GlobalWorkerOptions.workerSrc = workerUrl

export default function PrintDialog({ session, onClose, setMessage }: {
  session: SheetPrintSession; onClose: () => void; setMessage: (message: string) => void
}) {
  const { t } = useI18n()
  const [settings, setSettings] = useState(() => initialPrintPreferences(session.setup))
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [payload, setPayload] = useState<WorkbookExportPdfRequest | null>(null)
  const [busy, setBusy] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(0)
  const [copies, setCopies] = useState(1)
  const [color, setColor] = useState(true)
  const [collate, setCollate] = useState(true)
  const [duplex, setDuplex] = useState<'simplex' | 'longEdge' | 'shortEdge'>('simplex')
  const [rangeMode, setRangeMode] = useState('all')
  const [range, setRange] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const previewQueue = useRef<Promise<void>>(Promise.resolve())
  const setup = useMemo(() => setupForPrint(session.setup, settings, session.selectedArea), [session, settings])
  const total = doc?.numPages ?? 0
  const current = Math.min(page, Math.max(total, 1))
  const ranges = rangeMode === 'custom' ? parsePrintPageRanges(range, total)
    : rangeMode === 'current' ? [{ from: current - 1, to: current - 1 }] : undefined
  const rangeInvalid = rangeMode === 'custom' && !ranges

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('button, select, input')?.focus()
    return () => previous?.focus?.()
  }, [])

  // 串行、去抖并丢弃过期任务，避免快速调参创建大量后台渲染窗口。
  useEffect(() => {
    let alive = true
    let task: ReturnType<typeof getDocument> | undefined
    setBusy(true); setError(''); setPayload(null)
    const timer = window.setTimeout(() => {
      previewQueue.current = previewQueue.current.catch(() => {}).then(async () => {
        if (!alive) return
        try {
          const next = session.build(setup)
          const preview = await window.desktopApi.previewWorkbookPrint(next)
          if (!alive) return
          const binary = atob(preview.base64)
          task = getDocument({ data: Uint8Array.from(binary, (c) => c.charCodeAt(0)) })
          const loaded = await task.promise
          if (!alive) { await task.destroy(); return }
          setDoc(loaded); setPayload(next); setBusy(false)
        } catch (reason) {
          if (alive) { setDoc(null); setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false) }
        }
      })
    }, 300)
    return () => { alive = false; clearTimeout(timer); if (task) void task.destroy() }
  }, [session, setup])

  useEffect(() => {
    const canvas = canvasRef.current, pane = paneRef.current
    if (!doc || !canvas || !pane || busy) return
    let alive = true
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    const draw = async () => {
      render?.cancel()
      try {
        const pdfPage = await doc.getPage(current)
        if (!alive) return
        const unit = pdfPage.getViewport({ scale: 1 })
        const fit = Math.max(0.1, Math.min((pane.clientWidth - 48) / unit.width, (pane.clientHeight - 48) / unit.height))
        const scale = zoom > 0 ? zoom / 100 : fit
        const viewport = pdfPage.getViewport({ scale: scale * window.devicePixelRatio })
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
        canvas.style.width = `${unit.width * scale}px`; canvas.style.height = `${unit.height * scale}px`
        render = pdfPage.render({ canvas, viewport })
        await render.promise
      } catch (reason) {
        if (alive && (reason as Error)?.name !== 'RenderingCancelledException') setError(String(reason))
      }
    }
    void draw()
    const observer = new ResizeObserver(() => { if (zoom === 0) void draw() })
    observer.observe(pane)
    return () => { alive = false; observer.disconnect(); render?.cancel() }
  }, [doc, current, zoom, busy])

  const print = async () => {
    if (!payload || busy || printing || rangeInvalid) return
    setPrinting(true); setError('')
    try {
      const result = await window.desktopApi.printWorkbook({ ...payload, copies, color, collate,
        duplexMode: duplex, ...(ranges ? { pageRanges: ranges } : {}) })
      if (result.ok) { setMessage(t('appPrintSent')); onClose() }
      else if (result.error) setError(result.error)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setPrinting(false) }
  }
  return <div className="modal-backdrop" onClick={() => { if (!printing) onClose() }}>
    <div ref={dialogRef} className="modal sheet-print-dialog" role="dialog" aria-modal="true"
      aria-labelledby="sheet-print-title" onClick={(e) => e.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape' && !printing) { event.preventDefault(); onClose() }
        if (event.key === 'Tab') {
          const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)') ?? [])]
          const first = focusable[0], last = focusable[focusable.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
      }}>
      <h2 id="sheet-print-title">{t('appPrintPreviewTitle')}</h2>
      <div className="sheet-print-body">
        <section className="sheet-print-settings" aria-label={t('appPrintSettingsTitle')}>
          <fieldset disabled={printing}>
            <legend>{t('appPrintSettingsTitle')}</legend>
            <label>{t('appPrintScope')}<select value={settings.scope} onChange={(e) => setSettings({ ...settings, scope: e.target.value as typeof settings.scope })}>
              <option value="document">{t('appPrintScopeDocument')}</option><option value="used">{t('appPrintScopeUsed')}</option>
              <option value="selection" disabled={!session.selectedArea}>{t('appPrintScopeSelection')}{session.selectedArea ? ` (${session.selectedArea})` : ''}</option>
            </select></label>
            <div className="sheet-print-pair">
              <label>{t('appPrintOrientationLabel')}<select value={settings.orientation} onChange={(e) => setSettings({ ...settings, orientation: e.target.value as typeof settings.orientation })}>
                <option value="portrait">{t('appOrientationPortrait')}</option><option value="landscape">{t('appOrientationLandscape')}</option>
              </select></label>
              <label>{t('appPrintPaperLabel')}<select value={settings.paperSize} onChange={(e) => setSettings({ ...settings, paperSize: Number(e.target.value) })}>
                {!([1, 3, 5, 8, 9, 11].includes(settings.paperSize)) && <option value={settings.paperSize}>{t('appPaperSizeNote', { name: settings.paperSize })}</option>}
                {[[9, 'A4'], [8, 'A3'], [11, 'A5'], [1, 'Letter'], [5, 'Legal'], [3, 'Tabloid']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select></label>
            </div>
            <label>{t('appPrintMarginsLabel')}<select value={settings.margins} onChange={(e) => setSettings({ ...settings, margins: e.target.value as typeof settings.margins })}>
              <option value="document">{t('appPrintUseDocument')}</option><option value="normal">{t('appMarginsNormal')}</option>
              <option value="narrow">{t('appMarginsNarrow')}</option><option value="wide">{t('appMarginsWide')}</option>
            </select></label>
            <label>{t('appPrintScalingLabel')}<select value={settings.scaling} onChange={(e) => setSettings({ ...settings, scaling: e.target.value as typeof settings.scaling })}>
              <option value="document">{t('appPrintUseDocument')}</option><option value="actual">{t('appPrintActualSize')}</option>
              <option value="fit-sheet">{t('appPrintFitSheet')}</option><option value="fit-columns">{t('appPrintFitColumns')}</option><option value="custom">{t('appPrintCustomScale')}</option>
            </select></label>
            {settings.scaling === 'custom' && <label>{t('appPrintScalePercent')}<input type="number" min={10} max={200} value={settings.scale}
              onChange={(e) => setSettings({ ...settings, scale: Math.max(10, Math.min(200, Number(e.target.value) || 100)) })} /></label>}
            <div className="sheet-print-pair">
              <label className="sheet-print-check"><input type="checkbox" checked={settings.gridlines} onChange={(e) => setSettings({ ...settings, gridlines: e.target.checked })} />{t('appPrintGridlinesTitle')}</label>
              <label className="sheet-print-check"><input type="checkbox" checked={settings.headings} onChange={(e) => setSettings({ ...settings, headings: e.target.checked })} />{t('appPrintHeadingsTitle')}</label>
            </div>
          </fieldset>
          <fieldset disabled={printing}>
            <legend>{t('appPrintJobTitle')}</legend>
            <label>{t('appPrintPagesLabel')}<select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)}>
              <option value="all">{t('appPrintAllPages')}</option><option value="current">{t('appPrintCurrentPage')}</option><option value="custom">{t('appPrintCustomPages')}</option>
            </select></label>
            {rangeMode === 'custom' && <label>{t('appPrintPagesHint')}<input value={range} placeholder="1-3, 5" aria-invalid={rangeInvalid} onChange={(e) => setRange(e.target.value)} /></label>}
            {rangeInvalid && <p className="sheet-print-error" role="alert">{t('appPrintInvalidPages')}</p>}
            <div className="sheet-print-pair">
              <label>{t('appPrintCopies')}<input type="number" min={1} max={999} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(999, Math.trunc(Number(e.target.value)) || 1)))} /></label>
              <label>{t('appPrintColorLabel')}<select value={color ? 'color' : 'mono'} onChange={(e) => setColor(e.target.value === 'color')}><option value="color">{t('appPrintColor')}</option><option value="mono">{t('appPrintMonochrome')}</option></select></label>
            </div>
            <label>{t('appPrintSides')}<select value={duplex} onChange={(e) => setDuplex(e.target.value as typeof duplex)}>
              <option value="simplex">{t('appPrintOneSided')}</option><option value="longEdge">{t('appPrintLongEdge')}</option><option value="shortEdge">{t('appPrintShortEdge')}</option>
            </select></label>
            <label className="sheet-print-check"><input type="checkbox" checked={collate} onChange={(e) => setCollate(e.target.checked)} />{t('appPrintCollate')}</label>
            <p className="sheet-print-note">{t('appPrintSystemHint')}</p>
          </fieldset>
        </section>
        <section className="sheet-print-preview" aria-label={t('appPrintPreviewLabel')}>
          <div className="sheet-print-canvas" ref={paneRef} aria-busy={busy}>
            {!busy && doc && <canvas ref={canvasRef} style={{ filter: color ? undefined : 'grayscale(1)' }} aria-label={t('appPrintPreviewPage', { page: current, total })} />}
            {busy && <p role="status">{t('appPrintPreparing')}</p>}
            {!busy && !doc && <p>{t('appPrintFailed')}</p>}
          </div>
          <div className="sheet-print-navigation">
            <button aria-label={t('appPrintPreviousPage')} disabled={busy || printing || current <= 1} onClick={() => setPage(current - 1)}>‹</button>
            <span>{current} / {total || '—'}</span>
            <button aria-label={t('appPrintNextPage')} disabled={busy || printing || current >= total} onClick={() => setPage(current + 1)}>›</button>
            <select aria-label={t('appPrintZoomLabel')} value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
              <option value={0}>{t('appPrintFitPage')}</option>{[50, 75, 100, 125, 150, 200].map((value) => <option key={value} value={value}>{value}%</option>)}
            </select>
          </div>
        </section>
      </div>
      {error && <p className="sheet-print-error" role="alert">{t('appPrintErrorDetail', { error })}</p>}
      <div className="modal-actions">
        <button className="btn-ghost" disabled={printing} onClick={onClose}>{t('dlgCancel')}</button>
        <button className="btn-primary" disabled={busy || !payload || printing || rangeInvalid} onClick={() => void print()}>{printing ? t('appPrintPreparing') : t('appPrintOpenSystem')}</button>
      </div>
    </div>
  </div>
}
