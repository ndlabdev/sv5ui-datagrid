import { describe, expect, it } from 'vitest'
import type { ColumnDef, ColumnType, RowNode } from '$lib/index.js'
import { getCellValue } from '$lib/index.js'
import { buildRowNodes } from '../lib/core/grid/index.js'
import { createColumnState } from '../lib/core/columns/index.js'
import { formatCellText } from '../lib/core/utils/index.js'
import { quickFilterNodes } from '../lib/features/filtering/index.js'
import { rowsToMatrix, toCsv } from '../lib/features/selection/index.js'

interface Shape {
    name: string
    type?: ColumnType
    typeOptions?: ColumnDef<Cell>['typeOptions']
    value: unknown
    drawn: string
    search: string | null
}

interface Cell {
    id: string
    value: unknown
}

const LOCALE = 'en-US'
const EMPTY = '-'

const JAN_10 = new Date(2024, 0, 10, 9, 30)

const shapes: Shape[] = [
    { name: 'a string', type: 'text', value: 'Alice', drawn: 'Alice', search: 'ali' },
    { name: 'an empty string', type: 'text', value: '', drawn: EMPTY, search: null },
    { name: 'null', type: 'text', value: null, drawn: EMPTY, search: null },
    { name: 'undefined', type: 'text', value: undefined, drawn: EMPTY, search: null },
    { name: 'accented text', type: 'text', value: 'Nguyễn', drawn: 'Nguyễn', search: 'Nguyễn' },
    {
        name: 'text with a comma',
        type: 'text',
        value: 'Hanoi, VN',
        drawn: 'Hanoi, VN',
        search: 'oi,'
    },
    {
        name: 'text with a quote',
        type: 'text',
        value: 'say "hi"',
        drawn: 'say "hi"',
        search: '"hi"'
    },
    { name: 'text with a newline', type: 'text', value: 'a\nb', drawn: 'a\nb', search: 'a' },

    { name: 'a number', type: 'number', value: 1234.5, drawn: '1,234.5', search: '1,234.5' },
    { name: 'zero', type: 'number', value: 0, drawn: '0', search: '0' },
    { name: 'a negative number', type: 'number', value: -5, drawn: '-5', search: '-5' },
    {
        name: 'a numeric string',
        type: 'number',
        value: '1234.5',
        drawn: '1,234.5',
        search: '1,234.5'
    },
    {
        name: 'a big number',
        type: 'number',
        value: 1e21,
        drawn: '1,000,000,000,000,000,000,000',
        search: '1,000,000,000,000,000,000,000'
    },

    { name: 'currency', type: 'currency', value: 1234.5, drawn: '$1,234.50', search: '$1,234.50' },
    { name: 'a ratio percent', type: 'percent', value: 0.05, drawn: '5%', search: '5%' },
    {
        name: 'a whole percent',
        type: 'percent',
        typeOptions: { wholePercent: true },
        value: 5,
        drawn: '5%',
        search: '5%'
    },

    {
        name: 'a Date object',
        type: 'date',
        value: JAN_10,
        drawn: 'Jan 10, 2024',
        search: 'Jan 10, 2024'
    },
    {
        name: 'a Date object at midnight',
        type: 'date',
        value: new Date(2024, 0, 10),
        drawn: 'Jan 10, 2024',
        search: 'Jan 10, 2024'
    },
    {
        name: 'a plain date string',
        type: 'date',
        value: '2024-01-10',
        drawn: 'Jan 10, 2024',
        search: 'Jan 10, 2024'
    },
    {
        name: 'a timestamp string',
        type: 'date',
        value: JAN_10.toISOString(),
        drawn: 'Jan 10, 2024',
        search: 'Jan 10, 2024'
    },
    {
        name: 'an epoch number',
        type: 'date',
        value: JAN_10.getTime(),
        drawn: 'Jan 10, 2024',
        search: 'Jan 10, 2024'
    },
    {
        name: 'a datetime',
        type: 'datetime',
        value: JAN_10,
        drawn: 'Jan 10, 2024, 9:30 AM',
        search: 'Jan 10, 2024'
    },

    { name: 'no type at all', value: 'plain', drawn: 'plain', search: 'plain' }
]

function columnOf(shape: Shape): ColumnDef<Cell> {
    return {
        id: 'value',
        header: 'Value',
        type: shape.type,
        typeOptions: shape.typeOptions
    }
}

function nodeOf(shape: Shape): RowNode<Cell>[] {
    const row: Cell =
        shape.value === undefined ? ({ id: '1' } as Cell) : { id: '1', value: shape.value }
    return buildRowNodes([row], (cell) => cell.id)
}

describe('what the cell draws', () => {
    it.each(shapes)('draws $name as its own text', (shape) => {
        const drawn = formatCellText(
            getCellValue(nodeOf(shape)[0].row, columnOf(shape)),
            columnOf(shape),
            LOCALE
        )
        expect(drawn).toBe(shape.drawn)
    })
})

describe('the quick filter finds a row by the text its cell draws', () => {
    const searchable = shapes.filter((shape) => shape.search !== null)

    it.each(searchable)('finds $name', (shape) => {
        const found = quickFilterNodes(nodeOf(shape), [columnOf(shape)], shape.search!)
        expect(found).toHaveLength(1)
    })
})

describe('an export writes what the row holds', () => {
    it.each(shapes)('writes $name without losing it', (shape) => {
        const column = createColumnState(columnOf(shape))
        const csv = toCsv(rowsToMatrix(nodeOf(shape), [column]))
        expect(csv).not.toContain('[object')
        expect(csv).not.toContain('Invalid Date')
    })

    it.each(shapes.filter((shape) => shape.type === 'date' || shape.type === 'datetime'))(
        'writes $name as the day the cell shows',
        (shape) => {
            const column = createColumnState(columnOf(shape))
            const csv = toCsv(rowsToMatrix(nodeOf(shape), [column]))
            expect(csv).toContain('2024-01-10')
        }
    )
})
