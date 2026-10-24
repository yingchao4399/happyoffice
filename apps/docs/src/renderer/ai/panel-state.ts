// 首次文档布局只需要面板宽度，无需同步加载 Agent、工具和聊天界面。
export const PANEL_WIDTH_KEY = 'docs-ai-panel-width'
const PANEL_WIDTH_DEFAULT = 360
const PANEL_WIDTH_MIN = 280

export function clampPanelWidth(width: number): number {
  const ceiling = Math.max(PANEL_WIDTH_MIN, Math.min(720, Math.round(window.innerWidth * 0.6)))
  return Math.min(Math.max(width, PANEL_WIDTH_MIN), ceiling)
}

export function loadPanelWidth(): number {
  const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY))
  return Number.isFinite(saved) && saved > 0
    ? Math.min(Math.max(saved, PANEL_WIDTH_MIN), 720)
    : PANEL_WIDTH_DEFAULT
}

export function initialAiPanelWidth(): number {
  return clampPanelWidth(loadPanelWidth())
}

export const AI_REVISION_AUTHOR = 'AI Assistant'
