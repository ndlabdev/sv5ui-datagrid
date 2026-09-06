import { clamp } from '../utils/math.js'
import { rafBatch } from '../utils/raf-batch.js'
import type { VirtualRange } from './virtualizer.svelte.js'

export interface ColumnVirtualizerOptions {
    getOffsets: () => number[]
    overscanPx?: number
    initialColumns?: number
}

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
        if (this.viewportWidth <= 0) return { start: 0, end: Math.min(this.initialColumns, count) }

        const left = Math.max(0, this.scrollLeft - this.overscanPx)
        const right = this.scrollLeft + this.viewportWidth + this.overscanPx

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
