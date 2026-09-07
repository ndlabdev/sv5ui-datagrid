import { getContext, setContext } from 'svelte'
import type { ClassNameValue } from 'tailwind-merge'
import { getDataGridConfig } from '../datagrid.config.js'
import type { DataGridSlots, DataGridUi } from '../datagrid.variants.js'

const THEME_CONTEXT_KEY = Symbol('sv5ui-datagrid-theme')

export type GridTheme = (slot: DataGridSlots) => ClassNameValue

export function setGridTheme(ui: () => DataGridUi | undefined): void {
    setContext(THEME_CONTEXT_KEY, ui)
}

export function getGridTheme(grid?: { ui?: Record<string, unknown> }): GridTheme {
    const ui = getContext<(() => DataGridUi | undefined) | undefined>(THEME_CONTEXT_KEY)
    const { slots } = getDataGridConfig()
    return (slot) => [slots[slot], (ui?.() ?? (grid?.ui as DataGridUi | undefined))?.[slot]]
}
