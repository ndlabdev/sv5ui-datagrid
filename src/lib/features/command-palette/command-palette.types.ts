import { type GridState } from '../../core/grid/index.js'

/** One entry in the command palette. */
export interface GridCommand {
    /** Unique id; also the palette's search value, so keep it stable. */
    id: string
    label: string
    /** Iconify name, e.g. `lucide:eye-off`. */
    icon?: string
    /** Extra search aliases beyond the label. */
    keywords?: string[]
    /** Section heading the command renders under. @default 'Commands' */
    group?: string
    disabled?: boolean
    /** Executes the command. The palette closes first, then this runs. */
    run: () => void
}

export interface CommandPaletteOptions<TRow = unknown> {
    /**
     * Extra commands appended after the built-ins. Read every time the
     * list is built, so it can reflect the grid's current state.
     */
    commands?: (grid: GridState<TRow>) => GridCommand[]

    /**
     * Contribute the built-in commands: column hide/show/pin, grouping
     * (when the grouping feature is registered) and range copy (when
     * range selection is registered).
     * @default true
     */
    builtins?: boolean
}
