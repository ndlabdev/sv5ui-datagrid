import type { GridState } from '../../core/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/pipeline.svelte.js'
import type { GridFeature } from '../../core/types.js'
import { Virtualizer } from '../../core/virtualizer.svelte.js'
import type { VirtualizationOptions } from './virtualization.types.js'

export const VIRTUALIZATION = 'virtualization'

export class Virtualization<TRow> {
    readonly virtualizer: Virtualizer

    element = $state<HTMLElement | null>(null)

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: VirtualizationOptions) {
        this.#grid = grid
        this.virtualizer = new Virtualizer({
            ...options,
            getCount: () => grid.totalRows
        })

        grid.events.on('sortChanged', this.#resetScroll)
        grid.events.on('filterChanged', this.#resetScroll)
    }

    #resetScroll = (): void => {
        this.virtualizer.scrollTop = 0
        if (this.element) this.element.scrollTop = 0
    }

    #indexOf(target: number | string): number {
        if (typeof target === 'number') return target
        return this.#grid.preWindowNodes.findIndex((node) => node.id === target)
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
        const bottom = top + virtualizer.rowHeight + headerOffset
        if (top < element.scrollTop) {
            this.#setScrollTop(element, top)
        } else if (bottom > element.scrollTop + virtualizer.viewportHeight) {
            this.#setScrollTop(element, bottom - virtualizer.viewportHeight)
        }
    }
}

export function virtualization<TRow>(options: VirtualizationOptions = {}): GridFeature<TRow> {
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
