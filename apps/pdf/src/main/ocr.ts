/**
 * System-OCR bridge for the pdf viewer (issue #119): recognizes one rendered
 * page image via the platform helper binaries shared with pdf2docx
 * (macOS Vision / Windows.Media.Ocr). Same helper-path resolution as the
 * shell's pdf2docx-local.ts — packaged under Resources/ocr, repo-relative in
 * dev. Linux (or a build without the helper) resolves to no engine and the
 * viewer keeps today's behavior.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import type { PdfOcrLine } from '../shared/ipc'

let ocrHelper: string | null | undefined

function ensureOcrHelper(): string | null {
  if (ocrHelper !== undefined) return ocrHelper
  if (!['win32', 'darwin'].includes(process.platform)) return null
  const here = dirname(fileURLToPath(import.meta.url))
  const helper = process.platform === 'darwin' ? 'vision-ocr' : 'win-ocr.exe'
  const candidates = [
    ...(process.resourcesPath ? [join(process.resourcesPath, 'ocr', helper)] : []),
    join(here, '../ocr', helper),
    join(here, '../../../../packages/pdf2docx/ocr-helper', helper),
  ]
  ocrHelper = candidates.find(candidate => existsSync(candidate)) ?? null
  return ocrHelper
}

/** PNG (base64) → OCR lines; null only when the platform has no engine (callers
    stop trying), [] when recognition failed for this image (callers move on) */
export async function ocrPagePng(pngBase64: string, signal?: AbortSignal): Promise<PdfOcrLine[] | null> {
  const helper = ensureOcrHelper()
  if (!helper) return null
  let png: Uint8Array
  try {
    png = Uint8Array.from(Buffer.from(pngBase64, 'base64'))
  } catch {
    return []
  }
  // 主进程不能同步等待每页 OCR；识别大扫描件时窗口、剪贴板与其他文档仍可交互。
  const output = await new Promise<string | null>((resolve, reject) => {
    const child = execFile(helper, [], { windowsHide: true, timeout: 30000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', ...(signal ? { signal } : {}) }, (error, stdout) => {
      if (error) { if (error.code === 4) resolve(null); else reject(new Error('PDF_OCR_FAILED')) }
      else resolve(stdout)
    })
    child.stdin?.on('error', () => {})
    child.stdin?.end(png)
  })
  if (output === null) return null
  const result = JSON.parse(output.replace(/^\uFEFF/, '')) as { lines?: { t: string; c: number; b: [number, number, number, number]; chars?: { t: string; b: [number, number, number, number] }[] }[] }
  if (!Array.isArray(result.lines)) throw new Error('PDF_OCR_FAILED')
  return result.lines.map((l) => ({
    text: l.t,
    confidence: l.c,
    box: l.b,
    ...(l.chars
      ? {
          chars: l.chars.map((c) => ({
            text: c.t,
            box: c.b,
          })),
        }
      : {}),
  }))
}
