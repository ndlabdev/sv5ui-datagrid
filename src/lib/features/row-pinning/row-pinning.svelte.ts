import type { GridState } from '../../core/grid/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/grid/pipeline.svelte.js'
import type { GridFeature, MenuContext, MenuItem, RowNode, RowPinSide } from '../../core/types.js'
import type { RowPinningOptions } from './row-pinning.types.js'

export const ROW_PINNING = 'rowPinning'

export class RowPinning<TRow> {
    pinnedOverrides = $state.raw<Record<string, RowPinSide | null>>({})

    readonly #grid: GridState<TRow>
    readonly #isRowPinned: ((row: TRow) => RowPinSide | null) | null

    constructor(grid: GridState<TRow>, options: RowPinningOptions<TRow>) {
        this.#grid = grid
        this.#isRowPinned = options.isRowPinned ?? null
    }

    sideOf(node: RowNode<TRow>): RowPinSide | null {
        const override = this.pinnedOverrides[node.id]
        if (override !== undefined) return override
        return this.#isRowPinned?.(node.row) ?? null
    }

    /**
     * With no predicate and no overrides nothing can be pinned, so the two
     * scans below are skipped entirely — the common case for a grid that
     * merely has the feature registered.
     */
    get #possible(): boolean {
        return this.#isRowPinned !== null || Object.keys(this.pinnedOverrides).length > 0
    }

    topNodes = $derived.by(() =>
        this.#possible ? this.#grid.sourceNodes.filter((node) => this.sideOf(node) === 'top') : []
    )
    bottomNodes = $derived.by(() =>
        this.#possible
            ? this.#grid.sourceNodes.filter((node) => this.sideOf(node) === 'bottom')
            : []
    )
    pinnedCount = $derived(this.topNodes.length + this.bottomNodes.length)

    pinRow = (id: string, side: RowPinSide | null): void => {
        this.pinnedOverrides = { ...this.pinnedOverrides, [id]: side }
        this.#grid.events.emit('rowPinnedChanged', { id, side })
    }

    getPinnedRows = (): { top: TRow[]; bottom: TRow[] } => ({
        top: this.topNodes.map((node) => node.row),
        bottom: this.bottomNodes.map((node) => node.row)
    })
}

function createMenuItems<TRow>(ctx: MenuContext<TRow>): MenuItem[] {
    const state = getRowPinning(ctx.grid)
    const node = ctx.node
    if (!state || !node || node.meta?.fullWidth) return []

    const side = state.sideOf(node)
    if (side !== null) {
        return [
            {
                id: 'unpin-row',
                label: 'Unpin row',
                icon: 'lucide:pin-off',
                onSelect: () => state.pinRow(node.id, null)
            }
        ]
    }
    return [
        {
            id: 'pin-row-top',
            label: 'Pin row top',
            icon: 'lucide:arrow-up-to-line',
            onSelect: () => state.pinRow(node.id, 'top')
        },
        {
            id: 'pin-row-bottom',
            label: 'Pin row bottom',
            icon: 'lucide:arrow-down-to-line',
            onSelect: () => state.pinRow(node.id, 'bottom')
        }
    ]
}

export function rowPinning<TRow>(options: RowPinningOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: ROW_PINNING,
        createState: (grid) => new RowPinning(grid, options),
        createApi: (grid) => {
            const state = getRowPinning(grid)!
            return { pinRow: state.pinRow, getPinnedRows: state.getPinnedRows }
        },
        menuItems: createMenuItems,
        pipelineStage: {
            order: PIPELINE_ORDER.pinSplit,
            transform: (nodes, grid) => {
                const state = getRowPinning(grid)
                if (!state || state.pinnedCount === 0) return nodes
                return nodes.filter((node) => state.sideOf(node) === null)
            }
        }
    }
}

export function getRowPinning<TRow>(grid: GridState<TRow>): RowPinning<TRow> | undefined {
    return grid.feature<RowPinning<TRow>>(ROW_PINNING)
}
