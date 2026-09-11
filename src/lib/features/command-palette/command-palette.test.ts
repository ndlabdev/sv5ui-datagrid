import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { grouping } from '../grouping/grouping.svelte.js'
import { getRangeSelection, rangeSelection } from '../range-selection/range-selection.svelte.js'
import { type CommandPalette, commandPalette, getCommandPalette } from './command-palette.svelte.js'
import type { CommandPaletteOptions, GridCommand } from './command-palette.types.js'

interface Person {
    id: number
    name: string
    dept: string
    salary: number
}

const people: Person[] = [
    { id: 1, name: 'Alice', dept: 'Core', salary: 100 },
    { id: 2, name: 'Bob', dept: 'Data', salary: 200 }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'dept', header: 'Dept' },
    { id: 'salary', header: 'Salary', hidden: true }
]

function createGrid(
    options: CommandPaletteOptions<Person> = {},
    extraFeatures: Parameters<typeof createDataGrid<Person>>[0]['features'] = []
): { grid: GridState<Person>; palette: CommandPalette<Person> } {
    const grid = createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [...(extraFeatures ?? []), commandPalette<Person>(options)]
    })
    return { grid, palette: getCommandPalette(grid)! }
}

function ids(commands: GridCommand[]): string[] {
    return commands.map((command) => command.id)
}

describe('column commands', () => {
    it('offers hide + pin for visible columns and show for hidden ones', () => {
        const { palette } = createGrid()
        const commandIds = ids(palette.commands)

        expect(commandIds).toContain('column:hide:name')
        expect(commandIds).toContain('column:pin-left:name')
        expect(commandIds).toContain('column:pin-right:name')
        expect(commandIds).toContain('column:show:salary')
        expect(commandIds).not.toContain('column:hide:salary')
    })

    it('mutates the grid when run, and the list follows', () => {
        const { grid, palette } = createGrid()

        palette.commands.find((command) => command.id === 'column:hide:name')!.run()
        expect(grid.columns.get('name')?.hidden).toBe(true)
        expect(ids(palette.commands)).toContain('column:show:name')

        palette.commands.find((command) => command.id === 'column:pin-left:dept')!.run()
        expect(grid.columns.get('dept')?.pinned).toBe('left')
        expect(ids(palette.commands)).toContain('column:unpin:dept')
    })
})

describe('grouping commands', () => {
    it('is absent without the grouping feature', () => {
        const { palette } = createGrid()
        expect(ids(palette.commands).some((id) => id.startsWith('group:'))).toBe(false)
    })

    it('offers group-by, ungroup and bulk commands from live grouping state', () => {
        const { palette } = createGrid({}, [grouping<Person>({ by: ['dept'] })])
        const commandIds = ids(palette.commands)

        expect(commandIds).toContain('group:by:name')
        expect(commandIds).not.toContain('group:by:dept')
        expect(commandIds).toContain('group:remove:dept')
        expect(commandIds).toContain('group:expand-all')
        expect(commandIds).toContain('group:collapse-all')
        expect(commandIds).toContain('group:clear')
    })
})

describe('range commands', () => {
    it('offers copy only while a range is selected', () => {
        const { grid, palette } = createGrid({}, [rangeSelection()])
        expect(ids(palette.commands)).not.toContain('range:copy')

        getRangeSelection(grid)!.startRange(0, 0)
        expect(ids(palette.commands)).toContain('range:copy')
    })
})

describe('custom commands and builtins toggle', () => {
    it('appends custom commands after the built-ins', () => {
        const { palette } = createGrid({
            commands: () => [{ id: 'custom:export', label: 'Export', run: () => {} }]
        })
        const commandIds = ids(palette.commands)
        expect(commandIds[commandIds.length - 1]).toBe('custom:export')
    })

    it('yields only custom commands when builtins is false', () => {
        const { palette } = createGrid({
            builtins: false,
            commands: () => [{ id: 'custom:only', label: 'Only', run: () => {} }]
        })
        expect(ids(palette.commands)).toEqual(['custom:only'])
    })
})

describe('palette state and api', () => {
    it('opens, toggles and closes through the grid api', () => {
        const { grid, palette } = createGrid()
        expect(palette.open).toBe(false)
        ;(grid.api.openCommandPalette as () => void)()
        expect(palette.open).toBe(true)
        ;(grid.api.toggleCommandPalette as () => void)()
        expect(palette.open).toBe(false)
    })

    it('run closes the palette before executing', () => {
        const { palette } = createGrid()
        const order: string[] = []
        palette.show()
        palette.run({
            id: 'probe',
            label: 'Probe',
            run: () => order.push(`ran while open=${palette.open}`)
        })
        expect(order).toEqual(['ran while open=false'])
    })
})
