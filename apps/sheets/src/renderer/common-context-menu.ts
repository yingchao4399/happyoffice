import { IUndoRedoService, RedoCommand, UndoCommand } from '@univerjs/core'
import { SelectAllCommand } from '@univerjs/sheets-ui'
import { ContextMenuGroup, ContextMenuPosition, IMenuManagerService, MenuItemType, type MenuSchemaType } from '@univerjs/ui'
import { map } from 'rxjs'
import { t } from './i18n/locale'
import type { UniverRuntime } from './univer-state'

/** 扩展 Univer 原菜单；复用原命令、历史服务和选择模型，不创建第二套表格菜单。 */
export function installCommonContextMenu(runtime: UniverRuntime): void {
  const injector = runtime.univer.__getInjector()
  const history = injector.get(IUndoRedoService)
  const group: MenuSchemaType = {
    [SelectAllCommand.id]: {
      order: 20,
      menuItemFactory: () => ({
        id: SelectAllCommand.id, type: MenuItemType.BUTTON, title: t('appSelectAll'),
        params: { expandToGapFirst: false, loop: false },
      }),
    },
    'ui.operation.open-find-dialog': {
      order: 21,
      menuItemFactory: () => ({
        id: 'ui.operation.open-find-dialog', type: MenuItemType.BUTTON, title: t('appFind'),
      }),
    },
    [UndoCommand.id]: {
      order: 22,
      menuItemFactory: () => ({
        id: UndoCommand.id, type: MenuItemType.BUTTON, title: t('appUndo'),
        disabled$: history.undoRedoStatus$.pipe(map(({ undos }) => undos === 0)),
      }),
    },
    [RedoCommand.id]: {
      order: 23,
      menuItemFactory: () => ({
        id: RedoCommand.id, type: MenuItemType.BUTTON, title: t('appRedo'),
        disabled$: history.undoRedoStatus$.pipe(map(({ redos }) => redos === 0)),
      }),
    },
  }
  injector.get(IMenuManagerService).mergeMenu(Object.fromEntries(
    [ContextMenuPosition.MAIN_AREA, ContextMenuPosition.ROW_HEADER, ContextMenuPosition.COL_HEADER]
      .map((position) => [position, { [ContextMenuGroup.OTHERS]: group }]),
  ))
}
