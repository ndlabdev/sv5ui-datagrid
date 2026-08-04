<script lang="ts" generics="TRow">
    import { Empty, Icon, Skeleton } from 'sv5ui'
    import {
        isSyntheticColumn,
        ROW_HANDLE_COLUMN_ID,
        SELECTION_COLUMN_ID,
        type CellDecoration,
        type ColumnState,
        type RowNode
    } from '../../core/types/index.js'
    import { rowColSpans } from '../../core/columns/col-span.js'
    import { isBlank } from '../../core/utils/format.js'
    import { getEditing } from '../../features/editing/index.js'
    import { getRowPinning } from '../../features/row-pinning/index.js'
    import { getRowReorder } from '../../features/row-reorder/index.js'
    import { getSelection } from '../../features/selection/index.js'
    import { getVirtualization } from '../../features/virtualization/index.js'
    import { twMerge } from 'tailwind-merge'
    import { getGridContext } from '../internal/context.js'
    import { getGridTheme } from '../internal/theme.js'
    import GridCellEditor from '../cells/GridCellEditor.svelte'
    import GridCellValue from '../cells/GridCellValue.svelte'
    import type { GridBodyProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import GridRowHandleCell from '../cells/GridRowHandleCell.svelte'
    import GridSelectionCell from '../cells/GridSelectionCell.svelte'
    import { columnWindowOf, pinLeftVar, pinRightVar, windowStartOf } from '../internal/window.js'

    let {
        emptyText,
        loading = false,
        loadingRows = 5,
        error = null,
        onRetry,
        fullWidthRow,
        class: className
    }: GridBodyProps<TRow> = $props()

    const grid = getGridContext<TRow>()
    const labels = grid.labels
    const virtualization = getVirtualization(grid)
    const reorder = getRowReorder(grid)
    const selectionState = getSelection(grid)
    const pinning = getRowPinning(grid)
    const editing = getEditing(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()
    const editableClass = $derived(slots.cellEditable({ class: theme('cellEditable') }))

    function isEditingCell(node: RowNode<TRow>, column: ColumnState<TRow>): boolean {
        if (!editing) return false
        if (editing.active) return editing.isEditing(node.id, column.id)
        return editing.rowEditId === node.id && editing.editableAt(node, column.def)
    }

    function isEditable(node: RowNode<TRow>, column: ColumnState<TRow>): boolean {
        return editing?.editableAt(node, column.def) ?? false
    }

    function startEdit(node: RowNode<TRow>, column: ColumnState<TRow>): void {
        if (editing && isEditable(node, column)) editing.startEdit(node.id, column.id)
    }

    const rowClass = $derived(slots.row({ class: theme('row') }))
    const rowSelectedClass = $derived(
        `${rowClass} ${slots.rowSelected({ class: theme('rowSelected') })}`
    )
    const rowDraggingClass = $derived(slots.rowDragging({ class: theme('rowDragging') }))

    /** Only pays for `twMerge` when the app actually returns classes. */
    function classOfRow(node: RowNode<TRow>): string {
        let base = selectionState?.isSelected(node.id) ? rowSelectedClass : rowClass
        if (reorder?.drag?.sourceId === node.id) base += ` ${rowDraggingClass}`
        const custom = grid.rowClass?.(node)
        return custom ? twMerge(base, custom) : base
    }

    const cellClass = $derived({
        left: slots.cell({ align: 'left', class: theme('cell') }),
        center: slots.cell({ align: 'center', class: theme('cell') }),
        right: slots.cell({ align: 'right', class: theme('cell') })
    } as const)
    const pinnedCellClass = $derived(slots.pinnedCell({ class: theme('pinnedCell') }))
    const cellEditingClass = $derived(slots.cellEditing({ class: theme('cellEditing') }))
    const dropIndicatorClass = $derived(
        slots.rowDropIndicator({ class: theme('rowDropIndicator') })
    )
    const boundaryClass = slots.groupBoundary()

    interface CellClassInput {
        node: RowNode<TRow>
        column: ColumnState<TRow>
        colIndex: number
        rowIndex: number
        editing?: boolean
        decoration?: CellDecoration
    }

    function classOfCell(input: CellClassInput): string {
        const { node, column, colIndex, rowIndex, decoration } = input
        let result = column.pinned
            ? `${cellClass[column.align]} ${pinnedCellClass}`
            : cellClass[column.align]
        if (input.editing) result += ` ${cellEditingClass}`
        else if (isEditable(node, column)) result += ` ${editableClass}`
        if (decoration?.class) result += ` ${decoration.class}`
        result = withBoundary(result, colIndex)

        const custom = column.def.cellClass
        if (!custom) return result
        const extra = custom({
            node,
            row: node.row,
            value: grid.getValue(node, column),
            rowIndex
        })
        return extra ? twMerge(result, extra) : result
    }

    function withBoundary(base: string, index: number): string {
        return grid.columns.groupBoundaryFlags[index] ? `${base} ${boundaryClass}` : base
    }

    const decorators = grid.features.filter((feature) => feature.cellDecoration)

    function decorationOf(
        node: RowNode<TRow>,
        column: ColumnState<TRow>,
        rowIndex: number,
        colIndex: number
    ): CellDecoration | undefined {
        if (decorators.length === 0) return undefined
        let merged: CellDecoration | undefined
        for (const feature of decorators) {
            const decoration = feature.cellDecoration!({
                grid,
                node,
                column,
                rowIndex,
                colIndex
            })
            if (!decoration) continue
            merged = {
                class: [merged?.class, decoration.class].filter(Boolean).join(' ') || undefined,
                selected: merged?.selected || decoration.selected
            }
        }
        return merged
    }

    const windowStart = $derived(windowStartOf(grid))
    const columnWindow = $derived(columnWindowOf(grid))
    const headerRows = $derived(grid.columns.headerRowCount)
    const topRows = $derived(pinning?.topNodes.length ?? 0)
    // Indent, expand toggles and full-width fallbacks belong to the first column
    // that carries data, not to the grid's own grip or checkbox.
    const firstDataIndex = $derived(
        grid.columns.visible.findIndex((column) => !isSyntheticColumn(column.id))
    )

    function isActive(row: number, col: number): boolean {
        const active = grid.focus.active
        return !active.section && active.row === row && active.col === col
    }

    /** A spanning cell owns the active column when it falls anywhere in its span. */
    function isActiveInSpan(row: number, col: number, span: number): boolean {
        const active = grid.focus.active
        return !active.section && active.row === row && active.col >= col && active.col < col + span
    }

    function spanColumn(colIndex: number, span: number): string | undefined {
        if (columnWindow.windowed) return `${colIndex + 1} / span ${span}`
        return span > 1 ? `span ${span}` : undefined
    }

    function isPinnedActive(section: 'top' | 'bottom', row: number, col: number): boolean {
        const active = grid.focus.active
        return active.section === section && active.row === row && active.col === col
    }

    function rowHeightOf(node: RowNode<TRow>, row: number): string | undefined {
        if (!virtualization) return undefined
        // An auto row is measured, not sized: pinning it to the last measured
        // height would stop it from ever growing with its content.
        if (virtualization.isAutoRow(node)) return undefined
        return `${virtualization.virtualizer.sizeOf(row)}px`
    }

    /**
     * Reports an auto row's rendered height back to the virtualizer, which
     * needs it for scroll offsets. One observer per rendered row, and only the
     * window is ever rendered.
     */
    function measureRow(element: HTMLElement, id: string | null) {
        if (!id || !virtualization) return
        const observer = new ResizeObserver(() =>
            virtualization.measureRow(id, element.offsetHeight)
        )
        observer.observe(element)
        return { destroy: () => observer.disconnect() }
    }

    /** Tree and group indent. Logical, so it moves to the right edge in RTL. */
    function indentOf(node: RowNode<TRow>, colIndex: number): string | undefined {
        const level = node.meta?.level ?? 0
        if (colIndex !== firstDataIndex || level === 0) return undefined
        return `calc(0.75rem + ${level * 1.25}rem)`
    }

    /**
     * The title a cell carries from the start. Columns that say nothing about
     * tooltips return undefined and are left to the viewport's hover measure,
     * which only titles text that is actually cut off — so the common case
     * costs nothing per cell here.
     */
    function tooltipOf(
        node: RowNode<TRow>,
        column: (typeof columnWindow.renderColumns)[number]['column'],
        rowIndex: number
    ): string | undefined {
        const tooltip = column.def.tooltip
        if (tooltip === undefined || tooltip === false) return undefined
        const value = grid.getValue(node, column)
        if (tooltip === true) return isBlank(value) ? undefined : String(value)
        return tooltip({ node, row: node.row, value, rowIndex })
    }

    /**
     * Which edge of this row the drop line sits on, or undefined. Dropping
     * below the source draws under the target, above it draws over — so the
     * line always shows where the row will end up.
     */
    function dropEdgeOf(rowIndex: number): 'top' | 'bottom' | undefined {
        const drag = reorder?.drag
        if (!drag || drag.targetIndex !== rowIndex) return undefined
        const from = grid.preWindowNodes.findIndex((node) => node.id === drag.sourceId)
        if (from === rowIndex) return undefined
        return rowIndex > from ? 'bottom' : 'top'
    }

    function ariaExpanded(node: RowNode<TRow>): boolean | undefined {
        return node.meta?.expandable ? grid.expansion.isExpanded(node.id) : undefined
    }
</script>

{#snippet cellContent(
    node: RowNode<TRow>,
    column: (typeof columnWindow.renderColumns)[number]['column'],
    colIndex: number,
    rowIndex: number
)}
    {#if column.id === ROW_HANDLE_COLUMN_ID}
        <GridRowHandleCell {node} position={rowIndex + 1} />
    {:else if column.id === SELECTION_COLUMN_ID}
        <GridSelectionCell {node} />
    {:else}
        {#if colIndex === firstDataIndex && node.meta?.expandable}
            <button
                type="button"
                tabindex="-1"
                aria-label={grid.expansion.isExpanded(node.id)
                    ? labels.collapseRow
                    : labels.expandRow}
                class={slots.toggleButton({ class: theme('toggleButton') })}
                onclick={(event) => {
                    event.stopPropagation()
                    grid.expansion.toggle(node.id)
                }}
            >
                <Icon
                    name="lucide:chevron-right"
                    class={`size-4 transition-transform ${grid.expansion.isExpanded(node.id) ? 'rotate-90' : ''}`}
                />
            </button>
        {/if}
        {#if column.def.cell}
            {@render column.def.cell({
                node,
                row: node.row,
                value: grid.getValue(node, column),
                rowIndex
            })}
        {:else if column.def.type}
            <GridCellValue def={column.def} row={node.row} value={grid.getValue(node, column)} />
        {:else}
            <span class="truncate" data-dg-truncate>{grid.getValue(node, column)}</span>
        {/if}
    {/if}
{/snippet}

{#snippet rows()}
    {#each grid.nodes as node, viewIndex (node.id)}
        {@const rowIndex = windowStart + viewIndex}
        {@const rowHeight = rowHeightOf(node, rowIndex)}
        {@const dropEdge = dropEdgeOf(rowIndex)}
        <div
            role="row"
            aria-rowindex={rowIndex + 1 + headerRows + topRows}
            aria-selected={selectionState ? selectionState.isSelected(node.id) : undefined}
            aria-level={node.meta?.level !== undefined ? node.meta.level + 1 : undefined}
            aria-expanded={ariaExpanded(node)}
            aria-setsize={node.meta?.setSize}
            aria-posinset={node.meta?.posInSet}
            data-dg-row-id={node.id}
            class={classOfRow(node)}
            use:measureRow={virtualization?.isAutoRow(node) ? node.id : null}
            style:height={rowHeight}
            style:--dg-row-h={rowHeight}
            style:width={columnWindow.rowWidth}
        >
            {#if node.meta?.fullWidth}
                <div
                    role="gridcell"
                    aria-colindex={1}
                    tabindex={isActive(rowIndex, 0) ? 0 : -1}
                    data-dg-cell="{rowIndex}:0"
                    class={slots.fullWidthCell({ class: theme('fullWidthCell') })}
                    style="grid-column: 1 / -1"
                >
                    {#if fullWidthRow}
                        {@render fullWidthRow({
                            node,
                            row: node.row,
                            rowIndex
                        })}
                    {:else}
                        {grid.getValue(node, grid.columns.visible[firstDataIndex])}
                    {/if}
                </div>
            {:else}
                {@const spans = rowColSpans(grid, node, rowIndex)}
                {#each columnWindow.renderColumns as entry (entry.column.id)}
                    {@const column = entry.column}
                    {@const colIndex = entry.index}
                    {#if spans.owner[colIndex] === colIndex}
                        {@const colSpan = spans.span[colIndex]}
                        {@const editingCell = isEditingCell(node, column)}
                        {@const decoration = decorationOf(node, column, rowIndex, colIndex)}
                        <div
                            role="gridcell"
                            aria-colindex={colIndex + 1}
                            aria-colspan={colSpan > 1 ? colSpan : undefined}
                            aria-selected={decoration?.selected}
                            tabindex={isActiveInSpan(rowIndex, colIndex, colSpan) ? 0 : -1}
                            data-dg-cell="{rowIndex}:{colIndex}"
                            title={tooltipOf(node, column, rowIndex)}
                            data-dg-manual-tooltip={column.def.tooltip === undefined
                                ? undefined
                                : ''}
                            class={classOfCell({
                                node,
                                column,
                                colIndex,
                                rowIndex,
                                editing: editingCell,
                                decoration
                            })}
                            style:grid-column={spanColumn(colIndex, colSpan)}
                            style:inset-inline-start={pinLeftVar(column)}
                            style:inset-inline-end={pinRightVar(column)}
                            style:padding={editingCell ? '0' : undefined}
                            style:padding-inline-start={editingCell
                                ? undefined
                                : indentOf(node, colIndex)}
                            ondblclick={() => startEdit(node, column)}
                        >
                            {#if editingCell}
                                <GridCellEditor
                                    {node}
                                    {column}
                                    rowMode={editing?.active === null}
                                />
                            {:else}
                                {@render cellContent(node, column, colIndex, rowIndex)}
                            {/if}
                        </div>
                    {/if}
                {/each}
            {/if}
            {#if dropEdge}
                <div
                    class={dropIndicatorClass}
                    style:top={dropEdge === 'top' ? '0' : undefined}
                    style:bottom={dropEdge === 'bottom' ? '0' : undefined}
                ></div>
            {/if}
        </div>
    {/each}
{/snippet}

{#snippet pinnedRows(nodes: RowNode<TRow>[], baseIndex: number, section: 'top' | 'bottom')}
    {#each nodes as node, pinIndex (node.id)}
        <div
            role="row"
            aria-rowindex={baseIndex + pinIndex}
            data-dg-row-id={node.id}
            class={slots.pinnedRow({ class: theme('pinnedRow') })}
            style:width={columnWindow.rowWidth}
        >
            {#each columnWindow.renderColumns as entry (entry.column.id)}
                {@const column = entry.column}
                <div
                    role="gridcell"
                    aria-colindex={entry.index + 1}
                    tabindex={isPinnedActive(section, pinIndex, entry.index) ? 0 : -1}
                    data-dg-pinned-cell="{section}:{pinIndex}:{entry.index}"
                    class={classOfCell({
                        node,
                        column,
                        colIndex: entry.index,
                        rowIndex: node.index
                    })}
                    style:grid-column={columnWindow.windowed ? entry.index + 1 : undefined}
                    style:inset-inline-start={pinLeftVar(column)}
                    style:inset-inline-end={pinRightVar(column)}
                >
                    {@render cellContent(node, column, entry.index, node.index)}
                </div>
            {/each}
        </div>
    {/each}
{/snippet}

{#if pinning && pinning.topNodes.length > 0}
    <div
        role="rowgroup"
        class={slots.pinnedRowsTop({ class: theme('pinnedRowsTop') })}
        style:top={`calc(var(--dg-row-h) * ${headerRows})`}
    >
        {@render pinnedRows(pinning.topNodes, headerRows + 1, 'top')}
    </div>
{/if}

<div
    role="rowgroup"
    aria-busy={loading || undefined}
    class={slots.body({ class: [theme('body'), className] })}
    style:height={virtualization && !loading && !error && grid.totalRows > 0
        ? `${virtualization.virtualizer.totalHeight}px`
        : undefined}
>
    {#if error}
        <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
            <div
                role="gridcell"
                aria-colindex={1}
                class={slots.empty({ class: theme('empty') })}
                style="grid-column: 1 / -1"
            >
                <Empty
                    icon="lucide:circle-alert"
                    title={error}
                    variant="naked"
                    size="sm"
                    actions={onRetry ? [{ label: labels.retry, size: 'sm', onclick: onRetry }] : []}
                />
            </div>
        </div>
    {:else if loading}
        {#each Array.from({ length: loadingRows }, (_, i) => i) as i (i)}
            <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
                {#each columnWindow.renderColumns as entry (entry.column.id)}
                    <div
                        class={cellClass[entry.column.align]}
                        style:grid-column={columnWindow.windowed ? entry.index + 1 : undefined}
                    >
                        <Skeleton class="h-4 w-3/4" />
                    </div>
                {/each}
            </div>
        {/each}
    {:else if grid.totalRows === 0}
        <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
            <div
                role="gridcell"
                aria-colindex={1}
                class={slots.empty({ class: theme('empty') })}
                style="grid-column: 1 / -1"
            >
                <Empty
                    icon="lucide:inbox"
                    title={emptyText ?? labels.noData}
                    variant="naked"
                    size="sm"
                />
            </div>
        </div>
    {:else if virtualization}
        <div
            class={slots.bodyOffset({ class: theme('bodyOffset') })}
            style:transform={`translateY(${virtualization.virtualizer.offsetY}px)`}
        >
            {@render rows()}
        </div>
    {:else}
        {@render rows()}
    {/if}
</div>

{#if pinning && pinning.bottomNodes.length > 0}
    <div role="rowgroup" class={slots.pinnedRowsBottom({ class: theme('pinnedRowsBottom') })}>
        {@render pinnedRows(
            pinning.bottomNodes,
            headerRows + topRows + grid.totalRows + 1,
            'bottom'
        )}
    </div>
{/if}
