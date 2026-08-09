import { addCollection } from '@iconify/svelte'
import { datagridIcons } from './icons.data.js'

let registered = false

/**
 * Registers the bundled icons into the Iconify store sv5ui's `Icon` reads, so
 * a running grid never fetches them. Idempotent.
 *
 * `Grid.Root` calls this as it initialises, which covers everything the grid
 * itself draws. It is exported because that is too late for an app drawing one
 * of the same icons somewhere else: an `Icon` that renders before any grid
 * mounts finds an empty store and fetches, and the icon flickers in on arrival.
 * Call it once at startup to cover the whole page:
 *
 * ```ts
 * // src/routes/+layout.svelte
 * import { registerDataGridIcons } from '@sv5ui/datagrid'
 * registerDataGridIcons()
 * ```
 *
 * It only holds the icons the grid draws. An icon of your own that the grid
 * never uses is still yours to bundle — see `datagridIcons` for the shape, and
 * `addCollection` from `@iconify/svelte` to register your own.
 */
export function registerDataGridIcons(): void {
    if (registered) return
    registered = true
    addCollection(datagridIcons)
}
