/**
 * The whole-app config now lives in `core/theme`, beside the slot table it
 * overrides, so a feature can read it without importing from the layer that
 * imports it. Re-exported here because this is the path the public API names.
 */

export {
    defineDataGridConfig,
    getDataGridConfig,
    resetDataGridConfig,
    type DataGridConfig
} from '../core/theme/index.js'
