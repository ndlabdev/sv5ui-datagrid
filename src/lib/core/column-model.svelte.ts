import { buildColumnCssVars, createColumnState, toStyleString } from './column-sizing.js'
import type { ColumnDef, ColumnState } from './types.js'

export class ColumnModel<TRow> {
    defs = $state.raw<ColumnDef<TRow>[]>([])

    all = $derived(this.defs.map((def) => createColumnState(def)))
    visible = $derived(this.all.filter((column) => !column.hidden))
    cssVars = $derived(buildColumnCssVars(this.visible))
    style = $derived(toStyleString(this.cssVars))

    constructor(defs: ColumnDef<TRow>[]) {
        this.defs = defs
    }

    get(id: string): ColumnState<TRow> | undefined {
        return this.all.find((column) => column.id === id)
    }
}
