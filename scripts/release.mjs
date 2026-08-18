#!/usr/bin/env node
/**
 * Cuts a release end to end:
 *
 *   npm run release -- minor        # or patch / major / an explicit 1.2.3
 *   npm run release -- minor --dry  # do everything except write, commit, push
 *
 * Cut from `dev`, which is where work lands. Bumps the version, closes the
 * CHANGELOG's Unreleased section, runs the gates, verifies the packed tarball,
 * and commits, all on `dev`. One pull request then takes `dev` to `main`,
 * carrying the release commit and everything waiting behind it; `main` is
 * protected and takes no direct push, from an admin either. Only after that
 * merges is the tag cut, and pushing the tag is what publishes: `publish.yml`
 * fires on `v*.*.*` and runs `npm publish --provenance`. The script then waits
 * for that workflow and confirms the registry actually moved before reporting
 * success.
 *
 * One pull request, not two: bumping on `dev` means the work and the version
 * travel together, so there is no separate sync to remember. Releasing from
 * `main` needed that sync, and forgetting it would have shipped the previous
 * version's code under a new number.
 *
 * Resumable: if the version is already bumped and the CHANGELOG already has
 * its dated section — a previous run that stopped before tagging — it picks up
 * from there instead of refusing.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { nextVersion, rotateChangelog, waitForChecksToAppear } from './lib/release-helpers.mjs'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const bump = args.find((arg) => !arg.startsWith('-')) ?? 'patch'

const run = (cmd, argv, opts = {}) =>
    execFileSync(cmd, argv, { encoding: 'utf8', ...opts })
        ?.toString()
        .trim()
const step = (label) => console.log(`\n\x1b[1m${label}\x1b[0m`)
const fail = (message) => {
    console.error(`\n\x1b[31m${message}\x1b[0m\n`)
    process.exit(1)
}
const write = (file, content) => {
    if (!dry) writeFileSync(file, content)
}
const git = (...argv) => {
    if (dry) return console.log(`  [dry] git ${argv.join(' ')}`)
    return run('git', argv, { stdio: 'inherit' })
}

/**
 * Asks GitHub for the checks on a pull request. stderr is swallowed on
 * purpose: while no check exists yet, `gh` writes "no checks reported on the
 * ... branch" there, and execFileSync forwards that to our terminal. Letting it
 * through would print the exact alarming line the wait exists to stop people
 * believing — once per attempt.
 */
const listChecks = (prNumber) => () =>
    JSON.parse(
        run('gh', ['pr', 'checks', prNumber, '--json', 'bucket'], {
            stdio: ['ignore', 'pipe', 'ignore']
        }) || '[]'
    )

const pkg = () => JSON.parse(readFileSync('package.json', 'utf8'))
const current = pkg().version

// ---------------------------------------------------------------- preflight

step('Preflight')

const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch !== 'dev') {
    fail(
        `On "${branch}". Releases are cut from dev, which is where work lands.\n` +
            'The pull request this opens is what takes it to main.'
    )
}

if (run('git', ['status', '--porcelain'])) {
    fail('Working tree is dirty. Commit or stash first.')
}

run('git', ['fetch', 'origin', '--quiet'])
if (run('git', ['rev-list', 'HEAD..origin/dev', '--count']) !== '0') {
    fail('origin/dev is ahead. Pull first.')
}

// `main` should hold nothing `dev` lacks. When it does, a previous release was
// never pushed back, and this one would open a pull request that quietly
// reverts it. `rev-list` exits 128 rather than returning a count when the ref
// is missing, which a single-branch clone would hit, so that has to read as
// "cannot tell" instead of taking down the release with a stack trace.
let unsynced
try {
    unsynced = run('git', ['rev-list', 'origin/dev..origin/main', '--count'], {
        stdio: ['ignore', 'pipe', 'ignore']
    })
} catch {
    fail(
        'Cannot compare dev with origin/main, because the ref is missing.\n' +
            'Both branches have to be checkable to release:  git fetch origin main dev'
    )
}
if (unsynced !== '0') {
    fail(
        `origin/main holds ${unsynced} commits dev does not, so a previous release was never synced back.\n` +
            'Put them on dev first:  git checkout dev && git merge origin/main && git push origin dev'
    )
}

