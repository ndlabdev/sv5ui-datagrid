/**
 * The kernel proper: the grid instance, the pipeline it composes, the event
 * bus features talk through, row identity and the snapshot shape.
 *
 * `GridState` leaves as a type. It is constructed in one place —
 * `createDataGrid` — and every other reader only ever annotates with it.
 */

export { EventBus, type EventHandler } from './events.js'
export { createDataGrid } from './grid.svelte.js'
export type { GridState } from './grid.svelte.js'
export { composePipeline, PIPELINE_ORDER, type Pipeline } from './pipeline.svelte.js'
export {
    buildRowNodes,
    isDataRow,
    isLoadingRow,
    isSyntheticRow,
    LOADING_KEY,
    markSyntheticRow,
    nodeIndexById,
    nodesById,
    SYNTHETIC_KEY
} from './row-node.js'
export {
    composeReaders,
    gateReader,
    rawRead,
    readCell,
    readerToken,
    type CellRead
} from './value-gate.js'
export {
    buildColumnSnapshot,
    isDensity,
    normalizeSnapshot,
    resolveColumnSnapshot,
    type ColumnSnapshotSource
} from './snapshot.js'
export {
    canonicalJson,
    decodeSnapshot,
    encodeSnapshot,
    sameSnapshot,
    SHARE_LIMIT,
    ShareTooLongError
} from './share-link.js'
