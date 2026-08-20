# MosAIc Companion Governance

This document describes how decisions are made in MosAIc Companion, who makes
them, and how that changes as the project grows. It describes the project as it
is today, not as we would like it to look.

MosAIc Companion is pre-1.0 and has two maintainers. Much of what follows is
short because the project is small. Where a normal open-source practice is
absent, this document says so rather than describing a process nobody runs.

## Scope

This document covers the `mosaic-companion` repository. It does not cover other
HyperCycle repositories.

## Principles

1. Work and decisions are open by default.
2. Technical authority is earned through sustained contribution and judgment.
3. Security and user safety take priority over release speed.
4. Compatibility promises must match actual maintenance capacity.
5. Company sponsorship, employment, or membership does not carry merge authority.
6. Conflicts of interest are disclosed.
7. Roles belong to individuals, not to their employers, and do not transfer when
   someone changes jobs.
8. Both code and non-code contributions can demonstrate project leadership.

## Who decides

Technical decisions rest with the **maintainers** — the people listed in
[MAINTAINERS.md](MAINTAINERS.md). Holding administrative access to the repository
is not the same as being a maintainer; see [MAINTAINERS.md](MAINTAINERS.md).

There are currently two. There is no council, no board, no voting rule, and no
committee. A decision is made when the active maintainers agree on it.
[MAINTAINERS.md](MAINTAINERS.md) is the record of who that is.

**Where the maintainers disagree, the change does not happen** and existing
behaviour stands. This gives each maintainer a veto over change. We accept that
at two people, because the alternative is a casting vote that names one of them
permanently senior. Growing past it is a goal.

If you think a decision is wrong, say so in the issue or pull request where it
was made. There is no separate appeals procedure for technical decisions.

## How a change gets in

Changes go through pull requests. Branch protection requires an approving review
and a Developer Certificate of Origin sign-off on every commit, and blocks force
pushes and branch deletion.

Maintainers can bypass the review requirement on their own changes, and do. With
two part-time maintainers, waiting for the other would hold up fixes that should
not wait. Every change being reviewed by someone other than its author is a goal,
and the clearest practical reason to grow the maintainer group.

Significant changes are proposed as an issue before implementation — changes to
manifests, permissions, host functions, extension APIs, or security boundaries.
This **issue-first rule binds maintainers as well as outside contributors**, and
is the project's only proposal process. There is no separate RFC track.
[CONTRIBUTING.md](CONTRIBUTING.md) has the detail.

Routine fixes go straight to a pull request.

## Roles

### Contributor

Anyone who contributes accepted work or materially supports the project — code,
review, documentation, design, testing, security research, or community work.
No status is required and none is conferred.

### Maintainer

Someone with merge access, responsibility for the project's quality and security,
and a share in the decisions above. Maintainers are expected to review others'
work, triage issues, respond to security reports, keep documentation honest about
what the software actually does, and say when they no longer have capacity.

### Roles that do not exist yet

The project has no separate **reviewer** tier, no **security maintainer** or
**release maintainer** role distinct from maintainer, and no per-subsystem
ownership. With two people these would be labels rather than structure. They are
worth creating when there are enough maintainers for them to mean something.

## Becoming a maintainer

There is no ladder to climb and no nomination form. If you are contributing
regularly and want more responsibility, say so — in an issue, or to a maintainer
directly.

What it takes: sustained, reliable contribution over time; work that other people
can review and trust; understanding of the security and compatibility
consequences of the areas you touch; and willingness to review other people's
work, which is the part that is actually scarce.

Adding a maintainer requires the agreement of the current maintainers and the
consent of the candidate, recorded in [MAINTAINERS.md](MAINTAINERS.md). Consent
is required in writing because being listed as responsible for a project is a
commitment, not an honour.

## Inactivity

A maintainer who has been inactive for around six months may be asked whether
they want to resume, move to emeritus, or step down. Emeritus maintainers keep
the credit, lose the access, and can return by asking.

This is a conversation, not a trigger. The point is to keep
[MAINTAINERS.md](MAINTAINERS.md) an accurate statement of who is actually
responsible, so that nobody relies on cover that is not there.

## Removal

A maintainer may be removed for sustained absence without communication,
misuse of repository, release, or security privileges, serious or repeated Code
of Conduct violations, or undisclosed conflicts that materially affect project
decisions.

With two maintainers, removing one is a decision taken by the other, together
with the owners of the `hypercycle-development` organisation, who control access
regardless of what this document says. That is not an independent process.
Making it one is a goal. Until then, except where immediate action is needed for
safety, removal involves notice, an opportunity to respond, and recorded
reasoning.

## Security decisions

Maintainers receive private vulnerability reports and may act on them privately —
withholding details, pulling a release, or revoking an artifact — before any
public disclosure. The project publishes an advisory when it is safe to do so.
[SECURITY.md](SECURITY.md) describes reporting and coordinated disclosure.

The consensus rule above does not apply to reducing exposure. Either maintainer
may pull a release, revoke an artifact, or withhold details alone; the action is
reviewed afterwards. Without this, a disagreement would leave the vulnerable
state standing.

## Conduct

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) covers reporting and enforcement. Both
maintainers receive mail sent to the shared conduct address, so a report about
one of them goes to the other directly rather than to that address.

Where a report concerns both, there is no internal route. Conduct on GitHub can
be raised with GitHub at <https://github.com/contact/report-abuse>, independently
of this project. For conduct elsewhere there is currently no external route
either. A neutral escalation path is something the project wants and does not
have.

## Conflicts of interest

Disclose financial, employment, customer, investment, or personal interests that
a reasonable observer could think affect a project decision. Disclosure does not
automatically mean recusal; it means the other people deciding get to judge
whether recusal is warranted.

Do not use confidential project information to advantage an employer, customer,
investment, or competing product.

## Company participation

MosAIc Companion is developed by [HyperCycle](https://www.hypercycle.ai/), and
both current maintainers are affiliated with HyperCycle. The project is
single-vendor today. Broadening that is a goal.

Companies can contribute code, integrations, infrastructure, funding, staff time,
documentation, testing, or use cases. Company participation does not grant
maintainer status, roadmap commitments, preferential review, a right to merge, or
exclusive access to specifications. Technical roles are held by individuals.

## Capacity

MosAIc Companion is currently maintained by a very small team. We do not publish
response-time targets, because we would rather set targets when we can meet them
than publish numbers we cannot. Expect responses to be best-effort and sometimes
slow. Growing the project to the point where it can state service objectives and
meet them is a goal, not a present commitment.

## Amending this document

Changes to this document are made the same way as changes to the code: a pull
request, approved by a maintainer other than its author.

Several parts of this document do not scale: the veto, the absence of an
independent removal process, the absence of role tiers, and "consensus of active
maintainers", which at five people would mean five vetoes rather than two.

**At four maintainers, this document is revised rather than amended.** Until
then, check twice a year that [MAINTAINERS.md](MAINTAINERS.md) is still accurate
and that nothing here has become a description of a process rather than of a
fact.
