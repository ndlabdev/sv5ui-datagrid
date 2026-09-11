<script lang="ts">
    import { getGridContext, getGridElement } from '../../components/internal/context.js'
    import { getRangeSelection } from './range-selection.svelte.js'

    const grid = getGridContext()
    const element = getGridElement()

    const range = $derived(getRangeSelection(grid))

    function inPopover(target: HTMLElement | null): boolean {
        return Boolean(target?.closest?.('[role="dialog"]'))
    }

    function cellAt(event: Event): { row: number; col: number } | null {
        const target = event.target as HTMLElement | null
        if (inPopover(target)) return null
        const descriptor = target?.closest?.('[data-dg-cell]')?.getAttribute('data-dg-cell')
        if (!descriptor) return null
        return parseDescriptor(descriptor)
    }

    function parseDescriptor(descriptor: string): { row: number; col: number } | null {
        const [row, col] = descriptor.split(':').map(Number)
        if (row === undefined || col === undefined) return null
        if (Number.isNaN(row) || Number.isNaN(col)) return null

        if (row < 0) return null
        return { row, col }
    }

    function isInteractive(event: Event): boolean {
        const target = event.target as HTMLElement | null
        return Boolean(
            target?.closest?.('input, textarea, button, [role="checkbox"], [data-dg-editing]')
        )
    }

    const HANDLE_GRAB = 10

    function onFillHandle(event: PointerEvent): boolean {
        const at = range?.fillHandleAt
        if (!at) return false

        const cell = cellAt(event)
        if (!cell || cell.row !== at.row || cell.col !== at.col) return false

        const box = (event.target as HTMLElement | null)
            ?.closest('[data-dg-cell]')
            ?.getBoundingClientRect()
        if (!box) return false
        return event.clientX >= box.right - HANDLE_GRAB && event.clientY >= box.bottom - HANDLE_GRAB
    }

    const BORDER_GRAB = 4

    const EDGES = ['start', 'end', 'top', 'bottom'] as const

    function nearEdges(element: Element, event: PointerEvent) {
        const box = element.getBoundingClientRect()
        const rtl = getComputedStyle(element).direction === 'rtl'
        const nearLeft = event.clientX - box.left <= BORDER_GRAB
        const nearRight = box.right - event.clientX <= BORDER_GRAB

        return {
            start: rtl ? nearRight : nearLeft,
            end: rtl ? nearLeft : nearRight,
            top: event.clientY - box.top <= BORDER_GRAB,
            bottom: box.bottom - event.clientY <= BORDER_GRAB
        }
    }

    function onMoveBorder(event: PointerEvent, cell: { row: number; col: number }): boolean {
        const edges = range?.moveBorderAt(cell.row, cell.col)
        const element = (event.target as HTMLElement | null)?.closest('[data-dg-cell]')
        if (!edges || !element) return false

        const near = nearEdges(element, event)
        return EDGES.some((edge) => edges[edge] && near[edge])
    }

    function onPointerDown(event: PointerEvent) {
        if (!range || event.button !== 0 || isInteractive(event)) return

        if (onFillHandle(event)) {
            event.preventDefault()
            range.startFill()
            return
        }

        const cell = cellAt(event)
        if (!cell) return

        if (onMoveBorder(event, cell)) {
            event.preventDefault()
            range.startMove(cell.row, cell.col)
            return
        }

        range.startRange(cell.row, cell.col, { additive: event.ctrlKey || event.metaKey })
    }

    function onPointerMove(event: PointerEvent) {
        if (!range) return

        const cell = cellAt(event)
        if (!cell) return
        if (range.moving) range.extendMove(cell.row, cell.col)
        else if (range.filling) range.extendFill(cell.row, cell.col)
        else if (range.dragging) range.extendTo(cell.row, cell.col)
    }

    function onKeydownCapture(event: KeyboardEvent) {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
        if (!range?.commitDraftToRange()) return

        event.preventDefault()
        event.stopPropagation()
    }

    function onPointerUp() {
        range?.endRange()
        void range?.endFill()
        void range?.endMove()
    }

    $effect(() => {
        const root = element()
        if (!root) return

        root.setAttribute('data-dg-range-layer', '')
        root.addEventListener('pointerdown', onPointerDown)
        root.addEventListener('pointermove', onPointerMove)
        root.addEventListener('keydown', onKeydownCapture, true)
        return () => {
            root.removeAttribute('data-dg-range-layer')
            root.removeEventListener('pointerdown', onPointerDown)
            root.removeEventListener('pointermove', onPointerMove)
            root.removeEventListener('keydown', onKeydownCapture, true)
        }
    })

    $effect(() => {
        const root = element()
        if (!root) return
        const dragging = range?.dragging || range?.filling || range?.moving
        root.style.userSelect = dragging ? 'none' : ''
        return () => {
            root.style.userSelect = ''
        }
    })
</script>

<svelte:window onpointerup={onPointerUp} />
