import { describe, expect, it, vi } from 'vitest'
import { nextVersion, waitForChecksToAppear } from './release-helpers.mjs'

describe('nextVersion', () => {
    it('passes an explicit version through untouched', () => {
        expect(nextVersion('1.1.0', '2.0.0')).toBe('2.0.0')
    })

    it('counts a major, zeroing what follows', () => {
        expect(nextVersion('1.1.2', 'major')).toBe('2.0.0')
    })

    it('counts a minor, zeroing the patch', () => {
        expect(nextVersion('1.1.2', 'minor')).toBe('1.2.0')
    })

    it('counts a patch', () => {
        expect(nextVersion('1.1.2', 'patch')).toBe('1.1.3')
    })

    it('gives a breaking change a major now that the package is past 1.0', () => {
        // The pre-1.0 rule folded breaking into a minor. 1.1.0 shipped a
        // Removed section under that dead rule, by explicit decision; nothing
        // here should make that the default again.
        expect(nextVersion('1.1.0', 'major')).toBe('2.0.0')
        expect(nextVersion('1.1.0', 'minor')).not.toBe('2.0.0')
    })

    it('refuses an unknown bump rather than guessing a published number', () => {
        expect(() => nextVersion('1.1.0', 'mayor')).toThrow(/Unknown bump/)
    })

    it('refuses a current version it cannot read', () => {
        expect(() => nextVersion('1.1', 'patch')).toThrow(/Cannot read/)
        expect(() => nextVersion('nope', 'patch')).toThrow(/Cannot read/)
    })
})

describe('waitForChecksToAppear', () => {
    const noSleep = () => Promise.resolve()

    it('resolves once a check exists', async () => {
        const listChecks = vi.fn().mockResolvedValue([{ bucket: 'pending' }])
        expect(await waitForChecksToAppear(listChecks, { sleep: noSleep })).toBe(true)
        expect(listChecks).toHaveBeenCalledTimes(1)
    })

    it('keeps waiting while the host throws, which is how it reports none yet', async () => {
        // The shape seen live on release/v1.1.0: gh exits non-zero with
        // "no checks reported on the ... branch" until the run is attached.
        const listChecks = vi
            .fn()
            .mockRejectedValueOnce(new Error('no checks reported'))
            .mockRejectedValueOnce(new Error('no checks reported'))
            .mockResolvedValue([{ bucket: 'pending' }])

        expect(await waitForChecksToAppear(listChecks, { sleep: noSleep })).toBe(true)
        expect(listChecks).toHaveBeenCalledTimes(3)
    })

    it('keeps waiting while the list is empty', async () => {
        const listChecks = vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValue([{ bucket: 'pass' }])
        expect(await waitForChecksToAppear(listChecks, { sleep: noSleep })).toBe(true)
        expect(listChecks).toHaveBeenCalledTimes(2)
    })

    it('gives up rather than hanging, after the attempts it was given', async () => {
        const listChecks = vi.fn().mockResolvedValue([])
        expect(await waitForChecksToAppear(listChecks, { attempts: 4, sleep: noSleep })).toBe(false)
        expect(listChecks).toHaveBeenCalledTimes(4)
    })

    it('treats an already failing check as present, leaving the report to the caller', async () => {
        // Distinguishing red from absent is the whole point; a red check is
        // present, and `gh pr checks --watch` is what says so.
        const listChecks = vi.fn().mockResolvedValue([{ bucket: 'fail' }])
        expect(await waitForChecksToAppear(listChecks, { sleep: noSleep })).toBe(true)
    })

    it('announces the wait once, not once per attempt', async () => {
        const onWait = vi.fn()
        await waitForChecksToAppear(vi.fn().mockResolvedValue([]), {
            attempts: 5,
            sleep: noSleep,
            onWait
        })
        expect(onWait).toHaveBeenCalledTimes(1)
    })

    it('waits the interval it was given between attempts', async () => {
        const sleep = vi.fn().mockResolvedValue(undefined)
        await waitForChecksToAppear(vi.fn().mockResolvedValue([]), {
            attempts: 3,
            intervalMs: 250,
            sleep
        })
        expect(sleep).toHaveBeenCalledTimes(3)
        expect(sleep).toHaveBeenCalledWith(250)
    })
})
