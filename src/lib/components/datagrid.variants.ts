import type { ClassNameValue } from 'tailwind-merge'
import { tv, type VariantProps } from 'tailwind-variants'
import type { Density } from '../core/types/index.js'

export const datagridVariants = tv({
    slots: {
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
        footer: 'flex flex-wrap items-center justify-end gap-x-3 gap-y-2'
    },
    variants: {
        align: {
            left: {
                headerCell: 'justify-start text-start',
                cell: 'justify-start text-start',
                rowSpanFill: 'justify-start text-start',
                tooltipTrigger: 'justify-start text-start'
            },
            center: {
                headerCell: 'justify-center text-center',
                cell: 'justify-center text-center',
                rowSpanFill: 'justify-center text-center',
                tooltipTrigger: 'justify-center text-center'
            },
            right: {
                headerCell: 'justify-end text-end',
                cell: 'justify-end text-end',
                rowSpanFill: 'justify-end text-end',
                tooltipTrigger: 'justify-end text-end'
            }
        },
        pinSide: {
            top: { pinnedRow: 'after:bottom-0' },
            bottom: { pinnedRow: 'after:top-0' }
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

export type DataGridUi = Partial<Record<DataGridSlots, ClassNameValue>>

export const datagridDefaults: { defaultVariants: { density: Density }; slots: DataGridUi } = {
    defaultVariants: { density: 'standard' },
    slots: {}
}
