<script lang="ts" generics="TRow">
    import { FILTER_ROW, HEADER_ROW } from '../../core/interaction/index.js'
    import { isSyntheticColumn } from '../../core/types/index.js'
    import { popupOpen } from '../../core/utils/index.js'
    import { getFiltering } from '../../features/filtering/index.js'
    import type { GridFilterRowProps } from '../datagrid.types.js'
    import { getGridContext } from '../internal/context.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'
    import { columnWindowOf, pinLeftVar, pinRightVar } from '../internal/window.js'
    import GridFilterCell from '../cells/GridFilterCell.svelte'

    let { debounce = 200, class: className }: GridFilterRowProps = $props()

    const grid = getGridContext<TRow>()
    const filteringState = getFiltering(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    const columnWindow = $derived(columnWindowOf(grid))

    const rowIndex = $derived(grid.columns.headerRowCount + 1)

    const cellClass = $derived(slots.filterCell({ class: theme('filterCell') }))
    const pinnedClass = $derived(slots.filterCellPinned({ class: theme('filterCellPinned') }))
    const boundaryClass = slots.groupBoundary()
    const dividerClass = $derived(slots.headerDivider({ class: theme('headerDivider') }))
    const lastColumnIndex = $derived(grid.columns.visible.length - 1)

    function classOf(pinned: boolean, index: number): string {
        let result = pinned ? `${cellClass} ${pinnedClass}` : cellClass
        if (grid.columns.groupBoundaryFlags[index]) result += ` ${boundaryClass}`
        if (index !== lastColumnIndex) result += ` ${dividerClass}`
        return result
    }

    function isActive(index: number): boolean {
        const { row, col } = grid.focus.active
        return row === FILTER_ROW && col === index
    }

    /**
     * A field swallows the arrow keys, which is what a caret is for, so the
     * row hands back the one movement the grid still owns: leaving it. Left
     * and right stay with the caret; a popup that is open keeps everything.
     */
    function onkeydown(event: KeyboardEvent): void {
        if (popupOpen()) return
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
        event.preventDefault()
        event.stopPropagation()
        grid.focus.moveBy(event.key === 'ArrowUp' ? -1 : 1, 0)
    }

    /**
     * What a cell hands focus on to. In document order, so a date cell gives
     * it to the first segment rather than to the calendar button standing
     * after the segments.
     */
    const FIELD = 'input, [role="spinbutton"], [role="combobox"], button'

    /**
     * Focus arriving on the cell itself came from the grid rather than from a
     * click in the field, so it is passed on to the field: a row you can reach
     * but not type into is not a filter row.
     */
    function onfocus(event: FocusEvent): void {
        const cell = event.currentTarget as HTMLElement
        if (event.target !== cell) return
        cell.querySelector<HTMLElement>(FIELD)?.focus()
    }

    /**
     * The row can be switched off while the caret is standing in it. Nothing
     * else would move that caret, and a grid whose only tab stop is a row it
     * no longer draws cannot be tabbed into at all.
     */
    $effect(() => {
        if (filteringState?.floatingRow) return
        const { row, col } = grid.focus.active
        if (row === FILTER_ROW) grid.focus.focusCell({ row: HEADER_ROW, col })
    })
</script>

{#if filteringState?.floatingRow}
    <div
        role="row"
        aria-rowindex={rowIndex}
        class={slots.filterRow({ class: [theme('filterRow'), className] })}
    >
        {#each columnWindow.renderColumns as entry (entry.column.id)}
            {@const column = entry.column}
            {@const index = entry.index}
            <div
                role="gridcell"
                aria-colindex={index + 1}
                tabindex={isActive(index) ? 0 : -1}
                data-dg-cell="{FILTER_ROW}:{index}"
                class={classOf(Boolean(column.pinned), index)}
                style:grid-column={columnWindow.windowed ? index + 1 : undefined}
                style:inset-inline-start={pinLeftVar(column)}
                style:inset-inline-end={pinRightVar(column)}
                {onkeydown}
                {onfocus}
            >
                {#if !isSyntheticColumn(column.id)}
                    <GridFilterCell {column} {debounce} />
                {/if}
            </div>
        {/each}
    </div>
{/if}
