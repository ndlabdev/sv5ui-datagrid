const CRC_TABLE = buildCrcTable()

function buildCrcTable(): Uint32Array {
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
        let value = i
        for (let bit = 0; bit < 8; bit++) {
            value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
        }
        table[i] = value >>> 0
    }
    return table
}

const CRC_INIT = 0xffffffff

function crcUpdate(crc: number, bytes: Uint8Array): number {
    let next = crc
    for (let i = 0; i < bytes.length; i++) {
        next = CRC_TABLE[(next ^ bytes[i]!) & 0xff]! ^ (next >>> 8)
    }
    return next
}

export function crc32(bytes: Uint8Array): number {
    return (crcUpdate(CRC_INIT, bytes) ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
    name: string
    data: Uint8Array

    deflated?: Uint8Array

    crc?: number
    size?: number
}

export function zipEntry(name: string, text: string): ZipEntry {
    return { name, data: new TextEncoder().encode(text) }
}

export async function deflateEntries(entries: ZipEntry[]): Promise<ZipEntry[]> {
    try {
        new CompressionStream('deflate-raw')
    } catch {
        return entries
    }

    return Promise.all(
        entries.map(async (entry) => {
            const stream = new Blob([entry.data as BlobPart])
                .stream()
                .pipeThrough(new CompressionStream('deflate-raw'))
            const deflated = new Uint8Array(await new Response(stream).arrayBuffer())
            return deflated.length < entry.data.length ? { ...entry, deflated } : entry
        })
    )
}

const EMPTY = new Uint8Array(0)

function joinChunks(name: string, chunks: Iterable<string>): ZipEntry {
    let text = ''
    for (const chunk of chunks) text += chunk
    return zipEntry(name, text)
}

export async function deflateChunks(name: string, chunks: Iterable<string>): Promise<ZipEntry> {
    let stream: CompressionStream
    try {
        stream = new CompressionStream('deflate-raw')
    } catch {
        return joinChunks(name, chunks)
    }

    const encoder = new TextEncoder()
    const writer = stream.writable.getWriter()
    const collected = new Response(stream.readable).arrayBuffer()

    let crc = CRC_INIT
    let size = 0

    for (const chunk of chunks) {
        const bytes = encoder.encode(chunk)
        crc = crcUpdate(crc, bytes)
        size += bytes.length
        await writer.write(bytes)
    }
    await writer.close()

    const deflated = new Uint8Array(await collected)
    return { name, data: EMPTY, deflated, crc: (crc ^ 0xffffffff) >>> 0, size }
}

class ByteWriter {
    #chunks: Uint8Array[] = []
    #length = 0

    get length(): number {
        return this.#length
    }

    push(bytes: Uint8Array): void {
        this.#chunks.push(bytes)
        this.#length += bytes.length
    }

    u16(value: number): void {
        this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]))
    }

    u32(value: number): void {
        this.push(
            new Uint8Array([
                value & 0xff,
                (value >>> 8) & 0xff,
                (value >>> 16) & 0xff,
                (value >>> 24) & 0xff
            ])
        )
    }

    toUint8Array(): Uint8Array {
        const out = new Uint8Array(this.#length)
        let offset = 0
        for (const chunk of this.#chunks) {
            out.set(chunk, offset)
            offset += chunk.length
        }
        return out
    }
}

const STORED = 0
const DEFLATED = 8
const VERSION = 20

const DOS_EPOCH_DATE = (1 << 5) | 1

function u32Bounded(value: number, what: string): number {
    if (value > 0xffffffff) {
        throw new RangeError(`xlsx: ${what} exceeds 4 GiB, which the archive format cannot address`)
    }
    return value
}

export function createZip(entries: ZipEntry[]): Uint8Array {
    const body = new ByteWriter()
    const directory = new ByteWriter()
    const encoder = new TextEncoder()

    for (const entry of entries) {
        const name = encoder.encode(entry.name)
        const crc = entry.crc ?? crc32(entry.data)
        const written = entry.deflated ?? entry.data
        const method = entry.deflated ? DEFLATED : STORED
        const compressedSize = u32Bounded(written.length, `entry ${entry.name}`)
        const size = u32Bounded(entry.size ?? entry.data.length, `entry ${entry.name}`)
        const offset = u32Bounded(body.length, 'archive size')

        body.u32(0x04034b50)
        body.u16(VERSION)
        body.u16(0)
        body.u16(method)
        body.u16(0)
        body.u16(DOS_EPOCH_DATE)
        body.u32(crc)
        body.u32(compressedSize)
        body.u32(size)
        body.u16(name.length)
        body.u16(0)
        body.push(name)
        body.push(written)

        directory.u32(0x02014b50)
        directory.u16(VERSION)
        directory.u16(VERSION)
        directory.u16(0)
        directory.u16(method)
        directory.u16(0)
        directory.u16(DOS_EPOCH_DATE)
        directory.u32(crc)
        directory.u32(compressedSize)
        directory.u32(size)
        directory.u16(name.length)
        directory.u16(0)
        directory.u16(0)
        directory.u16(0)
        directory.u16(0)
        directory.u32(0)
        directory.u32(offset)
        directory.push(name)
    }

    const out = new ByteWriter()
    out.push(body.toUint8Array())
    const directoryOffset = u32Bounded(out.length, 'archive size')
    out.push(directory.toUint8Array())

    out.u32(0x06054b50)
    out.u16(0)
    out.u16(0)
    out.u16(entries.length)
    out.u16(entries.length)
    out.u32(directory.length)
    out.u32(directoryOffset)
    out.u16(0)

    return out.toUint8Array()
}