// The workflow cannot publish without this, and a tag that fails has to be
// deleted from the remote and the local repo before it can be retried.
const secrets = run('gh', ['secret', 'list']) ?? ''
if (!secrets.includes('NPM_TOKEN')) {
    fail(
        'NPM_TOKEN is not set on the repo, so publish.yml would build and then fail.\n' +
            'Set it first:  gh secret set NPM_TOKEN'
    )
}
// Named, which is all this can see. Whether npm accepts it is a thing only npm
// knows: a token can be expired, or be the granular kind that npm refuses to
// exempt from 2FA, and both look like this line passing.
console.log('  on dev, clean, main holds nothing dev lacks, a secret named NPM_TOKEN exists')

let version
try {
    version = nextVersion(current, bump)
} catch (error) {
    fail(error.message)
}
const tag = `v${version}`

if (run('git', ['tag', '-l', tag])) fail(`Tag ${tag} already exists.`)
if ((run('npm', ['view', pkg().name, 'versions', '--json']) ?? '').includes(`"${version}"`)) {
    fail(`${version} is already on npm. A published version cannot be replaced.`)
}

const changelogPath = 'CHANGELOG.md'
let changelog = readFileSync(changelogPath, 'utf8')
const released = new RegExp(
    `^## \\[${version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}`,
    'm'
)
const resuming = current === version && released.test(changelog)

console.log(`  ${current} -> ${version}${resuming ? '  (resuming, already prepared)' : ''}`)
if (dry) console.log('  [dry] nothing will be written or pushed')

// ------------------------------------------------------------------- gates

step('Gates')
for (const script of ['lint', 'check', 'test']) {
    run('npm', ['run', script], { stdio: 'inherit' })
}

// ------------------------------------------------------------------ prepare

if (!resuming) {
    step('Prepare')

    const today = new Date().toISOString().slice(0, 10)
    try {
        changelog = rotateChangelog(changelog, {
            version,
            date: today,
            url: `https://github.com/ndlabdev/sv5ui-datagrid/releases/tag/${tag}`
        })
    } catch (error) {
        fail(error.message)
    }

    write(changelogPath, changelog)
    if (!dry) run('npm', ['version', version, '--no-git-tag-version'], { stdio: 'inherit' })
    console.log(`  package.json -> ${version}, CHANGELOG section dated ${today}`)
}

// ------------------------------------------------------------------- verify

step('Verify the packed tarball')
if (dry && !resuming) {
    console.log('  [dry] skipped: the bump was not written, so the tarball would be stale')
} else {
    run('node', ['scripts/verify-package.mjs'], { stdio: 'inherit' })
}

// -------------------------------------------------------------------- ship

/**
 * `main` is protected: it takes no direct push, from an admin either, and the
 * `ci` check has to be green. So the release travels as one pull request from
 * `dev`, carrying the release commit and every change waiting behind it. Only
 * after it merges is the tag cut, from the merge commit `main` ends on. Tags
 * are outside branch protection, and pushing one is still what publishes.
 */
step('Commit, open the release PR, merge it')

if (!resuming) {
    git('add', 'package.json', changelogPath)
    git('commit', '-m', `chore(release): ${version}`)
}

if (dry) {
    console.log('  [dry] git push origin dev')
    console.log('  [dry] gh pr create --base main --head dev')
    console.log('  [dry] wait for the ci check, then gh pr merge --merge')
    console.log('  [dry] git checkout main && git pull, then tag the merge commit')
    console.log(`  [dry] git tag ${tag} && git push origin ${tag}`)
    console.log('  [dry] git push origin main:dev')
    console.log('\n[dry] stopping before the publish watch.\n')
    process.exit(0)
}

git('push', 'origin', 'dev')

const existingPr = run('gh', [
    'pr',
    'list',
    '--head',
    'dev',
    '--base',
    'main',
    '--json',
    'number',
    '--jq',
    '.[0].number // ""'
])
const prNumber =
    existingPr ||
    run('gh', [
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        'dev',
        '--title',
        `chore(release): ${version}`,
        '--body',
        `Cut by \`npm run release\`. Carries everything on dev, including the version bump. The tag is pushed from \`main\` once this merges, and that is what publishes ${version}.`,
        '--assignee',
        '@me'
    ])?.match(/\/pull\/(\d+)/)?.[1]

if (!prNumber) fail('Could not open or find the release pull request.')
console.log(`  release PR #${prNumber} from dev`)

step(`Waiting for the ci check on #${prNumber}`)

