import { getContext, setContext } from 'svelte'
import type { ClassNameValue } from 'tailwind-merge'
import { getDataGridConfig } from '../datagrid.config.js'
import type { DataGridSlots, DataGridUi } from '../datagrid.variants.js'

const THEME_CONTEXT_KEY = Symbol('sv5ui-datagrid-theme')

/** Variant classes, then app-wide config, then this grid's `ui`. */
export type GridTheme = (slot: DataGridSlots) => ClassNameValue

/** A getter, so changing `ui` restyles without remounting the parts. */
export function setGridTheme(ui: () => DataGridUi | undefined): void {
    setContext(THEME_CONTEXT_KEY, ui)
}

/** Config is read once per part: it is set at startup and never reactive. */
export function getGridTheme(): GridTheme {
    const ui = getContext<(() => DataGridUi | undefined) | undefined>(THEME_CONTEXT_KEY)
    const { slots } = getDataGridConfig()
    return (slot) => [slots[slot], ui?.()?.[slot]]
}
