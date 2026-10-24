import { useEffect, useRef, useState } from 'react'
import { getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { DEFAULT_PRINT_JOB } from '@genoffice/electron-utils/print-job-settings'
import type { PrintJobSettings as Job } from '@genoffice/electron-utils/print-job-settings'
import { PrintJobSettings, printFailureText } from '@genoffice/ui/print-job-settings'
import { parsePageRanges } from './view-config'
import { useI18n } from './i18n/locale'
import './print-dialog.css'

/** 同一已保存快照用于页面预览和原生打印；只保留当前页的画布。 */
export function PrintDialog({ path, currentPage, onClose, onPrint }: {
  path: string; currentPage: number; onClose: () => void
  onPrint: (pages: number[] | undefined, job: Job) => Promise<{ ok: boolean; error?: string }>
}) {
  const { lang, t } = useI18n()
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(currentPage)
  const [mode, setMode] = useState<'all' | 'current' | 'custom'>('all')
  const [range, setRange] = useState('')
  const [job, setJob] = useState({ ...DEFAULT_PRINT_JOB })
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const total = doc?.numPages ?? 0
  const current = Math.max(1, Math.min(page, total || 1))
  const pages = mode === 'custom' ? parsePageRanges(range, total) : mode === 'current' ? [current] : undefined
  const invalid = mode === 'custom' && (!pages || pages.length === 0)
  const text = lang.startsWith('zh') ? { preview: '打印预览', loading: '正在生成预览…', previous: '上一页', next: '下一页', fit: '适合页面' }
    : { preview: 'Print preview', loading: 'Preparing preview…', previous: 'Previous page', next: 'Next page', fit: 'Fit page' }
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('button, input, select')?.focus()
    let alive = true
    let task: ReturnType<typeof getDocument> | undefined
    void (async () => {
      try {
        const data = await window.pdfApi.readFile(path)
        if (!alive) return
        task = getDocument({ data: new Uint8Array(data) })
        const loaded = await task.promise
        if (!alive) { await task.destroy(); return }
        setDoc(loaded)
      } catch (reason) { if (alive) setError(String(reason)) }
    })()
    return () => { alive = false; if (task) void task.destroy(); previous?.focus?.() }
  }, [path])
  useEffect(() => {
    const canvas = canvasRef.current, pane = paneRef.current
    if (!doc || !canvas || !pane) return
    let alive = true, generation = 0
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    let queue = Promise.resolve()
    const draw = () => {
      const version = ++generation
      render?.cancel()
      queue = queue.catch(() => {}).then(async () => {
        if (!alive || version !== generation) return
        try {
          const source = await doc.getPage(current)
          if (!alive || version !== generation) return
          const unit = source.getViewport({ scale: 1 })
          const fit = Math.max(.1, Math.min((pane.clientWidth - 40) / unit.width, (pane.clientHeight - 40) / unit.height))
          const scale = zoom ? zoom / 100 : fit
          const viewport = source.getViewport({ scale: scale * window.devicePixelRatio })
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
          canvas.style.width = `${unit.width * scale}px`; canvas.style.height = `${unit.height * scale}px`
          canvas.style.filter = job.color ? '' : 'grayscale(1)'
          render = source.render({ canvas, viewport })
          await render.promise
        } catch (reason) { if (alive && (reason as Error).name !== 'RenderingCancelledException') setError(String(reason)) }
      })
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(pane)
    return () => { alive = false; generation++; observer.disconnect(); render?.cancel() }
  }, [doc, current, zoom, job.color])
  const print = async () => {
    if (!doc || invalid || printing) return
    setPrinting(true); setError('')
    try {
      const result = await onPrint(pages ?? undefined, job)
      if (result.ok) onClose()
      else if (result.error) setError(printFailureText(lang, result.error))
    } catch (reason) { setError(printFailureText(lang, reason instanceof Error ? reason.message : String(reason))) }
    finally { setPrinting(false) }
  }
  return <div className="pdf-modal-mask" onClick={() => { if (!printing) onClose() }}>
    <div ref={dialogRef} className="pdf-modal pdf-print-dialog" role="dialog" aria-modal="true" aria-label={t('print')}
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        event.stopPropagation()
        if (event.key === 'Escape' && !printing) { event.preventDefault(); onClose() }
        if (event.key === 'Tab') {
          const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])]
          const first = controls[0], last = controls[controls.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
      }}>
      <div className="pdf-modal-title">{t('print')}</div>
      <div className="pdf-print-body">
        <div className="pdf-print-settings">
          <PrintJobSettings lang={lang} value={job} onChange={setJob} disabled={printing} />
          <fieldset disabled={printing}><legend>{t('printRangeCustom')}</legend>
            {(['all', 'current', 'custom'] as const).map(value => <label className="pdf-modal-row" key={value}>
              <input type="radio" name="pdf-print-range" checked={mode === value} onChange={() => setMode(value)} />
              <span>{t(value === 'all' ? 'printRangeAll' : value === 'current' ? 'printRangeCurrent' : 'printRangeCustom')}</span>
            </label>)}
            <input className={`pdf-modal-input${invalid ? ' invalid' : ''}`} disabled={mode !== 'custom'}
              aria-label={t('printRangeCustom')} value={range} placeholder={t('printRangeHint')} onChange={event => setRange(event.target.value)} />
          </fieldset>
        </div>
        <div className="pdf-print-preview">
          <div ref={paneRef} className="pdf-print-page" aria-label={text.preview}>{doc ? <canvas ref={canvasRef} /> : <span>{text.loading}</span>}</div>
          <div className="pdf-print-nav">
            <button aria-label={text.previous} disabled={current <= 1 || !doc} onClick={() => setPage(current - 1)}>‹</button>
            <span>{current} / {total}</span>
            <button aria-label={text.next} disabled={current >= total || !doc} onClick={() => setPage(current + 1)}>›</button>
            <select aria-label={text.preview} value={zoom} onChange={event => setZoom(Number(event.target.value))}>
              <option value="0">{text.fit}</option>{[50, 75, 100, 125, 150, 200].map(value => <option value={value} key={value}>{value}%</option>)}
            </select>
          </div>
        </div>
      </div>
      {error && <div className="pdf-print-error" role="alert">{error}</div>}
      <div className="pdf-modal-actions"><button className="pdf-modal-btn" disabled={printing} onClick={onClose}>{t('cancel')}</button>
        <button className="pdf-modal-btn primary" disabled={!doc || invalid || printing} onClick={() => void print()}>{t('print')}</button></div>
    </div>
  </div>
}
