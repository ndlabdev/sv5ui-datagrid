import { describe, expect, it } from 'vitest'
import { prefixSums } from '../columns/column-sizing.js'
import { ColumnVirtualizer } from './column-virtualizer.svelte.js'

const widths = Array.from({ length: 20 }, () => 120)
const offsets = prefixSums(widths)

function createVirtualizer(overscanPx = 0) {
    return new ColumnVirtualizer({ getOffsets: () => offsets, overscanPx })
}

describe('ColumnVirtualizer', () => {
    it('renders all columns before the viewport is measured', () => {
        const virtualizer = createVirtualizer()
        expect(virtualizer.range).toEqual({ start: 0, end: 20 })
    })

    it('windows columns intersecting the horizontal viewport', () => {
        const virtualizer = createVirtualizer()
        virtualizer.viewportWidth = 600

        expect(virtualizer.range).toEqual({ start: 0, end: 5 })

        virtualizer.scrollLeft = 1200
        expect(virtualizer.range).toEqual({ start: 10, end: 15 })
    })

    it('includes partially visible columns at both edges', () => {
        const virtualizer = createVirtualizer()
        virtualizer.viewportWidth = 600
        virtualizer.scrollLeft = 60

        expect(virtualizer.range).toEqual({ start: 0, end: 6 })
    })

    it('extends the window by overscanPx on both sides', () => {
        const virtualizer = createVirtualizer(240)
        virtualizer.viewportWidth = 600
        virtualizer.scrollLeft = 1200

        expect(virtualizer.range).toEqual({ start: 8, end: 17 })
    })

    it('clamps at the end of the column list', () => {
        const virtualizer = createVirtualizer()
        virtualizer.viewportWidth = 600
        virtualizer.scrollLeft = 100_000

        expect(virtualizer.range.end).toBe(20)
        expect(virtualizer.range.start).toBeLessThanOrEqual(20)
    })

    it('returns clamped column offsets', () => {
        const virtualizer = createVirtualizer()
        expect(virtualizer.offsetOf(0)).toBe(0)
        expect(virtualizer.offsetOf(10)).toBe(1200)
        expect(virtualizer.offsetOf(999)).toBe(offsets[19])
    })

    it('handles an empty column list', () => {
        const virtualizer = new ColumnVirtualizer({ getOffsets: () => [0] })
        virtualizer.viewportWidth = 600
        expect(virtualizer.range).toEqual({ start: 0, end: 0 })
    })
})
