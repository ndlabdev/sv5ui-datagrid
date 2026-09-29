import { formatCellText, isBlank } from '../../core/utils/index.js'
import { compareValues } from '../sorting/sort.js'
import type { CellRead } from '../../core/grid/index.js'
import { isSyntheticColumn, type ColumnDef, type RowNode } from '../../core/types/index.js'
import type { PivotMeasure } from './pivot.types.js'

export const PIVOT_PREFIX = '__pv'
const CROSSING = `${PIVOT_PREFIX}:c:`
const TOTAL = `${PIVOT_PREFIX}:t:`

export const isPivotColumn = (columnId: string): boolean => columnId.startsWith(`${PIVOT_PREFIX}:`)

export const isPivotTotalColumn = (columnId: string): boolean => columnId.startsWith(TOTAL)

const escapeKey = (key: string): string => key.replaceAll('\\', '\\\\').replaceAll('|', '\\|')

export const pathId = (keys: string[]): string => keys.map(escapeKey).join('|')

export const crossingId = (keys: string[], measure: number): string =>
    `${CROSSING}${pathId(keys)}::${measure}`

export const totalId = (measure: number): string => `${TOTAL}${measure}`

export const subtotalId = (keys: string[], measure: number): string =>
    `${CROSSING}${pathId(keys)}::s${measure}`

export const BLANK_KEY = '(blank)'

export function rawKeyOf<TRow>(row: TRow, column: ColumnDef<TRow>, read: CellRead<TRow>): unknown {
    return read({ id: '', row, index: 0 } as RowNode<TRow>, column)
}

export const textOf = (value: unknown): string => (isBlank(value) ? BLANK_KEY : String(value))

export function keyOf<TRow>(row: TRow, column: ColumnDef<TRow>, read: CellRead<TRow>): string {
    return textOf(rawKeyOf(row, column, read))
}

export function pathOf<TRow>(
    row: TRow,
    columns: ColumnDef<TRow>[],
    read: CellRead<TRow>
): string[] {
    return columns.map((column) => keyOf(row, column, read))
}

export interface KeyNode {
    key: string
    value: unknown
    children: KeyNode[]
}

export interface Crossing {
    tree: KeyNode[]
    paths: string[][]
    overflowed: boolean
}

const EMPTY_CROSSING: Crossing = { tree: [], paths: [], overflowed: false }

export interface CrossingLimit {
    max: number
    leavesPerPath: number
    withSubtotals?: boolean
}

export type DeclaredKeys = (field: string, depth: number) => unknown[] | undefined

export function reconcile<TRow>(
    nodes: KeyNode[],
    fields: ColumnDef<TRow>[],
    declared: DeclaredKeys,
    depth = 0
): KeyNode[] {
    const field = fields[depth]
    if (!field) return nodes

    const wanted = declared(field.id, depth)
    const kept =
        wanted === undefined
            ? nodes
            : wanted.map((value) => {
                  const key = textOf(value)
                  return nodes.find((node) => node.key === key) ?? { key, value, children: [] }
              })

    return kept.map((node) => ({
        ...node,
        children: reconcile(node.children, fields, declared, depth + 1)
    }))
}

export function overLimit(crossing: Crossing, limit: CrossingLimit): boolean {
    const groups = limit.withSubtotals ? internalNodes(crossing.tree) : 0
    return (crossing.paths.length + groups) * limit.leavesPerPath > limit.max
}

export interface CrossingShape<TRow> {
    columns: ColumnDef<TRow>[]
    read: CellRead<TRow>
    limit: CrossingLimit
    declared?: DeclaredKeys
}

