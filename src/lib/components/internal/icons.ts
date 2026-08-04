import { addCollection } from '@iconify/svelte'
import { datagridIcons } from './icons.data.js'

let registered = false

/**
 * Registers the bundled icons into the Iconify store sv5ui's `Icon` reads, so
 * a running grid never fetches them. Idempotent; called from `Grid.Root`.
 */
export function registerDataGridIcons(): void {
    if (registered) return
    registered = true
    addCollection(datagridIcons)
}
