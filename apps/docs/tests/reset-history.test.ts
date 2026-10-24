import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { undoDepth, redoDepth } from '@tiptap/pm/history'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { editorExtensions } from '../src/renderer/editor/extensions'
import { resetEditorHistory } from '../src/renderer/editor/reset-history'

describe('document history boundary', () => {
  it('drops both history stacks without changing document, cursor or other plugin state', () => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: editorExtensions,
      content: { type: 'doc', content: [{ type: 'docParagraph', content: [{ type: 'text', text: 'First' }] }] },
    })
    const key = new PluginKey<{ marker: string }>('preserveDocumentState')
    let mounts = 0
    editor.registerPlugin(new Plugin({
      key,
      state: { init: () => ({ marker: 'keep' }), apply: (_tr, value) => value },
      view: () => { mounts++; return {} },
    }))
    try {
      editor.commands.insertContent(' old edit')
      expect(undoDepth(editor.state)).toBeGreaterThan(0)
      editor.commands.undo()
      expect(redoDepth(editor.state)).toBeGreaterThan(0)
      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'docParagraph', content: [{ type: 'text', text: 'Second document' }] }],
      })
      const doc = editor.state.doc
      const selection = editor.state.selection
      const pluginState = key.getState(editor.state)
      const beforeMounts = mounts
      resetEditorHistory(editor)
      expect(editor.state.doc).toBe(doc)
      expect(editor.state.selection).toBe(selection)
      expect(key.getState(editor.state)).toBe(pluginState)
      expect(undoDepth(editor.state)).toBe(0)
      expect(redoDepth(editor.state)).toBe(0)
      expect(editor.commands.undo()).toBe(false)
      expect(editor.commands.redo()).toBe(false)
      expect(mounts - beforeMounts).toBe(1)
      editor.commands.insertContent(' new edit')
      expect(editor.commands.undo()).toBe(true)
      expect(editor.state.doc.eq(doc)).toBe(true)
      expect(editor.commands.redo()).toBe(true)
      expect(editor.getText()).toContain('new edit')
    } finally { editor.destroy() }
  })
})
