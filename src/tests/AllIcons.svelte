<script lang="ts">
    import { Icon } from 'sv5ui'
    import { registerDataGridIcons } from '../lib/components/internal/icons.js'
    import { datagridIcons } from '../lib/components/internal/icons.data.js'

    // Exactly what Grid.Root does.
    registerDataGridIcons()
    const names = Object.keys(datagridIcons.icons)
</script>

{#each names as name (name)}
    <span data-icon={name}><Icon name={`lucide:${name}`} /></span>
{/each}
