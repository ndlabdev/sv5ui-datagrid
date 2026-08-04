import { clamp } from '../utils/math.js'
import { rafBatch } from '../utils/raf-batch.js'
import { fixedRowLayout, variableRowLayout, type RowLayout } from './row-layout.js'

/** The height a row is assumed to have until told otherwise. */
export const DEFAULT_ROW_HEIGHT = 40

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

    range = $derived.by<VirtualRange>(() => {
        const { layout } = this
        if (layout.count <= 0) return { start: 0, end: 0 }
        if (this.viewportHeight <= 0) {
            return { start: 0, end: Math.min(this.initialRows, layout.count) }
        }

        const firstVisible = layout.indexAt(this.scrollTop)
        const lastVisible = layout.indexAt(this.scrollTop + this.viewportHeight - 1)
        const end = clamp(lastVisible + 1 + this.overscan, 0, layout.count)
        const start = clamp(firstVisible - this.overscan, 0, end)
        return { start, end }
    })

    totalHeight = $derived.by(() => this.layout.totalHeight)
    offsetY = $derived.by(() => this.layout.offsetOf(this.range.start))

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
        return Math.max(
            1,
            layout.indexAt(this.scrollTop + this.viewportHeight - 1) -
                layout.indexAt(this.scrollTop) +
                1
        )
    }

    indexToOffset(index: number): number {
        const count = this.#getCount()
        return this.layout.offsetOf(clamp(index, 0, Math.max(0, count - 1)))
    }
}
