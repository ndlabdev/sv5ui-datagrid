<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { useLocalStorage } from 'sv5ui'
    import type { GridState } from '../core/grid.svelte.js'
    import { normalizeSnapshot } from '../core/snapshot.js'
    import type { GridSnapshot, PersistStateOptions } from '../core/types.js'

    let { grid, options }: { grid: GridState<TRow>; options: PersistStateOptions } = $props()

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

    $effect(() => {
        if (restored) return
        const snapshot = normalizeSnapshot(stored.current, options.migrate)
        if (snapshot) grid.setState(snapshot)
        restored = true
    })

    $effect(() => {
        const snapshot = grid.getState()
        if (restored) stored.current = snapshot
    })
</script>
