import { addCollection } from '@iconify/svelte'
import { datagridIcons } from './icons.data.js'

let registered = false

/**
 * Registers the grid's icons into the Iconify store that sv5ui's `Icon` reads,
 * so they render from the bundle instead of the Iconify API. `@iconify/svelte`
 * is a single shared module, so this reaches sv5ui's own icon lookups too.
 *
 * Called once from `Grid.Root`, which every grid mounts through, so a running
 * grid never fetches its own icons. Idempotent — extra calls are ignored, and
 * an app that has already registered these names is left untouched.
 */
export function registerDataGridIcons(): void {
    if (registered) return
    registered = true
    addCollection(datagridIcons)
}
