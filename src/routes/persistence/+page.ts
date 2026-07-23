// A persisted grid restores from localStorage, which only exists on the client.
// Server-rendering it would paint the default state (every column shown) and
// then correct it after hydration — the flash you would otherwise see on
// reload. Rendering client-side lets the synchronous restore apply before the
// first paint, so the saved layout shows immediately.
export const ssr = false
