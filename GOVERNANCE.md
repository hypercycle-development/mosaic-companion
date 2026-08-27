# MosAIc Companion Governance

This document describes how decisions are made in MosAIc Companion, who makes
them, and how that changes as the project grows. It describes the project as it
is today, not as we would like it to look.

MosAIc Companion is pre-1.0 and has three maintainers. Much of what follows is
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
through the `hypercycle-development` organisation is not the same as being a
maintainer: access is a fact about the organisation, while this document and
[MAINTAINERS.md](MAINTAINERS.md) record who is responsible.

There are currently three. There is no council, no board, and no committee.
[MAINTAINERS.md](MAINTAINERS.md) is the record of who they are.

**A decision is made when a majority of the active maintainers agree on it.**

This changed when the third maintainer joined, and it is a real change rather
than a larger number. At two, agreement had to be unanimous, which gave each
maintainer a veto over every change — accepted only because the alternative
was a casting vote naming one of them permanently senior. At three a majority
exists without anyone holding that position, so the reason for the veto is
gone and the veto goes with it.

Where a majority does not form, the change does not happen and existing
behaviour stands. Nobody is now able to block a change alone.

If you think a decision is wrong, say so in the issue or pull request where it
was made. There is no separate appeals procedure for technical decisions.

## How a change gets in

Changes go through pull requests. Branch protection requires an approving review
and a Developer Certificate of Origin sign-off on every commit, and blocks force
pushes and branch deletion.

**Merging a pull request is not the same act as making a decision.** One
approving review satisfies branch protection and is how ordinary changes land.
The majority rule above governs decisions — what the project will do, what it
refuses, what its rules are — not each merge. Where a pull request *is* the
decision, as with a change to this document or to a security boundary, the
issue-first rule below means it was already discussed as an issue before there
was a diff to approve.

Maintainers can bypass the review requirement on their own changes, and do,
because all three work on this part-time and waiting can hold up fixes that
should not wait. With three maintainers there is now a choice of reviewer, and losing one to
unavailability no longer leaves an author reviewing themselves. Bypassing review
is a choice about urgency rather than the only option. Every change being reviewed by
someone other than its author remains the goal.

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
ownership. At this size these would be labels rather than structure. They are
worth creating when there are enough maintainers for them to mean something.

## Becoming a maintainer

There is no ladder to climb and no nomination form. If you are contributing
regularly and want more responsibility, say so — in an issue, or to a maintainer
directly.

What it takes: sustained, reliable contribution over time; work that other people
can review and trust; understanding of the security and compatibility
consequences of the areas you touch; and willingness to review other people's
work, which is the part that is actually scarce.

Adding a maintainer requires the agreement of ALL current maintainers — not a
majority. Seating someone changes the composition every future majority is
counted from, so it is the one decision a majority should not be able to make
over a sitting maintainer's objection. Removal is likewise not a simple
majority; see below. Adding also requires the
consent of the candidate, recorded in [MAINTAINERS.md](MAINTAINERS.md). Consent
is required because being listed as responsible for a project is a commitment,
not an honour.

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

Removing a maintainer takes the agreement of ALL the remaining maintainers,
together with the owners of the `hypercycle-development` organisation, who
control access regardless of what this document says. At three that means both
others agreeing — where at two it meant one person could remove the other, which
is the change worth naming.

This is not an arbitrary exception. At three maintainers a removal always leaves
two, and among two there is no majority — only unanimity or a tie. The rule has
to be stated as unanimity or it is undefined. That it also makes removal harder
than an ordinary decision, and lets anyone facing it be protected by a single
colleague, is the right outcome rather than a coincidence. It is the one place a
single maintainer can still block something.

It is still not an independent process, because every maintainer is affiliated
with the same organisation. Making it one is a goal. Until then, except where
immediate action is needed for safety, removal involves notice, an opportunity
to respond, and recorded reasoning.

## Security decisions

Maintainers receive private vulnerability reports and may act on them privately —
withholding details, pulling a release, or revoking an artifact — before any
public disclosure. The project publishes an advisory when it is safe to do so.
[SECURITY.md](SECURITY.md) describes reporting and coordinated disclosure.

The majority rule above does not apply to reducing exposure. Any maintainer
may pull a release, revoke an artifact, or withhold details alone; the action is
reviewed afterwards. Without this, a disagreement would leave the vulnerable
state standing.

## Conduct

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) covers reporting and enforcement. All
three maintainers receive mail sent to the shared conduct address, so a report
about one of them should go to another of them directly rather than to that
address.

Where a report concerns all three, there is no internal route. Conduct on GitHub can
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
all three current maintainers are affiliated with HyperCycle. The project is
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
request, subject to the same review requirement — and the same bypass — as
anything else.

Several parts of this document do not scale: the absence of an independent
removal process, the absence of role tiers, and a majority rule among people who
all work for the same company, which counts heads without counting interests.
The veto was the largest of these and is gone as of the third maintainer.

**At four maintainers, this document is revised rather than amended.** Until
then, check twice a year that [MAINTAINERS.md](MAINTAINERS.md) is still accurate
and that nothing here has become a description of a process rather than of a
fact.
