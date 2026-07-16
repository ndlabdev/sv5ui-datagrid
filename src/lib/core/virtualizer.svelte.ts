export interface VirtualRange {
    start: number
    end: number
}

export interface VirtualizerOptions {
    getCount: () => number
    rowHeight?: number
    overscan?: number
    initialRows?: number
}

export class Virtualizer {
    scrollTop = $state(0)
    viewportHeight = $state(0)

    readonly rowHeight: number
    readonly overscan: number
    readonly initialRows: number

    #getCount: () => number
    #pendingScrollTop: number | null = null

    range = $derived.by<VirtualRange>(() => {
        const count = this.#getCount()
        if (count <= 0) return { start: 0, end: 0 }
        if (this.viewportHeight <= 0) {
            return { start: 0, end: Math.min(this.initialRows, count) }
        }

        const rawStart = Math.floor(this.scrollTop / this.rowHeight) - this.overscan
        const rawEnd =
            Math.ceil((this.scrollTop + this.viewportHeight) / this.rowHeight) + this.overscan
        const end = Math.max(0, Math.min(count, rawEnd))
        const start = Math.max(0, Math.min(rawStart, end))
        return { start, end }
    })

    totalHeight = $derived.by(() => this.#getCount() * this.rowHeight)
    offsetY = $derived.by(() => this.range.start * this.rowHeight)

    constructor(options: VirtualizerOptions) {
        this.#getCount = options.getCount
        this.rowHeight = options.rowHeight ?? 40
        this.overscan = options.overscan ?? 5
        this.initialRows = options.initialRows ?? 20
    }

    get count(): number {
        return this.#getCount()
    }

    onScroll = (scrollTop: number): void => {
        if (typeof requestAnimationFrame !== 'function') {
            this.scrollTop = scrollTop
            return
        }

        const hadPending = this.#pendingScrollTop !== null
        this.#pendingScrollTop = scrollTop
        if (hadPending) return

        requestAnimationFrame(() => {
            if (this.#pendingScrollTop === null) return
            this.scrollTop = this.#pendingScrollTop
            this.#pendingScrollTop = null
        })
    }

    indexToOffset(index: number): number {
        const count = this.#getCount()
        const clamped = Math.max(0, Math.min(index, Math.max(0, count - 1)))
        return clamped * this.rowHeight
    }
}
