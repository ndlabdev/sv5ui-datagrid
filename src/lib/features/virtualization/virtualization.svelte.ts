import { ColumnVirtualizer } from '../../core/virtual/column-virtualizer.svelte.js'
import type { GridState } from '../../core/grid/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/grid/pipeline.svelte.js'
import { nodeIndexById } from '../../core/grid/row-node.js'
import { scrollStart, setScrollStart } from '../../core/utils/scroll.js'
import type { GridFeature } from '../../core/types.js'
import { Virtualizer } from '../../core/virtual/virtualizer.svelte.js'
import type { VirtualizationOptions } from './virtualization.types.js'

export const VIRTUALIZATION = 'virtualization'

export class Virtualization<TRow> {
    readonly virtualizer: Virtualizer
    readonly columnVirtualizer: ColumnVirtualizer | null

    element = $state<HTMLElement | null>(null)

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: VirtualizationOptions<TRow>) {
        this.#grid = grid
        const getRowHeight = options.getRowHeight
        this.virtualizer = new Virtualizer({
            rowHeight: options.rowHeight,
            overscan: options.overscan,
            initialRows: options.initialRows,
            getCount: () => grid.totalRows,
            getRowHeight: getRowHeight
                ? (index) => getRowHeight(grid.preWindowNodes[index])
                : undefined
        })
        this.columnVirtualizer = options.columns
            ? new ColumnVirtualizer({
                  getOffsets: () => grid.columns.offsets ?? [],
                  overscanPx:
                      typeof options.columns === 'object' ? options.columns.overscanPx : undefined
              })
            : null

        grid.events.on('sortChanged', this.#resetScroll)
        grid.events.on('filterChanged', this.#resetScroll)
    }

    #resetScroll = (): void => {
        this.virtualizer.scrollTop = 0
        if (this.element) this.element.scrollTop = 0
    }

    // Scroll targets address a row's position in the windowed set, which is
    // not `node.index`. Built lazily — a grid scrolled only by index never
    // pays for it.
    #indexById = $derived.by(() => nodeIndexById(this.#grid.preWindowNodes))

    #indexOf(target: number | string): number {
        if (typeof target === 'number') return target
        return this.#indexById.get(target) ?? -1
    }

    scrollToRow = (target: number | string): void => {
        const element = this.element
        const index = this.#indexOf(target)
        if (!element || index < 0) return
        this.#setScrollTop(element, this.virtualizer.indexToOffset(index))
    }

    #setScrollTop(element: HTMLElement, value: number): void {
        element.scrollTop = value
        this.virtualizer.scrollTop = element.scrollTop
    }

    ensureVisible = (target: number | string): void => {
        const element = this.element
        const index = this.#indexOf(target)
        if (!element || index < 0) return

        const { virtualizer } = this
        const top = virtualizer.indexToOffset(index)
        if (virtualizer.viewportHeight <= 0) {
            this.#setScrollTop(element, top)
            return
        }

        const headerOffset = Math.max(0, element.scrollHeight - virtualizer.totalHeight)
        const bottom = top + virtualizer.sizeOf(index) + headerOffset
        if (top < element.scrollTop) {
            this.#setScrollTop(element, top)
        } else if (bottom > element.scrollTop + virtualizer.viewportHeight) {
            this.#setScrollTop(element, bottom - virtualizer.viewportHeight)
        }
    }

    #setScrollLeft(element: HTMLElement, value: number): void {
        setScrollStart(element, value)
        if (this.columnVirtualizer) this.columnVirtualizer.scrollLeft = scrollStart(element)
    }

    ensureColVisible = (col: number): void => {
        const element = this.element
        const columnVirtualizer = this.columnVirtualizer
        const offsets = this.#grid.columns.offsets
        if (!element || !columnVirtualizer || !offsets || col < 0) return

        const left = columnVirtualizer.offsetOf(col)
        const right = offsets[Math.min(col + 1, offsets.length - 1)]
        const start = scrollStart(element)
        if (left < start) {
            this.#setScrollLeft(element, left)
        } else if (
            columnVirtualizer.viewportWidth > 0 &&
            right > start + columnVirtualizer.viewportWidth
        ) {
            this.#setScrollLeft(element, right - columnVirtualizer.viewportWidth)
        }
    }
}

export function virtualization<TRow>(options: VirtualizationOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: VIRTUALIZATION,
        createState: (grid) => new Virtualization(grid, options),
        createApi: (grid) => {
            const state = getVirtualization(grid)!
            return { scrollToRow: state.scrollToRow, ensureVisible: state.ensureVisible }
        },
        pipelineStage: {
            order: PIPELINE_ORDER.window,
            transform: (nodes, grid) => {
                const state = getVirtualization(grid)
                if (!state) return nodes
                const { start, end } = state.virtualizer.range
                return nodes.slice(start, end)
            }
        }
    }
}

export function getVirtualization<TRow>(grid: GridState<TRow>): Virtualization<TRow> | undefined {
    return grid.feature<Virtualization<TRow>>(VIRTUALIZATION)
}
