export const SHARE_PARAM = 'view'

const RELATIVE_BASE = 'http://sv5ui.invalid'

export function withShareParam(href: string, token: string): string {
    const url = new URL(href, RELATIVE_BASE)
    url.searchParams.set(SHARE_PARAM, token)
    return url.origin === RELATIVE_BASE ? `${url.pathname}${url.search}${url.hash}` : url.toString()
}

export function readShareParam(href: string): string | null {
    try {
        return new URL(href, RELATIVE_BASE).searchParams.get(SHARE_PARAM)
    } catch {
        return null
    }
}
