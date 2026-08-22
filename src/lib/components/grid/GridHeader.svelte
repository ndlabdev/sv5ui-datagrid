<script lang="ts">
    import { Badge, Icon } from 'sv5ui'
    import { HEADER_ROW } from '../../core/interaction/index.js'
    import { inlineDelta, inlineOffset, isRtl, rafBatch } from '../../core/utils/index.js'
    import {
        isSyntheticColumn,
        SELECTION_COLUMN_ID,
        type ColumnState,
        type HeaderGroupCell
    } from '../../core/types/index.js'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { getFiltering } from '../../features/filtering/index.js'
    import { getSorting } from '../../features/sorting/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridHeaderProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'
    import GridColumnMenu from '../menus/GridColumnMenu.svelte'
    import GridFilterPanel from '../menus/GridFilterPanel.svelte'
    import GridFilterRow from './GridFilterRow.svelte'
    import GridSelectionCell from '../cells/GridSelectionCell.svelte'
    import { columnWindowOf, pinLeftVar, pinRightVar } from '../internal/window.js'

    let { class: className }: GridHeaderProps = $props()

    const grid = getGridContext()
    const sorting = getSorting(grid)
    const columnOps = getColumnOps(grid)
    const filteringState = getFiltering(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    const columnWindow = $derived(columnWindowOf(grid))
    const headerLevels = $derived(grid.columns.headerLevels)
    const leafRowIndex = $derived(grid.columns.headerRowCount)

    const headerCellClass = $derived({
        left: slots.headerCell({ align: 'left', class: theme('headerCell') }),
        center: slots.headerCell({ align: 'center', class: theme('headerCell') }),
        right: slots.headerCell({ align: 'right', class: theme('headerCell') })
    } as const)
    const groupCellClass = $derived(slots.groupCell({ class: theme('groupCell') }))
    const boundaryClass = slots.groupBoundary()

    function withBoundary(base: string, endIndex: number): string {
        return grid.columns.groupBoundaryFlags[endIndex] ? `${base} ${boundaryClass}` : base
    }

    const dividerClass = $derived(slots.headerDivider({ class: theme('headerDivider') }))
    const lastColumnIndex = $derived(grid.columns.visible.length - 1)

    /** The last column's edge is the grid's own border. */
    function withDivider(base: string, index: number): string {
        return index === lastColumnIndex ? base : `${base} ${dividerClass}`
    }
    const pinnedHeaderClass = $derived(slots.pinnedHeaderCell({ class: theme('pinnedHeaderCell') }))
    const hasControls = $derived(Boolean(filteringState || columnOps))
    const controlsBaseClass = $derived(slots.headerControls({ class: theme('headerControls') }))
    const controlsPinnedClass = $derived(
        slots.headerControlsPinned({ class: theme('headerControlsPinned') })
    )

    /** Hidden until hovered, so the label gets the cell — unless filtered. */
    function controlsClass(columnId: string): string {
        const active = filteringState ? columnId in filteringState.columnFilters : false
        return active ? `${controlsBaseClass} ${controlsPinnedClass}` : controlsBaseClass
    }
    const resizeHandleClass = $derived(slots.resizeHandle({ class: theme('resizeHandle') }))

    function isActive(index: number): boolean {
        const { row, col } = grid.focus.active
        return row === HEADER_ROW && col === index
    }

    function ariaSort(columnId: string): 'ascending' | 'descending' | undefined {
        const direction = sorting?.directionOf(columnId)
        if (!direction) return undefined
        return direction === 'asc' ? 'ascending' : 'descending'
    }

    function sortIcon(columnId: string): string {
        const direction = sorting?.directionOf(columnId)
        if (!direction) return 'lucide:chevrons-up-down'
        return direction === 'asc' ? 'lucide:chevron-up' : 'lucide:chevron-down'
    }

    /** A snippet may draw nothing readable; without one the text is the name. */
    function headerName(column: ColumnState<unknown>): string | undefined {
        if (!column.def.headerCell) return undefined
        return column.header === '' ? column.id : column.header
    }

    function cellVisible(cell: HeaderGroupCell): boolean {
        for (let index = cell.start; index < cell.start + cell.span; index++) {
            if (columnWindow.has(index)) return true
        }
        return false
    }

    function pinLeftOf(cell: HeaderGroupCell): string | undefined {
        if (cell.pinned !== 'left') return undefined
        const pinVar = grid.columns.get(cell.leafIds[0])?.pinVar
        return pinVar ? `var(${pinVar})` : undefined
    }

    function pinRightOf(cell: HeaderGroupCell): string | undefined {
        if (cell.pinned !== 'right') return undefined
        const pinVar = grid.columns.get(cell.leafIds[cell.leafIds.length - 1])?.pinVar
        return pinVar ? `var(${pinVar})` : undefined
    }

    let resizing: ((clientX: number) => void) | null = null

    function capturePointer(element: HTMLElement, pointerId: number) {
        try {
            element.setPointerCapture(pointerId)
        } catch {
            // synthetic pointer events have no active pointer to capture
        }
    }

    function startResize(event: PointerEvent, columnId: string) {
        const ops = columnOps
        if (!ops?.canResize) return
        event.stopPropagation()
        const handle = event.currentTarget as HTMLElement
        capturePointer(handle, event.pointerId)
        const startX = event.clientX
        const startWidth = ops.currentWidth(columnId)
        const rtl = isRtl(handle)
        resizing = rafBatch((clientX) =>
            ops.setColumnWidth(columnId, startWidth + inlineDelta(rtl, startX, clientX))
        )
    }

    function startGroupResize(event: PointerEvent, cell: HeaderGroupCell) {
        const ops = columnOps
        if (!ops?.canResize || cell.isPlaceholder) return
        event.stopPropagation()
        const handle = event.currentTarget as HTMLElement
        capturePointer(handle, event.pointerId)
        const startX = event.clientX
        const rtl = isRtl(handle)
        const startWidths = cell.leafIds.map((id) => ops.currentWidth(id))
        const total = startWidths.reduce((sum, width) => sum + width, 0)
        const share = (index: number) =>
            total > 0 ? startWidths[index] / total : 1 / startWidths.length
        resizing = rafBatch((clientX) => {
            const delta = inlineDelta(rtl, startX, clientX)
            const widths: Record<string, number> = {}
            cell.leafIds.forEach((id, i) => {
                widths[id] = startWidths[i] + delta * share(i)
            })
            grid.columns.setWidths(widths)
        })
    }

    function moveResize(event: PointerEvent) {
        resizing?.(event.clientX)
    }

    function endResize() {
        resizing = null
    }

    let headerRowElement = $state<HTMLElement | null>(null)
    let dragCandidate: {
        id: string
        startX: number
        pointerId: number
        element: HTMLElement
        rtl: boolean
    } | null = null

    function headerPointerDown(event: PointerEvent, columnId: string) {
        if (!columnOps?.canReorder || isSyntheticColumn(columnId)) return
        if ((event.target as HTMLElement).closest('[data-dg-noreorder]')) return
        dragCandidate = {
            id: columnId,
            startX: event.clientX,
            pointerId: event.pointerId,
            element: event.currentTarget as HTMLElement,
            // `isRtl` forces a style recalculation, and cannot change mid-drag.
            rtl: headerRowElement ? isRtl(headerRowElement) : false
        }
    }

    function headerPointerMove(event: PointerEvent) {
        if (!dragCandidate || !columnOps) return
        if (!columnOps.drag) {
            if (Math.abs(event.clientX - dragCandidate.startX) < 4) return
            capturePointer(dragCandidate.element, dragCandidate.pointerId)
        }
        const rect = headerRowElement?.getBoundingClientRect()
        if (rect) {
            columnOps.updateDrag(
                dragCandidate.id,
                inlineOffset(dragCandidate.rtl, rect, event.clientX)
            )
        }
    }

    let suppressClick = false

    function headerPointerEnd() {
        if (!dragCandidate) return
        if (columnOps?.drag) {
            suppressClick = true
            setTimeout(() => (suppressClick = false), 0)
        }
        columnOps?.commitDrag()
        dragCandidate = null
    }

    function maybeSuppressClick(event: MouseEvent) {
        if (!suppressClick) return
        suppressClick = false
        event.preventDefault()
        event.stopPropagation()
    }

    function headerPointerCancel() {
        columnOps?.cancelDrag()
        dragCandidate = null
    }
</script>

<div
    role="rowgroup"
    class={slots.header({ class: [theme('header'), className] })}
    style:width={columnWindow.rowWidth}
>
    {#each headerLevels as level, levelIndex (levelIndex)}
        <div
            role="row"
            aria-rowindex={levelIndex + 1}
            class={slots.groupRow({ class: theme('groupRow') })}
        >
            {#each level as cell (`${cell.id}-${cell.start}`)}
                {#if cellVisible(cell)}
                    <!-- A placeholder sits above columns that belong to no
                         group. It names nothing, so exposing it as a header
                         would put an unlabelled one in the accessibility tree;
                         the leaf header below already describes the column. -->
                    <div
                        role={cell.isPlaceholder ? 'presentation' : 'columnheader'}
                        aria-colindex={cell.isPlaceholder ? undefined : cell.start + 1}
                        aria-colspan={!cell.isPlaceholder && cell.span > 1 ? cell.span : undefined}
                        class={withBoundary(
                            cell.pinned ? `${groupCellClass} ${pinnedHeaderClass}` : groupCellClass,
                            cell.start + cell.span - 1
                        )}
                        style:grid-column={`${cell.start + 1} / span ${cell.span}`}
                        style:inset-inline-start={pinLeftOf(cell)}
                        style:inset-inline-end={pinRightOf(cell)}
                    >
                        {cell.header}
                        {#if columnOps?.canResize && !cell.isPlaceholder}
                            <div
                                data-dg-noreorder
                                role="separator"
                                aria-orientation="vertical"
                                aria-label={grid.labels.resizeGroup(cell.header)}
                                class={resizeHandleClass}
                                onpointerdown={(event) => startGroupResize(event, cell)}
                                onpointermove={moveResize}
                                onpointerup={endResize}
                                onpointercancel={endResize}
                            ></div>
                        {/if}
                    </div>
                {/if}
            {/each}
        </div>
    {/each}
    {#snippet headerLabel(column: ColumnState<unknown>)}
        {#if column.def.headerCell}
            {@render column.def.headerCell({ column, header: column.header })}
        {:else if column.header === ''}
            <!-- Action columns are usually headerless; a column header
                 still needs an accessible name. -->
            <span class="sr-only">{column.id}</span>
        {:else}
            <span class="truncate" data-dg-truncate>{column.header}</span>
        {/if}
    {/snippet}
    <div
        role="row"
        aria-rowindex={leafRowIndex}
        class={slots.headerRow({ class: theme('headerRow') })}
        bind:this={headerRowElement}
    >
        {#each columnWindow.renderColumns as entry (entry.column.id)}
            {@const column = entry.column}
            {@const index = entry.index}
            {@const spacer = Boolean(columnOps || filteringState) && !isSyntheticColumn(column.id)}
            <div
                role="columnheader"
                aria-colindex={index + 1}
                aria-label={headerName(column)}
                aria-sort={ariaSort(column.id)}
                tabindex={isActive(index) ? 0 : -1}
                data-dg-cell="{HEADER_ROW}:{index}"
                class={withDivider(
                    withBoundary(
                        column.pinned
                            ? `${headerCellClass[column.align]} ${pinnedHeaderClass}`
                            : headerCellClass[column.align],
                        index
                    ),
                    index
                )}
                style:grid-column={columnWindow.windowed ? index + 1 : undefined}
                style:inset-inline-start={pinLeftVar(column)}
                style:inset-inline-end={pinRightVar(column)}
                onclickcapture={maybeSuppressClick}
                onpointerdown={(event) => headerPointerDown(event, column.id)}
                onpointermove={headerPointerMove}
                onpointerup={headerPointerEnd}
                onpointercancel={headerPointerCancel}
            >
                {#if spacer && column.align !== 'left'}
                    <span data-dg-spacer class="grow"></span>
                {/if}
                {#if column.id === SELECTION_COLUMN_ID}
                    <GridSelectionCell />
                {:else if sorting && column.def.sortable}
                    <button
                        type="button"
                        tabindex="-1"
                        class={slots.sortButton({ class: theme('sortButton') })}
                        onclick={(event) =>
                            sorting.toggleSort(column.id, { append: event.shiftKey })}
                    >
                        {@render headerLabel(column)}
                        <Icon name={sortIcon(column.id)} class="size-3.5 shrink-0" />
                        {#if sorting.priorityOf(column.id)}
                            <Badge label={sorting.priorityOf(column.id)!} size="xs" />
                        {/if}
                    </button>
                {:else}
                    {@render headerLabel(column)}
                {/if}
                {#if spacer && column.align !== 'right'}
                    <span data-dg-spacer class="grow"></span>
                {/if}
                {#if hasControls && !isSyntheticColumn(column.id)}
                    <span data-dg-noreorder class={controlsClass(column.id)}>
                        {#if filteringState}
                            <GridFilterPanel {column} />
                        {/if}
                        {#if columnOps}
                            <GridColumnMenu {column} />
                        {/if}
                    </span>
                {/if}
                {#if columnOps && !isSyntheticColumn(column.id)}
                    {#if columnOps.canResizeColumn(column.id)}
                        <div
                            data-dg-noreorder
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={grid.labels.resizeColumn(column.header)}
                            class={resizeHandleClass}
                            onpointerdown={(event) => startResize(event, column.id)}
                            onpointermove={moveResize}
                            onpointerup={endResize}
                            onpointercancel={endResize}
                            ondblclick={() => columnOps.autoSizeColumn(column.id)}
                        ></div>
                    {/if}
                {/if}
            </div>
        {/each}
    </div>
    <GridFilterRow />
    {#if columnOps?.drag}
        <div
            class={slots.dropIndicator({ class: theme('dropIndicator') })}
            style:inset-inline-start={`${columnOps.drag.indicatorX}px`}
        ></div>
    {/if}
</div>
