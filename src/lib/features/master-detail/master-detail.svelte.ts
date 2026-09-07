import { type GridState, PIPELINE_ORDER } from '../../core/grid/index.js'
import { type GridFeature, type RowNode } from '../../core/types/index.js'
import { buildDetailNodes, isDetailNode, masterIdOf } from './detail-nodes.js'
import type { MasterDetailOptions } from './master-detail.types.js'

const MASTER_DETAIL = 'masterDetail'

export class MasterDetail<TRow> {
    readonly single: boolean

    #grid: GridState<TRow>
    #hasDetail: (row: TRow) => boolean

    constructor(grid: GridState<TRow>, options: MasterDetailOptions<TRow>) {
        this.#grid = grid
        this.#hasDetail = options.hasDetail ?? (() => true)
        this.single = options.single ?? false

        if (this.single) {
            grid.events.on('rowExpanded', ({ id, expanded }) => {
                if (!expanded) return

                const others = [...grid.expansion.expandedIds].filter(
                    (open) => open !== id && !isDetailNode(open)
                )
                if (others.length > 0) grid.expansion.expandAll([id])
            })
        }
    }

    hasDetail = (row: TRow): boolean => this.#hasDetail(row)

    isDetailRow = (node: RowNode<TRow>): boolean => isDetailNode(node.id)

    masterOf = (node: RowNode<TRow>): string => masterIdOf(node.id)

    build = (nodes: RowNode<TRow>[]): RowNode<TRow>[] =>
        buildDetailNodes(nodes, {
            hasDetail: this.#hasDetail,
            isExpanded: (id) => this.#grid.expansion.isExpanded(id)
        })

    toggle = (id: string): void => {
        this.#grid.expansion.toggle(id)
    }

    closeAll = (): void => {
        this.#grid.expansion.collapseAll()
    }
}

export function masterDetail<TRow>(options: MasterDetailOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: MASTER_DETAIL,
        createState: (grid) => {
            grid.expansion.enabled = true
            return new MasterDetail(grid, options)
        },
        createApi: (grid) => {
            const state = getMasterDetail(grid)!
            return { toggleDetail: state.toggle, closeAllDetails: state.closeAll }
        },
        pipelineStage: {
            order: PIPELINE_ORDER.flatten,
            transform: (nodes, grid) => getMasterDetail(grid)?.build(nodes) ?? nodes
        }
    }
}

export function getMasterDetail<TRow>(grid: GridState<TRow>): MasterDetail<TRow> | undefined {
    return grid.feature<MasterDetail<TRow>>(MASTER_DETAIL)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        toggleDetail?: (id: string) => void
        closeAllDetails?: () => void
    }
}
