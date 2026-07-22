<script lang="ts">
    import { Empty, Icon, Skeleton } from 'sv5ui'
    import {
        SELECTION_COLUMN_ID,
        type CellDecoration,
        type ColumnState,
        type RowNode
    } from '../../core/types.js'
    import { getEditing } from '../../features/editing/index.js'
    import { getRowPinning } from '../../features/row-pinning/index.js'
    import { getSelection } from '../../features/selection/index.js'
    import { getVirtualization } from '../../features/virtualization/index.js'
    import { getGridContext } from '../internal/context.js'
    import GridCellEditor from '../cells/GridCellEditor.svelte'
    import GridCellValue from '../cells/GridCellValue.svelte'
    import type { GridBodyProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import GridSelectionCell from '../cells/GridSelectionCell.svelte'
    import { columnWindowOf, pinLeftVar, pinRightVar, windowStartOf } from '../internal/window.js'

    let {
        emptyText = 'No data',
        loading = false,
        loadingRows = 5,
        error = null,
        onRetry,
        fullWidthRow,
        class: className
    }: GridBodyProps = $props()

    const grid = getGridContext()
    const virtualization = getVirtualization(grid)
    const selectionState = getSelection(grid)
    const pinning = getRowPinning(grid)
    const editing = getEditing(grid)
    const slots = datagridVariants()
    const editableClass = slots.cellEditable()

    function isEditingCell(node: RowNode<unknown>, column: ColumnState<unknown>): boolean {
        if (!editing) return false
        if (editing.active) return editing.isEditing(node.id, column.id)
        return editing.rowEditId === node.id && editing.editableAt(node, column.def)
    }

    function isEditable(node: RowNode<unknown>, column: ColumnState<unknown>): boolean {
        return editing?.editableAt(node, column.def) ?? false
    }

    function startEdit(node: RowNode<unknown>, column: ColumnState<unknown>): void {
        if (editing && isEditable(node, column)) editing.startEdit(node.id, column.id)
    }

    const rowClass = slots.row()
    const rowSelectedClass = `${rowClass} ${slots.rowSelected()}`

    function classOfRow(id: string): string {
        return selectionState?.isSelected(id) ? rowSelectedClass : rowClass
    }
    const cellClass = {
        left: slots.cell({ align: 'left' }),
        center: slots.cell({ align: 'center' }),
        right: slots.cell({ align: 'right' })
    } as const
    const pinnedCellClass = slots.pinnedCell()
    const boundaryClass = slots.groupBoundary()

    function withBoundary(base: string, index: number): string {
        return grid.columns.groupBoundaryFlags[index] ? `${base} ${boundaryClass}` : base
    }

    // Resolved once: a grid with no decorating feature pays nothing per cell.
    const decorators = grid.features.filter((feature) => feature.cellDecoration)

    function decorationOf(
        node: RowNode<unknown>,
        column: ColumnState<unknown>,
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
    const firstDataIndex = $derived(grid.columns.visible[0]?.id === SELECTION_COLUMN_ID ? 1 : 0)

    function isActive(row: number, col: number): boolean {
        const active = grid.focus.active
        return !active.section && active.row === row && active.col === col
    }

    function isPinnedActive(section: 'top' | 'bottom', row: number, col: number): boolean {
        const active = grid.focus.active
        return active.section === section && active.row === row && active.col === col
    }

    function rowHeightOf(row: number): string | undefined {
        if (!virtualization) return undefined
        return `${virtualization.virtualizer.sizeOf(row)}px`
    }

    function indentOf(node: RowNode<unknown>, colIndex: number): string | undefined {
        const level = node.meta?.level ?? 0
        if (colIndex !== firstDataIndex || level === 0) return undefined
        return `calc(0.75rem + ${level * 1.25}rem)`
    }

    function ariaExpanded(node: RowNode<unknown>): boolean | undefined {
        return node.meta?.expandable ? grid.expansion.isExpanded(node.id) : undefined
    }
</script>

{#snippet cellContent(
    node: RowNode<unknown>,
    column: (typeof columnWindow.renderColumns)[number]['column'],
    colIndex: number,
    rowIndex: number
)}
    {#if column.id === SELECTION_COLUMN_ID}
        <GridSelectionCell {node} />
    {:else}
        {#if colIndex === firstDataIndex && node.meta?.expandable}
            <button
                type="button"
                tabindex="-1"
                aria-label={grid.expansion.isExpanded(node.id) ? 'Collapse row' : 'Expand row'}
                class={slots.toggleButton()}
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
        {@const rowHeight = rowHeightOf(rowIndex)}
        <div
            role="row"
            aria-rowindex={rowIndex + 1 + headerRows + topRows}
            aria-selected={selectionState ? selectionState.isSelected(node.id) : undefined}
            aria-level={node.meta?.level !== undefined ? node.meta.level + 1 : undefined}
            aria-expanded={ariaExpanded(node)}
            aria-setsize={node.meta?.setSize}
            aria-posinset={node.meta?.posInSet}
            data-dg-row-id={node.id}
            class={classOfRow(node.id)}
            style:height={rowHeight}
            style:--dg-row-h={rowHeight}
            style:width={columnWindow.rowWidth}
        >
            {#if node.meta?.fullWidth}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    role="gridcell"
                    aria-colindex={1}
                    tabindex={isActive(rowIndex, 0) ? 0 : -1}
                    data-dg-cell="{rowIndex}:0"
                    class={slots.fullWidthCell()}
                    style="grid-column: 1 / -1"
                    onclick={() => grid.focus.focusCell({ row: rowIndex, col: 0 })}
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
                {#each columnWindow.renderColumns as entry (entry.column.id)}
                    {@const column = entry.column}
                    {@const colIndex = entry.index}
                    {@const editingCell = isEditingCell(node, column)}
                    {@const decoration = decorationOf(node, column, rowIndex, colIndex)}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        role="gridcell"
                        aria-colindex={colIndex + 1}
                        aria-selected={decoration?.selected}
                        tabindex={isActive(rowIndex, colIndex) ? 0 : -1}
                        data-dg-cell="{rowIndex}:{colIndex}"
                        class={withBoundary(
                            (column.pinned
                                ? `${cellClass[column.align]} ${pinnedCellClass}`
                                : cellClass[column.align]) +
                                (!editingCell && isEditable(node, column)
                                    ? ` ${editableClass}`
                                    : '') +
                                (decoration?.class ? ` ${decoration.class}` : ''),
                            colIndex
                        )}
                        style:grid-column={columnWindow.windowed ? colIndex + 1 : undefined}
                        style:inset-inline-start={pinLeftVar(column)}
                        style:inset-inline-end={pinRightVar(column)}
                        style:padding={editingCell ? '0' : undefined}
                        style:padding-left={editingCell ? undefined : indentOf(node, colIndex)}
                        onclick={() => grid.focus.focusCell({ row: rowIndex, col: colIndex })}
                        ondblclick={() => startEdit(node, column)}
                    >
                        {#if editingCell}
                            <GridCellEditor {node} {column} rowMode={editing?.active === null} />
                        {:else}
                            {@render cellContent(node, column, colIndex, rowIndex)}
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>
    {/each}
{/snippet}

{#snippet pinnedRows(nodes: RowNode<unknown>[], baseIndex: number, section: 'top' | 'bottom')}
    {#each nodes as node, pinIndex (node.id)}
        <div
            role="row"
            aria-rowindex={baseIndex + pinIndex}
            data-dg-row-id={node.id}
            class={slots.pinnedRow()}
            style:width={columnWindow.rowWidth}
        >
            {#each columnWindow.renderColumns as entry (entry.column.id)}
                {@const column = entry.column}
                <div
                    role="gridcell"
                    aria-colindex={entry.index + 1}
                    tabindex={isPinnedActive(section, pinIndex, entry.index) ? 0 : -1}
                    data-dg-pinned-cell="{section}:{pinIndex}:{entry.index}"
                    class={withBoundary(
                        column.pinned
                            ? `${cellClass[column.align]} ${pinnedCellClass}`
                            : cellClass[column.align],
                        entry.index
                    )}
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
        class={slots.pinnedRowsTop()}
        style:top={`calc(var(--dg-row-h) * ${headerRows})`}
    >
        {@render pinnedRows(pinning.topNodes, headerRows + 1, 'top')}
    </div>
{/if}

<div
    role="rowgroup"
    aria-busy={loading || undefined}
    class={slots.body({ class: className })}
    style:height={virtualization && !loading && !error && grid.totalRows > 0
        ? `${virtualization.virtualizer.totalHeight}px`
        : undefined}
>
    {#if error}
        <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
            <div
                role="gridcell"
                aria-colindex={1}
                class={slots.empty()}
                style="grid-column: 1 / -1"
            >
                <Empty
                    icon="lucide:circle-alert"
                    title={error}
                    variant="naked"
                    size="sm"
                    actions={onRetry ? [{ label: 'Retry', size: 'sm', onclick: onRetry }] : []}
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
                class={slots.empty()}
                style="grid-column: 1 / -1"
            >
                <Empty icon="lucide:inbox" title={emptyText} variant="naked" size="sm" />
            </div>
        </div>
    {:else if virtualization}
        <div
            class={slots.bodyOffset()}
            style:transform={`translateY(${virtualization.virtualizer.offsetY}px)`}
        >
            {@render rows()}
        </div>
    {:else}
        {@render rows()}
    {/if}
</div>

{#if pinning && pinning.bottomNodes.length > 0}
    <div role="rowgroup" class={slots.pinnedRowsBottom()}>
        {@render pinnedRows(
            pinning.bottomNodes,
            headerRows + topRows + grid.totalRows + 1,
            'bottom'
        )}
    </div>
{/if}
