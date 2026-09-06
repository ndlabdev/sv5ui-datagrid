const DRAG_THRESHOLD = 4

const TOUCH_HOLD_MS = 250

const TOUCH_SLOP = 8

const EDGE_ZONE = 48

const MAX_SCROLL_SPEED = 18

const GHOST_Z_INDEX = '45'

const SETTLE_MS = 160

export interface RowDragOptions {
    ghostClass: string
    onOver: (rowId: string) => void
    onStart: () => void
    onCommit: () => void
    onCancel: () => void
}

function copyGridVariables(row: HTMLElement, ghost: HTMLElement): void {
    const resolved = getComputedStyle(row)
    for (let node = row.parentElement; node; node = node.parentElement) {
        for (const name of node.style) {
            if (!name.startsWith('--dg-')) continue
            if (!ghost.style.getPropertyValue(name)) {
                ghost.style.setProperty(name, resolved.getPropertyValue(name))
            }
        }
    }
}

function createGhost(row: HTMLElement, ghostClass: string): HTMLElement {
    const rect = row.getBoundingClientRect()
    const computed = getComputedStyle(row)
    const ghost = row.cloneNode(true) as HTMLElement

    ghost.removeAttribute('data-dg-row-id')
    ghost.removeAttribute('role')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.dataset.dgGhost = ''
    if (ghostClass) ghost.classList.add(...ghostClass.split(' ').filter(Boolean))

    copyGridVariables(row, ghost)
    ghost.style.gridTemplateColumns = computed.gridTemplateColumns
    ghost.style.position = 'fixed'
    ghost.style.left = `${rect.left}px`
    ghost.style.top = `${rect.top}px`
    ghost.style.width = `${rect.width}px`
    ghost.style.height = `${rect.height}px`
    ghost.style.margin = '0'
    ghost.style.pointerEvents = 'none'
    ghost.style.zIndex = GHOST_Z_INDEX

    document.body.appendChild(ghost)
    return ghost
}

function settleGhost(ghost: HTMLElement, to: DOMRect | null, offset: { x: number; y: number }) {
    const finish = () => ghost.remove()
    if (!to || typeof ghost.animate !== 'function') {
        finish()
        return
    }

    const from = ghost.getBoundingClientRect()
    const animation = ghost.animate(
        [
            { transform: `translate(${offset.x}px, ${offset.y}px)` },
            {
                transform: `translate(${offset.x + (to.left - from.left)}px, ${
                    offset.y + (to.top - from.top)
                }px)`,
                opacity: 0
            }
        ],
        { duration: SETTLE_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' }
    )
    animation.finished.then(finish, finish)
}

function scrollStep(distanceToEdge: number): number {
    const depth = Math.max(0, EDGE_ZONE - distanceToEdge)
    return Math.ceil((depth / EDGE_ZONE) * MAX_SCROLL_SPEED)
}

function scrollable(element: HTMLElement | null): element is HTMLElement {
    return Boolean(element) && element!.scrollHeight > element!.clientHeight + 1
}

/** Takes over a press on the grip; a caller only forwards `pointerdown`. */
export function beginRowDrag(event: PointerEvent, options: RowDragOptions): void {
    const handle = event.currentTarget as HTMLElement
    const row = handle.closest<HTMLElement>('[data-dg-row-id]')
    if (!row) return
    const rowId = row.dataset.dgRowId
    const viewport = handle.closest<HTMLElement>('[role="grid"]')

    const origin = { x: event.clientX, y: event.clientY }
    const pointer = { ...origin }
    const touch = event.pointerType === 'touch'
    let started = false
    let ghost: HTMLElement | null = null
    let frame = 0
    let hold = 0

    try {
        handle.setPointerCapture(event.pointerId)
    } catch {}

    function hitTest() {
        const target = document
            .elementFromPoint(pointer.x, pointer.y)
            ?.closest<HTMLElement>('[data-dg-row-id]')
        const id = target?.dataset.dgRowId
        if (id) options.onOver(id)
    }

    function autoScroll() {
        const target = scrollable(viewport) ? viewport : null
        const rect = target
            ? target.getBoundingClientRect()
            : new DOMRect(0, 0, window.innerWidth, window.innerHeight)

        const above = pointer.y - rect.top
        const below = rect.bottom - pointer.y
        let delta = 0
        if (above < EDGE_ZONE) delta = -scrollStep(above)
        else if (below < EDGE_ZONE) delta = scrollStep(below)
        if (delta === 0) return

        if (target) target.scrollTop += delta
        else window.scrollBy(0, delta)
    }

    function tick() {
        frame = requestAnimationFrame(tick)
        autoScroll()
        hitTest()
    }

    function beginDrag() {
        started = true
        options.onStart()
        ghost = createGhost(row!, options.ghostClass)
        frame = requestAnimationFrame(tick)
    }

    function moveGhost() {
        if (!ghost) return
        ghost.style.transform = `translate(${pointer.x - origin.x}px, ${pointer.y - origin.y}px)`
    }

    function stop() {
        if (frame) cancelAnimationFrame(frame)
        if (hold) clearTimeout(hold)
        frame = 0
        hold = 0
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey)
    }

    function onMove(move: PointerEvent) {
        pointer.x = move.clientX
        pointer.y = move.clientY
        const travelled = Math.hypot(move.clientX - origin.x, move.clientY - origin.y)

        if (!started) {
            if (hold) {
                if (travelled > TOUCH_SLOP) {
                    stop()
                    options.onCancel()
                }
                return
            }
            if (travelled < DRAG_THRESHOLD) return
            beginDrag()
        }

        if (move.cancelable) move.preventDefault()
        moveGhost()
    }

    function onUp() {
        const dragged = started
        const flying = ghost
        const offset = { x: pointer.x - origin.x, y: pointer.y - origin.y }
        stop()

        if (!dragged) {
            flying?.remove()
            options.onCancel()
            return
        }

        options.onCommit()
        requestAnimationFrame(() => {
            const landed = rowId
                ? document.querySelector<HTMLElement>(`[data-dg-row-id="${CSS.escape(rowId)}"]`)
                : null
            if (flying) settleGhost(flying, landed?.getBoundingClientRect() ?? null, offset)
        })
    }

    function onCancel() {
        const flying = ghost
        stop()
        flying?.remove()
        options.onCancel()
    }

    function onKey(key: KeyboardEvent) {
        if (key.key !== 'Escape') return
        key.preventDefault()
        onCancel()
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)

    if (touch) {
        hold = window.setTimeout(() => {
            hold = 0
            beginDrag()
            moveGhost()
        }, TOUCH_HOLD_MS)
    }
}
