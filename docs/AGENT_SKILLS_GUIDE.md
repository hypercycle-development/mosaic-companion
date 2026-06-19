# Agent Skills Framework — Engineering Team Guide

> **Production-grade engineering skills for AI coding agents.**
> 
> Based on Addy Osmani's Agent Skills framework (github.com/addyosmani/agent-skills)
> 
> These skills encode the workflows, quality gates, and best practices that senior engineers use when building software.

---

## The 6-Phase Development Lifecycle

```
  DEFINE          PLAN           BUILD          VERIFY         REVIEW          SHIP
 ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
 │ Idea │ ───▶ │ Spec │ ───▶ │ Code │ ───▶ │ Test │ ───▶ │  QA  │ ───▶ │  Go  │
 │Refine│      │  PRD │      │ Impl │      │Debug │      │ Gate │      │ Live │
 └──────┘      └──────┘      └──────┘      └──────┘      └──────┘      └──────┘
  /spec          /plan          /build        /test         /review       /ship
```

---

## The 24 Skills at a Glance

### Meta — Discover which skill applies
| Skill | Use When |
|-------|----------|
| `using-agent-skills` | Starting a session or deciding which skill applies |

### Define — Clarify what to build
| Skill | Use When |
|-------|----------|
| `interview-me` | The ask is underspecified — need to extract real requirements |
| `idea-refine` | You have a rough concept that needs exploration |
| `spec-driven-development` | Starting a new project, feature, or significant change |

### Plan — Break it down
| Skill | Use When |
|-------|----------|
| `planning-and-task-breakdown` | You have a spec and need implementable units |

### Build — Write the code
| Skill | Use When |
|-------|----------|
| `incremental-implementation` | Any change touching more than one file |
| `test-driven-development` | Implementing logic, fixing bugs, or changing behavior |
| `context-engineering` | Output quality drops or switching tasks |
| `source-driven-development` | You want authoritative, source-cited code |
| `doubt-driven-development` | Stakes are high — need adversarial review |
| `frontend-ui-engineering` | Building or modifying user-facing interfaces |
| `api-and-interface-design` | Designing APIs, module boundaries, or public interfaces |

### Verify — Prove it works
| Skill | Use When |
|-------|----------|
| `browser-testing-with-devtools` | Building or debugging anything that runs in a browser |
| `debugging-and-error-recovery` | Tests fail, builds break, or behavior is unexpected |

### Review — Quality gates before merge
| Skill | Use When |
|-------|----------|
| `code-review-and-quality` | Before merging any change |
| `code-simplification` | Code works but is harder to maintain than it should be |
| `security-and-hardening` | Handling user input, auth, data storage, or external integrations |
| `performance-optimization` | Performance requirements exist or you suspect regressions |

### Ship — Deploy with confidence
| Skill | Use When |
|-------|----------|
| `git-workflow-and-versioning` | Making any code change (always) |
| `ci-cd-and-automation` | Setting up or modifying build and deploy pipelines |
| `deprecation-and-migration` | Removing old systems or sunsetting features |
| `documentation-and-adrs` | Making architectural decisions or shipping features |
| `observability-and-instrumentation` | Adding telemetry or shipping to production |
| `shipping-and-launch` | Preparing to deploy to production |

---

## Key Principles Summary

### 1. Spec Before Code
> "Write a PRD covering objectives, commands, structure, code style, testing, and boundaries before any code."

### 2. Small, Atomic Changes
```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if single logical change.
~1000 lines changed  → Too large. Split it.
```

### 3. Vertical Slicing (Not Horizontal)
**Bad:** Build entire database → Build all API → Build all UI → Connect everything
**Good:** Build one complete feature path at a time (DB + API + UI for one feature)

### 4. TDD: Red-Green-Refactor
```
RED: Write a test that fails
GREEN: Write minimal code to make it pass
REFACTOR: Clean up with tests still passing
```

### 5. The Beyonce Rule
> "If you liked it, you should have put a test on it."
> Infrastructure changes are not responsible for catching your bugs — your tests are.

### 6. Five-Axis Code Review
1. **Correctness** — Does it do what it claims?
2. **Readability** — Can another engineer understand it?
3. **Architecture** — Does it fit the system?
4. **Security** — Any vulnerabilities?
5. **Performance** — Any bottlenecks?

### 7. Git Workflow: Trunk-Based Development
```
main ──●──●──●──●──●──●──●──●──●──  (always deployable)
        ╲      ╱  ╲    ╱
         ●──●─╱    ●──╱    ← short-lived branches (1-3 days)
```

