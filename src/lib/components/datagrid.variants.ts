import { tv, type VariantProps } from 'tailwind-variants'

export const datagridVariants = tv({
    slots: {
        root: 'w-full space-y-3',
        toolbar: 'flex flex-wrap items-center gap-2',
        viewport: 'relative w-full overflow-auto rounded-lg border border-outline-variant text-sm',
        header: 'sticky top-0 z-10 min-w-full bg-surface-container',
        headerRow:
            'grid [grid-template-columns:var(--dg-grid-template)] border-b border-outline-variant',
        headerCell:
            'flex h-(--dg-row-h) min-w-0 items-center gap-1 px-3 font-medium whitespace-nowrap text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
        sortButton:
            'inline-flex cursor-pointer items-center gap-1 select-none transition-colors hover:text-on-surface',
        body: 'relative',
        bodyOffset: 'will-change-transform',
        row: 'grid [grid-template-columns:var(--dg-grid-template)] border-b border-outline-variant transition-colors last:border-b-0 hover:bg-surface-container-low',
        cell: 'flex min-h-(--dg-row-h) min-w-0 items-center px-3 py-(--dg-cell-py) text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
        empty: 'w-full p-4',
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
