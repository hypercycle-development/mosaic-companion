---
name: platform-integration-analysis
description: "Deep architectural analysis of complex platform codebases to identify unconnected components and design integration patterns between subsystems. Covers inventory, dependency mapping, gap analysis, and creative bridge solutions."
version: "1.0.0"
triggers:
  - analyze architecture
  - analyze components
  - find gaps
  - how can X use Y
  - bridge components
  - integration patterns
  - deep analysis
  - component inventory
  - platform audit
keywords:
  - integration
  - architecture
  - components
  - subsystem
  - bridge
  - gap
  - deep dive
  - audit
  - dependency map
  - unconnected
---

# Platform Integration Analysis

## When to Use

When the user wants to understand how two (or more) subsystems within a large platform can better integrate. Examples:
- "Analyze how Feature-A uses components from Module-B"
- "Find patterns to make System-X more powerful using System-Y"
- "Why doesn't Tab-A use Service-B?"
- Deep architectural audits before refactoring or adding new features.

## Pre-requisites

- Read access to the codebase (local clone)
- `find`, `grep`, `wc`, and basic shell tools available
- Python or Node.js for automated inventory scripts

## Methodology: The 7-Phase Deep Analysis

### Phase 1: Structural Inventory
```bash
# Count total files by extension
find ./src -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn

# Find all service/directory files up to depth 4
find ./src -maxdepth 4 -type f -not -path '*/node_modules/*' -not -path '*/dist/*'

# Count lines of code per major directory
for d in src/services src/components src/types plugins; do
  echo "$d: $(find $d -type f \( -name '*.ts' -o -name '*.tsx' \) | wc -l) files"
done
```

**Goal**: Build a mental model of the codebase shape. Identify service clusters, UI families, and plugin boundaries.

### Phase 2: Core File Extraction

For each major subsystem, read its "front door" files:
- Service index.ts / barrel exports
- Main component file (the biggest one)
- Type definitions
- Package.json for dependency tree

**Red flag**: If a subsystem has no index.ts or clear export boundary, it may be poorly encapsulated.

### Phase 3: Import / Dependency Mapping

Use search to find who imports whom:
```bash
# Find all files importing a target subsystem
grep -rl "StargatePool" ./src --include="*.ts" --include="*.tsx"

# Find what a specific component imports
grep -n "import.*from" Component.tsx | head -30
```

**Key question**: Is the dependency graph uni-directional or bi-directional?

### Phase 4: Integration Point Discovery

Read the integration-heavy files:
- Main panel / page component (e.g., AdaPortalPanel.tsx)
- App root (App.tsx)
- Sidebar / navigation
- The place where tabs are rendered

**Goal**: Identify the "wiring layer" — how subsystems get surfaced in the UI.

### Phase 5: Gap Analysis (Negative Space)

For each subsystem A, ask:
1. What data/services does A produce?
2. What systems exist that could CONSUME that data?
3. Where does B import from A? If zero imports -> gap.
4. Are there orphan components (never imported)? -> gap.

Document each gap as:
```markdown
| Gap # | Producer | Consumer | What A Has | What B Needs | Impact |
```

### Phase 6: Creative Solution Generation

For each gap, propose bridges using existing framework capabilities.

Common bridge patterns:
| Pattern | When to Use |
|---------|-------------|
| A-as-manifest | Subsystem A can model its entities as manifests consumable by B |
| B inherits A lifecycle | A provides lifecycle hooks (launch/stop/health) that B can implement |
| Shared protocol (MCP, etc.) | A and B both speak a standard protocol — bridge is thin |
| IDE-as-dev-environment | B has a built-in IDE that can be the dev environment for A |
| Unified orchestration | A and B both dispatch tasks — merge orchestration layers |
| Vault-backed secrets | A stores secrets insecurely — replace with B's vault subsystem |
| Gatekeeper/traffic filter | A communicates outbound without filtering — reuse B's gatekeeper |
| Audit + compliance | A uses console.log only — append to B's append-only chronicle |

### Phase 7: Priority Matrix

Sort solutions by Effort vs Impact, flag P0 / P1 / P2 / P3.

## Output Format

Always produce a structured markdown report with:
1. Part numbers for each subsystem
2. Tables for component inventory
3. Explicit gap matrices
4. Numbered creative solutions with code sketches
5. Priority matrix
6. "The Unique Moat" — a summary of what NO competitor can copy

## Incremental Build & Commit Pattern

After analysis, do NOT attempt a monolithic build. Use the kanban-coupled incremental pipeline:

