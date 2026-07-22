<script lang="ts">
    import type { GridToolbarProps } from '../datagrid.types.js'
    import { datagridVariants } from '../datagrid.variants.js'
    import { getGridTheme } from '../internal/theme.js'

    let { class: className, children }: GridToolbarProps = $props()

    const slots = datagridVariants()

    const theme = getGridTheme()
</script>

<div class={slots.toolbar({ class: [theme('toolbar'), className] })}>
    {@render children?.()}
</div>
