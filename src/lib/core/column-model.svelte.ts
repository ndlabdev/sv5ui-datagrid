import {
    buildColumnCssVars,
    createColumnState,
    prefixSums,
    resolveColumnWidths,
    toStyleString
} from './column-sizing.js'
import type { ColumnDef, ColumnState } from './types.js'

export class ColumnModel<TRow> {
    defs = $state.raw<ColumnDef<TRow>[]>([])
    containerWidth = $state(0)

    all = $derived(this.defs.map((def) => createColumnState(def)))
    visible = $derived(this.all.filter((column) => !column.hidden))
    resolvedWidths = $derived.by(() => {
        if (this.containerWidth <= 0) return null
        return resolveColumnWidths(this.visible, this.containerWidth)
    })
    offsets = $derived.by(() => (this.resolvedWidths ? prefixSums(this.resolvedWidths) : null))
    cssVars = $derived(buildColumnCssVars(this.visible, this.resolvedWidths))
    style = $derived(toStyleString(this.cssVars))

    constructor(defs: ColumnDef<TRow>[]) {
        this.defs = defs
    }

    get(id: string): ColumnState<TRow> | undefined {
        return this.all.find((column) => column.id === id)
    }
}
