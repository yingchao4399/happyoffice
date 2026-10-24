// 首页与各编辑器共享轻量文件记录；读取最近文件不应拉起 Word 引擎。
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function readList(name: string): string[] {
  try {
    const file = join(app.getPath('userData'), name)
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as string[]
  } catch { /* 沿用原最近文件记录损坏时的回退行为。 */ }
  return []
}

function writeList(name: string, paths: string[]): void {
  const file = join(app.getPath('userData'), name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(paths, null, 2))
}

export function readRecentFiles(): string[] { return readList('recent.json') }
export function readStarredFiles(): string[] { return readList('starred.json') }

export function recordRecentFile(filePath: string): boolean {
  const recent = readRecentFiles()
  if (recent[0] === filePath) return false
  writeList('recent.json', [filePath, ...recent.filter(p => p !== filePath)].slice(0, 100))
  return true
}

export function removeRecentFiles(paths: string[]): void {
  const drop = new Set(paths)
  writeList('recent.json', readRecentFiles().filter(p => !drop.has(p)))
}

export function replaceRecentFile(oldPath: string, newPath: string): void {
  writeList('recent.json', readRecentFiles().map(p => p === oldPath ? newPath : p))
  const starred = readStarredFiles()
  if (starred.includes(oldPath)) writeList('starred.json', starred.map(p => p === oldPath ? newPath : p))
}

export function toggleStarredFile(filePath: string): void {
  const starred = readStarredFiles()
  writeList('starred.json', starred.includes(filePath) ? starred.filter(p => p !== filePath) : [...starred, filePath])
}

export function removeStarredFiles(paths: string[]): void {
  const drop = new Set(paths)
  if (!drop.size) return
  const starred = readStarredFiles(), next = starred.filter(p => !drop.has(p))
  if (next.length !== starred.length) writeList('starred.json', next)
}
