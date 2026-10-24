import type { ActionCtx } from './action-context'

/** 菜单和键盘共用选择规则，排除装饰、背景和占位提示。 */
export function selectAllElements(ctx: ActionCtx): void {
  const ids = (ctx.slide?.nodes ?? [])
    .filter((node) => !node.decoration && !node.background && node.type !== 'placeholder-chip')
    .map((node) => node.sourceId)
  ctx.setSelectedIds(ids)
}
