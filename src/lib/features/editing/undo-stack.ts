import type { EditTransaction } from '../../core/types.js'

/**
 * One undoable edit. `before` restores the prior values, `after`
 * re-applies the change. A row-mode edit spans several columns in one
 * command so it undoes atomically.
 */
export interface UndoCommand {
    before: EditTransaction
    after: EditTransaction
}

export interface UndoState {
    stack: UndoCommand[]
    /** Index one past the last applied command. */
    cursor: number
}

export function emptyUndo(): UndoState {
    return { stack: [], cursor: 0 }
}

/** Pushes a command, truncating any redo branch ahead of the cursor. */
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

/** Returns the command to reverse and the state with the cursor moved back. */
export function undo(state: UndoState): { command: UndoCommand; state: UndoState } | null {
    if (!canUndo(state)) return null
    const cursor = state.cursor - 1
    return { command: state.stack[cursor], state: { ...state, cursor } }
}

/** Returns the command to re-apply and the state with the cursor moved forward. */
export function redo(state: UndoState): { command: UndoCommand; state: UndoState } | null {
    if (!canRedo(state)) return null
    const command = state.stack[state.cursor]
    return { command, state: { ...state, cursor: state.cursor + 1 } }
}
