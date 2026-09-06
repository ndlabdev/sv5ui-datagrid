/**
 * A whole grid state in a URL: the snapshot, canonicalized, deflated where the
 * browser offers it, and spelled in base64url.
 *
 * Not to be confused with `snapshot.ts` next door, which builds and restores
 * the snapshot itself. This file only carries one.
 */
import { SNAPSHOT_VERSION, type GridSnapshot } from '../types/index.js'
import { base64UrlToBytes, bytesToBase64Url } from '../utils/base64.js'

export const SHARE_LIMIT = 1800

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical)
    if (value === null || typeof value !== 'object') return value

    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries.map(([key, item]) => [key, canonical(item)]))
}

export function canonicalJson(snapshot: GridSnapshot): string {
    return JSON.stringify(canonical(snapshot))
}

export function sameSnapshot(a: GridSnapshot, b: GridSnapshot): boolean {
    return canonicalJson(a) === canonicalJson(b)
}

function isSnapshot(value: unknown): value is GridSnapshot {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as GridSnapshot).version === 'number'
    )
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | null> {
    try {
        const stream = new Blob([bytes as BlobPart])
            .stream()
            .pipeThrough(new CompressionStream('deflate-raw'))
        return new Uint8Array(await new Response(stream).arrayBuffer())
    } catch {
        return null
    }
}

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer> | null> {
    try {
        const stream = new Blob([bytes as BlobPart])
            .stream()
            .pipeThrough(new DecompressionStream('deflate-raw'))
        return new Uint8Array(await new Response(stream).arrayBuffer())
    } catch {
        return null
    }
}

export class ShareTooLongError extends Error {
    readonly length: number

    constructor(length: number) {
        super(
            `The grid state encodes to ${length} characters, past the ${SHARE_LIMIT} a link can carry. ` +
                'Save it as a view and share the view instead.'
        )
        this.name = 'ShareTooLongError'
        this.length = length
    }
}

export async function encodeSnapshot(snapshot: GridSnapshot): Promise<string> {
    const json = new TextEncoder().encode(canonicalJson(snapshot))
    const packed = await deflate(json)

    const token = packed ? `1${bytesToBase64Url(packed)}` : `0${bytesToBase64Url(json)}`
    if (token.length > SHARE_LIMIT) throw new ShareTooLongError(token.length)
    return token
}

export async function decodeSnapshot(token: string): Promise<GridSnapshot | null> {
    const marker = token[0]
    if (marker !== '0' && marker !== '1') return null

    try {
        const bytes = base64UrlToBytes(token.slice(1))
        const json = marker === '1' ? await inflate(bytes) : bytes
        if (!json) return null

        const parsed: unknown = JSON.parse(new TextDecoder().decode(json))
        if (!isSnapshot(parsed)) return null
        return parsed.version === SNAPSHOT_VERSION ? parsed : null
    } catch {
        return null
    }
}
