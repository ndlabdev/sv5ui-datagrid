import { defaultAnnouncerStrings } from '../core/interaction/announcer.svelte.js'
import { defaultLabels } from '../core/interaction/labels.js'
import type { DataGridLocalePack } from '../core/types/index.js'

/**
 * English, the language the grid falls back to. Listing it alongside another
 * pack is what lets an English page stay English while a Vietnamese one
 * switches — without it, the only candidate always wins.
 */
export const enUS: DataGridLocalePack = {
    tag: 'en-US',
    labels: defaultLabels,
    announcer: defaultAnnouncerStrings
}
