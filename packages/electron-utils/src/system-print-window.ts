import { BrowserWindow } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'

const ownerLocks = new WeakMap<BrowserWindow, { count: number; wasEnabled: boolean }>()

/** 原生子进程和 Electron 打印窗口共享锁；最后一项打印完成后恢复输入。 */
export function lockSystemPrintOwner(owner?: BrowserWindow | null): () => void {
  if (!owner || owner.isDestroyed()) return () => {}
  let lock = ownerLocks.get(owner)
  if (!lock) {
    lock = { count: 0, wasEnabled: owner.isEnabled() }
    ownerLocks.set(owner, lock)
  }
  lock.count++
  owner.setEnabled(false)
  let released = false
  return () => {
    if (released) return
    released = true
    if (--lock.count > 0) return
    ownerLocks.delete(owner)
    if (!owner.isDestroyed() && lock.wasEnabled) {
      owner.setEnabled(true)
      owner.focus()
    }
  }
}

/** Windows 打印窗口独立出现在任务栏，原生打印和保存框始终附着于该窗口。 */
export function createSystemPrintWindow(
  owner: BrowserWindow | null | undefined,
  options: BrowserWindowConstructorOptions,
): BrowserWindow {
  const window = new BrowserWindow({
    ...options,
    show: false,
    ...(process.platform === 'win32'
      ? { width: 900, height: 700, autoHideMenuBar: true, closable: false, skipTaskbar: false }
      : {}),
  })
  if (process.platform !== 'win32' || !owner || owner.isDestroyed()) return window

  // 使用独立的顶层窗口，避免 WebContentsView → 隐藏 owner → 系统对话框的多层
  // 所属关系。打印期间仍阻止原文档接受编辑；并发打印最后一个结束后才恢复。
  let release = () => {}
  const ownerClosed = () => { if (!window.isDestroyed()) window.destroy() }
  owner.once('closed', ownerClosed)
  window.once('show', () => {
    if (owner.isDestroyed()) return
    release = lockSystemPrintOwner(owner)
  })
  window.once('closed', () => {
    owner.removeListener('closed', ownerClosed)
    release()
  })
  return window
}
