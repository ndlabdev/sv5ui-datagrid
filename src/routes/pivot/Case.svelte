<script lang="ts">
    import { Button, Link, ThemeModeButton } from 'sv5ui'
    import type { Snippet } from 'svelte'

    let {
        title,
        what,
        look,
        code,
        children,
        controls,
        after
    }: {
        title: string
        what: string
        look: string
        code?: string
        children: Snippet
        controls?: Snippet
        after?: Snippet
    } = $props()
</script>

<div class="mx-auto max-w-4xl space-y-5 px-4 py-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 text-sm">
            <Link href="/pivot/cases">Demo pivot</Link>
            <span class="text-on-surface-variant">/</span>
            <span class="text-on-surface-variant">{title}</span>
        </div>
        <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" label="Trang chủ" href="/" />
            <ThemeModeButton />
        </div>
    </div>

    <div class="space-y-2">
        <h1 class="text-xl font-semibold text-on-surface">{title}</h1>
        <p class="text-sm text-on-surface-variant">{what}</p>
    </div>

    {#if code}
        <pre
            class="overflow-x-auto rounded-lg bg-surface-container px-4 py-3 text-xs text-on-surface-variant">{code}</pre>
    {/if}

    {#if controls}
        <div class="flex flex-wrap items-center gap-2">
            {@render controls()}
        </div>
    {/if}

    <div class="space-y-2">
        <p class="border-l-2 border-primary pl-3 text-sm text-on-surface">{look}</p>
        {@render children()}
    </div>

    {#if after}
        {@render after()}
    {/if}
</div>
