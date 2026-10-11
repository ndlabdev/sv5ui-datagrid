import { CROSSING, TOTAL, crossingId, pathId, subtotalId, totalId } from './pivot-ids.js'
import { isSyntheticColumn, type ColumnDef } from '../../core/types/index.js'
import { type Crossing, type KeyNode } from './pivot-crossing.js'
import { type HeaderText } from './pivot-headers.js'
import { type PivotMeasure } from './pivot.types.js'

export type ColumnGroupMode = 'fixed' | 'open' | 'closed'

interface ColumnShape<TRow> {
    measures: PivotMeasure<TRow>[]
    names: string[]
    looks: Partial<ColumnDef<TRow>>[]
    totalHeader: string | undefined
    subtotalHeader?: (header: string) => string
    groups: ColumnGroupMode
    header: HeaderText
    sortable: boolean
    accessor?: (keys: string[], measure: number) => (row: TRow) => unknown
}

function measureLeaves<TRow>(
    keys: string[],
    shape: ColumnShape<TRow>,
    header: string,
    subtotal = false
): ColumnDef<TRow>[] {
    const idFor = (index: number): string => {
        if (keys.length === 0) return totalId(index)
        return subtotal ? subtotalId(keys, index) : crossingId(keys, index)
    }

    const leaf = (index: number, text: string): ColumnDef<TRow> => ({
        align: 'right' as const,
        ...shape.looks[index],
        id: idFor(index),
        header: text,
        sortable: shape.sortable,
        filter: false,
        ...(shape.accessor ? { accessor: shape.accessor(keys, index) } : {})
    })

    if (shape.measures.length === 1) return [leaf(0, header)]
    return shape.measures.map((_measure, index) => leaf(index, shape.names[index] ?? ''))
}

function subtotalOf<TRow>(
    keys: string[],
    shape: ColumnShape<TRow>,
    text: string
): ColumnDef<TRow>[] {
    const label = shape.subtotalHeader
    if (!label) return []

    const leaves = measureLeaves<TRow>(keys, shape, label(text), true)
    if (leaves.length === 1) return leaves
    return [{ id: `${CROSSING}${pathId(keys)}::s`, header: label(text), children: leaves }]
}

function branch<TRow>(nodes: KeyNode[], shape: ColumnShape<TRow>, prefix: string[]) {
    return nodes.map((node): ColumnDef<TRow> => {
        const keys = [...prefix, node.key]
        const text = shape.header(node.key, prefix.length, node.value)

        if (node.children.length > 0) {
            const subtotal = subtotalOf(keys, shape, text)
            const folds = shape.groups !== 'fixed'

            return {
                id: `${CROSSING}${pathId(keys)}`,
                header: text,
                ...(folds
                    ? {
                          collapsed: shape.groups === 'closed',
                          ...(subtotal.length === 0 ? { collapseMode: 'rail' as const } : {})
                      }
                    : {}),
                children: [
                    ...branch(node.children, shape, keys).map((child) =>
                        folds ? { ...child, columnGroupShow: 'open' as const } : child
                    ),
                    ...subtotal
                ]
            }
        }
        const leaves = measureLeaves<TRow>(keys, shape, text)
        if (leaves.length === 1) return leaves[0]!
        return { id: `${CROSSING}${pathId(keys)}`, header: text, children: leaves }
    })
}

export function pivotColumnDefs<TRow>(
    crossing: Crossing,
    shape: ColumnShape<TRow>
): ColumnDef<TRow>[] {
    const defs = branch<TRow>(crossing.tree, shape, [])
    if (shape.totalHeader === undefined) return defs

    const leaves = measureLeaves<TRow>([], shape, shape.totalHeader)
    if (leaves.length === 1) return [...defs, leaves[0]!]
    return [...defs, { id: `${TOTAL}group`, header: shape.totalHeader, children: leaves }]
}

export function keepOnly<TRow>(defs: ColumnDef<TRow>[], fields: string[]): ColumnDef<TRow>[] {
    const kept = new Set(fields)
    return defs.map((def) =>
        kept.has(def.id) || isSyntheticColumn(def.id) ? def : { ...def, hidden: true }
    )
}

export function missingFields<TRow>(defs: ColumnDef<TRow>[], fields: string[]): string[] {
    const declared = new Set(defs.map((def) => def.id))
    return fields.filter((field) => !declared.has(field))
}
