<script lang="ts" module>
    import { registerDataGridIcons } from '../internal/icons.js'

    // At import, not at init: an instance script runs only once this component
    // mounts, and anything the app drew before that — its own button carrying
    // one of the grid's icons — would have found an empty store and fetched.
    // The module runs as soon as the app imports the grid, before any render.
    // Same place sv5ui registers its own bundle, for the same reason.
    registerDataGridIcons()
</script>

<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { setGridContext } from '../internal/context.js'
    import { setGridTheme } from '../internal/theme.js'
    import { getDataGridConfig } from '../datagrid.config.js'
    import type { GridRootProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import GridStatePersistence from './GridStatePersistence.svelte'

    let { grid, persistState, ui, class: className, children }: GridRootProps<TRow> = $props()

    setGridContext(untrack(() => grid))
    setGridTheme(() => ui)

    // Written back once so toggle, snapshot and rendering read one value.
    untrack(() => {
        if (grid.configuredDensity === undefined) {
            grid.density = getDataGridConfig().defaultVariants.density
        }
    })

    const config = getDataGridConfig()
    const slots = $derived(datagridVariants({ density: grid.density }))
</script>

{#if persistState}
    <GridStatePersistence {grid} options={persistState} />
{/if}

<div class={slots.root({ class: [config.slots.root, className, ui?.root] })}>
    <div aria-live="polite" class="sr-only">{grid.announcer.message}</div>
    {@render children?.()}
</div>
