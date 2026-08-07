import { untrack } from 'svelte'

/**
 * Wraps a mutator so nothing it reads becomes a dependency of its caller.
 *
 * Grid setters read state on their way out: the page count to clamp against,
 * the filter model to announce, the sort array to amend, the selected set to
 * add to. Every one of those is replaced rather than patched, and several reach
 * `grid.nodes` and so the whole row pipeline. A setter called from an `$effect`
 * would therefore subscribe to the value it had just written — the effect
 * re-runs on its own change and either undoes the user's action or never
 * settles.
 *
 * Reads inside a mutator are asking "what is true now" to decide what to write.
 * That question never wants a subscription, so the rule is unconditional: a
 * method that writes grid state goes through here.
 */
export function mutator<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult
): (...args: TArgs) => TResult {
    return (...args: TArgs) => untrack(() => fn(...args))
}
