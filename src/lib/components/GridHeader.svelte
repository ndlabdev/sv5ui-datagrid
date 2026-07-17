<script lang="ts">
    import { Icon } from 'sv5ui'
    import { HEADER_ROW } from '../core/focus-model.svelte.js'
    import { rafBatch } from '../core/raf-batch.js'
    import type { HeaderGroupCell } from '../core/types.js'
    import { getColumnOps } from '../features/column-ops/index.js'
    import { getSorting } from '../features/sorting/index.js'
    import { getGridContext } from './context.js'
    import type { GridHeaderProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'
    import GridColumnMenu from './GridColumnMenu.svelte'
    import { columnWindowOf, pinLeftVar, pinRightVar } from './window.js'

    let { class: className }: GridHeaderProps = $props()

    const grid = getGridContext()
    const sorting = getSorting(grid)
    const columnOps = getColumnOps(grid)
    const slots = datagridVariants()

    const columnWindow = $derived(columnWindowOf(grid))
    const headerLevels = $derived(grid.columns.headerLevels)
    const leafRowIndex = $derived(grid.columns.headerRowCount)

    const headerCellClass = {
        left: slots.headerCell({ align: 'left' }),
        center: slots.headerCell({ align: 'center' }),
        right: slots.headerCell({ align: 'right' })
    } as const
    const groupCellClass = slots.groupCell()
    const pinnedHeaderClass = slots.pinnedHeaderCell()
    const resizeHandleClass = slots.resizeHandle()

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
        capturePointer(event.currentTarget as HTMLElement, event.pointerId)
        const startX = event.clientX
        const startWidth = ops.currentWidth(columnId)
        resizing = rafBatch((clientX) =>
            ops.setColumnWidth(columnId, startWidth + (clientX - startX))
        )
    }

    function startGroupResize(event: PointerEvent, cell: HeaderGroupCell) {
        const ops = columnOps
        if (!ops?.canResize || cell.isPlaceholder) return
        event.stopPropagation()
        capturePointer(event.currentTarget as HTMLElement, event.pointerId)
        const startX = event.clientX
        const startWidths = cell.leafIds.map((id) => ops.currentWidth(id))
        const total = startWidths.reduce((sum, width) => sum + width, 0)
        const share = (index: number) =>
            total > 0 ? startWidths[index] / total : 1 / startWidths.length
        resizing = rafBatch((clientX) => {
            const delta = clientX - startX
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
    } | null = null

    function headerPointerDown(event: PointerEvent, columnId: string) {
        if (!columnOps?.canReorder) return
        if ((event.target as HTMLElement).closest('[data-dg-noreorder]')) return
        dragCandidate = {
            id: columnId,
            startX: event.clientX,
            pointerId: event.pointerId,
            element: event.currentTarget as HTMLElement
        }
    }

    function headerPointerMove(event: PointerEvent) {
        if (!dragCandidate || !columnOps) return
        if (!columnOps.drag) {
            if (Math.abs(event.clientX - dragCandidate.startX) < 4) return
            capturePointer(dragCandidate.element, dragCandidate.pointerId)
        }
        const rect = headerRowElement?.getBoundingClientRect()
        if (rect) columnOps.updateDrag(dragCandidate.id, event.clientX - rect.left)
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

<div role="rowgroup" class={slots.header({ class: className })} style:width={columnWindow.rowWidth}>
    {#each headerLevels as level, levelIndex (levelIndex)}
        <div role="row" aria-rowindex={levelIndex + 1} class={slots.headerRow()}>
            {#each level as cell (`${cell.id}-${cell.start}`)}
                {#if cellVisible(cell)}
                    <div
                        role="columnheader"
                        aria-colindex={cell.start + 1}
                        aria-colspan={cell.span > 1 ? cell.span : undefined}
                        class={cell.pinned
                            ? `${groupCellClass} ${pinnedHeaderClass}`
                            : groupCellClass}
                        style:grid-column={`${cell.start + 1} / span ${cell.span}`}
                        style:left={pinLeftOf(cell)}
                        style:right={pinRightOf(cell)}
                    >
                        {cell.header}
                        {#if columnOps?.canResize && !cell.isPlaceholder}
                            <div
                                data-dg-noreorder
                                role="separator"
                                aria-orientation="vertical"
                                aria-label={`Resize ${cell.header} group`}
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
    <div
        role="row"
        aria-rowindex={leafRowIndex}
        class={slots.headerRow()}
        bind:this={headerRowElement}
    >
        {#each columnWindow.renderColumns as entry (entry.column.id)}
            {@const column = entry.column}
            {@const index = entry.index}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                role="columnheader"
                aria-colindex={index + 1}
                aria-sort={ariaSort(column.id)}
                tabindex={isActive(index) ? 0 : -1}
                data-dg-cell="{HEADER_ROW}:{index}"
                class={column.pinned
                    ? `${headerCellClass[column.align]} ${pinnedHeaderClass}`
                    : headerCellClass[column.align]}
                style:grid-column={columnWindow.windowed ? index + 1 : undefined}
                style:left={pinLeftVar(column)}
                style:right={pinRightVar(column)}
                onclickcapture={maybeSuppressClick}
                onclick={() => grid.focus.focusCell({ row: HEADER_ROW, col: index })}
                onpointerdown={(event) => headerPointerDown(event, column.id)}
                onpointermove={headerPointerMove}
                onpointerup={headerPointerEnd}
                onpointercancel={headerPointerCancel}
            >
                {#if sorting && column.def.sortable}
                    <button
                        type="button"
                        tabindex="-1"
                        class={slots.sortButton()}
                        onclick={() => sorting.toggleSort(column.id)}
                    >
                        {column.header}
                        <Icon name={sortIcon(column.id)} class="size-3.5 shrink-0" />
                    </button>
                {:else}
                    <span class="truncate">{column.header}</span>
                {/if}
                {#if columnOps}
                    <span class="grow"></span>
                    <GridColumnMenu {column} />
                    {#if columnOps.canResize}
                        <div
                            data-dg-noreorder
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${column.header} column`}
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
    {#if columnOps?.drag}
        <div class={slots.dropIndicator()} style:left={`${columnOps.drag.indicatorX}px`}></div>
    {/if}
</div>
