import { type GridState } from '../../core/grid/index.js'
import { SELECTION_COLUMN_ID } from '../../core/types/index.js'
import { getGrouping } from '../grouping/grouping.svelte.js'
import { getFindReplace } from '../find-replace/index.js'
import { getRangeSelection } from '../range-selection/range-selection.svelte.js'
import type { CommandPaletteOptions, GridCommand } from './command-palette.types.js'

export function columnCommands<TRow>(grid: GridState<TRow>): GridCommand[] {
    const t = grid.labels
    const commands: GridCommand[] = []

    for (const column of grid.columns.all) {
        if (column.id === SELECTION_COLUMN_ID) continue
        const { id, header } = column

        if (column.hidden) {
            commands.push({
                id: `column:show:${id}`,
                label: t.commandShowColumn(header),
                icon: 'lucide:eye',
                group: t.commandGroupColumns,
                run: () => grid.columns.setHidden(id, false)
            })
            continue
        }

        commands.push({
            id: `column:hide:${id}`,
            label: t.commandHideColumn(header),
            icon: 'lucide:eye-off',
            group: t.commandGroupColumns,
            run: () => grid.columns.setHidden(id, true)
        })

        if (column.pinned) {
            commands.push({
                id: `column:unpin:${id}`,
                label: t.commandUnpinColumn(header),
                icon: 'lucide:pin-off',
                group: t.commandGroupColumns,
                run: () => grid.columns.setPinned(id, null)
            })
        } else {
            commands.push(
                {
                    id: `column:pin-left:${id}`,
                    label: t.commandPinColumnLeft(header),
                    icon: 'lucide:pin',
                    group: t.commandGroupColumns,
                    run: () => grid.columns.setPinned(id, 'left')
                },
                {
                    id: `column:pin-right:${id}`,
                    label: t.commandPinColumnRight(header),
                    icon: 'lucide:pin',
                    group: t.commandGroupColumns,
                    run: () => grid.columns.setPinned(id, 'right')
                }
            )
        }
    }

    return commands
}

export function groupingCommands<TRow>(grid: GridState<TRow>): GridCommand[] {
    const state = getGrouping(grid)
    if (!state) return []
    const t = grid.labels
    const commands: GridCommand[] = []

    for (const column of state.groupableColumns()) {
        commands.push({
            id: `group:by:${column.id}`,
            label: t.commandGroupByColumn(column.header),
            icon: 'lucide:group',
            group: t.commandGroupGrouping,
            run: () => state.groupBy(column.id)
        })
    }

    for (const columnId of state.by) {
        commands.push({
            id: `group:remove:${columnId}`,
            label: t.commandUngroupColumn(grid.columns.get(columnId)?.header ?? columnId),
            icon: 'lucide:ungroup',
            group: t.commandGroupGrouping,
            run: () => state.ungroup(columnId)
        })
    }

    if (state.isGrouped) {
        commands.push(
            {
                id: 'group:expand-all',
                label: t.commandExpandAllGroups,
                icon: 'lucide:chevrons-up-down',
                group: t.commandGroupGrouping,
                run: state.expandAllGroups
            },
            {
                id: 'group:collapse-all',
                label: t.commandCollapseAllGroups,
                icon: 'lucide:chevrons-down-up',
                group: t.commandGroupGrouping,
                run: state.collapseAllGroups
            },
            {
                id: 'group:clear',
                label: t.commandClearGrouping,
                icon: 'lucide:x',
                group: t.commandGroupGrouping,
                run: state.clearGrouping
            }
        )
    }

    return commands
}

export function rangeCommands<TRow>(grid: GridState<TRow>): GridCommand[] {
    const state = getRangeSelection(grid)
    if (!state || state.ranges.length === 0) return []
    const t = grid.labels

    const commands: GridCommand[] = [
        {
            id: 'range:copy',
            label: t.commandCopyRange,
            icon: 'lucide:copy',
            keywords: ['clipboard'],
            group: t.commandGroupClipboard,
            run: () => void state.copyRange()
        }
    ]

    const range = state.primary
    if (state.fill && range) {
        if (range.bottom > range.top) {
            commands.push({
                id: 'range:fill-down',
                label: t.commandFillDown,
                icon: 'lucide:arrow-down-to-line',
                group: t.commandGroupClipboard,
                run: () => void state.fillWithin('down')
            })
        }
        if (range.right > range.left) {
            commands.push({
                id: 'range:fill-right',
                label: t.commandFillRight,
                icon: 'lucide:arrow-right-to-line',
                group: t.commandGroupClipboard,
                run: () => void state.fillWithin('right')
            })
        }
    }

    return commands
}

export function findCommands<TRow>(grid: GridState<TRow>): GridCommand[] {
    const state = getFindReplace(grid)
    if (!state || state.open) return []

    return [
        {
            id: 'find:open',
            label: grid.labels.commandFind,
            icon: 'lucide:search',
            keywords: ['find', 'replace', 'search'],
            group: grid.labels.commandGroupClipboard,
            run: state.show
        }
    ]
}

export function buildCommands<TRow>(
    grid: GridState<TRow>,
    options: CommandPaletteOptions<TRow>
): GridCommand[] {
    const builtins =
        (options.builtins ?? true)
            ? [
                  ...columnCommands(grid),
                  ...groupingCommands(grid),
                  ...rangeCommands(grid),
                  ...findCommands(grid)
              ]
            : []
    return [...builtins, ...(options.commands?.(grid) ?? [])]
}
