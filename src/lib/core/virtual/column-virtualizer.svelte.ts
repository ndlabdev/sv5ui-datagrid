import { clamp } from '../utils/math.js'
import { rafBatch } from '../utils/raf-batch.js'
import type { VirtualRange } from './virtualizer.svelte.js'

export interface ColumnVirtualizerOptions {
    getOffsets: () => number[]
    overscanPx?: number
    initialColumns?: number
}

/**
 * Where `edge` falls in a list that only ever ascends. `after` picks between
 * the first offset past the edge and the first one at or past it, which is the
 * difference between the column an edge sits inside and the one after it.
 */
function seek(offsets: number[], count: number, edge: number, after: boolean): number {
    let low = 0
    let high = count
    while (low < high) {
        const middle = (low + high) >> 1
        const before = after ? offsets[middle] <= edge : offsets[middle] < edge
        if (before) low = middle + 1
        else high = middle
    }
    return low
}

export class ColumnVirtualizer {
    scrollLeft = $state(0)
    viewportWidth = $state(0)

    readonly overscanPx: number
    readonly initialColumns: number

    #getOffsets: () => number[]

    range = $derived.by<VirtualRange>(() => {
        const offsets = this.#getOffsets()
        const count = offsets.length - 1
        if (count <= 0) return { start: 0, end: 0 }
        // Before the viewport has been measured, which is the first paint and
        // every server-rendered one. Rendering every column here is what a
        // grid of twenty thousand of them cannot afford, and it is the same
        // reason the row virtualizer has `initialRows`.
        if (this.viewportWidth <= 0) return { start: 0, end: Math.min(this.initialColumns, count) }

        const left = Math.max(0, this.scrollLeft - this.overscanPx)
        const right = this.scrollLeft + this.viewportWidth + this.overscanPx

        // Searched rather than walked: a linear scan from the first column
        // costs the whole list on every frame of a scroll that has gone far
        // enough to the right.
        // The column the left edge sits inside, and the one the right edge has
        // already left: the same two the walk arrived at, found rather than
        // counted to.
        const start = Math.max(0, seek(offsets, count, left, true) - 1)
        const end = Math.min(count, seek(offsets, count, right, false))
        return { start, end: Math.max(end, start + 1) }
    })

    constructor(options: ColumnVirtualizerOptions) {
        this.#getOffsets = options.getOffsets
        this.overscanPx = options.overscanPx ?? 200
        this.initialColumns = options.initialColumns ?? 20
    }

    offsetOf(index: number): number {
        const offsets = this.#getOffsets()
        const count = offsets.length - 1
        if (count <= 0) return 0
        return offsets[clamp(index, 0, count - 1)]
    }

    onScroll = rafBatch((scrollLeft: number) => {
        this.scrollLeft = scrollLeft
    })
}
