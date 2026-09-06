export interface MasterDetailOptions<TRow> {
    /**
     * Which rows can open a panel. Rows without one keep no chevron, so the
     * grid never offers to expand something empty.
     *
     * @default every row
     */
    hasDetail?: (row: TRow) => boolean

    /**
     * Only one panel open at a time. Useful when a panel is tall or fetches
     * its own data.
     *
     * @default false
     */
    single?: boolean
}
