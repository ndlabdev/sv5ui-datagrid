<script lang="ts">
    import { ThemeMode } from 'sv5ui'
    import './layout.css'

    const { children } = $props()
</script>

<ThemeMode />

{@render children?.()}
