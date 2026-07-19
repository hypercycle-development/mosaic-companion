---
name: code-review-and-quality
description: Conduct five-axis code review before merging any change. Reviews correctness, readability, architecture, security, and performance.
---

# Code Review and Quality

## Overview

Multi-dimensional code review with quality gates. Every change gets reviewed before merge. Review covers five axes: correctness, readability, architecture, security, and performance.

## When to Use

- Before merging any PR or change
- After completing a feature implementation
- When another agent produced code you need to evaluate
- After any bug fix

## The Five-Axis Review

### 1. Correctness

Does the code do what it claims to do?

- Does it match the spec?
- Are edge cases handled (null, empty, boundary)?
- Are error paths handled?
- Does it pass all tests?
- Any off-by-one errors, race conditions, state inconsistencies?

### 2. Readability & Simplicity

Can another engineer understand this without help?

- Are names descriptive? (No `temp`, `data`, `result` without context)
- Is control flow straightforward?
- Could this be done in fewer lines?
- Are abstractions earning their complexity?
- Would a staff engineer say "why didn't you just..."?

### 3. Architecture

Does the change fit the system's design?

- Does it follow existing patterns?
- Does it maintain clean module boundaries?
- Is there code duplication that should be shared?
- Are dependencies flowing in the right direction?

### 4. Security

Does the change introduce vulnerabilities?

- Is user input validated and sanitized?
- Are secrets kept out of code?
- Is auth checked where needed?
- Are SQL queries parameterized?
- Are outputs encoded to prevent XSS?

### 5. Performance

Does the change introduce performance problems?

- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any missing pagination?

## Change Sizing

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if single logical change.
~1000 lines changed  → Too large. Split it.
```

## Comment Severity Labels

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(none)* | Required | Must address before merge |
| **Critical:** | Blocks merge | Security, data loss, broken functionality |
| **Nit:** | Minor, optional | May ignore — formatting preferences |
| **Optional:** | Suggestion | Worth considering |
| **FYI:** | Informational | Context for future |

## Review Process

### Step 1: Understand the Context

- What is this change trying to accomplish?
- What spec or task does it implement?
- What is the expected behavior change?

### Step 2: Review the Tests First

Tests reveal intent:
- Do tests exist for the change?
- Do they test behavior (not implementation)?
- Are edge cases covered?

### Step 3: Review the Implementation

Walk through with five axes in mind.

### Step 4: Verify the Verification

- What tests were run?
- Did the build pass?
- Was the change tested manually?
- Screenshots for UI changes?

## Anti-Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "I don't need review for this small change" | Small changes can have big impacts. Review everything. |
| "The tests pass, so it's fine" | Tests verify what you tested, not what you missed. |
| "I'll clean it up later" | Later never comes. Clean it now or it stays messy. |

## Review Checklist

- [ ] Correctness verified
- [ ] Readability assessed
- [ ] Architecture reviewed
- [ ] Security checked
- [ ] Performance considered
- [ ] Tests reviewed first
- [ ] Severity labels applied to comments
- [ ] Verification story confirmed
