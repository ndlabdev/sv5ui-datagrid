import type { CellRead } from '../../core/grid/index.js'
import type { ColumnDef, RowNode } from '../../core/types/index.js'
import { compareValues } from '../sorting/sort.js'
import { escapeKey, rawKeyOf, textOf } from './pivot-ids.js'

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

export interface CrossingOrder<TRow> {
    score: (rows: TRow[]) => number | null
    direction: 'asc' | 'desc'
}

export interface CrossingShape<TRow> {
    columns: ColumnDef<TRow>[]
    read: CellRead<TRow>
    limit: CrossingLimit
    declared?: DeclaredKeys
    order?: CrossingOrder<TRow>
}

function hold<TRow>(beneath: Map<string, TRow[]> | undefined, prefix: string, row: TRow): void {
    if (!beneath) return

    const held = beneath.get(prefix)
    if (held) held.push(row)
    else beneath.set(prefix, [row])
}

interface Growing<TRow> {
    roots: KeyNode[]
    index: Map<string, KeyNode>
    beneath: Map<string, TRow[]> | undefined
    leaves: number
}

function place<TRow>(
    row: TRow,
    columns: ColumnDef<TRow>[],
    read: CellRead<TRow>,
    into: Growing<TRow>
): void {
    let siblings = into.roots
    let prefix = ''

    for (let depth = 0; depth < columns.length; depth++) {
        const value = rawKeyOf(row, columns[depth]!, read)
        const key = textOf(value)
        prefix = prefix === '' ? escapeKey(key) : `${prefix}|${escapeKey(key)}`

        hold(into.beneath, prefix, row)

        let found = into.index.get(prefix)
        if (!found) {
            found = { key, value, children: [] }
            into.index.set(prefix, found)
            siblings.push(found)
            if (depth === columns.length - 1) into.leaves += 1
        }
        siblings = found.children
    }
}

export function pivotCrossing<TRow>(nodes: RowNode<TRow>[], shape: CrossingShape<TRow>): Crossing {
    const { columns, read, limit, declared, order } = shape
    if (columns.length === 0) return EMPTY_CROSSING

    const beneath = order ? new Map<string, TRow[]>() : undefined
    const growing: Growing<TRow> = { roots: [], index: new Map(), beneath, leaves: 0 }

    for (const node of nodes) {
        place(node.row, columns, read, growing)
        if (growing.leaves * limit.leavesPerPath > limit.max) {
            return { tree: [], paths: [], overflowed: true }
        }
    }

    const roots = growing.roots
    if (order && beneath) rankTree(roots, { order, beneath, prefix: '' })
    else sortTree(roots)
    const shaped = declared ? reconcile(roots, columns, declared) : roots
    const built: Crossing = { tree: shaped, paths: flattenPaths(shaped), overflowed: false }
    return overLimit(built, limit) ? { tree: [], paths: [], overflowed: true } : built
}

function sortTree(nodes: KeyNode[]): void {
    nodes.sort((left, right) => compareValues(left.value, right.value, -1))
    for (const node of nodes) sortTree(node.children)
}

interface Ranking<TRow> {
    order: CrossingOrder<TRow>
    beneath: Map<string, TRow[]>
    prefix: string
}

const under = (prefix: string, key: string): string =>
    prefix === '' ? escapeKey(key) : `${prefix}|${escapeKey(key)}`

function byRank(left: number | null, right: number | null, direction: 'asc' | 'desc'): number {
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    return direction === 'asc' ? left - right : right - left
}

function rankTree<TRow>(nodes: KeyNode[], at: Ranking<TRow>): void {
    const scores = new Map<KeyNode, number | null>()
    for (const node of nodes) {
        scores.set(node, at.order.score(at.beneath.get(under(at.prefix, node.key)) ?? []))
    }

    nodes.sort((left, right) => {
        const ranked = byRank(
            scores.get(left) ?? null,
            scores.get(right) ?? null,
            at.order.direction
        )
        return ranked === 0 ? compareValues(left.value, right.value, -1) : ranked
    })

    for (const node of nodes) {
        rankTree(node.children, { ...at, prefix: under(at.prefix, node.key) })
    }
}

function flattenPaths(nodes: KeyNode[], prefix: string[] = []): string[][] {
    return nodes.flatMap((node) => {
        const here = [...prefix, node.key]
        return node.children.length === 0 ? [here] : flattenPaths(node.children, here)
    })
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
