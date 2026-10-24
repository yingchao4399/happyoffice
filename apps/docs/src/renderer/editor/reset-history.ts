import type { Editor } from '@tiptap/core'

/**
 * 换文档时清空撤销记录，并保留其他插件状态。先在内存里去掉再加入
 * history，最后只更新一次视图，避免注销、注册分别重建所有布局插件。
 */
export function resetEditorHistory(editor: Editor): void {
  const plugins = editor.state.plugins
  const history = plugins.find((plugin) =>
    String((plugin as unknown as { key: string }).key).startsWith('history$'),
  )
  if (!history) return
  const withoutHistory = editor.state.reconfigure({
    plugins: plugins.filter((plugin) => plugin !== history),
  })
  editor.view.updateState(withoutHistory.reconfigure({ plugins }))
}
