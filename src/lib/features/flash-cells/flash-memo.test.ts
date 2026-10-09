import { describe, expect, it } from 'vitest'
import { cellKey, emptyMemo, flashesBetween, remember, wayBetween } from './flash-memo.js'

const seen = (pairs: [string, unknown][]) =>
    pairs.map(([key, value]) => ({ key: cellKey('r1', key), value }))

const keysOf = (found: { key: string }[]) => found.map((one) => one.key)

describe('what counts as a cell having changed', () => {
    it('reports nothing on the first pass, having witnessed nothing', () => {
        expect(flashesBetween(emptyMemo(), seen([['a', 1]]), true)).toEqual([])
    })

    it('reports a cell whose remembered value differs', () => {
        const before = remember(seen([['a', 1]]))
        const found = flashesBetween(before, seen([['a', 2]]), true)

        expect(keysOf(found)).toEqual([cellKey('r1', 'a')])
        expect(found[0]!.way).toBe('up')
    })

    it('says nothing about a cell whose value held', () => {
        const before = remember(seen([['a', 1]]))
        expect(flashesBetween(before, seen([['a', 1]]), true)).toEqual([])
    })

    it('stays silent on a cell it has no previous value for', () => {
        const before = remember(seen([['a', 1]]))
        expect(flashesBetween(before, seen([['b', 9]]), true)).toEqual([])
    })

    it('treats a value going missing as a change, not as an absence', () => {
        const before = remember(seen([['a', 1]]))
        const found = flashesBetween(before, seen([['a', undefined]]), true)

        expect(keysOf(found)).toEqual([cellKey('r1', 'a')])
        expect(found[0]!.way).toBe('changed')
    })

    it('does not report a cell that merely stopped being on screen', () => {
        const before = remember(
            seen([
                ['a', 1],
                ['b', 2]
            ])
        )
        expect(flashesBetween(before, seen([['a', 1]]), true)).toEqual([])
    })

    it('tells two zeros apart from nothing, and minus zero from zero', () => {
        expect(flashesBetween(remember(seen([['a', 0]])), seen([['a', 0]]), true)).toEqual([])
        expect(flashesBetween(remember(seen([['a', 0]])), seen([['a', -0]]), true).length).toBe(1)
    })

    it('reports a change between two values that are not numbers', () => {
        const found = flashesBetween(remember(seen([['a', 'x']])), seen([['a', 'y']]), true)
        expect(found[0]!.way).toBe('changed')
    })
})

describe('which way a change went', () => {
    it('reads a rise and a fall off two numbers', () => {
        expect(wayBetween(1, 2, true)).toBe('up')
        expect(wayBetween(2, 1, true)).toBe('down')
    })

    it('refuses a direction where one side is not a number', () => {
        expect(wayBetween(undefined, 2, true)).toBe('changed')
        expect(wayBetween(1, 'two', true)).toBe('changed')
        expect(wayBetween(null, null, true)).toBe('changed')
    })

    it('refuses a direction across a NaN, which compares false either way', () => {
        expect(wayBetween(Number.NaN, 2, true)).toBe('changed')
        expect(wayBetween(1, Number.NaN, true)).toBe('changed')
    })

    it('gives no direction at all when the option is off', () => {
        expect(wayBetween(1, 2, false)).toBe('changed')
        expect(wayBetween(2, 1, false)).toBe('changed')
    })
})

describe('the memo is the size of the window, not of the data', () => {
    it('holds only what the last pass saw', () => {
        const first = remember(
            seen([
                ['a', 1],
                ['b', 2],
                ['c', 3]
            ])
        )
        expect(first.size).toBe(3)

        const second = remember(seen([['a', 1]]))
        expect(second.size).toBe(1)
        expect(second.has(cellKey('r1', 'b'))).toBe(false)
    })

    it('keys a cell by its row and its column, not by position', () => {
        expect(cellKey('r1', 'a')).not.toBe(cellKey('r2', 'a'))
        expect(cellKey('r1', 'a')).not.toBe(cellKey('r1', 'b'))
    })

    it('keeps two rows apart whose ids would otherwise run together', () => {
        expect(cellKey('a', 'bc')).not.toBe(cellKey('ab', 'c'))
    })
})
