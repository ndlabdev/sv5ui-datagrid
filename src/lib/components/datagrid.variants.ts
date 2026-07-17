import { tv, type VariantProps } from 'tailwind-variants'

export const datagridVariants = tv({
    slots: {
        root: 'w-full space-y-3',
        toolbar: 'flex flex-wrap items-center gap-2',
        viewport: 'relative w-full overflow-auto rounded-lg border border-outline-variant text-sm',
        header: 'sticky top-0 z-10 min-w-full border-b border-outline-variant bg-surface-container',
        headerRow: 'grid [grid-template-columns:var(--dg-grid-template)]',
        groupRow:
            'relative grid [grid-template-columns:var(--dg-grid-template)] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[16] after:h-px after:bg-outline-variant',
        headerCell:
            'group/head relative flex h-(--dg-row-h) min-w-0 items-center gap-1 px-3 font-medium whitespace-nowrap text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
        groupCell:
            'relative flex h-(--dg-row-h) min-w-0 items-center justify-center gap-1 px-3 text-xs font-medium whitespace-nowrap text-on-surface-variant',
        sortButton:
            'inline-flex min-w-0 cursor-pointer items-center gap-1 truncate select-none transition-colors hover:text-on-surface',
        resizeHandle:
            'absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40 active:bg-primary',
        menuButton:
            'opacity-0 transition-opacity group-hover/head:opacity-100 group-focus-within/head:opacity-100',
        dropIndicator: 'pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-primary',
        pinnedCell:
            'sticky z-[5] bg-surface group-hover/row:bg-surface-container-low border-outline-variant',
        pinnedHeaderCell: 'sticky z-[15] bg-surface-container',
        chooserItem: 'flex items-center gap-2 px-1 py-1',
        body: 'relative',
        bodyOffset: 'will-change-transform',
        row: 'group/row relative grid [grid-template-columns:var(--dg-grid-template)] transition-colors after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-[6] after:h-px after:bg-outline-variant last:after:hidden hover:bg-surface-container-low',
        cell: 'flex min-h-(--dg-row-h) min-w-0 items-center px-3 py-(--dg-cell-py) text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
        empty: 'w-full p-4',
        groupBoundary: 'border-r border-outline-variant',
        footer: 'flex justify-end'
    },
    variants: {
        align: {
            left: { headerCell: 'justify-start text-left', cell: 'justify-start text-left' },
            center: {
                headerCell: 'justify-center text-center',
                cell: 'justify-center text-center'
            },
            right: { headerCell: 'justify-end text-right', cell: 'justify-end text-right' }
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