export function pivotCrossing<TRow>(nodes: RowNode<TRow>[], shape: CrossingShape<TRow>): Crossing {
    const { columns, read, limit, declared } = shape
    if (columns.length === 0) return EMPTY_CROSSING

    const roots: KeyNode[] = []
    const index = new Map<string, KeyNode>()
    let paths = 0

    for (const node of nodes) {
        let siblings = roots
        let prefix = ''

        for (let depth = 0; depth < columns.length; depth++) {
            const value = rawKeyOf(node.row, columns[depth]!, read)
            const key = textOf(value)
            prefix = prefix === '' ? escapeKey(key) : `${prefix}|${escapeKey(key)}`

            let found = index.get(prefix)
            if (!found) {
                found = { key, value, children: [] }
                index.set(prefix, found)
                siblings.push(found)
                if (depth === columns.length - 1) {
                    paths += 1
                    if (paths * limit.leavesPerPath > limit.max) {
                        return { tree: [], paths: [], overflowed: true }
                    }
                }
            }
            siblings = found.children
        }
    }

    sortTree(roots)
    const shaped = declared ? reconcile(roots, columns, declared) : roots
    const built: Crossing = { tree: shaped, paths: flattenPaths(shaped), overflowed: false }
    return overLimit(built, limit) ? { tree: [], paths: [], overflowed: true } : built
}

function sortTree(nodes: KeyNode[]): void {
    nodes.sort((left, right) => compareValues(left.value, right.value, -1))
    for (const node of nodes) sortTree(node.children)
}

function flattenPaths(nodes: KeyNode[], prefix: string[] = []): string[][] {
    return nodes.flatMap((node) => {
        const here = [...prefix, node.key]
        return node.children.length === 0 ? [here] : flattenPaths(node.children, here)
    })
}

export type HeaderText = (key: string, depth: number, value: unknown) => string

export function defaultHeader<TRow>(
    fields: ColumnDef<TRow>[],
    locale: string | undefined,
    blank: string
): HeaderText {
    return (key, depth, value) => {
        if (isBlank(value)) return blank
        const column = fields[depth]
        if (!column) return key
        return formatCellText(value, column, locale) ?? key
    }
}

const COUNTS = new Set(['count', 'distinctCount'])

export function measuredLook<TRow>(
    measure: PivotMeasure<TRow>,
    source: ColumnDef<TRow> | undefined
): Partial<ColumnDef<TRow>> {
    if (!source) return {}

    const look: Partial<ColumnDef<TRow>> = {
        width: source.width,
        minWidth: source.minWidth,
        align: source.align ?? 'right'
    }

    if (measure.showAs) return { ...look, type: 'percent' as const }

    const agg = measure.agg
    if (typeof agg !== 'string' || COUNTS.has(agg)) return look

    return { ...look, type: source.type, typeOptions: source.typeOptions, cell: source.cell }
}

export type ColumnGroupMode = 'fixed' | 'open' | 'closed'

