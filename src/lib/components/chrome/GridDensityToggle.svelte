<script lang="ts">
    import { Button } from 'sv5ui'
    import type { Density } from '../../core/types/index.js'
    import { getGridContext } from '../internal/context.js'
    import type { GridDensityToggleProps } from '../datagrid.types.js'

    let { class: className }: GridDensityToggleProps = $props()

    const grid = getGridContext()

    const options: { value: Density; icon: string; label: string }[] = [
        { value: 'compact', icon: 'lucide:rows-4', label: 'Compact density' },
        { value: 'standard', icon: 'lucide:rows-3', label: 'Standard density' },
        { value: 'comfortable', icon: 'lucide:rows-2', label: 'Comfortable density' }
    ]
</script>

<div role="group" aria-label="Row density" class={['flex items-center gap-1', className].join(' ')}>
    {#each options as option (option.value)}
        <Button
            size="sm"
            icon={option.icon}
            variant={grid.density === option.value ? 'solid' : 'outline'}
            aria-label={option.label}
            aria-pressed={grid.density === option.value}
            onclick={() => (grid.density = option.value)}
        />
    {/each}
</div>
