/**
 * IPC interface type definitions (shared by the renderer and main processes).
 * No Electron dependency; importable from the renderer.
 */
import type {
  ChatAttachment,
  ChatMessage,
  ChatMeta,
  ChatScope,
  ProjectSummary,
  TimelineEntry,
  ToolActivity,
} from './types.js'

export type {
  ChatAttachment,
  ChatMessage,
  ChatMeta,
  ChatScope,
  ProjectSummary,
  TimelineEntry,
  ToolActivity,
}

export interface AppendChatArgs {
  projectId: string
  chatId: string
  role: 'user' | 'assistant'
  text: string
  tools?: ToolActivity[]
  attachments?: ChatAttachment[]
  scope?: ChatScope
}

export interface LoadChatArgs {
  projectId: string
  chatId: string
  limit?: number
}

export interface ResolveChatArgs {
  /** Absolute path of the currently open file; null means an unsaved new file */
  filePath: string | null
  /** Temp chatId for unsaved files, e.g. "unsaved-<timestamp>" */
  tempChatId?: string
  /** Sheets mode: look up the file path by sessionId (handled in the main process) */
  sessionId?: string
}

export interface ResolveChatResult {
  projectId: string
  chatId: string
}

export interface FileChatArgs {
  /** Absolute path of the open file; null for an unsaved document. */
  filePath: string | null
  /** Sheets mode: the main process resolves the path from its workbook session. */
  sessionId?: string
  /** Temporary chat id used when no file path exists. */
  tempChatId?: string
}

export interface SelectChatForFileArgs extends FileChatArgs {
  chatId: string
}

export interface UpdateChatForFileArgs extends SelectChatForFileArgs {
  patch: {
    title?: string | null
    pinned?: boolean
    archived?: boolean
    deleted?: boolean
  }
}

export interface RebindChatArgs {
  projectId: string
  tempChatId: string
  /** Specify the new chatId directly; one of newChatId / newFilePath / sessionId */
  newChatId?: string
  /** File path where the unsaved session first hit disk: the main process derives the chatId from it and registers fileMap */
  newFilePath?: string
  /** Sheets mode: the renderer can't get the path, so it passes sessionId for the main process to look up and rebind */
  sessionId?: string
}

/** Project storage API the main process exposes to the renderer */
export interface ProjectApi {
  /**
   * Resolves projectId and chatId from a file path.
   * When filePath is null, returns the default project + tempChatId (if provided).
   */
  resolveChat(args: ResolveChatArgs): Promise<ResolveChatResult>
  /** Appends one message to the JSONL */
  appendChat(args: AppendChatArgs): Promise<void>
  /** Reads the most recent `limit` messages */
  loadChat(args: LoadChatArgs): Promise<ChatMessage[]>
  /** Lists the persisted sessions belonging to one file, newest first. */
  listChatsForFile(args: FileChatArgs): Promise<ChatMeta[]>
  /** Creates and activates a separate session for one file or unsaved document. */
  createChat(args: FileChatArgs): Promise<ResolveChatResult>
  /** Selects a persisted session for one file so it resumes on the next open. */
  selectChatForFile(args: SelectChatForFileArgs): Promise<ResolveChatResult>
  /** Renames, pins, archives, deletes or restores a session without removing its messages. */
  updateChatForFile(args: UpdateChatForFileArgs): Promise<ResolveChatResult>
  /** Renames the JSONL file (called after the file first hits disk); returns the new projectId/chatId */
  rebindChat(args: RebindChatArgs): Promise<ResolveChatResult>
}
