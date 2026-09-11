import type { EditTransaction } from '../../core/types/index.js'

export interface UndoCommand {
    before: EditTransaction[]
    after: EditTransaction[]
}

export interface UndoState {
    stack: UndoCommand[]
    cursor: number
}

export function emptyUndo(): UndoState {
    return { stack: [], cursor: 0 }
}

export function pushCommand(state: UndoState, command: UndoCommand): UndoState {
    const stack = state.stack.slice(0, state.cursor)
    stack.push(command)
    return { stack, cursor: stack.length }
}

export function canUndo(state: UndoState): boolean {
    return state.cursor > 0
}

export function canRedo(state: UndoState): boolean {
    return state.cursor < state.stack.length
}

export function undo(state: UndoState): { command: UndoCommand; state: UndoState } | null {
    if (!canUndo(state)) return null
    const cursor = state.cursor - 1
    return { command: state.stack[cursor], state: { ...state, cursor } }
}

export function redo(state: UndoState): { command: UndoCommand; state: UndoState } | null {
    if (!canRedo(state)) return null
    const command = state.stack[state.cursor]
    return { command, state: { ...state, cursor: state.cursor + 1 } }
}
