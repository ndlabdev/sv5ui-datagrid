interface BlockRange {
    start: number

    end: number
}

export function blockOf(rowIndex: number, blockSize: number): number {
    return Math.floor(rowIndex / blockSize)
}

export function blockBounds(block: number, blockSize: number): { start: number; end: number } {
    return { start: block * blockSize, end: (block + 1) * blockSize }
}

export function blocksFor(startRow: number, endRow: number, blockSize: number): BlockRange {
    return {
        start: Math.max(0, blockOf(startRow, blockSize)),
        end: Math.max(0, blockOf(Math.max(startRow, endRow - 1), blockSize))
    }
}

export function blocksIn(range: BlockRange): number[] {
    const blocks: number[] = []
    for (let block = range.start; block <= range.end; block++) blocks.push(block)
    return blocks
}

export function blocksToEvict(loaded: number[], keep: BlockRange, maxBlocks: number): number[] {
    if (loaded.length <= maxBlocks) return []

    const distance = (block: number) =>
        block < keep.start ? keep.start - block : block > keep.end ? block - keep.end : 0

    return loaded
        .filter((block) => distance(block) > 0)
        .sort((a, b) => distance(b) - distance(a))
        .slice(0, loaded.length - maxBlocks)
}

export function totalFromShortBlock(
    block: number,
    rowsReturned: number,
    blockSize: number
): number | null {
    return rowsReturned < blockSize ? block * blockSize + rowsReturned : null
}
