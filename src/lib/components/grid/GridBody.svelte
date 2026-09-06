<script lang="ts" generics="TRow">
    import { Empty, Icon, Skeleton, Tooltip } from 'sv5ui'
    import {
        isSyntheticColumn,
        railGroupIdOf,
        ROW_HANDLE_COLUMN_ID,
        SELECTION_COLUMN_ID,
        type CellDecoration,
        type ColumnState,
        type RowNode
    } from '../../core/types/index.js'
    import { opensRowSpanGroup, rowColSpans, rowSpansOf } from '../../core/columns/index.js'
    import {
        DEFAULT_EMPTY_TEXT,
        formatCellText,
        inlineStyle,
        isBlank
    } from '../../core/utils/index.js'
    import { getEditing } from '../../features/editing/index.js'
    import { getPagination } from '../../features/pagination/index.js'
    import { getRowPinning } from '../../features/row-pinning/index.js'
    import { getRowReorder } from '../../features/row-reorder/index.js'
    import { getSelection } from '../../features/selection/index.js'
    import { getVirtualization } from '../../features/virtualization/index.js'
    import { twMerge } from 'tailwind-merge'
    import { getGridContext } from '../internal/context.js'
    import { notTabbable } from '../internal/focus.js'
    import { getGridTheme } from '../internal/theme.js'
    import GridCellEditor from '../cells/GridCellEditor.svelte'
    import GridCellValue from '../cells/GridCellValue.svelte'
    import type { GridBodyProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import GridRowHandleCell from '../cells/GridRowHandleCell.svelte'
    import GridSelectionCell from '../cells/GridSelectionCell.svelte'
    import {
        ariaRowCountOf,
        columnWindowOf,
        headerRowsOf,
        pinLeftVar,
        pinRightVar,
        isRailAt,
        railEdgeClasses,
        railInset,
        railsOf,
        rowIndexOffsetOf,
        windowStartOf,
        type RailBand
    } from '../internal/window.js'

    let {
        emptyText,
        loading: loadingProp,
        loadingRows,
        error: errorProp,
        onRetry: onRetryProp,
        fullWidthRow,
        class: className
    }: GridBodyProps<TRow> = $props()

    const grid = getGridContext<TRow>()

    function errorText(value: unknown): string | undefined {
        if (value === null || value === undefined) return undefined
        return value instanceof Error ? value.message : String(value)
    }

    const loading = $derived(loadingProp ?? grid.status?.loading ?? false)
    const error = $derived(errorProp ?? errorText(grid.status?.error) ?? null)
    const onRetry = $derived(onRetryProp ?? grid.status?.onRetry)
    const labels = $derived(grid.labels)
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

    const rowEditOpensAt = $derived.by(() => {
        const rowId = editing?.rowEditId
        if (!rowId) return null
        const node = grid.nodeById(rowId)
        if (!node) return null
        return grid.columns.visible.find((candidate) => isEditable(node, candidate))?.id ?? null
    })

    function startEdit(node: RowNode<TRow>, column: ColumnState<TRow>): void {
        if (editing && isEditable(node, column)) editing.beginEdit(node.id, column.id)
    }

    const rowClass = $derived(slots.row({ class: theme('row') }))
    const rowSelectedClass = $derived(
        `${rowClass} ${slots.rowSelected({ class: theme('rowSelected') })}`
    )
    const rowDraggingClass = $derived(slots.rowDragging({ class: theme('rowDragging') }))
    const rowEditingClass = $derived(slots.rowEditing({ class: theme('rowEditing') }))

    function classOfRow(node: RowNode<TRow>): string {
        let base = selectionState?.isSelected(node.id) ? rowSelectedClass : rowClass
        if (reorder?.drag?.sourceId === node.id) base += ` ${rowDraggingClass}`
        if (editing?.rowEditId === node.id) base += ` ${rowEditingClass}`
        const custom = grid.rowClass?.(node)
        return custom ? twMerge(base, custom) : base
    }

    const cellClass = $derived({
        left: slots.cell({ align: 'left', class: theme('cell') }),
        center: slots.cell({ align: 'center', class: theme('cell') }),
        right: slots.cell({ align: 'right', class: theme('cell') })
    } as const)
    const cellFocusClass = $derived(slots.cellFocus({ class: theme('cellFocus') }))
    const tooltipTriggerClass = $derived({
        left: slots.tooltipTrigger({ align: 'left', class: theme('tooltipTrigger') }),
        center: slots.tooltipTrigger({ align: 'center', class: theme('tooltipTrigger') }),
        right: slots.tooltipTrigger({ align: 'right', class: theme('tooltipTrigger') })
    } as const)
    const pinnedCellClass = $derived(slots.pinnedCell({ class: theme('pinnedCell') }))
    const pinnedCellRaisedClass = $derived(
        slots.pinnedCellRaised({ class: theme('pinnedCellRaised') })
    )
    const pinnedCellSelectedClass = $derived(
        slots.pinnedCellSelected({ class: theme('pinnedCellSelected') })
    )
    const cellEditingClass = $derived(slots.cellEditing({ class: theme('cellEditing') }))
    const cellRowSpanClass = $derived(slots.cellRowSpan({ class: theme('cellRowSpan') }))
    const rowSpanFillClass = $derived({
        left: slots.rowSpanFill({ align: 'left', class: theme('rowSpanFill') }),
        center: slots.rowSpanFill({ align: 'center', class: theme('rowSpanFill') }),
        right: slots.rowSpanFill({ align: 'right', class: theme('rowSpanFill') })
    } as const)
    const rowSpanFillLastClass = $derived(
        slots.rowSpanFillLast({ class: theme('rowSpanFillLast') })
    )
    const rowSpanEdgeClass = $derived(slots.rowSpanEdge({ class: theme('rowSpanEdge') }))
    const rowSpanEdgeStartClass = $derived(
        slots.rowSpanEdgeStart({ class: theme('rowSpanEdgeStart') })
    )

    function edgeClasses(colIndex: number): string {
        const columns = grid.columns.visible
        if (!rowSpans.has(columns[colIndex]?.id)) return ''
        return opensRowSpanGroup(columns, colIndex, rowSpans)
            ? `${rowSpanEdgeClass} ${rowSpanEdgeStartClass}`
            : rowSpanEdgeClass
    }

    function fillClass(
        align: ColumnState<TRow>['align'],
        colIndex: number,
        owner: number,
        length: number
    ): string {
        let result = `${rowSpanFillClass[align]} ${edgeClasses(colIndex)}`
        if (owner + length >= grid.preWindowNodes.length) result += ` ${rowSpanFillLastClass}`
        return result
    }
    const dropIndicatorClass = $derived(
        slots.rowDropIndicator({ class: theme('rowDropIndicator') })
    )
    const boundaryClass = slots.groupBoundary()
    const railSurfaceClass = $derived(slots.railSurface({ class: theme('railSurface') }))

    interface CellClassInput {
        node: RowNode<TRow>
        column: ColumnState<TRow>
        colIndex: number
        rowIndex: number
        editing?: boolean
        decoration?: CellDecoration
        rowSpanning?: boolean
    }

    function pinnedClasses(node: RowNode<TRow>, column: ColumnState<TRow>): string {
        const selected = selectionState?.isSelected(node.id)
        const raised = railGroupIdOf(column.id) ? '' : ` ${pinnedCellRaisedClass}`
        return `${pinnedCellClass}${raised}${selected ? ` ${pinnedCellSelectedClass}` : ''}`
    }

    function editStateClasses(input: CellClassInput): string {
        if (input.editing) return cellEditingClass
        const editable = isEditable(input.node, input.column) ? ` ${editableClass}` : ''
        return `${cellFocusClass}${editable}`
    }

    function classOfCell(input: CellClassInput): string {
        const { node, column, colIndex, rowIndex, decoration } = input
        let result = `${cellClass[column.align]} ${editStateClasses(input)}`
        if (column.pinned) result += ` ${pinnedClasses(node, column)}`
        if (input.rowSpanning) result += ` ${cellRowSpanClass}`
        else {
            const edges = edgeClasses(colIndex)
            if (edges) result += ` ${edges}`
        }
        if (decoration?.class) result += ` ${decoration.class}`
        if (railGroupIdOf(column.id)) {
            result = twMerge(
                result,
                railSurfaceClass,
                railEdgeClasses(grid, colIndex, { lead: railEdgeClass, trail: boundaryClass })
            )
        }
        result = withBoundary(result, colIndex)

        const custom = column.def.cellClass
        if (!custom) return result
        const extra = custom({
            node,
            row: node.row,
            value: grid.getValue(node, column),
            rowIndex,
            column
        })
        return extra ? twMerge(result, extra) : result
    }

    function withBoundary(base: string, index: number): string {
        if (!grid.columns.groupBoundaryFlags[index] || isRailAt(grid, index + 1)) return base
        return `${base} ${boundaryClass}`
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
            merged = mergeDecorations(merged, decoration)
        }
        return merged
    }

    function mergeDecorations(base: CellDecoration | undefined, next: CellDecoration) {
        const style = base?.style || next.style ? { ...base?.style, ...next.style } : undefined
        return {
            class: [base?.class, next.class].filter(Boolean).join(' ') || undefined,
            selected: base?.selected || next.selected,
            style
        }
    }

    const skeletonRows = $derived(
        loadingRows ??
            virtualization?.virtualizer.visibleCount() ??
            getPagination(grid)?.pageSize ??
            5
    )

    const windowStart = $derived(windowStartOf(grid))
    const rowIndexOffset = $derived(rowIndexOffsetOf(grid))
    const columnWindow = $derived(columnWindowOf(grid))
    const headerRows = $derived(headerRowsOf(grid))

    const rails = $derived(railsOf(grid, columnWindow))
    const railClass = $derived(slots.rail({ class: theme('rail') }))
    const railEdgeClass = $derived(slots.railEdge({ class: theme('railEdge') }))
    const railFocusClass = $derived(slots.railFocus({ class: theme('railFocus') }))

    function railClassOf(rail: RailBand): string {
        let result = `${railClass} ${railEdgeClasses(grid, rail.index, { lead: railEdgeClass, trail: boundaryClass })}`
        if (grid.columns.visible[grid.focus.active.col]?.id === rail.id) {
            result += ` ${railFocusClass}`
        }
        return result
    }
    const topRows = $derived(pinning?.topNodes.length ?? 0)
    const firstDataIndex = $derived(
        grid.columns.visible.findIndex((column) => !isSyntheticColumn(column.id))
    )

    function isActive(row: number, col: number): boolean {
        const active = grid.focus.active
        return !active.section && active.row === row && active.col === col
    }

    function isActiveInSpan(row: number, col: number, colSpan: number, rowSpan: number): boolean {
        const active = grid.focus.active
        if (active.section) return false
        return (
            active.row >= row &&
            active.row < row + rowSpan &&
            active.col >= col &&
            active.col < col + colSpan
        )
    }

    function spanColumn(colIndex: number, span: number): string | undefined {
        if (columnWindow.windowed || rowSpans.size > 0) return `${colIndex + 1} / span ${span}`
        return span > 1 ? `span ${span}` : undefined
    }

    function isPinnedActive(section: 'top' | 'bottom', row: number, col: number): boolean {
        const active = grid.focus.active
        return active.section === section && active.row === row && active.col === col
    }

    function rowHeightOf(node: RowNode<TRow>, row: number): string | undefined {
        if (!virtualization) return undefined
        if (virtualization.isAutoRow(node)) return undefined
        return `${virtualization.virtualizer.sizeOf(row)}px`
    }

    const rowSpans = $derived(rowSpansOf(grid, grid.preWindowNodes))

    interface VerticalSpan {
        owner: number
        length: number
    }

    function verticalSpan(column: ColumnState<TRow>, row: number): VerticalSpan {
        const spans = rowSpans.get(column.id)
        if (!spans) return { owner: row, length: 1 }
        const owner = spans.owner[row] ?? row
        return { owner, length: spans.span[owner] ?? 1 }
    }

    function spanHeight(owner: number, length: number): string {
        if (!virtualization) return `calc(var(--dg-row-h) * ${length})`
        let total = 0
        for (let i = 0; i < length; i++) total += virtualization.virtualizer.sizeOf(owner + i)
        return `${total}px`
    }

    function spanOffset(owner: number, row: number): string {
        if (owner >= row) return '0'
        if (!virtualization) return `calc(var(--dg-row-h) * -${row - owner})`
        let total = 0
        for (let i = owner; i < row; i++) total += virtualization.virtualizer.sizeOf(i)
        return `-${total}px`
    }

    function measureRow(element: HTMLElement, id: string | null) {
        if (!id || !virtualization) return
        const observer = new ResizeObserver(() =>
            virtualization.measureRow(id, element.offsetHeight)
        )
        observer.observe(element)
        return { destroy: () => observer.disconnect() }
    }

    function indentOf(node: RowNode<TRow>, colIndex: number): string | undefined {
        const level = node.meta?.level ?? 0
        if (colIndex !== firstDataIndex || level === 0) return undefined
        return `calc(0.75rem + ${level * 1.25}rem)`
    }

    function tooltipOf(
        node: RowNode<TRow>,
        column: (typeof columnWindow.renderColumns)[number]['column'],
        rowIndex: number
    ): string | undefined {
        const tooltip = column.def.tooltip
        if (tooltip === undefined || tooltip === false) return undefined
        const value = grid.getValue(node, column)
        const formatted = formatCellText(value, column.def, grid.locale)
        if (tooltip === true) return isBlank(value) ? undefined : (formatted ?? String(value))
        return tooltip({ node, row: node.row, value, rowIndex, column, formatted })
    }

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
    {:else if railGroupIdOf(column.id)}{:else}
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
            {@const cellValue = grid.getValue(node, column)}
            {@render column.def.cell({
                node,
                row: node.row,
                value: cellValue,
                rowIndex,
                column,
                get formatted() {
                    return formatCellText(cellValue, column.def, grid.locale)
                }
            })}
        {:else if column.def.type}
            <GridCellValue def={column.def} row={node.row} value={grid.getValue(node, column)} />
        {:else}
            {@const value = grid.getValue(node, column)}
            {#if isBlank(value)}
                <span class="text-on-surface-variant"
                    >{column.def.typeOptions?.emptyText ?? DEFAULT_EMPTY_TEXT}</span
                >
            {:else}
                <span class="truncate" data-dg-truncate>{value}</span>
            {/if}
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
            aria-rowindex={rowIndex + rowIndexOffset + 1 + headerRows + topRows}
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
                    {@const vertical = verticalSpan(column, rowIndex)}
                    {#if spans.owner[colIndex] === colIndex && (vertical.owner === rowIndex || rowIndex === windowStart)}
                        {@const colSpan = spans.span[colIndex]}
                        {@const spanRow = vertical.owner}
                        {@const rowSpan = vertical.length}
                        {@const spanNode =
                            spanRow === rowIndex ? node : (grid.preWindowNodes[spanRow] ?? node)}
                        {@const editingCell = isEditingCell(spanNode, column)}
                        {@const decoration = decorationOf(spanNode, column, spanRow, colIndex)}
                        <div
                            role="gridcell"
                            aria-colindex={colIndex + 1}
                            aria-colspan={colSpan > 1 ? colSpan : undefined}
                            aria-rowspan={rowSpan > 1 ? rowSpan : undefined}
                            aria-selected={decoration?.selected}
                            tabindex={isActiveInSpan(spanRow, colIndex, colSpan, rowSpan) ? 0 : -1}
                            data-dg-cell="{spanRow}:{colIndex}"
                            data-dg-manual-tooltip={column.def.tooltip === undefined
                                ? undefined
                                : ''}
                            use:notTabbable={column.def.tooltip !== undefined}
                            class={classOfCell({
                                node: spanNode,
                                column,
                                colIndex,
                                rowIndex: spanRow,
                                editing: editingCell,
                                decoration,
                                rowSpanning: rowSpan > 1
                            })}
                            style={inlineStyle(decoration?.style)}
                            style:grid-column={spanColumn(colIndex, colSpan)}
                            style:inset-inline-start={pinLeftVar(column)}
                            style:inset-inline-end={pinRightVar(column)}
                            style:padding={editingCell && rowSpan === 1 ? '0' : undefined}
                            style:padding-inline-start={editingCell || rowSpan > 1
                                ? undefined
                                : indentOf(spanNode, colIndex)}
                            ondblclick={() => startEdit(spanNode, column)}
                        >
                            {#if rowSpan > 1}
                                <div
                                    class={fillClass(column.align, colIndex, spanRow, rowSpan)}
                                    style:height={spanHeight(spanRow, rowSpan)}
                                    style:top={spanOffset(spanRow, rowIndex)}
                                    style:padding-inline-start={indentOf(spanNode, colIndex)}
                                >
                                    {@render cellContent(spanNode, column, colIndex, spanRow)}
                                </div>
                            {:else if editingCell}
                                {@const inRowEdit = editing?.active === null}
                                <GridCellEditor
                                    node={spanNode}
                                    {column}
                                    rowMode={inRowEdit}
                                    first={!inRowEdit || rowEditOpensAt === column.id}
                                />
                            {:else}
                                {@const tip = tooltipOf(spanNode, column, spanRow)}
                                {#if tip}
                                    <Tooltip text={tip} class={tooltipTriggerClass[column.align]}>
                                        {@render cellContent(spanNode, column, colIndex, spanRow)}
                                    </Tooltip>
                                {:else}
                                    {@render cellContent(spanNode, column, colIndex, spanRow)}
                                {/if}
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
            class={slots.pinnedRow({ pinSide: section, class: theme('pinnedRow') })}
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
    {#each rails as rail (rail.id)}
        <div
            aria-hidden="true"
            data-dg-rail={rail.groupId}
            class={railClassOf(rail)}
            style:inset-inline-start={railInset(rail).start}
            style:width={railInset(rail).width}
            onclick={() => grid.api.toggleGroup?.(rail.groupId)}
            onkeydown={null}
        ></div>
    {/each}

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
        {#each Array.from({ length: skeletonRows }, (_, i) => i) as i (i)}
            <div role="row" class={rowClass} style:width={columnWindow.rowWidth}>
                {#each columnWindow.renderColumns as entry (entry.column.id)}
                    <div
                        role="gridcell"
                        aria-colindex={entry.index + 1}
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
            headerRows + topRows + ariaRowCountOf(grid) + 1,
            'bottom'
        )}
    </div>
{/if}
