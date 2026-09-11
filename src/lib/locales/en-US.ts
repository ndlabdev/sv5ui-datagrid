import { defaultAnnouncerStrings } from '../core/interaction/announcer.svelte.js'
import { defaultLabels } from '../core/interaction/labels.js'
import type { DataGridLocalePack } from '../core/types/index.js'

export const enUS: DataGridLocalePack = {
    tag: 'en-US',
    labels: defaultLabels,
    announcer: defaultAnnouncerStrings
}
