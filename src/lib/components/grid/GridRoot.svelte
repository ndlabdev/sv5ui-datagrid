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
    // A getter, so changing `ui` restyles the parts instead of remounting them.
    setGridTheme(() => ui)

    // A grid built without a density follows the app-wide default. Written back
    // once so the toggle, the snapshot and the rendering all read one value.
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