1. **Create kanban task per gap** with `kanban_create(assignee="backend-eng", ...)`
2. **Link dependencies** with `kanban_link(parent_id, child_id)` so P1 tasks wait for P0 completion
3. **Build one gap at a time** — commit before proceeding to the next
4. **tsc gate** — run `npx tsc --noEmit`, filter pre-existing noise with `grep -v`, verify zero new errors
5. **Kanban comment** — post completion evidence (commit SHA, files changed, architecture) before starting next

See `references/stargate-mosaic-incremental-delivery.md` for the full verified pattern including IPC naming conventions, cross-bundle type safety, and commit templates.

## References

- `references/ide-panel-feature-build-pattern.md` — Full pattern for building IDE panel features with Monaco editor, IPC bridge, template system, store extension, and Chronicle logging (session 2026-05-15)
- `references/stargate-mosaic-ui-wiring-reference.md` — canonical example of deep analysis
- `references/stargate-mosaic-integration-patterns.md` — verified interface reality + solution blueprints
- `references/stargate-mosaic-implementation-reference.md` — FULL implementation: all 8 gap solutions, API signatures, adapter methods, corrected return types, commit SHAs (session 2026-05-13)
- `references/stargate-mosaic-incremental-delivery.md` — verified incremental build pattern
- `references/ui-wiring-backend-to-frontend.md` — UI wiring pattern: adapter methods, two-phase service design, IPC return type traps, component wiring checklist, tsc noise filter (session 2026-05-13)
- `references/e2e-electron-service-testing.md` — verified E2E test pattern: `window` mocking for Electron IPC services, defensive `typeof window === 'undefined'` guard, mock inventory per IPC namespace, `tsx` runner for Node.js (session 2026-05-13)
- `references/backend-service-design-with-adapter-methods.md` — Two-phase service design pattern: Phase 1 build backend with native API, Phase 2 add adapter methods after reading component call sites. Includes TS2484 avoidance (class vs type same name), renderer self-containment, and IPC boundary type seams (session 2026-05-13)
- `references/stub-backend-gap-analysis.md` — IDE Agent Forge (Mosaic Companion): end-to-end wiring audit showing 6 gaps between UI flow and actual backend execution (syntax-only test, manifest.json that never runs, fleet deployment sending code as text prompts, type safety bypass, session non-persistence, templates referencing uninstalled packages) (session 2026-05-16)
- `references/electron-ipc-bridge-gap-analysis.md` — The "Wired to Nowhere" pattern: 5-layer Electron IPC bridge audit, QR callback architecture for mobile wallets, dead code signatures, and step-by-step wiring procedure (session 2026-05-13)
- `references/cardano-nft-bridge-qr-pairing.md` — Cardano NFT verification + QR wallet pairing: Koios API, local HTTP callback server, IPC handler return types, policy ID management, mobile callback networking pitfalls, stake address handling, quantity filter leniency (session 2026-05-13)
- `references/eight-phase-debugging-methodology.md` — Strict 8-phase debugging framework (Understand → Hypothesize → Isolate → Verify → Fix → Test → Prevent → Detective). User-enforced. Never compress to 4 phases. (session 2026-05-13)

## Pitfalls

