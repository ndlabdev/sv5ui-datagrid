<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { useLocalStorage } from 'sv5ui'
    import type { GridState } from '../core/grid.svelte.js'
    import { normalizeSnapshot } from '../core/snapshot.js'
    import type { GridSnapshot, PersistStateOptions } from '../core/types.js'

    let { grid, options }: { grid: GridState<TRow>; options: PersistStateOptions } = $props()

    /**
     * A column resize rewrites the width map every animation frame. Writing on
     * each one costs a serialize plus a synchronous storage write per frame, so
     * writes are coalesced onto a timer and the tail is flushed on teardown.
     */
    const WRITE_INTERVAL_MS = 200

    // The key binds the storage slot for this component's lifetime; swapping it
    // later means a different grid, which is a remount, not a reactive update.
    const stored = useLocalStorage<GridSnapshot | null>(
        untrack(() => options.key),
        null
    )

    // useLocalStorage reads storage in an effect of its own, created here and
    // therefore flushed before both effects below — so the restore never races
    // the read, and the save never writes defaults over a stored snapshot.
    let restored = $state(false)

    let timer: ReturnType<typeof setTimeout> | null = null
    let pending: GridSnapshot | null = null

    function flush() {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
        if (pending === null) return
        stored.current = pending
        pending = null
    }

    $effect(() => {
        if (restored) return
        const snapshot = normalizeSnapshot(stored.current, options.migrate)
        if (snapshot) grid.setState(snapshot)
        restored = true
    })

    $effect(() => {
        const snapshot = grid.getState()
        if (!restored) return
        pending = snapshot
        timer ??= setTimeout(flush, WRITE_INTERVAL_MS)
    })

    // No dependencies, so this teardown runs once, on destroy.
    $effect(() => flush)
</script>
