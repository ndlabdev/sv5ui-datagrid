import {
    SNAPSHOT_VERSION,
    type Density,
    type GridSnapshot,
    type PinnedSide
} from '../types/index.js'

/** The column state a snapshot round-trips, independent of any class. */
export interface ColumnSnapshotSource {
    orderIds: string[]
    widthOverrides: Record<string, number>
    hiddenOverrides: Record<string, boolean>
    pinnedOverrides: Record<string, PinnedSide | null>
    collapsedGroups: Record<string, boolean>
}

const DENSITIES: Density[] = ['compact', 'standard', 'comfortable']

function pruneRecord<T>(
    record: unknown,
    known: Set<string>,
    keep: (value: unknown) => value is T
): Record<string, T> {
    if (typeof record !== 'object' || record === null) return {}

    const kept: Record<string, T> = {}
    for (const [id, value] of Object.entries(record)) {
        if (known.has(id) && keep(value)) kept[id] = value
    }
    return kept
}

function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean'
}

function isDrawableWidth(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

function isEmpty(value: object): boolean {
    return Object.keys(value).length === 0
}

export function buildColumnSnapshot(
    source: ColumnSnapshotSource
): GridSnapshot['columns'] | undefined {
    const columns: NonNullable<GridSnapshot['columns']> = {}
    if (source.orderIds.length > 0) columns.order = [...source.orderIds]
    if (!isEmpty(source.widthOverrides)) columns.widths = { ...source.widthOverrides }
    if (!isEmpty(source.hiddenOverrides)) columns.hidden = { ...source.hiddenOverrides }
    if (!isEmpty(source.pinnedOverrides)) columns.pinned = { ...source.pinnedOverrides }
    if (!isEmpty(source.collapsedGroups)) columns.collapsed = { ...source.collapsedGroups }
    return isEmpty(columns) ? undefined : columns
}

function resolveOrder(stored: unknown, known: Set<string>, knownIds: string[]) {
    if (!Array.isArray(stored)) return []
    const order = stored.filter((id): id is string => typeof id === 'string' && known.has(id))
    if (order.length === 0) return []
    return [...order, ...knownIds.filter((id) => !order.includes(id))]
}

export function resolveColumnSnapshot(
    stored: unknown,
    knownIds: string[],
    knownGroupIds: string[] = []
): ColumnSnapshotSource {
    const known = new Set(knownIds)
    const columns: Record<string, unknown> =
        typeof stored === 'object' && stored !== null && !Array.isArray(stored)
            ? (stored as Record<string, unknown>)
            : {}

    return {
        orderIds: resolveOrder(columns.order, known, knownIds),
        widthOverrides: pruneRecord(columns.widths, known, isDrawableWidth),
        hiddenOverrides: pruneRecord(columns.hidden, known, isBoolean),
        pinnedOverrides: prunePinned(columns.pinned, known),
        collapsedGroups: pruneRecord(columns.collapsed, new Set(knownGroupIds), isBoolean)
    }
}

function prunePinned(stored: unknown, known: Set<string>): Record<string, PinnedSide | null> {
    if (typeof stored !== 'object' || stored === null) return {}

    const pinned: Record<string, PinnedSide | null> = {}
    for (const [id, side] of Object.entries(stored)) {
        if (!known.has(id)) continue
        pinned[id] = side === 'left' || side === 'right' ? side : null
    }
    return pinned
}

export function isDensity(value: unknown): value is Density {
    return DENSITIES.includes(value as Density)
}

/**
 * Only a well-formed snapshot of the current version, `migrate` first when it
 * is older. Anything else is discarded rather than half-applied.
 */
export function normalizeSnapshot(
    stored: unknown,
    migrate?: (snapshot: GridSnapshot) => GridSnapshot | undefined
): GridSnapshot | undefined {
    if (!stored || typeof stored !== 'object') return undefined

    const snapshot = stored as GridSnapshot
    if (typeof snapshot.version !== 'number') return undefined

    const resolved =
        snapshot.version === SNAPSHOT_VERSION ? snapshot : (migrate?.(snapshot) ?? undefined)

    return resolved?.version === SNAPSHOT_VERSION ? resolved : undefined
}
