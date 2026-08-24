import { describe, expect, it } from 'vitest'
import { createColumnState } from './column-sizing.js'
import {
    buildGroupPaths,
    buildHeaderLevels,
    flattenColumns,
    foldableGroupIds,
    groupBoundaries,
    groupIdsOf,
    hiddenByCollapse,
    parentGroupIdOf
} from './header-groups.js'
import type { ColumnDef, ColumnState } from '../types/index.js'

interface Row {
    [key: string]: unknown
}

const defs: ColumnDef<Row>[] = [
    {
        id: 'identity',
        header: 'Identity',
        children: [
            { id: 'id', header: '#' },
            { id: 'name', header: 'Name' }
        ]
    },
    { id: 'status', header: 'Status' },
    {
        id: 'comp',
        header: 'Compensation',
        children: [
            { id: 'salary', header: 'Salary' },
            {
                id: 'bonus-group',
                header: 'Bonus',
                children: [
                    { id: 'q1', header: 'Q1' },
                    { id: 'q2', header: 'Q2' }
                ]
            }
        ]
    }
]

function states(
    ids: string[],
    pinnedById: Record<string, 'left' | 'right'> = {}
): ColumnState<Row>[] {
    const leaves = flattenColumns(defs)
    return ids.map((id) => {
        const def = leaves.find((leaf) => leaf.id === id)!
        return createColumnState(def, { pinned: pinnedById[id] ?? null })
    })
}

describe('flattenColumns', () => {
    it('returns leaf defs depth-first', () => {
        expect(flattenColumns(defs).map((def) => def.id)).toEqual([
            'id',
            'name',
            'status',
            'salary',
            'q1',
            'q2'
        ])
    })
})

describe('buildGroupPaths', () => {
    it('maps each leaf to its ancestor chain', () => {
        const paths = buildGroupPaths(defs)
        expect(paths.get('id')?.map((group) => group.id)).toEqual(['identity'])
        expect(paths.get('status')).toEqual([])
        expect(paths.get('q1')?.map((group) => group.id)).toEqual(['comp', 'bonus-group'])
        expect(parentGroupIdOf(paths, 'q1')).toBe('bonus-group')
        expect(parentGroupIdOf(paths, 'status')).toBeNull()
    })
})

describe('groupBoundaries', () => {
    it('flags the last column of each top-level cell except the final one', () => {
        const visible = states(['id', 'name', 'status', 'salary', 'q1', 'q2'])
        const levels = buildHeaderLevels(visible, buildGroupPaths(defs))

        expect(groupBoundaries(levels, visible.length)).toEqual([
            false,
            true,
            true,
            false,
            false,
            false
        ])
    })

    it('returns no flags for flat definitions', () => {
        expect(groupBoundaries([], 3)).toEqual([false, false, false])
    })
})

describe('buildHeaderLevels', () => {
    it('returns no levels for flat definitions', () => {
        const flat: ColumnDef<Row>[] = [{ id: 'a' }, { id: 'b' }]
        expect(buildHeaderLevels(states(['id']).slice(0, 0), buildGroupPaths(flat))).toEqual([])
    })

    it('builds spans per level with placeholders above ungrouped leaves', () => {
        const visible = states(['id', 'name', 'status', 'salary', 'q1', 'q2'])
        const levels = buildHeaderLevels(visible, buildGroupPaths(defs))

        expect(levels).toHaveLength(2)
        expect(
            levels[0].map((cell) => ({ id: cell.id, start: cell.start, span: cell.span }))
        ).toEqual([
            { id: 'identity', start: 0, span: 2 },
            { id: 'placeholder-0-2', start: 2, span: 1 },
            { id: 'comp', start: 3, span: 3 }
        ])
        expect(
            levels[1].filter((cell) => !cell.isPlaceholder).map((cell) => [cell.id, cell.span])
        ).toEqual([['bonus-group', 2]])
    })

    it('splits a group span when its leaves land in different pin sections', () => {
        const visible = states(['name', 'status', 'salary', 'q1', 'q2', 'id'], { id: 'left' })
        const reordered = [visible[5], ...visible.slice(0, 5)]
        const levels = buildHeaderLevels(reordered, buildGroupPaths(defs))

        const identityCells = levels[0].filter((cell) => cell.id === 'identity')
        expect(identityCells).toHaveLength(2)
        expect(identityCells[0].pinned).toBe('left')
        expect(identityCells[0].span).toBe(1)
        expect(identityCells[1].pinned).toBeNull()
    })

    it('merges adjacent placeholders into one cell', () => {
        const flatWithGroup: ColumnDef<Row>[] = [
            { id: 'a' },
            { id: 'b' },
            { id: 'g', header: 'G', children: [{ id: 'c' }] }
        ]
        const leaves = flattenColumns(flatWithGroup)
        const visible = leaves.map((def) => createColumnState(def))
        const levels = buildHeaderLevels(visible, buildGroupPaths(flatWithGroup))

        expect(levels[0].map((cell) => [cell.isPlaceholder, cell.span])).toEqual([
            [true, 2],
            [false, 1]
        ])
    })
})

