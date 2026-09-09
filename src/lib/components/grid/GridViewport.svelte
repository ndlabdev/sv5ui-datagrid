<script lang="ts">
    import { tick } from 'svelte'
    import { useElementSize } from 'sv5ui'
    import { HEADER_ROW, type CellPosition } from '../../core/interaction/index.js'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { getEditing } from '../../features/editing/index.js'
    import { getFiltering } from '../../features/filtering/index.js'
    import { getPagination } from '../../features/pagination/index.js'
    import { getRowPinning } from '../../features/row-pinning/index.js'
    import { getVirtualization } from '../../features/virtualization/index.js'
    import { isRtl, scrollStart, setScrollStart } from '../../core/utils/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridViewportProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'
    import { ariaRowCountOf, headerRowsOf, windowStartOf } from '../internal/window.js'

    let { class: className, children }: GridViewportProps = $props()

    const grid = getGridContext()
    const virtualization = getVirtualization(grid)
    const columnVirtualizer = virtualization?.columnVirtualizer ?? null
    const columnOps = getColumnOps(grid)
    const filteringState = getFiltering(grid)
    const pinning = getRowPinning(grid)
    const editing = getEditing(grid)
    const slots = datagridVariants()
    const theme = getGridTheme()

    const pinnedRowCount = $derived(pinning?.pinnedCount ?? 0)

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
        if (element) {
            virtualization.virtualizer.chromeHeight = Math.max(
                0,
                element.scrollHeight - virtualization.virtualizer.totalHeight
            )
        }
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
    let movedByKeyboard = false

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
        followPage(active.row)
    })

    $effect(() => {
        if (virtualization) return

        const api = grid.api as { ensureVisible?: (target: number | string) => void }
        api.ensureVisible = async (target) => {
            const row =
                typeof target === 'number'
                    ? target
                    : grid.preWindowNodes.findIndex((node) => node.id === target)
            if (row < 0) return

            followPage(row)
            await tick()
            element
                ?.querySelector(`[data-dg-cell^="${row - windowStartOf(grid)}:"]`)
                ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
        return () => {
            delete api.ensureVisible
        }
    })

    function followPage(row: number): void {
        const pagination = getPagination(grid)
        if (!pagination?.pageSize || pagination.server) return
        const targetPage = Math.floor(row / pagination.pageSize) + 1
        if (targetPage !== pagination.page) pagination.setPage(targetPage)
    }

    $effect(() => {
        void grid.focus.active
        void grid.nodes
        void columnVirtualizer?.range
        if (!pendingFocus || !element) return

        const cell = element.querySelector<HTMLElement>(selectorFor(pendingFocus))
        if (cell) {
            pendingFocus = null
            const byKeyboard = movedByKeyboard
            movedByKeyboard = false

            if (document.activeElement !== cell && cell.contains(document.activeElement)) return

            cell.focus()
            if (byKeyboard) requestAnimationFrame(() => revealColumn(cell))
        }
    })

    function clearSpan(row: Element, cell: HTMLElement, view: DOMRect) {
        let start = view.left
        let end = view.right
        for (const sibling of row.children) {
            if (sibling === cell || getComputedStyle(sibling).position !== 'sticky') continue
            const box = sibling.getBoundingClientRect()
            if (box.left - view.left <= view.right - box.right) start = Math.max(start, box.right)
            else end = Math.min(end, box.left)
        }
        return { start, end }
    }

    function revealColumn(cell: HTMLElement): void {
        const row = cell.parentElement
        if (!element || !row || document.activeElement !== cell) return
        if (getComputedStyle(cell).position === 'sticky') return

        const { start, end } = clearSpan(row, cell, element.getBoundingClientRect())
        const box = cell.getBoundingClientRect()
        const offset =
            box.left < start || box.width > end - start
                ? box.left - start
                : Math.max(0, box.right - end)
        if (offset === 0) return
        setScrollStart(element, scrollStart(element) + (isRtl(element) ? -offset : offset))
    }

    function selectorFor(position: CellPosition): string {
        const section = sectionOf(position)
        if (section === 'body') return `[data-dg-cell="${position.row}:${position.col}"]`
        if (section === 'header') {
            return `[data-dg-header-cell="${position.row}:${position.col}"]`
        }
        return `[data-dg-pinned-cell="${section}:${position.row}:${position.col}"]`
    }

    function outsideBody(target: HTMLElement | null): CellPosition | null {
        const header = target?.closest('[data-dg-header-cell]')?.getAttribute('data-dg-header-cell')
        if (header) {
            const [level, col] = header.split(':')
            return { row: Number(level), col: Number(col), section: 'header' }
        }

        const pinned = target?.closest('[data-dg-pinned-cell]')?.getAttribute('data-dg-pinned-cell')
        if (!pinned) return null
        const [section, row, col] = pinned.split(':')
        return { row: Number(row), col: Number(col), section: section as 'top' | 'bottom' }
    }

    function positionOf(event: Event): CellPosition | null {
        const target = event.target as HTMLElement | null
        if (target?.closest('[role="dialog"]')) return null

        const outside = outsideBody(target)
        if (outside) return outside

        const descriptor = target?.closest('[data-dg-cell]')?.getAttribute('data-dg-cell')
        if (!descriptor) return null

        const [row, col] = descriptor.split(':').map(Number)
        return { row, col }
    }

    function syncFocus(event: FocusEvent) {
        const position = positionOf(event)
        if (!position) return
        if (position.section) {
            grid.focus.focusCell(position)
            return
        }

        const active = grid.focus.active
        if (
            active.row !== position.row ||
            active.col !== position.col ||
            sectionOf(active) !== 'body'
        ) {
            grid.focus.focusCell(position)
        }
    }

    function focusClickedCell(event: MouseEvent) {
        const position = positionOf(event)
        if (position) grid.focus.focusCell(position)
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
        if (grid.focus.handleKeydown(event)) {
            movedByKeyboard = true
            return
        }
        if (!editing || editing.active || editing.rowEditId || !isPrintable(event)) return

        const { row, col } = grid.focus.active
        if (row < 0) return
        const node = grid.preWindowNodes[row]
        const column = grid.columns.visible[col]
        if (!node || !column || !editing.editableAt(node, column.def)) return

        event.preventDefault()
        editing.startEditWith(node.id, column.id, event.key)
    }

    function handlePaste(event: ClipboardEvent) {
        if (!editing || editing.active || editing.rowEditId) return
        if ((event.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]'))
            return
        const text = event.clipboardData?.getData('text') ?? ''
        if (!text) return
        event.preventDefault()
        void editing.pasteText(text)
    }

    function maybeTooltip(event: PointerEvent) {
        const target = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(
            '[data-dg-truncate]'
        )
        if (!target) return
        if (target.closest('[data-dg-manual-tooltip]')) return

        const text = target.textContent ?? ''
        if (text !== '' && target.scrollWidth > target.clientWidth + 1) {
            target.title = text
        } else if (target.title) {
            target.removeAttribute('title')
        }
    }

    function markScroll(target: HTMLElement): void {
        target.style.setProperty('--dg-scroll-x', `${scrollStart(target)}px`)
        target.style.setProperty('--dg-view-w', `${target.clientWidth}px`)
    }

    $effect(() => {
        void size.width
        void grid.columns.style
        if (element) markScroll(element)
    })

    function handleScroll(event: Event) {
        const target = event.currentTarget as HTMLElement
        markScroll(target)
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
    aria-rowcount={ariaRowCountOf(grid) + headerRowsOf(grid) + pinnedRowCount}
    aria-colcount={grid.columns.visible.length}
    tabindex={activeRendered ? undefined : 0}
    class={slots.viewport({ class: [theme('viewport'), className] })}
    style={grid.columns.style}
    onkeydown={handleKeydown}
    onpaste={handlePaste}
    onclick={focusClickedCell}
    onfocus={redirectFocus}
    onfocusin={syncFocus}
    onscroll={handleScroll}
    onpointerover={maybeTooltip}
>
    {@render children?.()}
</div>
