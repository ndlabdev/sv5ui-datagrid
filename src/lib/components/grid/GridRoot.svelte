<script lang="ts" module>
    import { registerDataGridIcons } from '../internal/icons.js'

    registerDataGridIcons()
</script>

<script lang="ts" generics="TRow">
    import { untrack } from 'svelte'
    import { setGridContext, setGridElement } from '../internal/context.js'
    import { setGridTheme } from '../internal/theme.js'
    import { getDataGridConfig } from '../../core/theme/index.js'
    import type { GridRootProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import GridStatePersistence from './GridStatePersistence.svelte'

    let { grid, persistState, ui, class: className, children }: GridRootProps<TRow> = $props()

    setGridContext(untrack(() => grid))
    setGridTheme(() => ui)
    $effect.pre(() => {
        grid.ui = ui
    })

    let root = $state<HTMLElement | null>(null)
    setGridElement(() => root)

    const layers = $derived(grid.features.filter((feature) => feature.component))

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

<div bind:this={root} class={slots.root({ class: [config.slots.root, className, ui?.root] })}>
    <div aria-live="polite" class="sr-only">{grid.announcer.message}</div>
    {#each layers as feature (feature.id)}
        {@const Layer = feature.component!}
        <Layer />
    {/each}
    {@render children?.()}
</div>