describe('columnGroupShow', () => {
    /**
     * A group that folds down to one summary column, holding a nested group
     * that folds on its own account.
     */
    const defs: ColumnDef<Row>[] = [
        { id: 'id', header: '#' },
        {
            id: 'pay',
            header: 'Pay',
            children: [
                { id: 'total', header: 'Total', columnGroupShow: 'closed' },
                { id: 'base', header: 'Base', columnGroupShow: 'open' },
                {
                    id: 'extras',
                    header: 'Extras',
                    columnGroupShow: 'open',
                    children: [
                        { id: 'bonus', header: 'Bonus' },
                        { id: 'stock', header: 'Stock', columnGroupShow: 'open' }
                    ]
                }
            ]
        }
    ]

    const paths = buildGroupPaths(defs)
    const leaves = flattenColumns(defs)
    const leafOf = (id: string) => leaves.find((def) => def.id === id)!

    function shown(collapsed: string[]): string[] {
        const set = new Set(collapsed)
        return leaves
            .filter(
                (leaf) => !hiddenByCollapse(paths.get(leaf.id) ?? [], leaf, (id) => set.has(id))
            )
            .map((leaf) => leaf.id)
    }

    it('lists the groups a child asks to fold, and no others', () => {
        expect(foldableGroupIds(defs)).toEqual(new Set(['pay', 'extras']))
        expect(
            foldableGroupIds([{ id: 'a', header: 'A', children: [{ id: 'b', header: 'B' }] }])
        ).toEqual(new Set())
    })

    it('names every group in the tree', () => {
        expect(groupIdsOf(defs)).toEqual(['pay', 'extras'])
    })

    it('draws the detail while the group is open and the summary once it folds', () => {
        expect(shown([])).toEqual(['id', 'base', 'bonus', 'stock'])
        expect(shown(['pay'])).toEqual(['id', 'total'])
    })

    it('folds a nested group on its own account, not on the one above it', () => {
        // `extras` closed: its own `open` child goes, the rest of `pay` stays.
        expect(shown(['extras'])).toEqual(['id', 'base', 'bonus'])
        // And an outer fold takes the whole nested group with it.
        expect(shown(['pay', 'extras'])).toEqual(['id', 'total'])
    })

    it('leaves a column alone when nothing on its path declares anything', () => {
        expect(hiddenByCollapse([], leafOf('id'), () => true)).toBe(false)
    })

    it('stamps the toggle onto the group cells, and never onto a placeholder', () => {
        const visible = [
            createColumnState<Row>({ id: 'id', header: '#' }),
            createColumnState<Row>({ id: 'total', header: 'Total' })
        ]
        const levels = buildHeaderLevels(
            visible,
            buildGroupPaths([defs[0]!, { ...defs[1]!, children: [defs[1]!.children![0]!] }]),
            new Map([['pay', { collapsible: true, collapsed: true }]])
        )

        const [placeholder, group] = levels[0]!
        expect(placeholder).toMatchObject({ isPlaceholder: true, collapsible: false })
        expect(group).toMatchObject({ id: 'pay', collapsible: true, collapsed: true })
    })
})
