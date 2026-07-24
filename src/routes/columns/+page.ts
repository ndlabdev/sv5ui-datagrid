// This demo persists column layout (order, width, pin, visibility) to
// localStorage, which only exists on the client. Server-rendering it would
// paint the default layout — unpinned, all columns shown — and correct it
// after hydration, the flash you would otherwise see on reload. Rendering
// client-side lets the synchronous restore apply before the first paint.
export const ssr = false
