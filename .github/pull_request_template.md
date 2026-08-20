## What this changes

<!-- Explain the outcome in plain language. Link the issue this implements. -->

Closes #

## Why

<!-- What user, operator, or contributor need does this address? -->

## Change type

- [ ] Bug fix
- [ ] Feature
- [ ] Integration or extension
- [ ] Refactor or maintenance
- [ ] Documentation
- [ ] Security or privacy hardening
- [ ] Breaking change

## Trust and execution surface

Tick every surface this change touches.

- [ ] Core desktop application
- [ ] AI agents, chat, or model providers
- [ ] Sandboxed WASM tool
- [ ] MCP server or connector
- [ ] Renderer add-on
- [ ] IDE or developer tooling
- [ ] Wallet or payment path
- [ ] Vault, credentials, or user data
- [ ] Build, packaging, or release
- [ ] None of the above
- [ ] I am not sure which of these applies

## How it was tested

<!-- Include commands, environments, and results. Say what you did not test. -->

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test:e2e` where relevant
- [ ] Manual verification, described below

## Screenshots or recordings

<!-- Include these for visible UI changes where practical. -->

## Compatibility and migration

<!-- Manifest, ABI, data-format, configuration, OS, or API compatibility. "None" is a fine answer. -->

## Security, privacy, and permissions

Tick anything this change does. If you are unsure, tick the last box — that is a useful answer, not a failure. Assessing the risk is the reviewer's job; this section is just the facts they need to do it.

- [ ] Adds or changes a permission, or what a permission allows
- [ ] Makes network requests, or changes where existing ones go
- [ ] Reads or writes user data, credentials, wallet material, or the Vault
- [ ] Adds or updates a dependency
- [ ] Changes how an extension, tool, or MCP server is loaded or trusted
- [ ] Runs code from outside the repository
- [ ] None of the above
- [ ] I am not sure — please check this during review

<!-- Anything else worth flagging? Do not disclose an unpatched vulnerability here — see SECURITY.md. -->

## Documentation

- [ ] User or contributor documentation updated
- [ ] Compatibility or migration note added
- [ ] Not required, because:

## Checklist

- [ ] The change is focused and reviewable.
- [ ] I added or updated tests where practical.
- [ ] No secrets, private data, credentials, or unrelated files are included.
- [ ] I have the right to submit this work under the repository licence.
- [ ] All commits carry a Developer Certificate of Origin sign-off (`Signed-off-by:`).
