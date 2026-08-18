/**
 * Windowing: the row virtualizer and its two layout strategies, plus the
 * column virtualizer that does the same along the inline axis.
 */

export { ColumnVirtualizer, type ColumnVirtualizerOptions } from './column-virtualizer.svelte.js'
export { fixedRowLayout, variableRowLayout, type RowLayout } from './row-layout.js'
export {
    DEFAULT_ROW_HEIGHT,
    MAX_SPACER_HEIGHT,
    Virtualizer,
    type VirtualizerOptions,
    type VirtualRange
} from './virtualizer.svelte.js'
