import { useEffect, useRef, useState } from 'react'
import type { OfficeFileResult } from '@genoffice/electron-utils/office-file-bridge'

export const officeFileStrings = {
  zh: {
    handout: '创建讲义（Word）', file: '文件', new: '新建', open: '打开', save: '保存', saveAs: '另存为', close: '关闭', information: '信息',
    print: '打印', export: '导出', changeType: '更改文件类型', options: '选项', cancel: '取消', apply: '应用',
    pptx: 'PowerPoint 演示文稿（.pptx）', ppt: 'PowerPoint 97–2003 演示文稿（.ppt）',
    potx: 'PowerPoint 模板（.potx）', pot: 'PowerPoint 97–2003 模板（.pot）',
    ppsx: 'PowerPoint 放映（.ppsx）', pps: 'PowerPoint 97–2003 放映（.pps）', odp: 'OpenDocument 演示文稿（.odp）',
    autoSave: '默认自动保存', theme: '界面主题', system: '跟随系统', light: '浅色', dark: '深色',
    defaultApps: '默认打开方式', busy: '正在导出…', exported: '已导出', failed: '导出失败',
    cancelled: '已取消导出', unavailable: '此格式需要可用的系统 Office 转换器。请安装或修复 Microsoft Office 后重试。',
    cancelExport: '取消导出',
    nativeBusy: '系统 Office 正在使用中。请保存并关闭对应的 Word、Excel 或 PowerPoint 窗口后重试此格式。',
    sourceOverwrite: '导出副本不能覆盖当前源文件，请选择其他文件名。',
    edit: '编辑', read: '阅读', spelling: '拼写检查', darkPage: '深色页面',
    unmodified: '没有修改，当前文档为只读查看状态。',
  },
  en: {
    handout: 'Create handout (Word)', file: 'File', new: 'New', open: 'Open', save: 'Save', saveAs: 'Save As', close: 'Close', information: 'Information',
    print: 'Print', export: 'Export', changeType: 'Change file type', options: 'Options', cancel: 'Cancel', apply: 'Apply',
    pptx: 'PowerPoint presentation (.pptx)', ppt: 'PowerPoint 97–2003 presentation (.ppt)',
    potx: 'PowerPoint template (.potx)', pot: 'PowerPoint 97–2003 template (.pot)',
    ppsx: 'PowerPoint show (.ppsx)', pps: 'PowerPoint 97–2003 show (.pps)', odp: 'OpenDocument presentation (.odp)',
    autoSave: 'Auto-save by default', theme: 'App theme', system: 'System', light: 'Light', dark: 'Dark',
    defaultApps: 'Default apps', busy: 'Exporting…', exported: 'Exported', failed: 'Export failed',
    cancelled: 'Export cancelled', unavailable: 'This format requires a working system Office converter. Install or repair Microsoft Office and try again.',
    cancelExport: 'Cancel export',
    nativeBusy: 'System Office is in use. Save and close the relevant Word, Excel or PowerPoint windows, then retry this format.',
    sourceOverwrite: 'An exported copy cannot overwrite the source document. Choose another filename.',
    edit: 'Editing', read: 'Reading', spelling: 'Spelling', darkPage: 'Dark page',
    unmodified: 'No changes. The document is open for reading.',
  },
}
export const officeFileText = (lang: string) => officeFileStrings[lang.startsWith('zh') ? 'zh' : 'en']
export function officeExportStatus(lang: string, result: OfficeFileResult): string {
  const text = officeFileText(lang)
  if (result.cancelled) return text.cancelled
  if (result.ok) return `${text.exported}: ${result.data?.path ?? ''}`
  const code = result.error?.code
  const reason = code === 'OFFICE_NATIVE_EXPORT_UNAVAILABLE' ? text.unavailable
    : code === 'OFFICE_NATIVE_EXPORT_BUSY' ? text.nativeBusy
    : code === 'OFFICE_EXPORT_SOURCE_OVERWRITE' ? text.sourceOverwrite
    : result.error?.message || code || text.failed
  return `${text.failed}: ${reason}${result.error?.path ? ` (${result.error.path})` : ''}`
}

