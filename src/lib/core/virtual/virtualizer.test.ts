import { describe, expect, it } from 'vitest'
import { MAX_SPACER_HEIGHT, Virtualizer } from './virtualizer.svelte.js'

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

describe('lists taller than the browser will render', () => {
    /** A million rows at 40px wants 40M px; browsers clamp well below that. */
    const millionRows = () =>
        new Virtualizer({ getCount: () => 1_000_000, rowHeight: 40, overscan: 0 })

    it('keeps the spacer inside what a browser honours', () => {
        const virtualizer = millionRows()
        virtualizer.viewportHeight = 600

        expect(virtualizer.contentHeight).toBe(40_000_000)
        expect(virtualizer.totalHeight).toBeLessThanOrEqual(MAX_SPACER_HEIGHT)
        expect(virtualizer.scale).toBeGreaterThan(1)
    })

    it('reaches the last row at the bottom of the scroller', () => {
        const virtualizer = millionRows()
        virtualizer.viewportHeight = 600
        // Scrolled to the end, the way a browser reports it.
        virtualizer.scrollTop = virtualizer.totalHeight - virtualizer.viewportHeight

        // Without scaling the spacer is clamped and the run ends around row
        // 838k, stranding everything past it.
        expect(virtualizer.range.end).toBe(1_000_000)
    })

    it('leaves an ordinary list on the untouched path', () => {
        const virtualizer = new Virtualizer({ getCount: () => 100_000, rowHeight: 40, overscan: 0 })
        virtualizer.viewportHeight = 600

        expect(virtualizer.scale).toBe(1)
        expect(virtualizer.totalHeight).toBe(virtualizer.contentHeight)

        virtualizer.scrollTop = 4000
        // Scroll space and content space are the same, so the row under the
        // viewport top is exactly the one arithmetic says it is.
        expect(virtualizer.range.start).toBe(100)
        expect(virtualizer.offsetY).toBe(4000)
    })

    it('translates the rendered rows into scroll space', () => {
        const virtualizer = millionRows()
        virtualizer.viewportHeight = 600
        virtualizer.scrollTop = 1_000_000

        const { start } = virtualizer.range
        // The rows sit where the scroller expects them: their content offset
        // carried back by the difference between the two spaces.
        expect(virtualizer.offsetY).toBeCloseTo(1_000_000 + start * 40 - virtualizer.contentTop, 5)
    })

    it('scrolls to a row by its position in scroll space', () => {
        const virtualizer = millionRows()
        virtualizer.viewportHeight = 600

        const target = virtualizer.indexToOffset(999_999)
        expect(target).toBeLessThanOrEqual(virtualizer.totalHeight)

        virtualizer.scrollTop = target
        expect(virtualizer.range.start).toBeLessThanOrEqual(999_999)
        expect(virtualizer.range.end).toBeGreaterThan(999_990)
    })
})

describe('the scroller carries a sticky header', () => {
    /** The header lengthens the scroll range without lengthening the rows. */
    const withHeader = (count: number) => {
        const virtualizer = new Virtualizer({ getCount: () => count, rowHeight: 40, overscan: 0 })
        virtualizer.viewportHeight = 560
        virtualizer.chromeHeight = 40
        return virtualizer
    }

    it('leaves a list the browser can render on the unscaled path', () => {
        const virtualizer = withHeader(100_000)
        expect(virtualizer.scale).toBe(1)

        // Content space and scroll space stay the same, so the rows are
        // translated exactly where they were before any of this existed.
        virtualizer.scrollTop = 4000
        expect(virtualizer.contentTop).toBe(4000)
        expect(virtualizer.offsetY).toBe(4000)
    })

    it('lands the last row against the bottom of a scaled list', () => {
        const virtualizer = withHeader(1_000_000)
        expect(virtualizer.scale).toBeGreaterThan(1)

        // Scrolled to the end, the way a browser reports it: the spacer plus
        // the header, less what fits on screen.
        virtualizer.scrollTop =
            virtualizer.totalHeight + virtualizer.chromeHeight - virtualizer.viewportHeight

        const last = virtualizer.count - 1
        expect(virtualizer.range.end).toBe(virtualizer.count)

        // Where that row is drawn, in the space the scroller moves it in.
        const screenTop =
            virtualizer.chromeHeight +
            virtualizer.offsetY +
            (last - virtualizer.range.start) * 40 -
            virtualizer.scrollTop
        expect(screenTop + 40).toBeCloseTo(virtualizer.viewportHeight, 5)
    })

    it('counting the header on one side only would strand the bottom', () => {
        const virtualizer = withHeader(1_000_000)
        virtualizer.chromeHeight = 0
        const naive = virtualizer.scale

        virtualizer.chromeHeight = 40
        // Small, but at this scale it is the difference between the last row
        // sitting on the edge and hanging a rowful past it.
        expect(virtualizer.scale).not.toBe(naive)
    })
})
