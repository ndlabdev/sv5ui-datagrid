import type { ClassNameValue } from 'tailwind-merge'

/**
 * Every class the grid puts on an element it draws, named one slot at a time.
 *
 * It lives in the kernel rather than beside `datagridVariants` because two
 * layers need it and only one of them draws markup. A feature contributing a
 * `cellDecoration` names a slot the same way a component does, and having it
 * reach up into `components/` for the table would point an import back down
 * the layer it is imported from.
 *
 * `datagridVariants` builds `tv()` on top of this, and is what applies the
 * variants and an app's `ui` overrides. What a feature gets here is the base.
 */
export const datagridSlots = {
    root: 'w-full space-y-3',
    toolbar: 'flex flex-wrap items-center gap-2',
    viewport:
        'group/grid relative w-full overflow-auto rounded-lg border border-outline-variant text-sm',
    header: 'group/header sticky top-0 z-10 min-w-min border-b border-outline-variant bg-surface-container',
    headerRow: 'grid [grid-template-columns:var(--dg-grid-template)]',
    groupRow:
        'relative grid min-w-min [grid-template-columns:var(--dg-grid-template)] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[16] after:h-px after:bg-outline-variant',
    headerCell:
        'group/head relative flex h-(--dg-row-h) min-w-0 items-center gap-1 overflow-hidden px-3 font-medium whitespace-nowrap text-on-surface-variant outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
    groupCell:
        'relative flex h-(--dg-row-h) min-w-0 items-center justify-center gap-1 overflow-hidden px-3 text-xs font-medium whitespace-nowrap text-on-surface-variant outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
    /** What a `headerGroupCell` snippet draws into: shrinkable, and clipped. */
    groupContent: 'flex min-w-0 items-center gap-1 overflow-hidden',
    /**
     * The strip a railed group folds down to, running the body's height.
     * A closed drawer rather than a gap: its own surface, edged on both
     * sides, and warm to the pointer, since clicking anywhere down it is
     * what opens the group again.
     */
    rail: 'absolute inset-y-0 z-[7] cursor-pointer bg-surface-container-high',
    /**
     * The drawer's head, over the header rows. Above the lines the header
     * draws between its levels and along its foot, because a drawer with
     * the header's rules struck across it is not one thing but three.
     */
    railHead:
        'absolute top-0 -bottom-px z-[17] flex cursor-pointer items-start justify-center bg-surface-container-high',
    /**
     * The caret stands on the group cell under the head, which the head
     * covers, so the drawer shows the caret itself. Not a ring: the
     * drawer is two elements meeting, and a box around each of them is
     * two boxes rather than one drawer. A bar down the leading edge and
     * a wash over the surface both carry through the seam. Tied to
     * focus inside the grid, so it goes out with the grid's focus
     * rather than sitting on a page nobody is on.
     */
    railFocus:
        'group-has-[:focus-visible]/grid:bg-primary/10 group-has-[:focus-visible]/grid:shadow-[inset_2px_0_0_0_var(--color-primary)]',
    /**
     * Every cell over a folded group's strip, header included, so the
     * drawer is one band from the top of the header to the last row
     * rather than a patch that starts where the rows do.
     */
    railSurface: 'bg-surface-container-high focus-visible:ring-0',
    /**
     * What the strip holds, held in the middle of what is on screen: the
     * way back, and the name of what is folded.
     */
    railInner: 'flex flex-col items-center gap-2 py-3 text-on-surface-variant',
    /** The group's name, turned to read up the strip. */
    railLabel:
        'max-h-[50vh] truncate text-xs font-medium tracking-wide [writing-mode:vertical-rl] [rotate:180deg]',
    /** Room kept at the trailing edge for the fold toggle to sit in. */
    groupCellFoldable: 'pe-8',
    groupToggle: 'absolute inset-y-0.5 end-1 flex items-center',
    sortButton:
        'inline-flex min-w-0 cursor-pointer items-center gap-1 truncate select-none transition-colors [text-align:inherit] [text-transform:inherit] hover:text-on-surface',
    resizeHandle:
        'absolute inset-y-0 end-0 z-10 w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40 active:bg-primary',
    headerControls:
        'absolute inset-y-0.5 end-1.5 flex items-center gap-0.5 bg-surface-container ps-2 opacity-0 transition-opacity group-hover/head:opacity-100 group-focus-within/head:opacity-100 [@media(hover:none)]:opacity-100',
    headerControlsPinned: 'opacity-100',
    menuButton: 'shrink-0',
    dropIndicator: 'pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-primary',
    rowHandle:
        'flex size-full cursor-grab items-center justify-center text-on-surface-variant outline-none touch-pan-y select-none hover:text-on-surface focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset active:cursor-grabbing disabled:cursor-default disabled:opacity-30',
    rowDropIndicator: 'pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary',
    rowGhost: 'overflow-hidden rounded-md bg-surface shadow-lg ring-1 ring-primary',
    rowDragging: 'opacity-40',
    pinnedCell:
        'sticky z-[5] bg-surface group-hover/row:bg-surface-container-low border-outline-variant',
    pinnedHeaderCell: 'sticky z-[15] bg-surface-container',
    chooserItem: 'flex items-center gap-2 px-1 py-1',
    body: 'relative',
    bodyOffset: 'will-change-transform',
    row: 'group/row relative grid min-w-min [grid-template-columns:var(--dg-grid-template)] transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[6] after:h-px after:bg-outline-variant last:after:hidden hover:bg-surface-container-low',
    cell: 'flex min-h-(--dg-row-h) min-w-0 items-center overflow-hidden px-3 py-(--dg-cell-py) text-on-surface outline-none',
    cellFocus:
        'focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
    cellEditing: 'overflow-visible',
    cellRowSpan: 'relative z-[7] overflow-visible p-0',
    rowSpanFill:
        'absolute inset-x-0 z-[7] flex min-w-0 items-start overflow-hidden bg-surface px-3 py-(--dg-cell-py) after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-outline-variant',
    rowSpanFillLast: 'after:hidden',
    rowSpanEdge: 'border-e border-outline-variant',
    rowSpanEdgeStart: 'border-s border-outline-variant',
    pinnedCellRaised:
        'z-[8] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-outline-variant group-last/row:after:hidden',
    pinnedCellSelected:
        'before:pointer-events-none before:absolute before:inset-0 before:bg-primary/8',
    empty: 'w-full p-4',
    toggleButton:
        'me-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
    cellEditor: 'relative flex h-full min-h-(--dg-row-h) w-full min-w-0 items-center',
    // z-7, not higher: above the row's own separator, which is at 6 and
    // would otherwise paint its grey line along the bottom of the ring and
    // leave three edges looking one weight and the fourth another. Below
    // the pinned cells at 8, which have to stay over anything scrolling
    // under them, an open editor included.
    cellEditorFlat: 'z-[7] bg-surface ring-2 ring-inset ring-primary',
    cellEditorInRow:
        'bg-surface after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-transparent focus-within:z-[7] focus-within:bg-primary/8 focus-within:after:bg-primary',
    cellEditorInRowWidget: 'bg-surface focus-within:z-[7]',
    cellEditorInRowDivider: 'border-s border-outline-variant',
    cellEditorPad: 'px-2',
    cellEditorWide: 'min-w-max',
    cellEditorField: 'w-full',
    cellError:
        'absolute top-full start-0 z-30 mt-0.5 rounded bg-error px-1.5 py-0.5 text-xs whitespace-nowrap text-on-error shadow-sm',
    cellEditable: 'cursor-text',
    tooltipTrigger:
        '-mx-3 -my-(--dg-cell-py) flex min-w-0 grow items-center overflow-hidden px-3 py-(--dg-cell-py)',
    fullWidthCell:
        'min-h-(--dg-row-h) min-w-0 overflow-hidden bg-surface-container-lowest p-3 text-on-surface outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
    pinnedRow:
        'group/row relative grid min-w-min [grid-template-columns:var(--dg-grid-template)] bg-surface after:pointer-events-none after:absolute after:inset-x-0 after:z-[6] after:h-px after:bg-outline-variant',
    pinnedRowsTop: 'sticky z-[9] min-w-min shadow-sm',
    pinnedRowsBottom: 'sticky bottom-0 z-[9] min-w-min shadow-[0_-1px_2px_rgba(0,0,0,0.05)]',
    rowSelected:
        'before:pointer-events-none before:absolute before:inset-0 before:z-[6] before:bg-primary/8',
    rowEditing:
        'after:pointer-events-none after:absolute after:inset-0 after:z-[8] after:ring-2 after:ring-inset after:ring-primary',
    groupBoundary: 'border-e border-outline-variant',
    /**
     * A drawer draws both of its own edges, so it is framed the same on
     * both sides wherever it stands, including in the middle of a group
     * where the grid draws no line of its own. The cells beside it give
     * theirs up for the same reason.
     */
    railEdge: 'border-s border-outline-variant',
    headerDivider: 'border-e border-outline-variant',
    filterRow:
        'grid min-w-min border-t border-outline-variant bg-surface-container-low [grid-template-columns:var(--dg-grid-template)]',
    filterCell:
        'relative flex h-(--dg-row-h) min-w-0 items-center gap-1 overflow-hidden px-1.5 outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
    filterCellPinned: 'sticky z-[15] bg-surface-container-low',
    filterSummary: 'min-w-0 grow truncate text-xs text-on-surface-variant',
    filterPanel:
        'fixed z-40 flex w-68 flex-col gap-2 rounded-lg border border-outline-variant bg-surface p-3 shadow-lg',
    filterChips: 'flex flex-wrap items-center gap-1.5',
    statusBar: 'flex items-center gap-2 text-xs text-on-surface-variant',
    footer: 'flex flex-wrap items-center justify-end gap-x-3 gap-y-2',

    // Grouping, range selection, the tool panel, the filter builder, the
    // import wizard, conditional formatting, saved views, find and replace
    // and the command palette. Registered here rather than in a second
    // table so an app overrides every slot the grid has in one `ui` prop.
    groupPanel:
        'flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-outline-variant px-3 py-2',
    groupPanelLabel: 'text-xs font-medium text-on-surface-variant',
    groupPanelChip:
        'inline-flex items-center gap-1 rounded-md bg-surface-container py-0.5 pr-0.5 pl-2',
    groupPanelChipLabel: 'text-xs font-medium text-on-surface',
    groupPanelSeparator: 'size-3.5 text-on-surface-variant',
    groupPanelEmpty: 'text-xs text-on-surface-variant',

    rangeStatusBar:
        'flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-on-surface-variant',
    rangeStatusBarValue: 'text-on-surface',

    rangeCell:
        'relative bg-primary/10 before:pointer-events-none before:absolute before:inset-0 before:z-[2] before:border-primary/45',
    rangeEdgeTop: 'before:border-t',
    rangeEdgeBottom: 'before:border-b',
    rangeEdgeStart: 'before:border-s',
    rangeEdgeEnd: 'before:border-e',

    fillHandle:
        'after:absolute after:end-0 after:bottom-0 after:z-20 after:size-[7px] after:cursor-crosshair after:bg-primary after:content-[""]',

    cutSource:
        'relative before:pointer-events-none before:absolute before:inset-0 before:z-[3] before:border before:border-dashed before:border-primary',

    moveTarget:
        'relative bg-tertiary/10 before:pointer-events-none before:absolute before:inset-0 before:z-[3] before:border before:border-tertiary/60',

    fillPreview:
        'relative bg-primary/5 before:pointer-events-none before:absolute before:inset-0 before:z-[2] before:border-dashed before:border-primary/45',

    toolPanel:
        'flex w-full flex-col gap-3 rounded-lg border border-outline-variant bg-surface p-3 lg:w-72 lg:shrink-0',
    toolPanelCollapsed:
        'flex w-full flex-row items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface p-2 lg:w-auto lg:flex-col lg:justify-start',
    toolPanelHeader: 'flex items-center justify-between gap-2',
    toolPanelTitle: 'text-xs font-medium text-on-surface',
    toolPanelTabs: 'flex items-center gap-1',
    toolPanelBody: 'flex max-h-96 min-h-0 flex-col gap-1 overflow-y-auto lg:max-h-none',
    toolPanelRow:
        'flex items-center gap-1 rounded px-1 py-1 hover:bg-surface-container has-[input:checked]:bg-transparent',
    toolPanelRowMuted: 'opacity-60',
    toolPanelValueRow: 'flex flex-col gap-1 rounded px-1 py-1',
    toolPanelRowLabel: 'grow truncate text-xs text-on-surface',
    toolPanelPinMark: 'text-[10px] font-medium tracking-wide text-primary uppercase',
    toolPanelHint: 'text-xs text-on-surface-variant',

    filterBuilder: 'flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface p-3',
    filterBuilderGroup: 'flex flex-col gap-2 rounded-md border border-outline-variant/70 p-2',
    filterBuilderGroupHeader: 'flex flex-wrap items-center gap-2',
    filterBuilderRow: 'flex flex-wrap items-center gap-2',
    filterBuilderColumnSelect: 'w-full shrink-0 sm:w-44',
    filterBuilderOperatorSelect: 'w-full shrink-0 sm:w-48',
    filterBuilderValueInput: 'w-full min-w-36 sm:w-auto sm:min-w-0 sm:grow',
    filterBuilderValuePlaceholder: 'text-on-surface-variant',
    filterBuilderHint: 'text-xs text-on-surface-variant',

    importPanel: 'flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface p-4',
    importDropZone:
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-outline-variant px-4 py-10 text-center transition-colors',
    importDropZoneActive: 'border-primary bg-primary-container/40',
    importHint: 'text-xs text-on-surface-variant',
    importMapRow: 'flex flex-col gap-1 rounded px-1 py-1',
    importMapLabel: 'text-xs font-medium text-on-surface',
    importMapSelect: 'w-full',
    importIssueList: 'flex max-h-40 flex-col gap-1 overflow-y-auto',
    importIssueRow: 'flex items-center justify-between gap-3 text-xs text-on-surface-variant',
    importIssueCount: 'shrink-0 tabular-nums text-error',
    importStagedCell: 'bg-tertiary/10',
    importBadCell: 'bg-error/15 ring-1 ring-inset ring-error/60',

    commandPalette: 'p-0 max-w-lg',

    findPanel:
        'flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2',
    findCount: 'text-xs tabular-nums text-on-surface-variant',

    findMatch: 'bg-tertiary/20',

    findMatchCurrent: 'bg-tertiary/40 ring-1 ring-inset ring-tertiary',

    formatHighlight: 'bg-tertiary/20',

    formatPanel:
        'flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2',
    formatPanelLabel: 'text-xs font-medium text-on-surface-variant',
    formatPanelEmpty: 'text-xs text-on-surface-variant',
    formatPanelError: 'text-xs text-error',
    formatRuleChip:
        'inline-flex items-center gap-1 rounded-md bg-surface-container-high py-0.5 pr-0.5 pl-2',
    formatRuleChipLabel: 'text-xs font-medium text-on-surface',
    formatRuleChipInvalid: 'ring-1 ring-error',

    savedViews:
        'flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2',
    savedViewsLabel: 'text-xs font-medium text-on-surface-variant',
    savedViewsModified: 'text-xs text-warning'
}

export type DataGridSlots = keyof typeof datagridSlots

/** An app's classes for any slot, merged over the grid's own. */
export type DataGridUi = Partial<Record<DataGridSlots, ClassNameValue>>