// `gh pr checks --watch` does not wait for a check to exist. A PR opened a
// second ago has none attached yet, and it exits non-zero saying so — which
// read as a failure and aborted an otherwise healthy 1.1.0. Wait for the run
// to appear first, then hand over to --watch for the run itself.
const appeared = await waitForChecksToAppear(listChecks(prNumber), {
    onWait: () => console.log('  no check attached yet, waiting for one to appear')
})
if (!appeared) {
    fail(
        `No check ever appeared on #${prNumber}. Nothing is tagged or published.\n` +
            'ci.yml runs on pull requests to main — check that it is enabled, then run the same command again.'
    )
}

try {
    run('gh', ['pr', 'checks', prNumber, '--watch', '--interval', '20'], { stdio: 'inherit' })
} catch {
    fail(
        'CI failed on the release PR. Nothing is tagged or published.\n' +
            `Look at it with:  gh pr checks ${prNumber}\n` +
            'If it is genuinely red, fix it on dev and run the same command again.'
    )
}

// `dev` is permanent, so it is never deleted on merge.
step('Merging the release PR')
run('gh', ['pr', 'merge', prNumber, '--merge'], { stdio: 'inherit' })

git('checkout', 'main')
git('pull', '--ff-only', 'origin', 'main')

const merged = run('git', ['show', 'HEAD:package.json'])
if (!merged?.includes(`"version": "${version}"`)) {
    fail(`main is not carrying ${version} after the merge. Check the pull request.`)
}

step('Tag and push')
git('tag', tag)
git('push', 'origin', tag)

// The merge commit exists only on `main`, so `dev` has to take it back or it
// starts the next release one commit behind. `dev` is unprotected, so it takes
// it directly. Then return there: the run started on `dev`, and leaving the
// checkout on `main` with a stale local `dev` would fail the next preflight.
git('push', 'origin', 'main:dev')
git('checkout', 'dev')
git('pull', '--ff-only', 'origin', 'dev')

// ------------------------------------------------------------------ publish

step(`Publishing — waiting for publish.yml on ${tag}`)
console.log('  (the tag push is what triggers it)')

let runId = ''
for (let attempt = 0; attempt < 20 && !runId; attempt++) {
    execFileSync('sleep', ['3'])
    runId = run('gh', [
        'run',
        'list',
        '--workflow',
        'publish.yml',
        '--branch',
        tag,
        '--limit',
        '1',
        '--json',
        'databaseId',
        '--jq',
        '.[0].databaseId // ""'
    ])
}
if (!runId) fail(`publish.yml did not start for ${tag}. Check: gh run list --workflow publish.yml`)

try {
    run('gh', ['run', 'watch', runId, '--exit-status'], { stdio: 'inherit' })
} catch {
    fail(
        `publish.yml failed. ${version} was not published.\n` +
            'What the registry said is in the log above, and it is about the token:\n' +
            '  404 on the PUT   the token is expired or cannot write this scope\n' +
            '  EOTP             the token is not the classic Automation kind, the\n' +
            '                   only one npm exempts from 2FA\n' +
            'Fix the cause, then delete and re-push the tag:\n' +
            `  git push --delete origin ${tag} && git tag -d ${tag}\n` +
            `  git tag ${tag} <merge commit> && git push origin ${tag}`
    )
}

// A green workflow is not proof the registry moved.
step('Confirming the registry')
let published = ''
for (let attempt = 0; attempt < 10 && published !== version; attempt++) {
    execFileSync('sleep', ['5'])
    published = run('npm', ['view', pkg().name, 'version']) ?? ''
}
if (published !== version) {
    fail(`Workflow was green but npm still reports ${published || 'nothing'}. Check manually.`)
}
console.log(`  npm reports ${published}`)

step('Release notes')
try {
    run('gh', ['release', 'create', tag, '--title', tag, '--notes-from-tag'], { stdio: 'inherit' })
} catch {
    console.log(`  could not create the GitHub release; do it by hand: gh release create ${tag}`)
}

console.log(`\n\x1b[32m${pkg().name}@${version} published.\x1b[0m\n`)
console.log('Consumers install a tarball, not the registry. To update the Pro repo:')
console.log('  cd ../sv5ui-datagrid-pro && pnpm sync:community')
console.log(`  then point devDependencies at vendor/sv5ui-datagrid-${version}.tgz\n`)
