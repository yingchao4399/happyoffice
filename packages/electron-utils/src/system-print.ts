import { BrowserWindow } from 'electron'
import type { WebContents, WebContentsPrintOptions } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lockSystemPrintOwner } from './system-print-window'

export interface SystemPrintResult { success: boolean; failureReason: string }

function helperPath(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url))
  return [
    join(here, '../native/system-print.exe'),
    join(here, '../../../../packages/electron-utils/native/system-print.exe'),
    ...(process.resourcesPath ? [join(process.resourcesPath, 'office/native/system-print.exe'), join(process.resourcesPath, 'native/system-print.exe')] : []),
  ].find(candidate => existsSync(candidate))
}

const paperSizes: Record<string, [number, number]> = {
  A0:[841000,1189000], A1:[594000,841000], A2:[420000,594000], A3:[297000,420000],
  A4:[210000,297000], A5:[148000,210000], A6:[105000,148000],
  Letter:[215900,279400], Legal:[215900,355600], Tabloid:[279400,431800], Ledger:[279400,431800],
}

/** 与 Electron print 一致，尺寸为微米；仅供可信主进程调用。 */
export function systemPrintPaperSize(size: WebContentsPrintOptions['pageSize']): { width: number; height: number } | undefined {
  if (!size) return undefined
  const pair = typeof size === 'string' ? paperSizes[size] : [size.width, size.height]
  if (!pair || pair.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('INVALID_PRINT_PAGE_SIZE')
  return { width: Math.round(Math.min(...pair)), height: Math.round(Math.max(...pair)) }
}

/** Windows 原生对话框使用本次任务的 DEVMODE，避免 Chromium 覆盖方向与纸张。 */
export async function printPdfFileWithSystemDialog(
  pdfPath: string,
  options: WebContentsPrintOptions = {},
  owner?: BrowserWindow | null,
): Promise<SystemPrintResult> {
  if (process.platform !== 'win32') return { success: false, failureReason:'WINDOWS_PRINT_UNAVAILABLE' }
  if (owner?.isDestroyed()) return { success:false, failureReason:'Print job canceled' }
  const helper = helperPath()
  if (!helper) return { success:false, failureReason:'WINDOWS_PRINT_HELPER_MISSING' }
  const size = systemPrintPaperSize(options.pageSize)
  return new Promise(resolve => {
    const release = lockSystemPrintOwner(owner)
    const closed = () => child.kill()
    const child = execFile(helper, [], { windowsHide:false, timeout:15 * 60 * 1000, maxBuffer:64 * 1024, encoding:'utf8' }, (error, stdout) => {
      owner?.removeListener('closed', closed)
      release()
      try {
        const result = JSON.parse(stdout.trim()) as SystemPrintResult
        if (typeof result.success === 'boolean' && typeof result.failureReason === 'string') { resolve(result); return }
      } catch { /* 不转发服务响应、文档路径或驱动内部信息。 */ }
      resolve({ success:false, failureReason:owner?.isDestroyed() ? 'Print job canceled' : error?.killed ? 'WINDOWS_PRINT_TIMEOUT' : 'WINDOWS_PRINT_FAILED' })
    })
    owner?.once('closed', closed)
    child.stdin?.on('error', () => {})
    child.stdin?.end(JSON.stringify({
      pdfPath, title:owner && !owner.isDestroyed() ? owner.getTitle() : 'Friday',
      landscape:options.landscape, color:options.color, copies:options.copies ?? 1,
      collate:options.collate, pageRanges:options.pageRanges,
      duplexMode:options.duplexMode, paperWidth:size?.width, paperHeight:size?.height,
    }))
  })
}

/** 先用同一预览页面生成打印快照，再交给系统打印；原文档不写入、不旋转。 */
export async function printWithSystemDialog(
  contents: WebContents,
  options: WebContentsPrintOptions = {},
  owner: BrowserWindow | null = BrowserWindow.fromWebContents(contents),
): Promise<SystemPrintResult> {
  if (process.platform !== 'win32') return new Promise(resolve => contents.print(options, (success, failureReason) => resolve({ success, failureReason })))
  const workDir = await mkdtemp(join(tmpdir(), 'friday-system-print-'))
  const pdfPath = join(workDir, 'print.pdf')
  try {
    const size = systemPrintPaperSize(options.pageSize)
    const margins = options.margins
    const pdf = await contents.printToPDF({
      printBackground:options.printBackground ?? true,
      preferCSSPageSize:true,
      ...(options.landscape !== undefined ? { landscape:options.landscape } : {}),
      ...(size ? { pageSize:{ width:size.width / 25400, height:size.height / 25400 } } : {}),
      ...(options.scaleFactor ? { scale:options.scaleFactor / 100 } : {}),
      ...(margins ? { margins: margins.marginType === 'none' ? { top:0,bottom:0,left:0,right:0 } : { top:(margins.top ?? 0) / 96, bottom:(margins.bottom ?? 0) / 96, left:(margins.left ?? 0) / 96, right:(margins.right ?? 0) / 96 } } : {}),
    })
    await writeFile(pdfPath, pdf)
    return await printPdfFileWithSystemDialog(pdfPath, options, owner)
  } finally {
    // 只删除自己创建的固定文件与空目录，不递归清理目录链接。
    await unlink(pdfPath).catch(() => {})
    await rmdir(workDir).catch(() => {})
  }
}

/** 打印已授权文档的独立快照；临时文件不会覆盖源 PDF。 */
export async function printPdfBytesWithSystemDialog(
  bytes: Uint8Array,
  options: WebContentsPrintOptions = {},
  owner?: BrowserWindow | null,
): Promise<SystemPrintResult> {
  const workDir = await mkdtemp(join(tmpdir(), 'friday-pdf-print-'))
  const pdfPath = join(workDir, 'print.pdf')
  try {
    await writeFile(pdfPath, bytes)
    return await printPdfFileWithSystemDialog(pdfPath, options, owner)
  } finally {
    await unlink(pdfPath).catch(() => {})
    await rmdir(workDir).catch(() => {})
  }
}
