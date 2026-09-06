import { type GridState, PIPELINE_ORDER } from '../../core/grid/index.js'
import { type GridFeature, type RowNode } from '../../core/types/index.js'
import { getFormula } from '../formula/index.js'
import { createSeenGroups } from '../grouping/seen-groups.js'
import { buildTreeNodes, indexByParent } from './tree-nodes.js'
import type { TreeOptions } from './tree.types.js'

export const TREE = 'tree'

export class Tree<TRow> {
    readonly defaultExpandedDepth: number

    #grid: GridState<TRow>
    #options: TreeOptions<TRow>
    #seen = createSeenGroups()

    constructor(grid: GridState<TRow>, options: TreeOptions<TRow>) {
        this.#grid = grid
        this.#options = options
        this.defaultExpandedDepth = options.defaultExpandedDepth ?? 0

        if (!options.getChildren && !options.getParentId) {
            throw new Error('tree() needs either getChildren or getParentId to find the hierarchy')
        }
    }

    #wrap(rows: TRow[], parentIndex: number): RowNode<TRow>[] {
        const nodes = rows.map((row, index) => ({
            id: this.#grid.getRowId(row),
            row,
            index: parentIndex + index + 1
        }))
        return getFormula(this.#grid)?.apply(nodes) ?? nodes
    }

    build = (nodes: RowNode<TRow>[]): RowNode<TRow>[] => {
        const { getChildren, getParentId } = this.#options

        const flatIndex = getParentId ? indexByParent(nodes, getParentId) : null
        const roots = flatIndex ? flatIndex.roots : nodes

        const childrenOf = (node: RowNode<TRow>): RowNode<TRow>[] => {
            if (flatIndex) return flatIndex.children.get(node.id) ?? []
            return this.#wrap(getChildren!(node.row) ?? [], node.index)
        }

        const result = buildTreeNodes(roots, {
            childrenOf,
            defaultExpandedDepth: this.defaultExpandedDepth,
            isExpanded: (id) => this.#grid.expansion.isExpanded(id),
            isSeeded: (id) => this.#seen.has(id)
        })

        const fresh = result.autoExpanded
        if (fresh.length > 0) {
            const expansion = this.#grid.expansion
            queueMicrotask(() => {
                for (const id of fresh) this.#seen.add(id)
                expansion.expandAll([...expansion.expandedIds, ...fresh])
            })
        }

        return result.nodes
    }

    expandableIds = (): string[] => {
        const ids: string[] = []
        for (const node of this.#grid.preWindowNodes) {
            if (node.meta?.expandable) ids.push(node.id)
        }
        return ids
    }

    expandAll = (): void => {
        for (let level = 0; level < MAX_EXPAND_PASSES; level++) {
            const ids = this.expandableIds()
            const expansion = this.#grid.expansion
            const before = expansion.expandedIds.size
            expansion.expandAll([...expansion.expandedIds, ...ids])
            if (expansion.expandedIds.size === before) return
        }
    }

    collapseAll = (): void => {
        this.#grid.expansion.collapseAll()
    }
}

const MAX_EXPAND_PASSES = 50

export function tree<TRow>(options: TreeOptions<TRow>): GridFeature<TRow> {
    return {
        id: TREE,
        createState: (grid) => {
            grid.expansion.enabled = true
            return new Tree(grid, options)
        },
        createApi: (grid) => {
            const state = getTree(grid)!
            return { expandAllRows: state.expandAll, collapseAllRows: state.collapseAll }
        },
        pipelineStage: {
            order: PIPELINE_ORDER.group,
            transform: (nodes, grid) => getTree(grid)?.build(nodes) ?? nodes
        }
    }
}

export function getTree<TRow>(grid: GridState<TRow>): Tree<TRow> | undefined {
    return grid.feature<Tree<TRow>>(TREE)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        expandAllRows?: () => void
        collapseAllRows?: () => void
    }
}
