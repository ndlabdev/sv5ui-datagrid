/**
 * The parts of the release that are worth testing: version arithmetic, and the
 * wait that tells an absent CI check apart from a failed one. Both are kept
 * free of git, gh and the clock so a test can drive them directly.
 */

/**
 * Resolves the version a bump asks for. An explicit `X.Y.Z` passes through.
 *
 * The package went past 1.0 on 2026-08-10, so plain semver applies: a breaking
 * change is a major. The pre-1.0 rule that folded breaking into a minor is gone.
 *
 * Throws on an unknown bump rather than returning something plausible: this
 * feeds a published version number, and a wrong guess cannot be taken back.
 */
export function nextVersion(current, bump) {
    if (/^\d+\.\d+\.\d+/.test(bump)) return bump

    const parts = current.split('.').map(Number)
    if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
        throw new Error(`Cannot read the current version "${current}".`)
    }

    const [major, minor, patch] = parts
    if (bump === 'major') return `${major + 1}.0.0`
    if (bump === 'minor') return `${major}.${minor + 1}.0`
    if (bump === 'patch') return `${major}.${minor}.${patch + 1}`

    throw new Error(`Unknown bump "${bump}". Use patch, minor, major, or an explicit X.Y.Z.`)
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const WAIT_DEFAULTS = {
    attempts: 18,
    intervalMs: 10_000,
    sleep: realSleep,
    onWait: undefined
}

/**
 * Polls until the host has attached at least one check to a pull request.
 *
 * `gh pr checks` exits non-zero both when a check has failed and when none
 * exists yet, so the two cannot be told apart by exit code. `listChecks` is
 * therefore expected to return the list, or to throw when the host says there
 * are none: both mean "not yet" here, and both keep the loop running.
 *
 * A check that already exists and is red still counts as present. Reporting
 * that is the caller's job, not this one's.
 *
 * Returns false when the budget runs out, so the caller can say so in terms of
 * the workflow rather than blaming the branch.
 */
export async function waitForChecksToAppear(listChecks, options) {
    const { attempts, intervalMs, sleep, onWait } = { ...WAIT_DEFAULTS, ...options }

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const checks = await listChecks()
            if (Array.isArray(checks) && checks.length > 0) return true
        } catch {
            // The host reports "no checks" as an error. That is this loop's
            // whole reason to exist, so it is not one.
        }
        if (attempt === 0) onWait?.()
        await sleep(intervalMs)
    }
    return false
}
