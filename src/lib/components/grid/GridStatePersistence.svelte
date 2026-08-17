<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { type GridState, normalizeSnapshot } from '../../core/grid/index.js'
    import type { GridSnapshot, PersistStateOptions } from '../../core/types/index.js'

    let { grid, options }: { grid: GridState<TRow>; options: PersistStateOptions } = $props()

    /** A resize rewrites the map every frame, so writes are coalesced. */
    const WRITE_INTERVAL_MS = 200

    const key = untrack(() => options.key)

    // Synchronous, before the first paint: an effect would show the defaults
    // and correct them a frame later.
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
        // The first run is the state just restored, not a user change.
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
