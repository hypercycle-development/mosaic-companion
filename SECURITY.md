# Security Policy

MosAIc Companion combines AI agents, local data, extension runtimes, network integrations, and wallet capabilities. Security reports are taken seriously and should be submitted privately.

## Supported versions

MosAIc Companion is pre-1.0 with a single active release line. Security fixes are made on the latest published release only; older releases are not maintained. If you are running an older version, upgrade.

| Version | Security support |
| --- | --- |
| Latest published release | Supported on a best-effort pre-1.0 basis |
| All earlier releases | Not maintained; upgrade to the latest release |

## Report a vulnerability privately

Do not open a public issue, discussion, or pull request for a suspected vulnerability.

Report through GitHub private vulnerability reporting at <https://github.com/hypercycle-development/mosaic-companion/security/advisories/new>. This is the only reporting channel.


## Include in the report

Provide as much of the following as is safe:

- Affected version, commit, platform, and architecture.
- Affected subsystem or extension type.
- Reproduction steps or proof of concept.
- Expected and observed behavior.
- Potential confidentiality, integrity, availability, financial, or privacy impact.
- Whether exploitation has been observed.
- Suggested remediation, if available.
- Your preferred name and disclosure credit.
- Any disclosure deadline you are working under.

Do not include real credentials, private keys, customer data, or unnecessary personal information. Use test data and redact secrets.

## Response expectations

MosAIc Companion is currently maintained by a very small team. We do not publish response-time targets, because we would rather set targets when we can meet them than publish numbers we cannot. Expect responses to be best-effort and sometimes slow. Growing the project to the point where it can state service objectives and meet them is a goal, not a present commitment.

Vulnerability reports are prioritized over ordinary issue and pull-request traffic, and actively exploited or critical vulnerabilities take priority within that. Disclosure and credit are coordinated with the reporter as described below.

## Coordinated disclosure

The project asks reporters to allow a reasonable period for investigation, remediation, release preparation, and user notification. A target of up to 90 days may be used unless active exploitation or another urgent circumstance requires faster disclosure.

The project will seek agreement with the reporter on:

- Severity and affected versions.
- Mitigations and release timing.
- Advisory wording.
- Attribution.
- Public disclosure date.

MosAIc will not ask a reporter to keep a vulnerability confidential indefinitely.

## Scope priorities

Reports are especially valuable when they affect:

- Electron Core, preload bridges, IPC authorization, or context isolation.
- Add-on identity, permissions, installation, signing, or update behavior.
- WASM sandbox escape, host functions, Gatekeeper, Chronicle, or tool input storage.
- MCP command execution, environment handling, authentication, or process isolation.
- Agent API-key encryption or secret handling.
- Vault access controls or content protection.
- Wallet keys, signing, transaction limits, payment flows, or node authentication.
- Release workflows, update channels, artifacts, or software-supply-chain integrity.
- Cross-agent or cross-user authorization.

## Out of scope without prior authorization

- Social engineering, phishing, or physical attacks.
- Accessing or modifying another person's data.
- Denial-of-service testing against public infrastructure.
- Automated scanning that materially degrades service.
- Attacks against third-party services not controlled by the project. This includes add-ons and the services they connect to — add-ons are by definition not project-controlled. Vulnerabilities in MosAIc's own add-on identity, permission, installation, or isolation mechanisms remain in scope above.
- Testing with real funds beyond amounts you personally control and can afford to lose.
- Public disclosure before the project has had a reasonable opportunity to assess and respond.

If you are uncertain whether a test is safe, ask through the private security channel before proceeding.

## Current security boundaries and limitations

- Sandboxed WASM tools and renderer add-ons do not have the same trust model.
- MCP servers may run as local child processes or remote services and should be treated according to their actual deployment model.
- Bundled or native main-process code is privileged application code.
- Electron `safeStorage` depends on the operating system's available secure-storage backend.
- The add-on system is not fully stood up. Add-ons can currently be installed only by explicit local path; browsing or installing community add-ons is not available because publisher signing is not yet in place. Standing this up is near-term planned work.
- The Vault is an early, unfinished component. Boxes hold user-entered text stored as local JSON, unencrypted at rest. Per-agent access controls are real and enforced within the application, but they do not protect the files on disk. Nothing in the interface says the contents are unencrypted, and the name invites more confidence than the implementation currently earns. Do not put anything sensitive in it.
- Pre-1.0 interfaces and controls remain under active hardening.

These limitations should not be interpreted as permission to bypass existing controls. They are disclosed so users and researchers can make informed decisions.

## Bug bounty

MosAIc does not currently promise monetary rewards. A scoped bug-bounty program may be introduced after the disclosure process, response coverage, threat model, and initial independent security review are in place.

## Security advisories

When appropriate, security fixes should be accompanied by a GitHub Security Advisory describing affected versions, severity, mitigation, fixed versions, and credit.

## References

- OpenSSF Vulnerability Disclosures Working Group: <https://openssf.org/groups/vulnerability-disclosures/>
- GitHub private vulnerability reporting: <https://docs.github.com/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository>
- OpenSSF OSPS Baseline: <https://baseline.openssf.org/>

