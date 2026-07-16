<script lang="ts">
    import { useElementSize } from 'sv5ui'
    import { getVirtualization } from '../features/virtualization/index.js'
    import { getGridContext } from './context.js'
    import type { GridViewportProps } from './datagrid.types.js'
    import { datagridVariants } from './datagrid.variants.js'

    let { class: className, children }: GridViewportProps = $props()

    const grid = getGridContext()
    const virtualization = getVirtualization(grid)
    const slots = datagridVariants()

    let element = $state<HTMLElement | null>(null)
    const size = useElementSize(() => (virtualization ? element : null))

    $effect(() => {
        if (!virtualization) return
        virtualization.element = element
        return () => {
            virtualization.element = null
        }
    })

    $effect(() => {
        if (!virtualization) return
        virtualization.virtualizer.viewportHeight = size.height
    })
</script>

<div
    bind:this={element}
    role="grid"
    aria-rowcount={grid.totalRows + 1}
    aria-colcount={grid.columns.visible.length}
    class={slots.viewport({ class: className })}
    style={grid.columns.style}
    onscroll={virtualization
        ? (event) => virtualization.virtualizer.onScroll(event.currentTarget.scrollTop)
        : undefined}
>
    {@render children?.()}
</div>
