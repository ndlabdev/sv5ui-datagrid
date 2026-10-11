import { escapeKey } from './pivot-ids.js'
import { type Crossing, type CrossingLimit, type KeyNode, overLimit } from './pivot-crossing.js'

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
