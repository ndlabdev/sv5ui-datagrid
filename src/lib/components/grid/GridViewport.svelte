<script lang="ts">
    import { useElementSize } from 'sv5ui'
    import { HEADER_ROW, type CellPosition } from '../../core/interaction/focus-model.svelte.js'
    import { getColumnOps } from '../../features/column-ops/index.js'
    import { getEditing } from '../../features/editing/index.js'
    import { getFiltering } from '../../features/filtering/index.js'
    import { getPagination } from '../../features/pagination/index.js'
    import { getRowPinning } from '../../features/row-pinning/index.js'
    import { getVirtualization } from '../../features/virtualization/index.js'
    import { isRtl, scrollStart, setScrollStart } from '../../core/utils/scroll.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridViewportProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'
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
    const theme = getGridTheme()

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
        // The header scrolls with the spacer, so it is part of the range the
        // scroller offers but not of the rows the range has to cover.
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

    /**
     * Turns to the page the focused row sits on. Only under a client model: a
     * server model holds one page, so its rows are indexed 0..n whichever page
     * they came from and the arithmetic would send every focus back to page 1.
     */
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

            // An editor inside the cell already holds the caret; pulling focus
            // back would take the keystrokes off the field just clicked.
            if (document.activeElement !== cell && cell.contains(document.activeElement)) return

            cell.focus()
            // Next frame, not now: measuring forces a style flush, and doing
            // that mid-effect mounts a popup the click that opened it is still
            // propagating towards — which then reads as a click outside.
            if (byKeyboard) requestAnimationFrame(() => revealColumn(cell))
        }
    })

    /**
     * The span of the viewport no pinned cell is sitting on. Which edge a
     * pinned cell holds is a question of where it ended up rather than of its
     * pin side, since under RTL the two swap over.
     */
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

    /**
     * Scrolls a focused cell clear of the pinned columns. The browser's own
     * scroll-into-view stops at the viewport edge, which is exactly where the
     * pinned columns sit, so a cell reached by keyboard parks underneath one.
     */
    function revealColumn(cell: HTMLElement): void {
        const row = cell.parentElement
        if (!element || !row || document.activeElement !== cell) return
        if (getComputedStyle(cell).position === 'sticky') return

        const { start, end } = clearSpan(row, cell, element.getBoundingClientRect())
        const box = cell.getBoundingClientRect()
        // A cell wider than the gap can only ever show one edge: its start.
        const offset =
            box.left < start || box.width > end - start
                ? box.left - start
                : Math.max(0, box.right - end)
        if (offset === 0) return
        setScrollStart(element, scrollStart(element) + (isRtl(element) ? -offset : offset))
    }

    /** Pinned rows are outside the pipeline, so they carry their own descriptor. */
    function selectorFor(position: CellPosition): string {
        const section = sectionOf(position)
        return section === 'body'
            ? `[data-dg-cell="${position.row}:${position.col}"]`
            : `[data-dg-pinned-cell="${section}:${position.row}:${position.col}"]`
    }

    /** The cell an event landed in, read back from its descriptor attribute. */
    function positionOf(event: Event): CellPosition | null {
        const target = event.target as HTMLElement | null
        // The filter panel renders inside a header cell, so its events bubble
        // here; treating them as cell interactions steals its focus.
        if (target?.closest('[role="dialog"]')) return null
        const pinned = target?.closest('[data-dg-pinned-cell]')?.getAttribute('data-dg-pinned-cell')
        if (pinned) {
            const [section, row, col] = pinned.split(':')
            return {
                row: Number(row),
                col: Number(col),
                section: section as 'top' | 'bottom'
            }
        }

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

    /** Delegated, so cells do not each allocate a handler. */
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
        // Set only where the focus model actually moved: a click reaches
        // something the user can already see, and Escape leaving a popup must
        // not drag the grid out from under the trigger they came from.
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

    /**
     * A paste event rather than a Ctrl+V binding: it reads synchronously
     * without a permission prompt, and covers right-click paste too.
     */
    function handlePaste(event: ClipboardEvent) {
        if (!editing || editing.active || editing.rowEditId) return
        if ((event.target as HTMLElement | null)?.closest('input, textarea, [contenteditable]'))
            return
        const text = event.clipboardData?.getData('text') ?? ''
        if (!text) return
        event.preventDefault()
        void editing.pasteText(text)
    }

    /** Measured on hover: comparing widths per cell per frame forces layout. */
    function maybeTooltip(event: PointerEvent) {
        const target = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(
            '[data-dg-truncate]'
        )
        if (!target) return
        // The column decides its own tooltip; measuring would fight it.
        if (target.closest('[data-dg-manual-tooltip]')) return

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

<!-- False positive: `grid` and `treegrid` are both interactive roles, but the
     compiler reads the role off a ternary and cannot resolve either literal.
     Satisfying it needs a static role, so a duplicated element or a spread. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    bind:this={element}
    role={grid.expansion.enabled ? 'treegrid' : 'grid'}
    aria-rowcount={grid.totalRows + grid.columns.headerRowCount + pinnedRowCount}
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
