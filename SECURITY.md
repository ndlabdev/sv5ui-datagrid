# Security Policy

## Supported versions

`@sv5ui/datagrid` follows semantic versioning. Security fixes are applied to the latest
minor release.

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |
| < 1.0   | ❌        |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions,
or pull requests.**

Report them privately through GitHub's
[**Report a vulnerability**](https://github.com/ndlabdev/sv5ui-datagrid/security/advisories/new)
form (repository **Security** tab → **Report a vulnerability**). That keeps the details
private until a fix ships.

Please include:

- The affected version, and which features were registered on the grid.
- A description of the issue and its impact.
- A minimal reproduction and the conditions needed to trigger it.

## What to expect

- **Acknowledgement** within a few days.
- An assessment of severity and affected versions, and a coordinated disclosure timeline.
- Credit in the release notes once a fix ships, unless you prefer to stay anonymous.

## Scope

The grid renders markup and transforms rows in the browser. It handles no authentication, no
secrets and no server logic. The classes of issue that do apply here:

- **CSV and TSV injection.** Export neutralizes a cell that begins with `=`, `+`, `-` or `@`,
  which a spreadsheet would otherwise evaluate as a formula on open. A path that reaches the
  clipboard or a file without that guard is a vulnerability, and `neutralizeFormula` is where
  to look.
- **Unsafe rendering.** The built-in renderers escape what they print. A component that
  forwarded untrusted data into a dangerous sink, such as a `javascript:` URL in a link
  renderer, would be in scope.
- **Prototype pollution** or an unsafe merge, particularly in the config system, the snapshot
  `hydrate` path and the filter model, all of which take plain objects from outside.
- **Denial of service through a pipeline stage** that an attacker can drive with data, for
  example a filter or comparator that goes quadratic on crafted input.
- **Supply chain** concerns in the build and publish tooling.

### Out of scope

- **A custom cell renderer or editor you wrote.** A snippet is your code, and the grid runs
  it as given. Sanitizing what it prints is the same responsibility it would be anywhere else
  in a Svelte app.
- **Data your server returns under `rowModel: 'server'`.** The grid displays the rows it is
  handed and does not filter them again; authorization stays on the server, where the request
  from `toFilterRequest` and `toSortRequest` arrives as untrusted input like any other.
- **A snapshot from an untrusted source.** `setState` restores column layout, sort and
  filters. Treat a snapshot as data from wherever you stored it, and validate it if that
  place is a URL a stranger can write.
