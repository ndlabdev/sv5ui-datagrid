/**
 * Surfaces an app places where it likes: a panel, a wizard, an overlay. They
 * are not toolbar controls and do not belong to a row of chrome, which is why
 * they live apart from it - each one is a piece of the page in its own right,
 * and each one is registered by a feature the app opted into.
 */

export { default as CommandPalette } from './CommandPalette.svelte'
export { default as ConditionalFormattingPanel } from './ConditionalFormattingPanel.svelte'
export { default as FilterBuilder } from './FilterBuilder.svelte'
export { default as FindReplace } from './FindReplace.svelte'
export { default as GroupPanel } from './GroupPanel.svelte'
export { default as ImportWizard } from './ImportWizard.svelte'
export { default as SavedViews } from './SavedViews.svelte'
export { default as ToolPanel } from './ToolPanel.svelte'
