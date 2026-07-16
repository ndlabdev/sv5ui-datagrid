import { tv, type VariantProps } from 'tailwind-variants'

export const datagridVariants = tv({
    slots: {
        root: 'w-full space-y-3',
        viewport: 'relative w-full overflow-auto rounded-lg border border-outline-variant text-sm',
        header: 'sticky top-0 z-10 bg-surface-container',
        headerRow:
            'grid [grid-template-columns:var(--dg-grid-template)] border-b border-outline-variant',
        headerCell:
            'flex h-10 min-w-0 items-center gap-1 px-3 font-medium whitespace-nowrap text-on-surface-variant',
        sortButton:
            'inline-flex cursor-pointer items-center gap-1 select-none transition-colors hover:text-on-surface',
        body: 'relative',
        bodyOffset: 'will-change-transform',
        row: 'grid [grid-template-columns:var(--dg-grid-template)] border-b border-outline-variant transition-colors last:border-b-0 hover:bg-surface-container-low',
        cell: 'flex min-w-0 items-center px-3 py-2 text-on-surface',
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
        }
    },
    defaultVariants: {
        align: 'left'
    }
})

export type DataGridVariantProps = VariantProps<typeof datagridVariants>
export type DataGridSlots = keyof ReturnType<typeof datagridVariants>
