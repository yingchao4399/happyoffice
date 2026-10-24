export interface OfficeFileResult {
  ok: boolean
  cancelled?: boolean
  data?: { path?: string; bytes?: number }
  warnings?: string[]
  error?: { code: string; message?: string; path?: string; recoverable: boolean } | null
}

export interface OfficeFileBridge {
  exportSelectionText(request: { text: string }): Promise<OfficeFileResult>
  snapshot(request?: unknown): Promise<Uint8Array>
  exportSnapshot(request: { format: string; bytes: Uint8Array; html?: string; plainText?: string; pages?: { pngBase64: string; notes: string }[] }): Promise<OfficeFileResult>
  cancelExport(): Promise<OfficeFileResult>
  command(command: 'new' | 'open' | 'saveAs' | 'close' | 'information' | 'default-apps'): Promise<OfficeFileResult>
  preferences(patch?: { autoSaveDefault?: boolean; theme?: 'light' | 'dark' | 'system' }): Promise<{ autoSaveDefault: boolean; theme: 'light' | 'dark' | 'system' }>
}

// 所有编辑器共用受限 IPC 接口，不暴露任意路径写入或任意主进程调用。
export function installOfficeFileBridge(
  bridge: { exposeInMainWorld(name: string, api: unknown): void },
  ipc: { invoke(channel: string, ...args: unknown[]): Promise<unknown> },
): void {
  bridge.exposeInMainWorld('fridayOffice', {
    exportSelectionText: (request: unknown) => ipc.invoke('office-file-export-selection-text', request),
    snapshot: (request?: unknown) => ipc.invoke('office-file-current-snapshot', request),
    exportSnapshot: (request: unknown) => ipc.invoke('office-file-export-snapshot', request),
    cancelExport: () => ipc.invoke('office-file-cancel-export'),
    command: (command: string) => ipc.invoke('office-file-command', command),
    preferences: (patch?: unknown) => ipc.invoke('office-file-preferences', patch),
  })
}

declare global {
  interface Window { fridayOffice?: OfficeFileBridge }
}
