<script lang="ts">
    import { useElementSize } from 'sv5ui'
    import { HEADER_ROW, type CellPosition } from '../core/focus-model.svelte.js'
    import { getColumnOps } from '../features/column-ops/index.js'
    import { getFiltering } from '../features/filtering/index.js'
    import { getPagination } from '../features/pagination/index.js'
    import { getRowPinning } from '../features/row-pinning/index.js'
    import { getVirtualization } from '../features/virtualization/index.js'
    import { getGridContext } from './context.js'
    import type { GridViewportProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'
    import { windowStartOf } from './window.js'

    let { class: className, children }: GridViewportProps = $props()

    const grid = getGridContext()
    const virtualization = getVirtualization(grid)
    const columnVirtualizer = virtualization?.columnVirtualizer ?? null
    const columnOps = getColumnOps(grid)
    const filteringState = getFiltering(grid)
    const pinning = getRowPinning(grid)
    const slots = datagridVariants()

    const pinnedRowCount = $derived(pinning?.pinnedCount ?? 0)

    let element = $state<HTMLElement | null>(null)
    const measured = Boolean(virtualization || columnOps)
    const size = useElementSize(() => (measured ? element : null))

    $effect(() => {
        if (!virtualization) return
        virtualization.element = element
        return () => {
            virtualization.element = null
        }
    })

    $effect(() => {
        if (!columnOps) return
        columnOps.element = element
        return () => {
            columnOps.element = null
        }
    })

    $effect(() => {
        if (!virtualization) return
        virtualization.virtualizer.viewportHeight = size.height
    })

    $effect(() => {
        if (!measured) return
        grid.columns.containerWidth = size.width
        if (columnVirtualizer) columnVirtualizer.viewportWidth = size.width
    })

    const activeRendered = $derived.by(() => {
        const active = grid.focus.active
        if (columnVirtualizer && grid.columns.offsets) {
            const { start, end } = columnVirtualizer.range
            if (active.col < start || active.col >= end) return false
        }
        if (active.row === HEADER_ROW) return true
        const start = windowStartOf(grid)
        return active.row >= start && active.row < start + grid.nodes.length
    })

    let pendingFocus: CellPosition | null = null

    $effect.pre(() => {
        const active = grid.focus.active
        if (!element || !element.contains(document.activeElement)) return

        pendingFocus = active
        virtualization?.ensureColVisible(active.col)
        if (active.row < 0) return

        if (virtualization) {
            virtualization.ensureVisible(active.row)
            return
        }
        const pagination = getPagination(grid)
        if (pagination?.pageSize) {
            const targetPage = Math.floor(active.row / pagination.pageSize) + 1
            if (targetPage !== pagination.page) pagination.setPage(targetPage)
        }
    })

    $effect(() => {
        void grid.focus.active
        void grid.nodes
        void columnVirtualizer?.range
        if (!pendingFocus || !element) return

        const cell = element.querySelector<HTMLElement>(
            `[data-dg-cell="${pendingFocus.row}:${pendingFocus.col}"]`
        )
        if (cell) {
            pendingFocus = null
            cell.focus()
        }
    })

    function syncFocus(event: FocusEvent) {
        const target = event.target as HTMLElement | null
        const descriptor = target?.closest('[data-dg-cell]')?.getAttribute('data-dg-cell')
        if (!descriptor) return

        const [row, col] = descriptor.split(':').map(Number)
        const active = grid.focus.active
        if (active.row !== row || active.col !== col) grid.focus.focusCell({ row, col })
    }

    function redirectFocus(event: FocusEvent) {
        if (event.target !== element) return
        grid.focus.focusCell(grid.focus.active)
    }

    function handleScroll(event: Event) {
        const target = event.currentTarget as HTMLElement
        virtualization?.virtualizer.onScroll(target.scrollTop)
        columnVirtualizer?.onScroll(target.scrollLeft)
        if (filteringState?.filterFor) filteringState.filterFor = null
        if (columnOps?.menuFor) columnOps.menuFor = null
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    bind:this={element}
    role={grid.expansion.enabled ? 'treegrid' : 'grid'}
    aria-rowcount={grid.totalRows + grid.columns.headerRowCount + pinnedRowCount}
    aria-colcount={grid.columns.visible.length}
    tabindex={activeRendered ? undefined : 0}
    class={slots.viewport({ class: className })}
    style={grid.columns.style}
    onkeydown={grid.focus.handleKeydown}
    onfocus={redirectFocus}
    onfocusin={syncFocus}
    onscroll={handleScroll}
>
    {@render children?.()}
</div>
