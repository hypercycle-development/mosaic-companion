# Signing test fixtures

**There is no committed signing key here, and there must never be one again.**

`test-signing-key.json` and `generate-test-signing-key.cjs` were removed on
2026-08-21. The key's private half had been committed to this **public** repo
since #96, so it must be treated as permanently compromised — git history keeps
it reachable regardless of the deletion. It was pinned nowhere by then, so the
removal costs nothing; it is recorded here because the reasoning is the point.

A private key in a repo is a private key on the internet the moment that repo is
public. A test key is indistinguishable from a real one to whoever finds it, and
"it's only for CI" is not visible from the outside.

## Exercising the verify path

`electron/addons/signing.ts` no longer pins any dev key. An unpackaged build
trusts public keys supplied **at runtime**:

```bash
MOSAIC_DEV_PUBLISHER_KEYS=/path/to/pins.json npm start
```

where `pins.json` is an array of `{ keyId, publicKey, introducedAt, retiredAt }`
— **public halves only**. `devPublisherKeys()` refuses the whole file if any
entry carries private key material, and a packaged build ignores the variable
entirely, so it can never widen what a shipped app trusts.

Generate the keypair with the same offline ceremony used for production, and
keep the private half outside every working tree. Delete it when finished.
