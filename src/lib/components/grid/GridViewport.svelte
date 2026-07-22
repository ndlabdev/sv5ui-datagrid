<script lang="ts">
    import { useElementSize } from 'sv5ui'
    import { HEADER_ROW, type CellPosition } from '../../core/interaction/focus-model.svelte.js'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { getEditing } from '../../features/editing/index.js'
    import { getFiltering } from '../../features/filtering/index.js'
    import { getPagination } from '../../features/pagination/index.js'
    import { getRowPinning } from '../../features/row-pinning/index.js'
    import { getVirtualization } from '../../features/virtualization/index.js'
    import { scrollStart } from '../../core/utils/scroll.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridViewportProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { windowStartOf } from '../internal/window.js'

    let { class: className, children }: GridViewportProps = $props()

    const grid = getGridContext()
    const virtualization = getVirtualization(grid)
    const columnVirtualizer = virtualization?.columnVirtualizer ?? null
    const columnOps = getColumnOps(grid)
    const filteringState = getFiltering(grid)
    const pinning = getRowPinning(grid)
    const editing = getEditing(grid)
    const slots = datagridVariants()

    const pinnedRowCount = $derived(pinning?.pinnedCount ?? 0)

    // Body positions omit `section` entirely, so never compare it directly.
    const sectionOf = (position: CellPosition) => position.section ?? 'body'

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
        if (sectionOf(active) !== 'body') return true
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
        if (active.row < 0 || sectionOf(active) !== 'body') return

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

        const cell = element.querySelector<HTMLElement>(selectorFor(pendingFocus))
        if (cell) {
            pendingFocus = null
            cell.focus()
        }
    })

    /**
     * Pinned rows sit outside the pipeline, so they carry their own descriptor
     * rather than overloading `data-dg-cell` — whose row index every consumer
     * reads as an index into `preWindowNodes`.
     */
    function selectorFor(position: CellPosition): string {
        const section = sectionOf(position)
        return section === 'body'
            ? `[data-dg-cell="${position.row}:${position.col}"]`
            : `[data-dg-pinned-cell="${section}:${position.row}:${position.col}"]`
    }

    function syncFocus(event: FocusEvent) {
        const target = event.target as HTMLElement | null
        const pinned = target?.closest('[data-dg-pinned-cell]')?.getAttribute('data-dg-pinned-cell')
        if (pinned) {
            const [section, row, col] = pinned.split(':')
            grid.focus.focusCell({
                row: Number(row),
                col: Number(col),
                section: section as 'top' | 'bottom'
            })
            return
        }

        const descriptor = target?.closest('[data-dg-cell]')?.getAttribute('data-dg-cell')
        if (!descriptor) return

        const [row, col] = descriptor.split(':').map(Number)
        const active = grid.focus.active
        if (active.row !== row || active.col !== col || sectionOf(active) !== 'body') {
            grid.focus.focusCell({ row, col })
        }
    }

    function redirectFocus(event: FocusEvent) {
        if (event.target !== element) return
        grid.focus.focusCell(grid.focus.active)
    }

    function isPrintable(event: KeyboardEvent): boolean {
        return (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            event.key !== ' '
        )
    }

    function handleKeydown(event: KeyboardEvent) {
        if (grid.focus.handleKeydown(event)) return
        if (!editing || editing.active || editing.rowEditId || !isPrintable(event)) return

        const { row, col } = grid.focus.active
        if (row < 0) return
        const node = grid.preWindowNodes[row]
        const column = grid.columns.visible[col]
        if (!node || !column || !editing.editableAt(node, column.def)) return

        event.preventDefault()
        editing.startEditWith(node.id, column.id, event.key)
    }

    /**
     * Adds a tooltip only to text that is actually cut off, measured on hover
     * rather than during render: comparing widths forces layout, and doing
     * that for every visible cell on every frame would cost more than the
     * tooltip is worth.
     */
    function maybeTooltip(event: PointerEvent) {
        const target = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(
            '[data-dg-truncate]'
        )
        if (!target) return

        const text = target.textContent ?? ''
        if (text !== '' && target.scrollWidth > target.clientWidth + 1) {
            target.title = text
        } else if (target.title) {
            target.removeAttribute('title')
        }
    }

    function handleScroll(event: Event) {
        const target = event.currentTarget as HTMLElement
        virtualization?.virtualizer.onScroll(target.scrollTop)
        columnVirtualizer?.onScroll(scrollStart(target))
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
    onkeydown={handleKeydown}
    onfocus={redirectFocus}
    onfocusin={syncFocus}
    onscroll={handleScroll}
    onpointerover={maybeTooltip}
>
    {@render children?.()}
</div>
