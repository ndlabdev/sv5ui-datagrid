import type { ColumnDef } from '../types/index.js'

/** How `autoColumns` reads the data, and what it is allowed to decide. */
export interface AutoColumnsOptions<TRow> {
    /**
     * How many rows to look at when guessing a column's type. Every non-blank
     * value in those rows has to agree for a guess to hold, so a column that
     * changes shape after the sample is read from what the sample saw. A
     * sample larger than the data costs nothing; one below 1 is read as 1.
     * @default 50
     */
    sample?: number

    /**
     * Keys to leave out entirely. Keys starting with `__` are always left out:
     * that is where this package keeps its own row markers.
     * @default []
     */
    exclude?: string[]

    /**
     * Column order, by key. Keys not named here follow in the order they were
     * first seen in the data.
     * @default []
     */
    order?: string[]

    /**
     * Header text for a key. The default turns `placedAt` into `Placed At` and
     * `order_total` into `Order Total`.
     */
    header?: (key: string) => string

    /**
     * Merged over the generated definition, keyed by column id, for the parts
     * a guess cannot know: `width`, `editable`, a `cell` snippet, a better
     * `type`. This is the escape hatch that keeps the guess useful when it is
     * only mostly right, and it also brings back a key the guess dropped -
     * naming one here is how an object or array column gets in, with a `cell`
     * snippet to render it.
     * @default {}
     */
    overrides?: Record<string, Partial<ColumnDef<TRow>>>
}
