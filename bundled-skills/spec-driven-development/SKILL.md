---
name: spec-driven-development
description: Write a PRD covering objectives, commands, structure, code style, testing, and boundaries before any code. Use when starting a new project, feature, or significant change.
---

# Spec-Driven Development

## Overview

Before writing any code, write the spec. A specification is a contract between you and the implementation — it defines what success looks like, what constraints exist, and what "done" means. Without a spec, you're building blindly.

## When to Use

- Starting a new project, feature, or significant change
- The scope feels vague or open-ended
- Multiple stakeholders need alignment
- You're tempted to start coding immediately

## The Spec Writing Process

### Step 1: Define Objectives

What does this accomplish? Be specific:

```markdown
## Objectives

**Primary:** Users can register for accounts with email/password and receive confirmation emails.

**Secondary:**
- Prevent duplicate registrations
- Rate limit registration attempts
- Log registration events for security audit

**Non-Objectives (Out of Scope):**
- Social login (OAuth) — separate feature
- Phone verification — future phase
- Admin user management — separate feature
```

### Step 2: Define Commands/Interface

If this exposes commands, APIs, or interfaces — specify them upfront:

```markdown
## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/register` | Start registration flow | `/register email@example.com` |
| `/confirm` | Confirm email with token | `/confirm abc123` |

## API Endpoints

### POST /api/auth/register
Request body: `{ email: string, password: string }`
Response: `{ userId: string, email: string, status: "pending_confirmation" }`
Errors: 400 (validation), 409 (duplicate), 429 (rate limited)
```

### Step 3: Define Structure

What components, files, and modules will this touch?

```markdown
## Structure

```
src/
  auth/
    register.ts       # Registration logic
    confirm.ts        # Email confirmation
    validate.ts       # Input validation
    rate-limiter.ts   # Rate limiting
  email/
    sender.ts         # Email service integration
    templates/
      confirmation.hbs
```
```

### Step 4: Define Code Style

Any specific patterns, conventions, or constraints?

```markdown
## Code Style

- Use Zod for all input validation
- Async/await only — no callbacks
- Repository pattern for database access
- Error handling: custom AuthError classes with error codes
```

### Step 5: Define Testing Strategy

How will this be tested?

```markdown
## Testing

- Unit tests: validation logic, rate limiter
- Integration tests: full registration flow with test DB
- E2E tests: registration via UI (2 tests max)
- Security tests: SQL injection, XSS attempts
```

### Step 6: Define Boundaries

What's in scope? What's explicitly out?

```markdown
## Boundaries

**In Scope:**
- Email/password registration
- Email confirmation
- Basic rate limiting

**Out of Scope:**
- OAuth providers
- Phone/SMS verification
- Admin functionality
- Password reset (separate feature)

**Assumptions:**
- SMTP server is configured
- Database schema supports user table
- Frontend handles UI validation
```

## Spec Template

```markdown
# Spec: [Feature Name]

## Overview
One paragraph describing what this builds and why.

## Objectives
- Primary: [What success looks like]
- Secondary: [Nice-to-haves]
- Non-objectives: [Explicitly out of scope]

## Commands / Interface
[Commands, APIs, or interfaces this exposes]

## Structure
[Files, components, modules]

## Code Style
[Patterns, conventions, constraints]

## Testing Strategy
[What to test and how]

## Boundaries
[In scope / Out of scope]

## Open Questions
- [Question needing resolution]

## Acceptance Criteria
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]
```

## Anti-Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "I'll write the spec after I prototype" | The prototype becomes production. Specs written after code describe what you built, not what you should build. |
| "This is a simple change, no spec needed" | "Simple" changes often have hidden complexity. 10 minutes of spec writing saves hours of rework. |
| "The code IS the spec" | Code describes implementation, not intent. Future maintainers need to know the "why", not just the "what". |

## Verification

- [ ] Spec is written before any code
- [ ] Spec includes acceptance criteria
- [ ] Boundaries are explicitly defined
- [ ] Team/stakeholders have reviewed spec
