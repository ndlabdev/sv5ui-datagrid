import { type RowNode } from '../../core/types/index.js'

export interface BuildTreeOptions<TRow> {
    childrenOf: (node: RowNode<TRow>) => RowNode<TRow>[]

    isExpanded: (id: string) => boolean

    defaultExpandedDepth?: number

    isSeeded?: (id: string) => boolean
}

export interface TreeResult<TRow> {
    nodes: RowNode<TRow>[]

    autoExpanded: string[]
}

export function buildTreeNodes<TRow>(
    roots: RowNode<TRow>[],
    options: BuildTreeOptions<TRow>
): TreeResult<TRow> {
    const flat: RowNode<TRow>[] = []
    const autoExpanded: string[] = []
    const depth = options.defaultExpandedDepth ?? 0

    const visit = (siblings: RowNode<TRow>[], level: number) => {
        siblings.forEach((node, index) => {
            const children = options.childrenOf(node)
            const expandable = children.length > 0

            flat.push({
                ...node,
                meta: {
                    ...node.meta,
                    level,
                    expandable,
                    setSize: siblings.length,
                    posInSet: index + 1
                }
            })

            if (!expandable) return
            const expanded = options.isExpanded(node.id)
            const auto = level < depth && !expanded && !options.isSeeded?.(node.id)
            if (auto) autoExpanded.push(node.id)
            if (auto || expanded) visit(children, level + 1)
        })
    }

    visit(roots, 0)
    return { nodes: flat, autoExpanded }
}

export function indexByParent<TRow>(
    nodes: RowNode<TRow>[],
    parentIdOf: (row: TRow) => string | null | undefined
): { roots: RowNode<TRow>[]; children: Map<string, RowNode<TRow>[]> } {
    const present = new Set(nodes.map((node) => node.id))
    const children = new Map<string, RowNode<TRow>[]>()
    const roots: RowNode<TRow>[] = []

    for (const node of nodes) {
        const parent = parentIdOf(node.row)
        if (parent === null || parent === undefined || !present.has(parent)) {
            roots.push(node)
            continue
        }
        const bucket = children.get(parent)
        if (bucket) bucket.push(node)
        else children.set(parent, [node])
    }

    return { roots, children }
}
