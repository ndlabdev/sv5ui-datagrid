import { addCollection } from '@iconify/svelte'
import { datagridIcons } from './icons.data.js'

let registered = false

/**
 * Fills the Iconify store sv5ui's `Icon` reads. Idempotent. `GridRoot` calls it
 * from its module script, so importing the grid is enough; exported for a grid
 * behind a dynamic `import()`, which may load after the app's own icons render.
 */
export function registerDataGridIcons(): void {
    if (registered) return
    registered = true
    addCollection(datagridIcons)
}
