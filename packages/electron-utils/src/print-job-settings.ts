/** 打印任务的可序列化白名单；渲染进程不能传静默打印或任意设备/文件路径。 */
export interface PrintJobSettings {
  copies: number
  color: boolean
  collate: boolean
  duplexMode: 'simplex' | 'longEdge' | 'shortEdge'
}
export const DEFAULT_PRINT_JOB: PrintJobSettings = { copies: 1, color: true, collate: true, duplexMode: 'simplex' }

export function parsePrintJobSettings(value: unknown): PrintJobSettings {
  if (value === undefined) return { ...DEFAULT_PRINT_JOB }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_PRINT_SETTINGS')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !['copies', 'color', 'collate', 'duplexMode'].includes(key))) throw new Error('INVALID_PRINT_SETTINGS')
  const result = { ...DEFAULT_PRINT_JOB, ...input }
  if (!Number.isInteger(result.copies) || result.copies < 1 || result.copies > 999 ||
    typeof result.color !== 'boolean' || typeof result.collate !== 'boolean' ||
    !['simplex', 'longEdge', 'shortEdge'].includes(result.duplexMode)) throw new Error('INVALID_PRINT_SETTINGS')
  return result as PrintJobSettings
}
