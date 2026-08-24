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

function pruneRecord<T>(record: Record<string, T>, known: Set<string>): Record<string, T> {
    return Object.fromEntries(Object.entries(record).filter(([id]) => known.has(id)))
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

/**
 * Ids that disappeared are dropped; ids that appeared keep their defaults.
 * Groups are named apart from columns, since a folded group is keyed by the
 * group's own id and no column carries it.
 */
function resolveOrder(stored: string[] | undefined, known: Set<string>, knownIds: string[]) {
    const order = (stored ?? []).filter((id) => known.has(id))
    if (order.length === 0) return []
    // A column that appeared since the snapshot was written goes last rather
    // than disappearing for want of a place in the order.
    return [...order, ...knownIds.filter((id) => !order.includes(id))]
}

export function resolveColumnSnapshot(
    stored: GridSnapshot['columns'],
    knownIds: string[],
    knownGroupIds: string[] = []
): ColumnSnapshotSource {
    const known = new Set(knownIds)
    const columns = stored ?? {}

    return {
        orderIds: resolveOrder(columns.order, known, knownIds),
        widthOverrides: pruneRecord(columns.widths ?? {}, known),
        hiddenOverrides: pruneRecord(columns.hidden ?? {}, known),
        pinnedOverrides: prunePinned(columns.pinned ?? {}, known),
        collapsedGroups: pruneRecord(columns.collapsed ?? {}, new Set(knownGroupIds))
    }
}

/** Values too, not just keys: a corrupt entry must not reach the model. */
function prunePinned(
    stored: Record<string, PinnedSide | null>,
    known: Set<string>
): Record<string, PinnedSide | null> {
    const pinned: Record<string, PinnedSide | null> = {}
    for (const [id, side] of Object.entries(pruneRecord(stored, known))) {
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
