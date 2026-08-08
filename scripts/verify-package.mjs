#!/usr/bin/env node
/**
 * Checks what `npm publish` would actually upload, by packing a tarball and
 * reading it back — not by reading the working tree. The two differ: `files`,
 * `.npmignore` and `svelte-package` all sit between the source and the
 * artifact, and every release bug worth catching lives in that gap.
 *
 * Run it before tagging. Exits non-zero on the first hard failure.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const failures = []
const notes = []

function check(label, ok, detail) {
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
    if (!ok) failures.push(label)
}

const work = mkdtempSync(join(tmpdir(), 'dg-verify-'))
try {
    console.log(`\nPacking ${pkg.name}@${pkg.version}\n`)
    execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
    const tarball = execFileSync('npm', ['pack', '--pack-destination', work], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .pop()

    const path = join(work, tarball)
    const entries = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).trim().split('\n')
    execFileSync('tar', ['-xzf', path, '-C', work])
    const root = join(work, 'package')
    const packed = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

    const has = (file) => entries.includes(`package/${file}`)
    const read = (file) => readFileSync(join(root, file), 'utf8')

    console.log(`\n${entries.length} files\n`)

    // The workflow refuses to publish when the tag and the manifest disagree.
    // Catching it here saves deleting a pushed tag.
    check('tarball version matches package.json', packed.version === pkg.version, packed.version)

    // `files` is an allow-list, so a leak means someone widened it.
    const leaked = entries.filter((entry) => /\.(test|spec)\.|\.test-d\./.test(entry))
    check('no test files', leaked.length === 0, leaked.slice(0, 3).join(', '))

    // Every export must resolve inside the tarball, or the package is broken
    // for the first consumer who imports it.
    const targets = new Set()
    for (const value of Object.values(pkg.exports ?? {})) {
        if (typeof value === 'string') targets.add(value)
        else for (const nested of Object.values(value ?? {})) targets.add(nested)
    }
    const missing = [...targets]
        .filter((target) => typeof target === 'string' && target.startsWith('./'))
        .map((target) => target.slice(2))
        .filter((target) => !has(target))
    check('every export resolves in the tarball', missing.length === 0, missing.join(', '))

    // Interface augmentation is what makes `grid.api.setPage` visible to a
    // consumer. It is emitted per feature and is easy to lose to a build
    // change, and nothing inside this repo would notice: the source compiles
    // either way, because the declaring module is right there.
    const augmented = entries.filter(
        (entry) =>
            entry.startsWith('package/dist/features/') &&
            entry.endsWith('.d.ts') &&
            read(entry.slice('package/'.length)).includes('declare module')
    )
    check(
        'GridApi augmentations survive packaging',
        augmented.length > 0,
        `${augmented.length} files`
    )

    // Peer ranges are deliberately wider than the devDependency, so a
    // difference proves nothing and a check on it would cry wolf every run.
    // Whether a range claims support nobody tested is a judgement call, and
    // the release skill asks for it by hand.

    // The README is the npm landing page; a placeholder there is public.
    if (has('README.md')) {
        const readme = read('README.md')
        const placeholders = ['REPLACE_WITH', 'TODO', 'FIXME', 'XXX'].filter((token) =>
            readme.includes(token)
        )
        check('README has no placeholders', placeholders.length === 0, placeholders.join(', '))
    }

    // Read from the working tree: CHANGELOG is not shipped in the tarball, but
    // it is what the release notes and the npm page's changelog link point at.
    const changelog = readFileSync('CHANGELOG.md', 'utf8')
    const version = pkg.version.replace(/\./g, '\\.')
    check(
        `CHANGELOG has a dated [${pkg.version}] section`,
        new RegExp(`^## \\[${version}\\] - \\d{4}-\\d{2}-\\d{2}`, 'm').test(changelog)
    )
    check(
        `CHANGELOG has the [${pkg.version}] link reference`,
        new RegExp(`^\\[${version}\\]:`, 'm').test(changelog)
    )
    if (/^## \[Unreleased\]/m.test(changelog)) {
        notes.push('CHANGELOG still has an [Unreleased] section — intended?')
    }
} finally {
    rmSync(work, { recursive: true, force: true })
}

if (notes.length > 0) {
    console.log('\nWorth a look:')
    for (const note of notes) console.log(`  - ${note}`)
}

if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed. Do not tag.\n`)
    process.exit(1)
}
console.log(
    `\nTarball looks publishable. Next: git tag v${pkg.version} && git push origin v${pkg.version}\n`
)