### 8. Commit Discipline
- **Atomic:** One logical thing per commit
- **Descriptive:** Explain the *why*, not just the *what*
- **Frequent:** Commit after each increment
- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## Task Sizing Guidelines

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config | Add validation rule |
| **S** | 1-2 | One component or endpoint | Add new API endpoint |
| **M** | 3-5 | One feature slice | User registration flow |
| **L** | 5-8 | Multi-component feature | Search with filtering |
| **XL** | 8+ | **Break it down** | — |

---

## Comment Severity Labels

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(none)* | Required | Must address before merge |
| **Critical:** | Blocks merge | Security, data loss, broken functionality |
| **Nit:** | Minor, optional | May ignore — formatting preferences |
| **Optional:** | Suggestion | Worth considering, not required |
| **FYI:** | Informational | No action needed — context for future |

---

## Test Pyramid

```
          ╱╲
         ╱  ╲         E2E Tests (~5%)
        ╱    ╲        Full user flows
       ╱──────╲
      ╱        ╲      Integration Tests (~15%)
     ╱          ╲     Component interactions
    ╱────────────╲
   ╱              ╲   Unit Tests (~80%)
  ╱                ╲  Pure logic, isolated
 ╱──────────────────╲
```

---

## DAMP Over DRY in Tests

In production code, DRY (Don't Repeat Yourself) is right. In tests, **DAMP (Descriptive And Meaningful Phrases)** is better.

```typescript
// Good: Reads like a specification
it('returns tasks sorted by creation date, newest first', async () => {
  const tasks = await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(tasks[0].createdAt.getTime())
    .toBeGreaterThan(tasks[1].createdAt.getTime());
});

// Bad: Tests implementation details
it('calls db.query with ORDER BY created_at DESC', async () => {
  await listTasks({ sortBy: 'createdAt', sortOrder: 'desc' });
  expect(db.query).toHaveBeenCalledWith(
    expect.stringContaining('ORDER BY created_at DESC')
  );
});
```

---

## Skill Anatomy

Every skill follows this structure:

```
┌─────────────────────────────────────────────────┐
│  SKILL.md                                       │
│                                                 │
│  ┌─ Frontmatter ─────────────────────────────┐  │
│  │ name: lowercase-hyphen-name               │  │
│  │ description: Guides agents through [task].│  │
│  │              Use when…                    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Overview         → What this skill does       │
│  When to Use      → Triggering conditions       │
│  Process          → Step-by-step workflow       │
│  Rationalizations → Excuses + rebuttals         │
│  Red Flags        → Signs something's wrong     │
│  Verification     → Evidence requirements       │
└─────────────────────────────────────────────────┘
```

**Key design choices:**
- **Process, not prose.** Skills are workflows agents follow, not reference docs they read.
- **Anti-rationalization.** Every skill includes a table of common excuses agents use to skip steps with documented counter-arguments.
- **Verification is non-negotiable.** Every skill ends with evidence requirements — "seems right" is never sufficient.
- **Progressive disclosure.** Supporting references load only when needed.

---

## Source

Based on Google's engineering culture — concepts from:
- [Software Engineering at Google](https://abseil.io/resources/swe-book)
- [Google Engineering Practices Guide](https://google.github.io/eng-practices/)

Key concepts embedded:
- Hyrum's Law in API design
- Beyonce Rule and test pyramid in testing
- Change sizing and review speed norms in code review
- Chesterton's Fence in simplification
- Trunk-based development in git workflow
- Shift Left and feature flags in CI/CD
- ADRs for documenting decisions

---

## Using Agent Skills in Mosaic-Companion

When working with agents on Stargate components:

1. **Start with `/spec`** — Define what we're building before coding
2. **Use `/plan`** — Break work into verifiable tasks
3. **Apply `/build`** — Implement incrementally with TDD
4. **Run `/test`** — Prove it works before shipping
5. **Do `/review`** — Five-axis quality gate
6. **Execute `/ship`** — Deploy with confidence

**For complex features:** `/build auto` generates the plan and implements every task autonomously — you approve the plan once, it runs with TDD and commits individually.

---

## Skills Installed in This Project

The following skills have been added to your Hermes skills library:

- `addy-agent-skills` — Master reference guide
- `spec-driven-development` — Write PRD before code
- `planning-and-task-breakdown` — Decompose into tasks
- `incremental-implementation` — Build in vertical slices
- `code-review-and-quality` — Five-axis review
- `git-workflow-and-versioning` — Trunk-based discipline

---

*Reference: github.com/addyosmani/agent-skills*
*Framework: MIT License*
