import { clamp } from '../utils/math.js'
import { rafBatch } from '../utils/raf-batch.js'
import type { VirtualRange } from './virtualizer.svelte.js'

export interface ColumnVirtualizerOptions {
    getOffsets: () => number[]
    overscanPx?: number
}

export class ColumnVirtualizer {
    scrollLeft = $state(0)
    viewportWidth = $state(0)

    readonly overscanPx: number

    #getOffsets: () => number[]

    range = $derived.by<VirtualRange>(() => {
        const offsets = this.#getOffsets()
        const count = offsets.length - 1
        if (count <= 0) return { start: 0, end: 0 }
        if (this.viewportWidth <= 0) return { start: 0, end: count }

        const left = Math.max(0, this.scrollLeft - this.overscanPx)
        const right = this.scrollLeft + this.viewportWidth + this.overscanPx

        let start = 0
        while (start < count - 1 && offsets[start + 1] <= left) start += 1

        let end = start
        while (end < count && offsets[end] < right) end += 1

        return { start, end }
    })

    constructor(options: ColumnVirtualizerOptions) {
        this.#getOffsets = options.getOffsets
        this.overscanPx = options.overscanPx ?? 200
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
