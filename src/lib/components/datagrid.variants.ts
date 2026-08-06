import type { ClassNameValue } from 'tailwind-merge'
import { tv, type VariantProps } from 'tailwind-variants'
import type { Density } from '../core/types/index.js'

export const datagridVariants = tv({
    slots: {
        root: 'w-full space-y-3',
        toolbar: 'flex flex-wrap items-center gap-2',
        viewport: 'relative w-full overflow-auto rounded-lg border border-outline-variant text-sm',
        header: 'sticky top-0 z-10 min-w-min border-b border-outline-variant bg-surface-container',
        headerRow: 'grid [grid-template-columns:var(--dg-grid-template)]',
        groupRow:
            'relative grid min-w-min [grid-template-columns:var(--dg-grid-template)] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[16] after:h-px after:bg-outline-variant',
        headerCell:
            'group/head relative flex h-(--dg-row-h) min-w-0 items-center gap-1 overflow-hidden px-3 font-medium whitespace-nowrap text-on-surface-variant outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
        groupCell:
            'relative flex h-(--dg-row-h) min-w-0 items-center justify-center gap-1 px-3 text-xs font-medium whitespace-nowrap text-on-surface-variant',
        sortButton:
            'inline-flex min-w-0 cursor-pointer items-center gap-1 truncate select-none transition-colors hover:text-on-surface',
        resizeHandle:
            'absolute inset-y-0 end-0 z-10 w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40 active:bg-primary',
        // No z-index: it would open a stacking context and trap the filter
        // panel rendered inside, under the pinned header cells.
        headerControls:
            'absolute inset-y-0.5 end-1.5 flex items-center gap-0.5 bg-surface-container ps-2 opacity-0 transition-opacity group-hover/head:opacity-100 group-focus-within/head:opacity-100 [@media(hover:none)]:opacity-100',
        headerControlsPinned: 'opacity-100',
        menuButton: 'shrink-0',
        dropIndicator: 'pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-primary',
        rowHandle:
            'flex size-full cursor-grab items-center justify-center text-on-surface-variant outline-none touch-pan-y select-none hover:text-on-surface focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset active:cursor-grabbing disabled:cursor-default disabled:opacity-30',
        rowDropIndicator: 'pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary',
        // Opaque because a row has no background of its own; clipped because
        // pinned cells would otherwise spill over the ring's rounded corners.
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
        // Kept apart from `cell` so an editing cell can simply not have it: an
        // open editor draws its own ring, and the two nested read as a mistake.
        // Lifted above the row separator (z-6), or that eats the inset ring.
        cellFocus:
            'focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
        // The validation message hangs below the cell.
        cellEditing: 'overflow-visible',
        // Keeps its row's height — a taller cell grows the grid track and
        // stretches every sibling. `relative` bounds the overlay to this cell;
        // the z-index is here, not on the overlay, which a pinned cell's own
        // stacking context (z-5) would otherwise trap under the separator.
        cellRowSpan: 'relative z-[7] overflow-visible p-0',
        // The overhang: opaque and above the separator and selection tint it
        // crosses, and drawing the one at its own foot, where the next run
        // begins.
        rowSpanFill:
            'absolute inset-x-0 z-[7] flex min-w-0 items-start overflow-hidden bg-surface px-3 py-(--dg-cell-py) after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-outline-variant',
        rowSpanFillLast: 'after:hidden',
        // Merging takes the horizontal lines away; without these the block has
        // no edge left and reads as a hole.
        rowSpanEdge: 'border-e border-outline-variant',
        rowSpanEdgeStart: 'border-s border-outline-variant',
        // The separator sits over pinned cells so its line crosses them, a
        // focused cell sits over the separator so the ring stays whole, and a
        // pinned cell must sit over anything scrolling under it — a cycle.
        // Lifting pinned cells breaks it; they then draw the separator and the
        // selection tint they have risen above.
        pinnedCellRaised:
            'z-[8] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-outline-variant group-last/row:after:hidden',
        pinnedCellSelected:
            'before:pointer-events-none before:absolute before:inset-0 before:bg-primary/8',
        empty: 'w-full p-4',
        toggleButton:
            'me-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
        cellEditor: 'relative flex h-full min-h-(--dg-row-h) w-full min-w-0 items-center',
        cellEditorFlat: 'bg-surface ring-2 ring-inset ring-primary',
        cellEditorPad: 'px-2',
        // A date or time editor has an intrinsic width: fixed segments plus the
        // icon its field reserves room for. Squeezed into a narrower column the
        // segments overflow and run under that icon, so the editor is allowed
        // to outgrow the cell instead — which is already `overflow-visible`
        // while one is open.
        cellEditorWide: 'min-w-max',
        cellEditorField: 'w-full',
        cellError:
            'absolute top-full start-0 z-30 mt-0.5 rounded bg-error px-1.5 py-0.5 text-xs whitespace-nowrap text-on-error shadow-sm',
        cellEditable: 'cursor-text',
        fullWidthCell:
            'min-h-(--dg-row-h) min-w-0 overflow-hidden bg-surface-container-lowest p-3 text-on-surface outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
        pinnedRow:
            'group/row relative grid min-w-min [grid-template-columns:var(--dg-grid-template)] bg-surface after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[6] after:h-px after:bg-outline-variant',
        pinnedRowsTop: 'sticky z-[9] min-w-min shadow-sm',
        pinnedRowsBottom: 'sticky bottom-0 z-[9] min-w-min shadow-[0_-1px_2px_rgba(0,0,0,0.05)]',
        rowSelected:
            'before:pointer-events-none before:absolute before:inset-0 before:z-[6] before:bg-primary/8',
        groupBoundary: 'border-e border-outline-variant',
        // The resize handle sits on this edge but only shows on hover.
        headerDivider: 'border-e border-outline-variant',
        // Below the sv5ui popup layer (z-50), or it covers its own listboxes.
        filterPanel:
            'fixed z-40 flex w-68 flex-col gap-2 rounded-lg border border-outline-variant bg-surface p-3 shadow-lg',
        filterChips: 'flex flex-wrap items-center gap-1.5',
        statusBar: 'flex items-center gap-2 text-xs text-on-surface-variant',
        footer: 'flex flex-wrap items-center justify-end gap-x-3 gap-y-2'
    },
    variants: {
        align: {
            left: {
                headerCell: 'justify-start text-start',
                cell: 'justify-start text-start',
                rowSpanFill: 'justify-start text-start'
            },
            center: {
                headerCell: 'justify-center text-center',
                cell: 'justify-center text-center',
                rowSpanFill: 'justify-center text-center'
            },
            right: {
                headerCell: 'justify-end text-end',
                cell: 'justify-end text-end',
                rowSpanFill: 'justify-end text-end'
            }
        },
        density: {
            compact: { root: '[--dg-row-h:2rem] [--dg-cell-py:0.25rem]' },
            standard: { root: '[--dg-row-h:2.5rem] [--dg-cell-py:0.5rem]' },
            comfortable: { root: '[--dg-row-h:3rem] [--dg-cell-py:0.75rem]' }
        }
    },
    defaultVariants: {
        align: 'left',
        density: 'standard'
    }
})

export type DataGridVariantProps = VariantProps<typeof datagridVariants>
export type DataGridSlots = keyof ReturnType<typeof datagridVariants>

/** Extra classes per visual slot, merged after the variant's own. */
export type DataGridUi = Partial<Record<DataGridSlots, ClassNameValue>>

/** `align` is absent on purpose: it is resolved per column, not per grid. */
export const datagridDefaults: { defaultVariants: { density: Density }; slots: DataGridUi } = {
    defaultVariants: { density: 'standard' },
    slots: {}
}
