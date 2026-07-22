import { describe, expect, it } from 'vitest'
import { createColumnState } from './column-sizing.js'
import {
    buildGroupPaths,
    buildHeaderLevels,
    flattenColumns,
    groupBoundaries,
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
