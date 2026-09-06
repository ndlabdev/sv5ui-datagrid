import { describe, expect, it } from 'vitest'
import {
    blockBounds,
    blockOf,
    blocksFor,
    blocksIn,
    blocksToEvict,
    totalFromShortBlock
} from './blocks.js'

describe('block arithmetic', () => {
    it('maps rows to blocks and back', () => {
        expect(blockOf(0, 100)).toBe(0)
        expect(blockOf(99, 100)).toBe(0)
        expect(blockOf(100, 100)).toBe(1)
        expect(blockBounds(2, 100)).toEqual({ start: 200, end: 300 })
    })

    it('covers a row range inclusively at both ends', () => {
        expect(blocksFor(0, 100, 100)).toEqual({ start: 0, end: 0 })
        expect(blocksFor(0, 101, 100)).toEqual({ start: 0, end: 1 })
        expect(blocksFor(250, 460, 100)).toEqual({ start: 2, end: 4 })
        expect(blocksIn({ start: 2, end: 4 })).toEqual([2, 3, 4])
    })

    it('never asks for a negative block on an empty range', () => {
        expect(blocksFor(0, 0, 100)).toEqual({ start: 0, end: 0 })
    })
})

describe('eviction', () => {
    const keep = { start: 5, end: 6 }

    it('keeps everything while under budget', () => {
        expect(blocksToEvict([1, 5, 6], keep, 20)).toEqual([])
    })

    it('drops the blocks furthest from the viewport first', () => {
        const evicted = blocksToEvict([0, 4, 5, 6, 7, 20], keep, 4)
        expect(evicted).toEqual([20, 0])
    })

    it('never evicts a block the viewport is sitting on', () => {
        const evicted = blocksToEvict([5, 6], keep, 1)
        expect(evicted).toEqual([])
    })
})

describe('discovering the end', () => {
    it('reads the total from a short block', () => {
        expect(totalFromShortBlock(3, 40, 100)).toBe(340)
    })

    it('stays unknown while blocks come back full', () => {
        expect(totalFromShortBlock(3, 100, 100)).toBeNull()
    })

    it('treats an empty block as the end', () => {
        expect(totalFromShortBlock(4, 0, 100)).toBe(400)
    })
})
