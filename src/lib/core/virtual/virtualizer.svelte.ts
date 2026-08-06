import { clamp } from '../utils/math.js'
import { rafBatch } from '../utils/raf-batch.js'
import { fixedRowLayout, variableRowLayout, type RowLayout } from './row-layout.js'

/** The height a row is assumed to have until told otherwise. */
export const DEFAULT_ROW_HEIGHT = 40

/**
 * How tall the scroll spacer is allowed to get. Browsers clamp an element's
 * height — Chromium at 2^25 px, others lower — and a spacer past the clamp is
 * silently shortened, which strands every row beyond it: at 40px a million
 * rows want 40M px and the last 160k become unreachable.
 *
 * Staying under it and scaling instead keeps the whole list reachable. The
 * value is deliberately below the lowest clamp in wide use rather than at
 * Chromium's, since a grid does not get to choose its browser.
 */
export const MAX_SPACER_HEIGHT = 15_000_000

export interface VirtualRange {
    start: number
    end: number
}

export interface VirtualizerOptions {
    getCount: () => number
    rowHeight?: number
    overscan?: number
    initialRows?: number
    getRowHeight?: (index: number) => number
}

export class Virtualizer {
    scrollTop = $state(0)
    viewportHeight = $state(0)
    /**
     * Anything inside the scroller that is not the spacer — the sticky header.
     * It lengthens the scroll range without lengthening the rows, so the two
     * spaces only line up once it is counted on both sides.
     */
    chromeHeight = $state(0)

    readonly rowHeight: number
    readonly overscan: number
    readonly initialRows: number

    #getCount: () => number
    #getRowHeight?: (index: number) => number

    layout = $derived.by<RowLayout>(() => {
        const count = this.#getCount()
        if (this.#getRowHeight) return variableRowLayout(count, this.#getRowHeight)
        return fixedRowLayout(count, this.rowHeight)
    })

    /** What the rows actually add up to, before any clamping. */
    contentHeight = $derived.by(() => this.layout.totalHeight)

    /** What the spacer is given, which the browser will honour. */
    totalHeight = $derived(Math.min(this.contentHeight, MAX_SPACER_HEIGHT))

    /**
     * Content pixels per scrolled pixel. 1 for any list the browser can render
     * at full height, which is every list until the millions — so a normal
     * grid never takes a different path from this.
     */
    scale = $derived.by(() => {
        const extra = this.chromeHeight - this.viewportHeight
        const travel = this.contentHeight + extra
        const room = this.totalHeight + extra
        return travel > 0 && room > 0 ? Math.max(1, travel / room) : 1
    })

    /** Where the top of the viewport sits in content space. */
    contentTop = $derived(this.scrollTop * this.scale)

    range = $derived.by<VirtualRange>(() => {
        const { layout } = this
        if (layout.count <= 0) return { start: 0, end: 0 }
        if (this.viewportHeight <= 0) {
            return { start: 0, end: Math.min(this.initialRows, layout.count) }
        }

        const top = this.contentTop
        const firstVisible = layout.indexAt(top)
        const lastVisible = layout.indexAt(top + this.viewportHeight - 1)
        const end = clamp(lastVisible + 1 + this.overscan, 0, layout.count)
        const start = clamp(firstVisible - this.overscan, 0, end)
        return { start, end }
    })

    /**
     * Where to translate the rendered rows. Written in scroll space, since
     * that is the space the scroller moves them in: the row's content offset
     * is carried back by the difference between the two.
     */
    offsetY = $derived.by(
        () => this.scrollTop + this.layout.offsetOf(this.range.start) - this.contentTop
    )

    constructor(options: VirtualizerOptions) {
        this.#getCount = options.getCount
        this.#getRowHeight = options.getRowHeight
        this.rowHeight = options.rowHeight ?? DEFAULT_ROW_HEIGHT
        this.overscan = options.overscan ?? 5
        this.initialRows = options.initialRows ?? 20
    }

    get count(): number {
        return this.#getCount()
    }

    onScroll = rafBatch((scrollTop: number) => {
        this.scrollTop = scrollTop
    })

    sizeOf(index: number): number {
        return this.layout.sizeOf(index)
    }

    visibleCount(): number {
        const { layout } = this
        if (layout.count <= 0) return 1
        if (this.viewportHeight <= 0) return Math.max(1, Math.min(this.initialRows, layout.count))
        const top = this.contentTop
        return Math.max(1, layout.indexAt(top + this.viewportHeight - 1) - layout.indexAt(top) + 1)
    }

    /** A row's position in scroll space, which is what a scroller is set to. */
    indexToOffset(index: number): number {
        const count = this.#getCount()
        const offset = this.layout.offsetOf(clamp(index, 0, Math.max(0, count - 1)))
        return offset / this.scale
    }

    /** A height in scroll space, for measuring against a scroll position. */
    toScrollSpace(height: number): number {
        return height / this.scale
    }
}
