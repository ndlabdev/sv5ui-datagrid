interface ArchiveEntry {
    name: string
    method: number
    offset: number
    compressedSize: number
    size: number
}

interface UnzipLimits {
    maxEntrySize?: number
    maxTotalSize?: number
}

const DEFAULT_MAX_ENTRY = 64 * 1024 * 1024
const DEFAULT_MAX_TOTAL = 256 * 1024 * 1024

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50
const STORED = 0
const DEFLATED = 8

function u16(bytes: Uint8Array, at: number): number {
    return bytes[at]! | (bytes[at + 1]! << 8)
}

function u32(bytes: Uint8Array, at: number): number {
    return (
        (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0
    )
}

function findEndOfDirectory(bytes: Uint8Array): number {
    const earliest = Math.max(0, bytes.length - 0xffff - 22)
    for (let at = bytes.length - 22; at >= earliest; at--) {
        if (u32(bytes, at) === EOCD) return at
    }
    throw new Error('This is not a zip archive: it has no end-of-directory record.')
}

export function readDirectory(bytes: Uint8Array): ArchiveEntry[] {
    const end = findEndOfDirectory(bytes)
    const count = u16(bytes, end + 10)
    let at = u32(bytes, end + 16)

    const entries: ArchiveEntry[] = []
    const decoder = new TextDecoder()

    for (let index = 0; index < count; index++) {
        if (u32(bytes, at) !== CENTRAL) break

        const nameLength = u16(bytes, at + 28)
        const extraLength = u16(bytes, at + 30)
        const commentLength = u16(bytes, at + 32)

        entries.push({
            name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
            method: u16(bytes, at + 10),
            compressedSize: u32(bytes, at + 20),
            size: u32(bytes, at + 24),
            offset: u32(bytes, at + 42)
        })

        at += 46 + nameLength + extraLength + commentLength
    }

    return entries
}

async function inflate(bytes: Uint8Array, name: string, limit: number): Promise<Uint8Array> {
    const stream = new Blob([bytes as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'))

    const reader = stream.getReader()
    const chunks: Uint8Array[] = []
    let total = 0

    try {
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            if (!value) continue

            total += value.length
            if (total > limit) {
                await reader.cancel()
                throw new RangeError(
                    `"${name}" keeps unpacking past the ${limit.toLocaleString('en-US')} bytes ` +
                        'this reads. An archive that unpacks to far more than it claims is the ' +
                        'shape of a zip bomb, and reading the rest of it is the attack.'
                )
            }
            chunks.push(value)
        }
    } finally {
        reader.releaseLock()
    }

    const out = new Uint8Array(total)
    let at = 0
    for (const chunk of chunks) {
        out.set(chunk, at)
        at += chunk.length
    }
    return out
}

export async function readEntry(
    bytes: Uint8Array,
    entry: ArchiveEntry,
    limits: UnzipLimits = {}
): Promise<Uint8Array> {
    const maxEntry = limits.maxEntrySize ?? DEFAULT_MAX_ENTRY
    if (entry.size > maxEntry) {
        throw new RangeError(
            `"${entry.name}" unpacks to ${entry.size.toLocaleString('en-US')} bytes, past the ` +
                `${maxEntry.toLocaleString('en-US')} this reads. A small archive claiming a huge ` +
                'entry is the shape of a zip bomb.'
        )
    }

    if (entry.size === 0xffffffff || entry.compressedSize === 0xffffffff) {
        throw new Error(
            `"${entry.name}" is stored in the zip64 form, which this reader does not read. ` +
                'Save the workbook again from a spreadsheet that writes the plain form.'
        )
    }

    if (u32(bytes, entry.offset) !== LOCAL) {
        throw new Error(`"${entry.name}" does not start where the directory says it does.`)
    }

    const nameLength = u16(bytes, entry.offset + 26)
    const extraLength = u16(bytes, entry.offset + 28)
    const start = entry.offset + 30 + nameLength + extraLength
    const raw = bytes.subarray(start, start + entry.compressedSize)

    if (entry.method === STORED) return raw
    if (entry.method !== DEFLATED) {
        throw new Error(
            `"${entry.name}" uses compression method ${entry.method}, which is not read.`
        )
    }

    return inflate(raw, entry.name, maxEntry)
}

export async function readArchive(
    bytes: Uint8Array,
    wanted: (name: string) => boolean,
    limits: UnzipLimits = {}
): Promise<Map<string, string>> {
    const maxTotal = limits.maxTotalSize ?? DEFAULT_MAX_TOTAL
    const entries = readDirectory(bytes).filter((entry) => wanted(entry.name))

    const declared = entries.reduce((sum, entry) => sum + entry.size, 0)
    if (declared > maxTotal) {
        throw new RangeError(
            `The archive declares ${declared.toLocaleString('en-US')} bytes of content, past the ` +
                `${maxTotal.toLocaleString('en-US')} this reads at once.`
        )
    }

    const decoder = new TextDecoder()
    const out = new Map<string, string>()
    let unpacked = 0

    for (const entry of entries) {
        const room = Math.min(limits.maxEntrySize ?? DEFAULT_MAX_ENTRY, maxTotal - unpacked)
        if (room <= 0) {
            throw new RangeError(
                `The archive unpacks past the ${maxTotal.toLocaleString('en-US')} bytes this ` +
                    'reads at once, whatever its directory claims.'
            )
        }

        const data = await readEntry(bytes, entry, { ...limits, maxEntrySize: room })
        unpacked += data.length
        out.set(entry.name, decoder.decode(data))
    }
    return out
}
