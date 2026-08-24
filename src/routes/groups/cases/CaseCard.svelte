<script lang="ts">
    import { Card } from 'sv5ui'
    import type { Snippet } from 'svelte'

    let {
        index,
        title,
        expects,
        state,
        children
    }: {
        index: number
        title: string
        /** Điều cần nhìn thấy để case này coi như đạt. */
        expects: string
        /** Trạng thái sống của lưới, để đối chiếu với những gì đang thấy. */
        state?: string
        children: Snippet
    } = $props()
</script>

<Card class="space-y-3 p-4">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-medium text-on-surface">
            <span class="text-on-surface-variant">{index}.</span>
            {title}
        </h2>
        {#if state}
            <code class="rounded bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
                {state}
            </code>
        {/if}
    </div>
    <p class="text-sm text-on-surface-variant">
        <strong class="text-on-surface">Kỳ vọng:</strong>
        {expects}
    </p>
    {@render children()}
</Card>
