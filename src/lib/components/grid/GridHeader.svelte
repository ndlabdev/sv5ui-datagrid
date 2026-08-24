<script lang="ts">
    import type { Snippet } from 'svelte'
    import { Badge, Button, Icon } from 'sv5ui'
    import { HEADER_ROW } from '../../core/interaction/index.js'
    import { inlineDelta, inlineOffset, isRtl, rafBatch } from '../../core/utils/index.js'
    import {
        isSyntheticColumn,
        railGroupIdOf,
        SELECTION_COLUMN_ID,
        type ColumnState,
        type HeaderGroupCell,
        type HeaderGroupContext
    } from '../../core/types/index.js'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { getFiltering } from '../../features/filtering/index.js'
    import { getSorting } from '../../features/sorting/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridHeaderProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { twMerge } from 'tailwind-merge'
    import { getGridTheme } from '../internal/theme.js'
    import GridColumnMenu from '../menus/GridColumnMenu.svelte'
    import GridFilterPanel from '../menus/GridFilterPanel.svelte'
    import GridFilterRow from './GridFilterRow.svelte'
    import GridSelectionCell from '../cells/GridSelectionCell.svelte'
    import {
        columnWindowOf,
        pinLeftVar,
        pinRightVar,
        isRailAt,
        railEdgeClasses,
        railInset,
        railsOf,
        type RailBand
    } from '../internal/window.js'

    let { class: className }: GridHeaderProps = $props()

    const grid = getGridContext()
    const sorting = getSorting(grid)
    const columnOps = getColumnOps(grid)
    const filteringState = getFiltering(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    const columnWindow = $derived(columnWindowOf(grid))
    // The head of every drawer the header has to cover, in row coordinates.
    const rails = $derived(railsOf(grid, columnWindow))
    const headerLevels = $derived(grid.columns.headerLevels)
    const leafRowIndex = $derived(grid.columns.headerRowCount)

    const headerCellClass = $derived({
        left: slots.headerCell({ align: 'left', class: theme('headerCell') }),
        center: slots.headerCell({ align: 'center', class: theme('headerCell') }),
        right: slots.headerCell({ align: 'right', class: theme('headerCell') })
    } as const)
    const groupCellClass = $derived(slots.groupCell({ class: theme('groupCell') }))
    const groupFoldableClass = $derived(
        slots.groupCellFoldable({ class: theme('groupCellFoldable') })
    )
    const groupToggleClass = $derived(slots.groupToggle({ class: theme('groupToggle') }))
    const groupContentClass = $derived(slots.groupContent({ class: theme('groupContent') }))

    /** Whether the caret stands on this group cell. */
    function groupActive(level: number, cell: HeaderGroupCell): boolean {
        const { row, col, section } = grid.focus.active
        return section === 'header' && row === level && col === cell.start
    }

    /** A group folded to a rail: its name runs down the strip, not in here. */
    function railedShut(cell: HeaderGroupCell): boolean {
        return cell.collapsed && grid.columns.isRail(cell.id)
    }

    /** An app's own drawing for this group, if it gave one. */
    function groupSnippetOf(cell: HeaderGroupCell): Snippet<[HeaderGroupContext]> | undefined {
        return cell.isPlaceholder ? undefined : grid.columns.groupDef(cell.id)?.headerGroupCell
    }

    /** Pinned and foldable are independent of each other. */
    function groupClassOf(cell: HeaderGroupCell): string {
        const plain = cell.pinned ? `${groupCellClass} ${pinnedHeaderClass}` : groupCellClass
        const base = withRailSurface(plain, columnIdUnder(cell))
        // The room kept for the toggle lands on the same side as the cell's
        // own padding, and the one that wins is the one Tailwind emits last.
        // What holds it honest is the layout test, which measures the label
        // against the toggle rather than trusting either class.
        // Not when it is folded to a rail: there is no toggle in there then,
        // and 44px of track cannot hold 44px of padding, so the cell would
        // stand a pixel wider than its column and double the line down its
        // edge.
        return cell.collapsible && !railedShut(cell) ? `${base} ${groupFoldableClass}` : base
    }
    const boundaryClass = slots.groupBoundary()

    function withBoundary(base: string, endIndex: number): string {
        if (!grid.columns.groupBoundaryFlags[endIndex] || isRailAt(grid, endIndex + 1)) return base
        return `${base} ${boundaryClass}`
    }

    const dividerClass = $derived(slots.headerDivider({ class: theme('headerDivider') }))
    const lastColumnIndex = $derived(grid.columns.visible.length - 1)

    /** The last column's edge is the grid's own border. */
    function withDivider(base: string, index: number): string {
        if (index === lastColumnIndex || isRailAt(grid, index + 1)) return base
        return `${base} ${dividerClass}`
    }

    const railSurfaceClass = $derived(slots.railSurface({ class: theme('railSurface') }))
    const railHeadClass = $derived(slots.railHead({ class: theme('railHead') }))
    const railEdgeClass = $derived(slots.railEdge({ class: theme('railEdge') }))
    const railFocusClass = $derived(slots.railFocus({ class: theme('railFocus') }))
    const railInnerClass = $derived(slots.railInner({ class: theme('railInner') }))
    const railLabelClass = $derived(slots.railLabel({ class: theme('railLabel') }))

    /**
     * Whether the caret stands anywhere in this drawer's column. The cells
     * there are covered, header and rows alike, so the drawer shows the
     * caret for whichever of them the caret is on.
     */
    function railFocused(columnId: string): boolean {
        return grid.columns.visible[grid.focus.active.col]?.id === columnId
    }

    function railHeadClassOf(rail: RailBand): string {
        let result = `${railHeadClass} ${railEdgeClasses(grid, rail.index, { lead: railEdgeClass, trail: boundaryClass })}`
        if (railFocused(rail.id)) result += ` ${railFocusClass}`
        return result
    }

    /**
     * A rail's own cells wear the strip's surface, not the header's. Merged
     * rather than appended: a pinned cell brings a surface of its own, and
     * which one lands last in the sheet is not this file's to know.
     */
    function withRailSurface(base: string, columnId: string | undefined): string {
        return columnId && railGroupIdOf(columnId) ? twMerge(base, railSurfaceClass) : base
    }

    /**
     * The column a group cell stands over, when it stands over exactly one.
     * A rail is one column wide, so this is what tells a cell at any level
     * that the drawer runs under it.
     */
    function columnIdUnder(cell: HeaderGroupCell): string | undefined {
        return cell.span === 1 ? grid.columns.visible[cell.start]?.id : undefined
    }
    const pinnedHeaderClass = $derived(slots.pinnedHeaderCell({ class: theme('pinnedHeaderCell') }))
    const hasControls = $derived(Boolean(filteringState || columnOps))
    const controlsBaseClass = $derived(slots.headerControls({ class: theme('headerControls') }))
    const controlsPinnedClass = $derived(
        slots.headerControlsPinned({ class: theme('headerControlsPinned') })
    )

    /**
     * Hidden until hovered, so the label gets the cell — unless the column is
     * filtered, or its panel is open. The panel is portalled out of the header
     * and takes focus with it, so `focus-within` cannot keep the trigger it is
     * anchored to on screen, and a panel opened from the column menu or from
     * the filter row would otherwise hang under nothing.
     */
    function controlsClass(columnId: string): string {
        const shown = filteringState
            ? columnId in filteringState.columnFilters || filteringState.filterFor === columnId
            : false
        return shown ? `${controlsBaseClass} ${controlsPinnedClass}` : controlsBaseClass
    }
    const resizeHandleClass = $derived(slots.resizeHandle({ class: theme('resizeHandle') }))

    function isActive(index: number): boolean {
        const { row, col } = grid.focus.active
        return row === HEADER_ROW && col === index
    }

    /** Says which way the click goes, so the name is the action taken. */
    function groupToggleLabel(cell: HeaderGroupCell): string {
        return cell.collapsed
            ? grid.labels.expandGroup(cell.header)
            : grid.labels.collapseGroup(cell.header)
    }

    /**
     * Folds the group, and leaves the caret on the group's own cell rather
     * than on the control inside it. Focus lives on cells everywhere else in
     * the grid, and a control that keeps it after a click is what leaves a
     * ring sitting in the header afterwards.
     */
    function toggleGroup(event: Event, groupId: string, level: number, start: number): void {
        columnOps?.toggleGroup(groupId)
        grid.focus.focusCell({ row: level, col: start, section: 'header' })
        // Taken by hand: the viewport will not pull focus off a control that
        // sits inside a cell, which is how an open editor keeps the
        // keystrokes meant for it.
        ;(event.currentTarget as HTMLElement).closest<HTMLElement>('[data-dg-header-cell]')?.focus()
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
    <!-- The head of each folded group's drawer. Hidden from the accessibility
         tree for the same reason the strip under it is: the group's own cell,
         which this covers, is what a reader and the keyboard already have. -->
    {#each rails as rail (rail.id)}
        <div
            aria-hidden="true"
            data-dg-rail-head={rail.groupId}
            class={railHeadClassOf(rail)}
            style:inset-inline-start={railInset(rail).start}
            style:width={railInset(rail).width}
            onclick={() => columnOps?.toggleGroup(rail.groupId)}
        >
            <!-- At the top of the drawer, which is the top of the grid: the
                 name of a folded group belongs where the name of an open one
                 is, and the header is where the header is read. It stays
                 there while the rows scroll because the header does. -->
            <span class={railInnerClass}>
                <Icon name="lucide:chevrons-right" class="size-3.5 shrink-0" />
                <span data-dg-truncate class={railLabelClass}>{rail.header}</span>
            </span>
        </div>
    {/each}
    {#each headerLevels as level, levelIndex (levelIndex)}
        <div
            role="row"
            aria-rowindex={levelIndex + 1}
            class={slots.groupRow({ class: theme('groupRow') })}
        >
            {#each level as cell (`${cell.id}-${cell.start}`)}
                {#if cellVisible(cell)}
                    {#if cell.isPlaceholder}
                        <!-- A placeholder sits above columns that belong to no
                             group. It names nothing and does nothing, so it is
                             neither a header in the accessibility tree nor a
                             cell focus can stand on; the leaf header below
                             already describes the column. -->
                        <div
                            role="presentation"
                            class={withBoundary(groupClassOf(cell), cell.start + cell.span - 1)}
                            style:grid-column={`${cell.start + 1} / span ${cell.span}`}
                            style:inset-inline-start={pinLeftOf(cell)}
                            style:inset-inline-end={pinRightOf(cell)}
                        ></div>
                    {:else}
                        <div
                            role="columnheader"
                            aria-colindex={cell.start + 1}
                            aria-colspan={cell.span > 1 ? cell.span : undefined}
                            aria-expanded={cell.collapsible ? !cell.collapsed : undefined}
                            tabindex={groupActive(levelIndex, cell) ? 0 : -1}
                            data-dg-header-cell="{levelIndex}:{cell.start}"
                            class={withBoundary(groupClassOf(cell), cell.start + cell.span - 1)}
                            style:grid-column={`${cell.start + 1} / span ${cell.span}`}
                            style:inset-inline-start={pinLeftOf(cell)}
                            style:inset-inline-end={pinRightOf(cell)}
                        >
                            {#if railedShut(cell)}
                                <!-- Drawn by the strip under it, which covers
                                     this cell: 44px of header would clip the
                                     name, and the strip carries it down its
                                     own length. Out of sight is not out of
                                     the accessibility tree, though, or the
                                     header this cell is would be an empty
                                     one and the caret would land on nothing
                                     a reader can say. -->
                                <span class="sr-only">{cell.header}</span>
                            {:else if groupSnippetOf(cell)}
                                <!-- In a box of its own: a group is at its
                                     narrowest when folded, and what an app
                                     draws has to give way there rather than
                                     spill over the group beside it. -->
                                <span class={groupContentClass}>
                                    {@render groupSnippetOf(cell)!({
                                        cell,
                                        // Plainly what it says. An app owns
                                        // the markup it drew and the caret
                                        // inside it, so nothing here moves
                                        // focus on its behalf.
                                        toggle: () => columnOps?.toggleGroup(cell.id)
                                    })}
                                </span>
                            {:else}
                                <!-- A group is at its narrowest exactly when it is
                                 folded, so the label has to give way rather
                                 than run under the toggle beside it. -->
                                <span class="truncate" data-dg-truncate>{cell.header}</span>
                            {/if}
                            {#if cell.collapsible && !railedShut(cell)}
                                <!-- At the trailing edge, so the label sits where
                                 it sits in every other group and the toggle
                                 reads as belonging to this block rather than
                                 to the seam between two.

                                 Not a tab stop of its own: the grid is one,
                                 and the cell around it takes the roving
                                 focus, where Enter and Space do what this
                                 does. -->
                                <span data-dg-noreorder class={groupToggleClass}>
                                    <Button
                                        variant="ghost"
                                        color="secondary"
                                        size="xs"
                                        square
                                        tabindex={-1}
                                        icon={cell.collapsed
                                            ? 'lucide:chevrons-right'
                                            : 'lucide:chevrons-left'}
                                        label={groupToggleLabel(cell)}
                                        ui={{ label: 'sr-only' }}
                                        onclick={(event: MouseEvent) =>
                                            toggleGroup(event, cell.id, levelIndex, cell.start)}
                                    />
                                </span>
                            {/if}
                            {#if columnOps?.canResize && !railedShut(cell)}
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
                {/if}
            {/each}
        </div>
    {/each}
    {#snippet headerLabel(column: ColumnState<unknown>)}
        {#if railGroupIdOf(column.id)}
            <!-- The strip below carries the name down its length; repeating it
                 here would only clip it against the strip's own width. The
                 cell takes the strip's own surface, so the drawer reads as one
                 block from the header down. -->
            <span class="sr-only">{column.header}</span>
        {:else if column.def.headerCell}
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
                class={withRailSurface(
                    withDivider(
                        withBoundary(
                            column.pinned
                                ? `${headerCellClass[column.align]} ${pinnedHeaderClass}`
                                : headerCellClass[column.align],
                            index
                        ),
                        index
                    ),
                    column.id
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
