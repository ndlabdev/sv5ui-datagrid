import type { Density } from '../core/types/index.js'
import { datagridDefaults, type DataGridUi } from './datagrid.variants.js'

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