- **Don't assume orphan components are dead.** They may be plugin renderer entry points loaded dynamically.
- **Don't trust file names alone.** `LocalNodeBridge.ts` and `stargate/LocalNodeBridge.ts` may be duplicates or forks.
- **Check for IPC namespaces.** Plugin manifest.json files define `ipcNamespace` — these are hidden integration points.
- **Electron main vs renderer:** A service in `src/services/` may be renderer-side only. Check `window.electronAPI` usage.
- **Browser vs desktop:** Features using `window.electronAPI` will degrade in browser dev mode. Note graceful degradation strategy.
- **Orphan services lack barrel exports.** Subsystems may have no `index.ts` — imports break if you assume one exists. Verify with `find src/<subsystem> -name "index.ts"` before writing cross-subsystem imports.
- **The preload.ts IS the IPC contract.** Any integration crossing Electron main/renderer MUST expose new channels in `electron/preload.ts` first. Check existing `toolSandbox`, `chronicle`, `sandbox` namespaces as patterns.
- **WASM is the primary sandbox runtime.** Docker is "future" — integrations targeting the sandbox should use the abstract `ToolLauncher`/`ToolManifest` interfaces, not Docker specifics.
- **Count lines cautiously.** `wc -l` includes comments and types. Use grep for meaningful code density.
- **Read the docs folder.** `docs/architecture/` often has diagrams and trust models not obvious from code.
- **Pre-existing tsc errors are common in large codebases.** Always run `tsc --noEmit` and grep-filter known noise (e.g. `grep -v node_modules`) before declaring "clean compile". Never fix pre-existing errors unrelated to your changes.
- **Cross-bundle type imports break renderer builds.** In Vite/Electron projects, renderer code CANNOT import from `electron/` paths. Use inline subset types in renderer, cast at IPC boundary in main. See `references/stargate-mosaic-incremental-delivery.md` for the verified pattern.
- **Never export both a class name and a `type` alias with the same identifier.** `export type { Foo }` + `export class Foo` or `export { default as Foo }` produces TS2484. Use `export type { Foo as FooType }` or omit the re-export entirely. This bit 3 files in a row (FleetSandboxLauncher, FleetGatekeeperFilter, FleetChronicleLogger) before the pattern was recognized.
- **Renderer-side service files must be self-contained.** Any type from the main-process must be re-declared inline in the renderer service. Do NOT attempt `import type from '../../../../electron/...'` — it will fail at build or runtime. The IPC boundary (`Record<string, unknown>`) is the type seam.
- **The UI wiring gap is invisible to typecheck.** Backend services can compile perfectly while having ZERO frontend imports. After building services, ALWAYS verify with `grep -r "from.*integrations" src/components` or similar. Dead code is worse than no code — it creates false confidence.
- **Adapter methods are required at the service level, not the component level.** Components use domain-specific types (`BridgeAIM`, `FleetNode`) while services use their own types (`AIMInfo`, `AgentToolManifest`). Don't make components do the mapping — add `registerFromXxx()` adapter methods to the service so components stay thin. This was the #1 source of the 10 tsc errors in this session.
- **Two-phase service design prevents API mismatch cascades.** Phase 1: Build backend service with its native API. Phase 2: Add component-facing adapter methods AFTER the component's needs are known. Never write both in one pass — you'll guess wrong on both sides.
- **IPC return types != renderer service return types.** `dispatchToFleet()` in `UnifiedOrchestrator` returns `HybridOrchestrationResult` (with `.nodeResults[]`), not `FleetJobResult[]` (with `.results[]`). The component's mental model and the service's actual return shape must be verified by reading the source, not inferred from the barrel export.
- **The "Wired to Nowhere" pattern — UI exists but IPC bridge is missing.** A common failure mode in Electron apps: the React layer is fully built (buttons, modals, polling loops, state variables) but `preload.ts` never exposed the namespace, `main.ts` never registered handlers, and the service layer never implemented logic. Result: `window.electronAPI?.namespace?.method()` returns `undefined` and the user sees silent failures. Always run the 5-layer bridge audit before declaring a feature complete. See `references/electron-ipc-bridge-gap-analysis.md`.

## Analysis-to-Build Pipeline (Verified Pattern)

After completing the gap analysis, bridge the findings using this 3-phase build pattern:

### Build Phase 1: Backend Services (Pure Service Layer)
- Write one service per gap. Each service is self-contained, renderer-safe, and barrel-exported.
- Use `export` for singleton instance, `export default` for class, `export type` for interfaces.
- NEVER export class name + `type` alias with same identifier — causes TS2484.
- Run `npx tsc --noEmit`, filter pre-existing noise, commit when zero new errors.

### Build Phase 2: Adapter Methods (Service-Component Bridge)
**Do NOT write component code in Phase 1.** After Phase 1, read the components that WILL use the service. Look at what types they hold (`BridgeAIM`, `FleetNode`). Then add adapter methods:

```typescript
// In the SERVICE, not the component
async registerFromFleetNode(node: { nodeId, label, host, port, computeTier }): Promise<Result> {
  // Component holds FleetNode. Service expects AgentToolManifest.
  // Build the manifest HERE so the component stays thin.
}
```

Common adapter patterns from verified session (2026-05-13):
- `registerAIMFromBridge(bridgeAim: BridgeAIM)` → maps to service's `AIMInfo`
- `registerFromFleetNode(node: FleetNode)` → generates `AgentToolManifest`
- Two-step sandbox: `createSandbox(id, tier)` → `launchSandbox(id)` → component reads `{ success, error }`

### Build Phase 3: UI Wiring (Minimal Component Changes)
- Import only the barrel singleton (`from '../../services/stargate/integrations'`)
- Add one button per integration feature alongside existing buttons
- Use `grep -r "from.*integrations" src/components` to verify dead code is eliminated
- Always pass the second argument when adapter expects it (`createSession(template, projectPath)`)
- tsc check again → zero new errors → commit

## Workflow Notes

- Prefer writing the analysis to a file (e.g., `analysis.md`) so the user can refer to it later.
- Include the absolute file path when delivering.
- Use the `senior-ai-developer` skill's guidance: think first, code second.
- Use the `spike` skill if a throwaway experiment is needed to validate a pattern before proposing it.

## Related Skills

- `senior-ai-developer` — coding constitution, design-before-build
- `writing-plans` — for turning analysis into implementation plans
- `electron-linux-setup` — for Electron-specific context
- `blockchain-node-ops` — for blockchain / smart contract ecosystem context