export type OfficeFileAction = 'new' | 'open' | 'save' | 'saveAs' | 'close' | 'information' | 'print' | 'options' | `export:${string}`
export function OfficeFileMenu({ lang, hasDocument, formats, fileTypes = [], busy = false, saveDisabledReason, onAction, onClose }: {
  lang: string; hasDocument: boolean; formats: readonly string[]; busy?: boolean
  fileTypes?: readonly string[]
  saveDisabledReason?: string
  onAction: (command: OfficeFileAction) => void; onClose: () => void
}) {
  const text = officeFileText(lang)
  const ref = useRef<HTMLDivElement>(null)
  const [exports, setExports] = useState(false)
  const [types, setTypes] = useState(false)
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    return () => { if (trigger?.isConnected) trigger.focus() }
  }, [])
  const item = (command: OfficeFileAction, label: string, shortcut?: string, disabled = false, reason?: string) => (
    <button key={command} type="button" role="menuitem" disabled={disabled} title={reason} data-office-file-action={command}
      onClick={() => { onClose(); onAction(command) }}>
      {label}{shortcut && <span className="file-menu-key">{shortcut}</span>}
    </button>
  )
  return <div ref={ref} role="menu" data-rb-panel="" className="file-menu office-file-menu" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    event.preventDefault(); event.stopPropagation(); buttons[next]?.focus()
  }}>
    {item('new', text.new, 'Ctrl+N')}
    {item('open', text.open, 'Ctrl+O')}
    {item('save', text.save, 'Ctrl+S', !hasDocument || busy || Boolean(saveDisabledReason), saveDisabledReason)}
    {item('saveAs', text.saveAs, 'Ctrl+Shift+S', !hasDocument || busy)}
    <hr />
    {item('information', text.information, undefined, !hasDocument)}
    {item('print', text.print, 'Ctrl+P', !hasDocument || busy)}
    <button role="menuitem" type="button" aria-expanded={exports} disabled={!hasDocument || busy} data-office-file-action="export" onClick={() => { setExports(value => !value); setTypes(false) }}>{text.export}<span aria-hidden="true">{exports ? '▴' : '▾'}</span></button>
    {exports && formats.map(format => item(`export:${format}`, format === 'handout.docx' ? text.handout : format.toUpperCase(), undefined, busy))}
    {fileTypes.length > 0 && <button role="menuitem" type="button" aria-expanded={types} disabled={!hasDocument || busy} data-office-file-action="change-type" onClick={() => { setTypes(value => !value); setExports(false) }}>{text.changeType}<span aria-hidden="true">{types ? '▴' : '▾'}</span></button>}
    {types && fileTypes.map(format => item(`export:${format}`, text[format as keyof typeof text] || format.toUpperCase(), undefined, busy))}
    {busy && <button role="menuitem" type="button" data-office-file-action="cancel-export" onClick={() => { onClose(); void window.fridayOffice?.cancelExport() }}>{text.cancelExport}</button>}
    <hr />
    {item('options', text.options)}
    {item('close', text.close, 'Ctrl+W', busy)}
  </div>
}

export function OfficeOptionsDialog({ lang, editing, reading, onClose }: {
  lang: string; editing?: { checked: boolean; change: (value: boolean) => void }
  reading?: { checked: boolean; change: (value: boolean) => void }; onClose: () => void
}) {
  const text = officeFileText(lang)
  const ref = useRef<HTMLDivElement>(null)
  const [preferences, setPreferences] = useState({ autoSaveDefault: false, theme: 'system' as 'light' | 'dark' | 'system' })
  const [edit, setEdit] = useState(editing?.checked ?? false)
  const [read, setRead] = useState(reading?.checked ?? false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.querySelector<HTMLElement>('input,select,button')?.focus()
    window.fridayOffice?.preferences().then(value => { setPreferences(value); setLoaded(true) }).catch(() => setError(text.failed))
    return () => previous?.focus()
  }, [])
  return <div className="modal-backdrop office-options-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={ref} className="modal office-options" role="dialog" aria-modal="true" aria-label={text.options} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
      if (event.key === 'Tab') {
        const fields = [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select') ?? [])]
        const first = fields[0], last = fields.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }}>
      <h2>{text.options}</h2>
      {editing && <label><input type="checkbox" checked={edit} onChange={event => setEdit(event.target.checked)} />{text.spelling}</label>}
      {reading && <label><input type="checkbox" checked={read} onChange={event => setRead(event.target.checked)} />{text.darkPage}</label>}
      <label><input type="checkbox" disabled={!loaded} checked={preferences.autoSaveDefault} onChange={event => setPreferences(value => ({ ...value, autoSaveDefault: event.target.checked }))} />{text.autoSave}</label>
      <label>{text.theme}<select disabled={!loaded} value={preferences.theme} onChange={event => setPreferences(value => ({ ...value, theme: event.target.value as typeof value.theme }))}>
        {(['system', 'light', 'dark'] as const).map(value => <option key={value} value={value}>{text[value]}</option>)}
      </select></label>
      <button type="button" onClick={() => { void window.fridayOffice?.command('default-apps') }}>{text.defaultApps}</button>
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>{text.cancel}</button>
        <button type="button" className="primary" disabled={!loaded} onClick={async () => {
          try { await window.fridayOffice?.preferences(preferences); editing?.change(edit); reading?.change(read); onClose() }
          catch { setError(text.failed) }
        }}>{text.apply}</button>
      </div>
    </div>
  </div>
}
