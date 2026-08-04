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
        // The filter and menu triggers float over the end of the header rather
        // than sitting in its flow: in flow they reserved their width even
        // while invisible, and a 90px column had nothing left for its label.
        //
        // Inset vertically by the width of the focus ring. The wrapper is
        // opaque, and stretched edge to edge it painted over the ring the cell
        // draws inside itself, leaving the outline broken along the top and
        // bottom wherever the controls sit.
        //
        // Revealed on hover, but a touch device has no hover to give: the last
        // rule keeps them visible wherever hovering is impossible. Tailwind
        // emits arbitrary media variants last, so it wins over the base
        // `opacity-0` without touching the pointer-device behaviour.
        // No z-index on purpose: any value here would open a stacking context
        // and trap the filter panel rendered inside, leaving it painted under
        // the pinned header cells. Coming after the label in the DOM is enough
        // to draw over it.
        headerControls:
            'absolute inset-y-0.5 end-1.5 flex items-center gap-0.5 bg-surface-container ps-2 opacity-0 transition-opacity group-hover/head:opacity-100 group-focus-within/head:opacity-100 [@media(hover:none)]:opacity-100',
        // A column that is actually filtered keeps its icon on show.
        headerControlsPinned: 'opacity-100',
        menuButton: 'shrink-0',
        dropIndicator: 'pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-primary',
        rowHandle:
            'flex size-full cursor-grab items-center justify-center text-on-surface-variant outline-none touch-pan-y select-none hover:text-on-surface focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset active:cursor-grabbing disabled:cursor-default disabled:opacity-30',
        rowDropIndicator: 'pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary',
        // The copy that follows the cursor, and what is left behind while it
        // does. The source stays in place so the list keeps its shape; fading
        // it is what says which row is in the air.
        // Opaque on purpose: a row draws no background of its own - the body
        // behind it does - so a bare copy would let the list show through it.
        // `overflow-hidden` is what keeps the ring whole: the pinned cells
        // carry a square opaque background, and without clipping they spill
        // past the rounded corners and cover the ring's arc on the left.
        rowGhost: 'overflow-hidden rounded-md bg-surface shadow-lg ring-1 ring-primary',
        rowDragging: 'opacity-40',
        pinnedCell:
            'sticky z-[5] bg-surface group-hover/row:bg-surface-container-low border-outline-variant',
        pinnedHeaderCell: 'sticky z-[15] bg-surface-container',
        chooserItem: 'flex items-center gap-2 px-1 py-1',
        body: 'relative',
        bodyOffset: 'will-change-transform',
        row: 'group/row relative grid min-w-min [grid-template-columns:var(--dg-grid-template)] transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[6] after:h-px after:bg-outline-variant last:after:hidden hover:bg-surface-container-low',
        // The focus ring is inset, so anything painted above the cell eats an
        // edge of it: the row separator sits at `z-6` and washed out the bottom
        // one. Lifting a focused cell over it keeps the ring even all round.
        cell: 'flex min-h-(--dg-row-h) min-w-0 items-center overflow-hidden px-3 py-(--dg-cell-py) text-on-surface outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
        // An open editor shows its validation message just below the cell, so
        // the cell must stop clipping while one is mounted.
        cellEditing: 'overflow-visible',
        empty: 'w-full p-4',
        toggleButton:
            'me-1 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface',
        cellEditor: 'relative flex h-full min-h-(--dg-row-h) w-full min-w-0 items-center',
        cellEditorFlat: 'bg-surface ring-2 ring-inset ring-primary',
        cellEditorPad: 'px-2',
        cellEditorField: 'w-full',
        cellError:
            'absolute top-full start-0 z-30 mt-0.5 rounded bg-error px-1.5 py-0.5 text-xs whitespace-nowrap text-on-error shadow-sm',
        cellEditable: 'cursor-text',
        fullWidthCell:
            'min-h-(--dg-row-h) min-w-0 overflow-hidden bg-surface-container-lowest p-3 text-on-surface outline-none focus-visible:z-[7] focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset',
        pinnedRow:
            'group/row relative grid min-w-min [grid-template-columns:var(--dg-grid-template)] bg-surface after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[6] after:h-px after:bg-outline-variant',
        pinnedRowsTop: 'sticky z-[8] min-w-min shadow-sm',
        pinnedRowsBottom: 'sticky bottom-0 z-[8] min-w-min shadow-[0_-1px_2px_rgba(0,0,0,0.05)]',
        rowSelected:
            'before:pointer-events-none before:absolute before:inset-0 before:z-[6] before:bg-primary/8',
        groupBoundary: 'border-e border-outline-variant',
        // Below the sv5ui popup layer on purpose. The panel is a surface, and
        // the menus it opens - the operator select, the join select - belong
        // above it. Sharing their `z-50` left the winner to DOM order, and the
        // panel is appended last, so it covered its own listboxes.
        filterPanel:
            'fixed z-40 flex w-68 flex-col gap-2 rounded-lg border border-outline-variant bg-surface p-3 shadow-lg',
        filterChips: 'flex flex-wrap items-center gap-1.5',
        statusBar: 'flex items-center gap-2 text-xs text-on-surface-variant',
        footer: 'flex flex-wrap items-center justify-end gap-x-3 gap-y-2'
    },
    variants: {
        align: {
            left: { headerCell: 'justify-start text-start', cell: 'justify-start text-start' },
            center: {
                headerCell: 'justify-center text-center',
                cell: 'justify-center text-center'
            },
            right: { headerCell: 'justify-end text-end', cell: 'justify-end text-end' }
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

/**
 * The shape `defineDataGridConfig` overrides, and the values used when it is
 * never called. `align` is deliberately absent: it is resolved per column from
 * `ColumnDef.align`, not as a whole-grid preference.
 */
export const datagridDefaults: { defaultVariants: { density: Density }; slots: DataGridUi } = {
    defaultVariants: { density: 'standard' },
    slots: {}
}
