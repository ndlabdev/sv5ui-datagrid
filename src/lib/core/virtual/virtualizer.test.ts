import { describe, expect, it } from 'vitest'
import { Virtualizer } from './virtualizer.svelte.js'

function createVirtualizer(count: number, options: { overscan?: number } = {}) {
    return new Virtualizer({
        getCount: () => count,
        rowHeight: 40,
        overscan: options.overscan ?? 5,
        initialRows: 20
    })
}

describe('Virtualizer', () => {
    it('falls back to initialRows before the viewport is measured (SSR)', () => {
        const virtualizer = createVirtualizer(100_000)
        expect(virtualizer.range).toEqual({ start: 0, end: 20 })
    })

    it('caps the SSR fallback at the row count', () => {
        const virtualizer = createVirtualizer(7)
        expect(virtualizer.range).toEqual({ start: 0, end: 7 })
    })

    it('returns an empty range when there are no rows', () => {
        const virtualizer = createVirtualizer(0)
        virtualizer.viewportHeight = 400
        virtualizer.scrollTop = 1000
        expect(virtualizer.range).toEqual({ start: 0, end: 0 })
    })

    it('computes the visible window plus overscan at the top', () => {
        const virtualizer = createVirtualizer(100_000)
        virtualizer.viewportHeight = 400

        expect(virtualizer.range).toEqual({ start: 0, end: 15 })
    })

    it('computes the window around the scroll position', () => {
        const virtualizer = createVirtualizer(100_000)
        virtualizer.viewportHeight = 400
        virtualizer.scrollTop = 4000

        expect(virtualizer.range).toEqual({ start: 95, end: 115 })
    })

    it('clamps the window at the end of the list', () => {
        const virtualizer = createVirtualizer(100)
        virtualizer.viewportHeight = 400
        virtualizer.scrollTop = 100 * 40

        expect(virtualizer.range.end).toBe(100)
        expect(virtualizer.range.start).toBeLessThanOrEqual(100)
    })

    it('keeps the whole list rendered when it fits the viewport', () => {
        const virtualizer = createVirtualizer(5)
        virtualizer.viewportHeight = 400

        expect(virtualizer.range).toEqual({ start: 0, end: 5 })
    })

    it('derives totalHeight and offsetY from the range', () => {
        const virtualizer = createVirtualizer(1000)
        virtualizer.viewportHeight = 400
        virtualizer.scrollTop = 4000

        expect(virtualizer.totalHeight).toBe(40_000)
        expect(virtualizer.offsetY).toBe(virtualizer.range.start * 40)
    })

    it('maps a row index to its scroll offset, clamped to the list', () => {
        const virtualizer = createVirtualizer(100)
        expect(virtualizer.indexToOffset(10)).toBe(400)
        expect(virtualizer.indexToOffset(-5)).toBe(0)
        expect(virtualizer.indexToOffset(10_000)).toBe(99 * 40)
    })

    it('writes scrollTop directly when requestAnimationFrame is unavailable', () => {
        const virtualizer = createVirtualizer(100)
        virtualizer.onScroll(1234)
        expect(virtualizer.scrollTop).toBe(1234)
    })

    it('supports variable row heights through the layout', () => {
        const heights = [40, 80, 40, 120, 40]
        const virtualizer = new Virtualizer({
            getCount: () => heights.length,
            getRowHeight: (index) => heights[index],
            overscan: 0,
            initialRows: 20
        })
        virtualizer.viewportHeight = 100

        expect(virtualizer.totalHeight).toBe(320)
        expect(virtualizer.sizeOf(3)).toBe(120)
        expect(virtualizer.indexToOffset(3)).toBe(160)

        virtualizer.scrollTop = 160
        expect(virtualizer.range).toEqual({ start: 3, end: 4 })
        expect(virtualizer.offsetY).toBe(160)
    })
})
