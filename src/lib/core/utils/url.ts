const NAVIGABLE_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel', 'sms', 'ftp'])

const PATH_START = /[/?#]/

export function safeHref(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined

    const href = String(value).trim()
    if (href === '') return undefined

    const colon = href.indexOf(':')
    const pathStart = href.search(PATH_START)
    const relative = colon < 0 || (pathStart >= 0 && pathStart < colon)
    if (relative) return href

    return NAVIGABLE_PROTOCOLS.has(href.slice(0, colon).toLowerCase()) ? href : undefined
}