interface ColumnShape<TRow> {
    measures: PivotMeasure<TRow>[]
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
    return shape.measures.map((measure, index) => leaf(index, measure.header ?? measure.field))
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

export function partitionByPath<TRow>(
    rows: TRow[],
    columns: ColumnDef<TRow>[],
    read: CellRead<TRow>
): Map<string, TRow[]> {
    const buckets = new Map<string, TRow[]>()

    for (const row of rows) {
        const path = pathOf(row, columns, read)
        let prefix = ''

        for (const key of path) {
            prefix = prefix === '' ? escapeKey(key) : `${prefix}|${escapeKey(key)}`
            const bucket = buckets.get(prefix)
            if (bucket) bucket.push(row)
            else buckets.set(prefix, [row])
        }
    }
    return buckets
}

export function internalNodes(nodes: KeyNode[]): number {
    let count = 0
    for (const node of nodes) {
        if (node.children.length === 0) continue
        count += 1 + internalNodes(node.children)
    }
    return count
}

export function subtotalPaths(nodes: KeyNode[], prefix: string[] = []): string[][] {
    return nodes.flatMap((node) => {
        if (node.children.length === 0) return []
        const here = [...prefix, node.key]
        return [here, ...subtotalPaths(node.children, here)]
    })
}

export function serverCrossing(answered: string[][], limit: CrossingLimit): Crossing {
    const roots: KeyNode[] = []
    const index = new Map<string, KeyNode>()
    const paths: string[][] = []

    for (const path of answered) {
        if (path.length === 0) continue

        let siblings = roots
        let prefix = ''
        let fresh = false

        for (const key of path) {
            prefix = prefix === '' ? escapeKey(key) : `${prefix}|${escapeKey(key)}`
            let found = index.get(prefix)
            if (!found) {
                found = { key, value: key, children: [] }
                index.set(prefix, found)
                siblings.push(found)
                fresh = true
            }
            siblings = found.children
        }

        if (!fresh) continue
        paths.push([...path])
    }

    const built: Crossing = { tree: roots, paths, overflowed: false }
    return overLimit(built, limit) ? { tree: [], paths: [], overflowed: true } : built
}

export function readServerCell(row: unknown, keys: string[], measure: number): unknown {
    if (keys.length === 0) {
        const totals = (row as { pivotTotal?: unknown } | null)?.pivotTotal
        return Array.isArray(totals) ? totals[measure] : undefined
    }

    let here: unknown = (row as { pivot?: unknown } | null)?.pivot
    for (const key of keys) {
        if (here === null || typeof here !== 'object') return undefined
        here = (here as Record<string, unknown>)[key]
    }
    return Array.isArray(here) ? here[measure] : undefined
}

export interface CrossingRef {
    keys: string[]
    measure: number
}

export interface IndexShape {
    paths: string[][]
    subtotals: string[][]
    measures: number
    withTotal: boolean
}

export function crossingIndex(shape: IndexShape): Map<string, CrossingRef> {
    const out = new Map<string, CrossingRef>()

    for (const path of shape.paths) {
        for (let measure = 0; measure < shape.measures; measure++) {
            out.set(crossingId(path, measure), { keys: path, measure })
        }
    }

    for (const path of shape.subtotals) {
        for (let measure = 0; measure < shape.measures; measure++) {
            out.set(subtotalId(path, measure), { keys: path, measure })
        }
    }

    if (!shape.withTotal) return out

    for (let measure = 0; measure < shape.measures; measure++) {
        out.set(totalId(measure), { keys: [], measure })
    }
    return out
}

export interface GroupLookup<TRow> {
    fields: ColumnDef<TRow>[]
    read: CellRead<TRow>
    idOf: (path: { columnId: string; key: string }[]) => string
    wanted: string
}

export function rowsInGroup<TRow>(nodes: RowNode<TRow>[], lookup: GroupLookup<TRow>): TRow[] {
    const { fields, read, idOf, wanted } = lookup
    const kept: TRow[] = []

    for (const node of nodes) {
        const path: { columnId: string; key: string }[] = []
        for (const field of fields) {
            path.push({ columnId: field.id, key: keyOf(node.row, field, read) })
            if (idOf(path) === wanted) {
                kept.push(node.row)
                break
            }
        }
    }
    return kept
}

export function startsWithKeys<TRow>(
    row: TRow,
    fields: ColumnDef<TRow>[],
    read: CellRead<TRow>,
    keys: string[]
): boolean {
    return keys.every((key, depth) => {
        const field = fields[depth]
        return field !== undefined && keyOf(row, field, read) === key
    })
}

export function cacheByKey(): (key: string, compute: () => unknown) => unknown {
    const seen = new Map<string, unknown>()
    return (key, compute) => {
        if (!seen.has(key)) seen.set(key, compute())
        return seen.get(key)
    }
}

export function cacheByRows<TRow>(): (
    rows: TRow[],
    slot: number,
    compute: () => unknown
) => unknown {
    const seen = new WeakMap<object, Map<number, unknown>>()
    return (rows, slot, compute) => {
        let found = seen.get(rows as object)
        if (!found) {
            found = new Map()
            seen.set(rows as object, found)
        }
        if (!found.has(slot)) found.set(slot, compute())
        return found.get(slot)
    }
}

export function offAxis<TRow>(
    defs: ColumnDef<TRow>[],
    taken: string[]
): { id: string; header: string }[] {
    const used = new Set(taken)
    return defs
        .filter((def) => !used.has(def.id))
        .map((def) => ({ id: def.id, header: String(def.header ?? def.id) }))
}
