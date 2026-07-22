import { getContext, setContext } from 'svelte'
import type { ClassNameValue } from 'tailwind-merge'
import { getDataGridConfig } from '../datagrid.config.js'
import type { DataGridSlots, DataGridUi } from '../datagrid.variants.js'

const THEME_CONTEXT_KEY = Symbol('sv5ui-datagrid-theme')

/**
 * Resolves the extra classes for one visual slot. The order is the same one
 * sv5ui components use: the variant's own classes, then the app-wide config,
 * then this grid's `ui` — so the more specific override always wins.
 */
export type GridTheme = (slot: DataGridSlots) => ClassNameValue

/**
 * Published by `Grid.Root` as a getter, so a grid whose `ui` prop changes
 * restyles without remounting its parts.
 */
export function setGridTheme(ui: () => DataGridUi | undefined): void {
    setContext(THEME_CONTEXT_KEY, ui)
}

/**
 * Config is read once per part rather than per slot: it is set at startup and
 * never reactive, while `ui` is a prop and stays live.
 */
export function getGridTheme(): GridTheme {
    const ui = getContext<(() => DataGridUi | undefined) | undefined>(THEME_CONTEXT_KEY)
    const { slots } = getDataGridConfig()
    return (slot) => [slots[slot], ui?.()?.[slot]]
}
