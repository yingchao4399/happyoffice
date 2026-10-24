import type { PrintJobSettings as Settings } from '@genoffice/electron-utils/print-job-settings'
import './print-job-settings.css'

const strings = {
  zh: { settings: '打印设置', copies: '份数', color: '颜色', fullColor: '彩色', grayscale: '黑白', sides: '单双面',
    simplex: '单面打印', longEdge: '双面 · 长边翻转', shortEdge: '双面 · 短边翻转', collate: '逐份打印',
    system: '打印机、纸张和驱动参数可在下一步系统打印窗口调整；双面功能取决于打印机支持。',
    unavailable: '当前系统不支持此打印方式。', missing: '打印组件缺失。请修复安装后重试。',
    timeout: '系统打印响应超时。请关闭未完成的打印窗口并重试。',
    failed: '系统打印失败。请检查打印机连接、驱动和打印队列后重试。', invalid: '打印参数无效。请检查份数和页面范围。' },
  en: { settings: 'Print settings', copies: 'Copies', color: 'Color', fullColor: 'Color', grayscale: 'Grayscale', sides: 'Sides',
    simplex: 'One-sided', longEdge: 'Two-sided · long edge', shortEdge: 'Two-sided · short edge', collate: 'Collate',
    system: 'Choose a printer, paper and driver options in the next system dialog. Duplex requires a compatible printer.',
    unavailable: 'This printing method is unavailable on this system.', missing: 'The print component is missing. Repair the installation and try again.',
    timeout: 'System printing timed out. Close pending print dialogs and try again.',
    failed: 'System printing failed. Check the printer connection, driver and queue, then try again.', invalid: 'Invalid print settings. Check copies and page ranges.' },
}
export const printJobText = (lang: string) => strings[lang.startsWith('zh') ? 'zh' : 'en']
export function printFailureText(lang: string, reason: string): string {
  const text = printJobText(lang)
  return ({ WINDOWS_PRINT_UNAVAILABLE: text.unavailable, WINDOWS_PRINT_HELPER_MISSING: text.missing,
    WINDOWS_PRINT_TIMEOUT: text.timeout, WINDOWS_PRINT_FAILED: text.failed, INVALID_PRINT_SETTINGS: text.invalid,
    INVALID_PRINT_PAGE_SIZE: text.invalid } as Record<string, string>)[reason] ?? reason
}
export function PrintJobSettings({ lang, value, onChange, disabled = false }: {
  lang: string; value: Settings; onChange: (value: Settings) => void; disabled?: boolean
}) {
  const text = printJobText(lang)
  return <fieldset className="office-print-job" disabled={disabled}>
    <legend>{text.settings}</legend>
    <label><span>{text.copies}</span><input type="number" min="1" max="999" step="1" value={value.copies}
      onChange={event => onChange({ ...value, copies: Math.max(1, Math.min(999, Math.trunc(Number(event.target.value)) || 1)) })} /></label>
    <label><span>{text.color}</span><select value={String(value.color)} onChange={event => onChange({ ...value, color: event.target.value === 'true' })}>
      <option value="true">{text.fullColor}</option><option value="false">{text.grayscale}</option></select></label>
    <label><span>{text.sides}</span><select value={value.duplexMode} onChange={event => onChange({ ...value, duplexMode: event.target.value as Settings['duplexMode'] })}>
      <option value="simplex">{text.simplex}</option><option value="longEdge">{text.longEdge}</option><option value="shortEdge">{text.shortEdge}</option></select></label>
    <label className="office-print-check"><input type="checkbox" checked={value.collate} onChange={event => onChange({ ...value, collate: event.target.checked })} /><span>{text.collate}</span></label>
    <p className="office-print-help">{text.system}</p>
  </fieldset>
}
