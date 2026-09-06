import type { Density } from '../types/index.js'
import { datagridSlots, type DataGridSlots, type DataGridUi } from './slots.js'

const datagridDefaults: { defaultVariants: { density: Density }; slots: DataGridUi } = {
    defaultVariants: { density: 'standard' },
    slots: {}
}

/**
 * Whole-app defaults for every grid, in the same `{ defaultVariants, slots }`
 * shape sv5ui components take from `defineConfig`. Set it once at startup;
 * grids read it when they mount, so it is not a reactive store.
 *
 * It lives here rather than in sv5ui's config because sv5ui does not export
 * the reader its components use internally. When it does, this store becomes
 * the fallback and `defineConfig({ datagrid })` starts feeding the same
 * values — which is why the shape is identical.
 */
export interface DataGridConfig {
    /** Defaults for variants that apply to a whole grid. */
    defaultVariants: { density: Density }
    /** Classes appended to every grid's slots, before any per-instance `ui`. */
    slots: DataGridUi
}

let current: DataGridConfig = clone(datagridDefaults)

function clone(config: DataGridConfig): DataGridConfig {
    return { defaultVariants: { ...config.defaultVariants }, slots: { ...config.slots } }
}

/**
 * Overrides the defaults for every grid in the app.
 *
 * @example
 * ```ts
 * defineDataGridConfig({
 *     defaultVariants: { density: 'compact' },
 *     slots: { cell: 'font-mono', headerCell: 'uppercase tracking-wide' }
 * })
 * ```
 */
export function defineDataGridConfig(config: Partial<DataGridConfig>): void {
    current = {
        defaultVariants: { ...current.defaultVariants, ...config.defaultVariants },
        slots: { ...current.slots, ...config.slots }
    }
}

/** The config a grid reads when it mounts. */
export function getDataGridConfig(): DataGridConfig {
    return current
}

/** Restores the built-in defaults. Mainly for tests, which must not leak state. */
export function resetDataGridConfig(): void {
    current = clone(datagridDefaults)
}

/**
 * One slot's classes for a caller that draws no markup: a feature returning a
 * `cellDecoration`. The grid's own class, then whatever the app set for that
 * slot in `defineDataGridConfig`.
 *
 * A grid's per-instance `ui` is deliberately absent. It arrives through
 * context, which only a component is inside; a feature runs in the pipeline,
 * where there is no component to ask.
 */
export function slotClass(slot: DataGridSlots): string {
    const override = current.slots[slot]
    return override ? `${datagridSlots[slot]} ${String(override)}` : datagridSlots[slot]
}
