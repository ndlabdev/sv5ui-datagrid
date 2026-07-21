import { describe, expect, it } from 'vitest'
import {
    canRedo,
    canUndo,
    emptyUndo,
    pushCommand,
    redo,
    undo,
    type UndoCommand
} from './undo-stack.js'

function cmd(id: string, before: unknown, after: unknown): UndoCommand {
    return {
        before: { rowId: id, changes: { v: before } },
        after: { rowId: id, changes: { v: after } }
    }
}

describe('undo-stack', () => {
    it('pushes commands and tracks undo/redo availability', () => {
        let state = emptyUndo()
        expect(canUndo(state)).toBe(false)
        state = pushCommand(state, cmd('1', 'a', 'b'))
        expect(canUndo(state)).toBe(true)
        expect(canRedo(state)).toBe(false)
    })

    it('walks the cursor back and forward through undo/redo', () => {
        let state = pushCommand(pushCommand(emptyUndo(), cmd('1', 'a', 'b')), cmd('2', 'x', 'y'))

        const u1 = undo(state)!
        expect(u1.command.before.changes).toEqual({ v: 'x' })
        state = u1.state
        expect(canRedo(state)).toBe(true)

        const r1 = redo(state)!
        expect(r1.command.after.changes).toEqual({ v: 'y' })
        state = r1.state
        expect(canRedo(state)).toBe(false)
    })

    it('truncates the redo branch when a new command is pushed after undo', () => {
        let state = pushCommand(pushCommand(emptyUndo(), cmd('1', 'a', 'b')), cmd('2', 'x', 'y'))
        state = undo(state)!.state
        state = pushCommand(state, cmd('3', 'p', 'q'))

        expect(state.stack).toHaveLength(2)
        expect(canRedo(state)).toBe(false)
        expect(state.stack[1].after.changes).toEqual({ v: 'q' })
    })

    it('returns null at the ends of the stack', () => {
        expect(undo(emptyUndo())).toBeNull()
        expect(redo(emptyUndo())).toBeNull()
    })
})
