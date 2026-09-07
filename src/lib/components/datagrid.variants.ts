import { tv } from 'tailwind-variants'
import { datagridSlots } from '../core/theme/index.js'

export const datagridVariants = tv({
    slots: datagridSlots,
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
