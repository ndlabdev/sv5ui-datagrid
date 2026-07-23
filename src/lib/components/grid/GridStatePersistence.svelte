<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import type { GridState } from '../../core/grid/grid.svelte.js'
    import { normalizeSnapshot } from '../../core/grid/snapshot.js'
    import type { GridSnapshot, PersistStateOptions } from '../../core/types/index.js'

    let { grid, options }: { grid: GridState<TRow>; options: PersistStateOptions } = $props()

    /** A column resize rewrites the width map every frame, so writes are
     * coalesced onto a timer and the tail flushed on teardown. */
    const WRITE_INTERVAL_MS = 200

    // Bound once: swapping the key later means a different grid, which is a
    // remount, not a reactive update.
    const key = untrack(() => options.key)

    // Restore synchronously during setup, before the grid renders, so the first
    // client paint already shows the saved state. Reading it in an effect
    // instead would paint the defaults first and correct them a frame later —
    // a visible flash. `localStorage` is client-only; an SSR'd grid has nothing
    // to read on the server and still paints defaults for that one frame.
    untrack(() => {
        if (typeof localStorage === 'undefined') return
        try {
            const raw = localStorage.getItem(key)
            if (raw === null) return
            const snapshot = normalizeSnapshot(JSON.parse(raw) as unknown, options.migrate)
            if (snapshot) grid.setState(snapshot)
        } catch {
            // A malformed or unreadable entry must not break the grid.
        }
    })

    let timer: ReturnType<typeof setTimeout> | null = null
    let pending: GridSnapshot | null = null

    function flush() {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
        if (pending === null) return
        try {
            localStorage.setItem(key, JSON.stringify(pending))
        } catch {
            // ignore serialization / quota errors
        }
        pending = null
    }

    let mounted = false

    $effect(() => {
        const snapshot = grid.getState()
        // The first run reads the state just restored; writing it back would be
        // a no-op, so it is skipped. Later runs are real user changes.
        if (!mounted) {
            mounted = true
            return
        }
        pending = snapshot
        timer ??= setTimeout(flush, WRITE_INTERVAL_MS)
    })

    // No dependencies, so this teardown runs once, on destroy.
    $effect(() => flush)
</script>
