import { type GridState } from '../../core/grid/index.js'
import { type GridFeature } from '../../core/types/index.js'
import { buildCommands } from './command-palette-commands.js'
import type { CommandPaletteOptions, GridCommand } from './command-palette.types.js'

const COMMAND_PALETTE = 'commandPalette'

export class CommandPalette<TRow> {
    open = $state(false)

    #grid: GridState<TRow>
    #options: CommandPaletteOptions<TRow>

    constructor(grid: GridState<TRow>, options: CommandPaletteOptions<TRow>) {
        this.#grid = grid
        this.#options = options
    }

    get commands(): GridCommand[] {
        return buildCommands(this.#grid, this.#options)
    }

    show = (): void => {
        this.open = true
    }

    hide = (): void => {
        this.open = false
    }

    toggle = (): void => {
        this.open = !this.open
    }

    run = (command: GridCommand): void => {
        this.hide()
        command.run()
    }
}

export function commandPalette<TRow>(options: CommandPaletteOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: COMMAND_PALETTE,
        createState: (grid) => new CommandPalette(grid, options),
        createApi: (grid) => {
            const state = getCommandPalette(grid)!
            return {
                openCommandPalette: state.show,
                closeCommandPalette: state.hide,
                toggleCommandPalette: state.toggle
            }
        }
    }
}

export function getCommandPalette<TRow>(grid: GridState<TRow>): CommandPalette<TRow> | undefined {
    return grid.feature<CommandPalette<TRow>>(COMMAND_PALETTE)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        openCommandPalette?: () => void
        closeCommandPalette?: () => void
        toggleCommandPalette?: () => void
    }
}
