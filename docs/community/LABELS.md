# Labels

The repository carries GitHub's default labels. This taxonomy keeps the six that
pull their weight and adds eight.

Labels only earn a place if they change how something is routed or reported.

## Keep — GitHub defaults, already present

| Label | Colour | Use |
| --- | --- | --- |
| `bug` | `d73a4a` | Reproducible incorrect behaviour |
| `documentation` | `0075ca` | Documentation-only or documentation-led work |
| `enhancement` | `a2eeef` | New or changed user-visible capability |
| `good first issue` | `7057ff` | Bounded task with context and someone available to review it |
| `help wanted` | `008672` | Maintainers actively welcome outside help |
| `question` | `d876e3` | Needs information before it can be classified |

`duplicate`, `invalid` and `wontfix` also exist by default. Nothing depends on
them; leave them alone.

**Note the spelling.** GitHub's built-ins are `good first issue` and
`help wanted`, with spaces. Do not create `good-first-issue` or `help-wanted`
alongside them — GitHub treats them as different labels and the two sets drift
apart silently. Likewise `enhancement` is used rather than adding a `feature`
label that would mean the same thing.

## Add

| Label | Colour | Use |
| --- | --- | --- |
| `triage` | `d4c5f9` | Filed but not yet looked at by a maintainer. Applied by every issue form, cleared on first response |
| `security` | `b60205` | Public hardening work, or security work already disclosed and fixed. **Never** used on an unpatched vulnerability — those do not exist as issues |
| `integration` | `0e8a16` | WASM tool, MCP server, add-on, connector, provider, wallet, or payment integration |
| `use-case` | `fbca04` | Evidence from an adopter or operator about a real workflow |
| `needs-design` | `c2e0c6` | Interface, UX, architecture, or threat model needs design work before implementation |
| `needs-evidence` | `ededed` | The problem or the demand needs stronger validation |
| `blocked` | `000000` | Cannot progress until a named dependency resolves. Name it in the issue |
| `compatibility` | `f9d0c4` | Manifest, ABI, API, platform, or migration compatibility |

## Rules

- Apply one work-type label. Add state labels only where they change what happens
  next.
- `good first issue` means a maintainer has capacity to review it. Do not apply
  it to clear the backlog.
- Revisit this list after the tracker passes about fifty issues, and remove
  anything unused.

## Creating them

```bash
gh label create triage         --color d4c5f9 --description "Filed but not yet looked at by a maintainer"
gh label create security       --color b60205 --description "Public hardening work or disclosed and fixed security work"
gh label create integration    --color 0e8a16 --description "WASM, MCP, add-on, connector, provider, wallet, or payment integration"
gh label create use-case       --color fbca04 --description "Evidence from an adopter or operator about a real workflow"
gh label create needs-design   --color c2e0c6 --description "Interface, UX, architecture, or threat model needs design work"
gh label create needs-evidence --color ededed --description "Problem or demand needs stronger validation"
gh label create blocked        --color 000000 --description "Cannot progress until a named dependency resolves"
gh label create compatibility  --color f9d0c4 --description "Manifest, ABI, API, platform, or migration compatibility"
```
