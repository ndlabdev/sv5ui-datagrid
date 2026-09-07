interface LoadedBlocks {
    has(block: number): boolean
    add(block: number): void
    remove(block: number): void
    list(): number[]
    clear(): void
}

export function createLoadedBlocks(): LoadedBlocks {
    const blocks = new Set<number>()
    return {
        has: (block) => blocks.has(block),
        add: (block) => void blocks.add(block),
        remove: (block) => void blocks.delete(block),
        list: () => [...blocks],
        clear: () => blocks.clear()
    }
}
