/**
 * The pointer half of row reordering: the gesture, not what a move means.
 * Kept out of Svelte state — the ghost moves every frame, and a rune would
 * re-render the rows behind it for nothing.
 */

/** Movement before a press counts as a drag, so a tap never reorders. */
const DRAG_THRESHOLD = 4

/** Under this, the gesture is still the browser's and scrolls the list. */
const TOUCH_HOLD_MS = 250

/** How far a finger may stray during the hold before it counts as a scroll. */
const TOUCH_SLOP = 8

/** How close to the scroller's edge the cursor has to be to scroll it. */
const EDGE_ZONE = 48

/** Pixels per frame at the very edge; less further in. */
const MAX_SCROLL_SPEED = 18

/** Above the grid, below the popup layer sv5ui portals menus into. */
const GHOST_Z_INDEX = '45'

/** Long enough to read as a movement, short enough not to delay the result. */
const SETTLE_MS = 160

export interface RowDragOptions {
    /** Extra classes for the floating copy, so a theme can restyle it. */
    ghostClass: string
    /** Row the drag started on moved over this one. */
    onOver: (rowId: string) => void
    /** Pointer travelled far enough — or rested long enough — to be a drag. */
    onStart: () => void
    /** Released over a valid target. */
    onCommit: () => void
    /** Escape, a cancelled pointer, or a release that never became a drag. */
    onCancel: () => void
}

/**
 * The grid's geometry lives in custom properties on a row's ancestors. Moved
 * to `<body>` every `var()` would resolve to nothing: tracks collapse and
 * pinned cells lose their offset.
 */
function copyGridVariables(row: HTMLElement, ghost: HTMLElement): void {
    const resolved = getComputedStyle(row)
    for (let node = row.parentElement; node; node = node.parentElement) {
        for (const name of node.style) {
            if (!name.startsWith('--dg-')) continue
            // Read from the row: that is where the cascade has settled.
            if (!ghost.style.getPropertyValue(name)) {
                ghost.style.setProperty(name, resolved.getPropertyValue(name))
            }
        }
    }
}

/** A copy of the row that follows the cursor. */
function createGhost(row: HTMLElement, ghostClass: string): HTMLElement {
    const rect = row.getBoundingClientRect()
    const computed = getComputedStyle(row)
    const ghost = row.cloneNode(true) as HTMLElement

    // Not a row any more: it must not answer hit tests or be read out.
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

/** Measured before the reorder: after it, a different row is under the cursor. */
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

/** Fast at the edge, gentle further in, nothing outside the zone. */
function scrollStep(distanceToEdge: number): number {
    const depth = Math.max(0, EDGE_ZONE - distanceToEdge)
    return Math.ceil((depth / EDGE_ZONE) * MAX_SCROLL_SPEED)
}

/** True when the element can actually take a scroll offset. */
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
    } catch {
        // synthetic pointer events have no active pointer to capture
    }

    function hitTest() {
        // The ghost is `pointer-events: none`, so this sees the row beneath it.
        const target = document
            .elementFromPoint(pointer.x, pointer.y)
            ?.closest<HTMLElement>('[data-dg-row-id]')
        const id = target?.dataset.dgRowId
        if (id) options.onOver(id)
    }

    /** A grid sized to its content has no overflow, so the page moves instead. */
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

    // The target is recomputed while the list scrolls under a still cursor.
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

    /**
     * Both axes: held to its own column the copy sits flush on the list and
     * cannot be told from the row under it. Only the vertical decides where
     * it lands.
     */
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
            // Waiting out a hold: straying means the finger meant to scroll.
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

        // The gesture is ours now; stop the browser panning behind it.
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
        // After the commit, once the row has taken its new place.
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

    // A hold rather than a distance: it is what tells a reorder from a swipe.
    if (touch) {
        hold = window.setTimeout(() => {
            hold = 0
            beginDrag()
            moveGhost()
        }, TOUCH_HOLD_MS)
    }
}
