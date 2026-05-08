# Interactive Node WebContainers For Docs

Date: 2026-05-08
Status: Draft approved in conversation, awaiting file review
Owner: Codex + project author

## Summary

This document defines the revised design for runnable course examples in the docs site.

The original Python + remote sandbox direction is replaced with a Node/TypeScript + browser runtime direction.

The chosen direction is:

- `Node.js / TypeScript` as the teaching language for runnable examples
- `WebContainers` as the execution runtime
- a custom embedded web IDE inside the docs site
- `Monaco Editor + file tree + run button + read-only output panel` in V1
- no public raw terminal input in V1
- one active `WebContainer` workspace per browser tab
- course content remains authored in `MDX`
- runnable behavior is driven by per-section manifests

The product goal is still not to build a general-purpose cloud IDE. The goal is to turn selected course sections into runnable learning environments while keeping the article reading experience primary.

## Why The Architecture Changed

The previous design used self-hosted or vendor-hosted remote sandboxes. That direction was dropped for two reasons:

- projected recurring runtime cost was too high for the expected student volume
- the project does not need a full remote sandbox if the course examples can be taught in Node/TypeScript

Switching the runnable examples to Node/TypeScript makes browser-only execution practical and removes most backend infrastructure from V1.

## Goals

- Let readers run selected agent engineering examples directly inside the docs site.
- Preserve a reading-first docs experience; the editor opens on demand.
- Support both section-level example opening and code-block-level actions.
- Keep each section independently runnable even when later chapters evolve.
- Avoid per-user server-side compute cost for basic course execution.

## Non-Goals

- Building a full cloud IDE in V1
- Supporting Python execution in V1
- Mobile interactive editing in V1
- Persistent multi-day workspaces in V1
- Arbitrary shell access in V1
- Fully offline operation

## Product Decisions

### Reading And Editing Experience

- Default state: article page only
- Trigger state: clicking `Run`, `Edit`, or `Open Example` opens a right-side workspace drawer
- Supported interaction pattern: `A + C`
  - drawer-style IDE
  - command blocks can directly trigger runtime startup and execution

### Teaching Language

- Runnable examples move to `Node.js / TypeScript`
- The course continues to teach agent engineering concepts rather than Python-specific language features

### Runtime Scope

- Execution happens entirely in the browser tab through `WebContainers`
- There is no remote sandbox per reader in V1
- There is one active `WebContainer` instance per browser tab
- Only one section workspace is mounted into that instance at a time

### Workspace Persistence

- Reader edits are temporary
- Section state may be restored locally for a short TTL
- The product is still a learning environment, not a hosted development environment

## Hosting And Platform Constraints

`WebContainers` imposes hard deployment constraints. These are first-class product requirements, not implementation details.

### Required Deployment Capabilities

- the site must be served over `HTTPS`
- the runtime page must be `cross-origin isolated`
- the host must send `COOP/COEP` headers
- the browser must support service workers and `SharedArrayBuffer`

Required headers:

```text
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

Or, if the project adopts the alternative mode:

```text
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

### Deployment Consequence

The current GitHub Pages-oriented static export deployment is not a good fit for this requirement.

The recommended direction is:

- switch to server deployment for the docs app
- remove the requirement to ship via `output: 'export'`
- serve the app from infrastructure that can reliably set the required headers

### Docker Deployment

Docker deployment is supported and recommended.

In this architecture, Docker is used to deploy the docs application, not to host the code execution runtime. The actual example execution still happens inside the reader's browser through `WebContainers`.

A practical production shape is:

- one `Next.js` app container
- one reverse proxy or edge layer that terminates `HTTPS`
- proxy-level or app-level configuration for `COOP/COEP`

Docker helps because it gives the project:

- stable server deployment instead of static export constraints
- full control over response headers
- easy rollout to a VM, ECS, Kubernetes, Railway, Fly.io, or similar hosts
- a natural path for later adding API routes or a lightweight backend proxy

### Browser Support Policy

V1 should officially support:

- desktop Chrome
- desktop Edge
- other Chromium-based desktop browsers that allow the required storage and service worker behavior

Firefox and Safari support exist, but they remain weaker for embedded `WebContainers`. V1 should treat them as best-effort rather than first-class targets.

## User Experience

### V1 Reader Flow

1. Reader opens a docs page on desktop.
2. Reader sees normal article content and normal code blocks by default.
3. A runnable block exposes `Run`, `Edit`, or `Open Example`.
4. On first runnable interaction, the app boots the single `WebContainer` instance if needed.
5. The app loads the current section workspace into that instance.
6. The right-side workspace drawer opens.
7. Depending on the trigger:
   - command blocks show the output panel and run the mapped command
   - file snippets open the mapped file in the editor
   - project-open actions open the section default file

### V1 Workspace Drawer

The drawer contains:

- a top toolbar with section title, runtime status, and reset action
- a file tree for the mounted section workspace
- a writable `Monaco` editor for temporary in-session edits
- a read-only terminal-style output panel for command execution logs and program output

V1 intentionally excludes:

- public raw terminal input
- arbitrary shell execution
- long-term workspace persistence
- multi-user collaboration
- desktop-like IDE complexity

### Mobile Policy

Interactive editing is desktop-only in V1. Mobile users see a message that the runnable environment is available on desktop.

## Content Model

### Authoring Model

Docs content remains in `MDX`.

Each runnable section gets a companion directory that stores:

- the complete runnable section workspace as source files
- a structured manifest that maps article actions to runtime behavior

Recommended structure:

```text
app/docs/{chapter}/{section}/page.mdx
examples/{chapter}/{section}/workspace/
examples/{chapter}/{section}/manifest.json
examples/{chapter}/{section}/README.md
```

### Why Section Snapshots Still Matter

The course remains progressive, but every section must stay independently runnable.

That requires:

- isolated section workspaces
- no runtime dependence on the latest version of the overall project
- no assumption that a later chapter's workspace can safely stand in for an earlier section

### Snapshot Packaging

At authoring time, each section keeps a readable source workspace under `examples/.../workspace`.

At build time, the project should generate a browser-loadable workspace snapshot for each section using `@webcontainer/snapshot` or an equivalent binary snapshot build step.

Recommended output:

```text
public/webcontainer-snapshots/{sectionId}.bin
```

The section manifest points to the corresponding snapshot asset.

### Manifest Responsibilities

The manifest is the contract between article content and the browser runtime.

It should include:

- section identity
- snapshot identity
- snapshot URL
- default file to open
- startup behavior
- block mappings

Suggested shape:

```json
{
  "id": "chat-02-core-concepts",
  "title": "1.2 Core Concepts",
  "snapshotId": "chat-02-core-concepts-v2",
  "snapshotUrl": "/webcontainer-snapshots/chat-02-core-concepts.bin",
  "defaultOpenFile": "src/main.ts",
  "startup": {
    "installCommands": ["npm install"],
    "runCommands": ["npm run dev"],
    "env": ["OPENAI_API_KEY"]
  },
  "blocks": [
    {
      "blockId": "install-deps",
      "type": "command",
      "command": "npm install"
    },
    {
      "blockId": "main-ts-snippet",
      "type": "file-snippet",
      "path": "src/main.ts",
      "anchor": "agent-loop"
    },
    {
      "blockId": "open-example",
      "type": "project-open"
    }
  ]
}
```

### Block Types

Only blocks that need runtime linkage receive explicit metadata.

- `command`
  - mapped to a pre-approved command in the manifest
- `file-snippet`
  - mapped to a file path and stable anchor or symbol
- `project-open`
  - opens the section workspace at the default entry point

Normal explanatory code blocks remain plain MDX code blocks.

### MDX Integration

Add a small set of custom MDX components for interactive blocks only:

- `RunnableCodeBlock`
- `CommandBlock`
- `OpenProjectButton`

These components accept a stable `blockId`. Runtime behavior is resolved from the current section manifest rather than hard-coded into the article body.

## Runtime Architecture

### High-Level Components

The system has two required layers and one optional layer:

- `Docs Frontend`
  - Next.js + Nextra docs site
  - renders article content, action buttons, and the workspace drawer
- `Browser Runtime`
  - `WebContainers`
  - executes Node processes, stores files, and exposes process output inside the browser
- `Optional Backend Proxy`
  - only needed for cases such as provider API proxying, analytics, or future authenticated features

### Frontend Responsibilities

- boot the `WebContainer` runtime once per tab
- load or restore section workspaces
- render code-block actions
- open and close the workspace drawer
- render the file tree and `Monaco` editor
- execute approved commands
- stream logs into the output panel
- locally cache short-lived section state

### Browser Runtime Responsibilities

- mount section snapshots into the in-browser filesystem
- execute `npm`, `node`, and other approved commands
- expose process output streams
- hold temporary file edits for the active section

### Optional Backend Responsibilities

The runtime itself does not need backend compute, but a backend may still be used for:

- LLM provider proxying
- temporary key exchange
- telemetry
- future authenticated features

## Web IDE Design

### Chosen V1 Stack

- `WebContainers`
- `Monaco Editor`
- custom file tree
- read-only terminal-style output panel
- manifest-driven run actions

This stack is chosen because it fits a docs-side drawer better than a full embedded IDE shell and keeps product control in the course site.

### V1 Editing Semantics

V1 allows temporary edits inside the current browser session, but it does not introduce a full save product.

That means:

- the editor is writable
- edits live inside the current mounted section workspace
- runs use the current in-memory workspace state
- a reset action remounts the original section snapshot
- V2 adds clearer dirty state, save semantics, and stronger code-to-step linkage

## WebContainer Lifecycle

### Single Runtime Rule

`WebContainer.boot()` is expensive and only one instance can be active concurrently in a tab.

Therefore V1 must assume:

- one booted `WebContainer` per browser tab
- one mounted section workspace at a time
- switching sections means replacing the mounted workspace, not opening another sandbox

### Boot Flow

On first runnable interaction in a tab:

1. boot the `WebContainer`
2. subscribe to runtime events
3. load the requested section workspace
4. open the drawer to the correct destination

### Workspace Mount Flow

To open a section:

1. load the section manifest
2. check for a locally cached section workspace snapshot with valid TTL
3. if found, mount the cached snapshot
4. otherwise fetch and mount the base snapshot asset from `public/webcontainer-snapshots`
5. open the default file or run the requested command

### Section Switching

When the reader moves to another runnable section:

1. export the current workspace snapshot if it should be restorable
2. cache it locally with `sectionId` and expiration metadata
3. clear or replace the current workspace
4. mount the newly selected section snapshot

### Local Restore Strategy

Use browser storage such as `IndexedDB` for short-lived workspace restore.

Recommended key model:

```text
sectionId -> { snapshotBinary, expiresAt }
```

The runtime should treat restored state as a convenience cache only, not a durable project store.

## Command Execution Model

### V1 Rule

The reader cannot execute arbitrary shell commands in V1.

Only manifest-approved commands are allowed.

### Behavior

When a `command` block is triggered:

- ensure the `WebContainer` is booted
- ensure the requested section workspace is mounted
- open the drawer to the output panel
- execute the mapped command with `spawn`
- stream process output to the read-only output panel
- track running, succeeded, and failed states

### Why This Constraint Exists

Even though execution is local to the browser, uncontrolled shell access would still raise product complexity and support burden too early. V1 is a guided learning environment, not an unrestricted REPL.

## File Location Model

When a `file-snippet` block is triggered:

- ensure the runtime is ready
- ensure the requested section workspace is mounted
- open the drawer to the editor
- locate the mapped file
- jump to the mapped anchor or symbol

Anchor- or symbol-based mapping is preferred over raw line numbers because line numbers drift as content evolves.

## Dependency Strategy

### V1 Principle

Use only course examples whose dependencies are compatible with browser-hosted Node execution.

That means:

- prefer pure JavaScript or WebAssembly-compatible packages
- avoid native Node addons
- avoid examples that require raw OS access or native binaries

### Startup Behavior

The section manifest can declare:

- install commands
- run commands
- environment variable names

The first time a fresh section snapshot is mounted, the runtime may need to run `npm install` before the main example command.

To keep startup time reasonable:

- keep example dependency graphs small
- reuse package choices across sections where possible
- avoid oversized example workspaces

## API Keys And Live LLM Calls

Moving execution into the browser does not solve provider secret management.

### Hard Rule

Do not ship project-owned provider secrets in the browser bundle or section snapshots.

### Supported V1 Modes

- `mock mode`
  - examples run with mocked model responses
- `reader key mode`
  - the reader provides their own key locally for the current session
- `proxy mode`
  - the docs site calls a separate backend proxy controlled by the project

Recommended V1 product stance:

- default to mockable examples where possible
- allow reader-supplied keys for internal testing
- treat a backend provider proxy as a separate later deliverable if live demos are important

## Error Handling

### User-Facing States

The frontend should distinguish:

- runtime booting
- workspace loading
- workspace ready
- command running
- command succeeded
- command failed
- unsupported browser
- header or isolation misconfiguration

### Common Failure Cases

- `WebContainer` boot failure
- missing `COOP/COEP` headers
- blocked service worker or browser storage restrictions
- unsupported browser mode
- dependency installation failure
- package incompatibility with browser Node execution
- runtime out-of-memory

### Recovery Actions

Provide:

- retry current action
- reset current section workspace
- copy logs or error details
- browser compatibility guidance
- desktop-only reminder

## Security, License, And Cost Controls

### Cost Model

V1 removes most per-student server compute cost because execution is local to the browser.

Remaining cost areas are:

- static asset hosting
- optional backend proxy traffic
- future commercial license for `WebContainers`

### Security Model

The threat surface is lower than a shared remote sandbox system, but it is not zero.

Guardrails:

- no project-owned secrets in the client
- no arbitrary shell execution in V1
- no backend command execution path in V1
- temporary local-only workspace state

### License Constraint

Prototype and proof-of-concept use are acceptable, but commercial production use of `WebContainers` requires commercial licensing. This should be treated as an explicit pre-launch dependency.

## Rollout Plan

### V1

- `WebContainers`
- `Monaco Editor`
- file tree
- run button
- read-only output panel
- manifest-driven command execution
- reset to section snapshot
- short-lived local restore

### V2

- explicit file save semantics within the current session
- run state improvements
- error location and highlighting
- stronger course step and code line linkage

### V3

- real terminal input via `xterm.js`
- stronger local workspace management
- more advanced section-to-project transitions

### V4

- persistent workspaces
- assignment submission
- AI teaching assistant feedback

## Testing Strategy

### Manual Acceptance

For each runnable section:

- opening a snippet boots the runtime if needed
- opening a snippet loads the correct section workspace
- opening a snippet focuses the correct file
- running a command executes only the mapped command
- resetting restores the original section snapshot
- revisiting within TTL restores local state
- revisiting after TTL remounts the clean base snapshot

### Platform Acceptance

Verify:

- required headers are present in production
- the site is `crossOriginIsolated`
- Chromium browsers work without extra product-side breakage
- unsupported browsers show actionable guidance

### Regression Coverage

Add automated coverage for:

- manifest parsing and validation
- section-to-snapshot resolution
- command allowlisting
- local restore metadata handling
- frontend state transitions for booting, loading, ready, running, and failed

## Future Evolution

The design deliberately starts with explicit manifests and independently maintained section workspaces.

Later, the project can add:

- snapshot export automation from a main teaching repo
- manifest generation helpers
- doc linting that checks whether `blockId` values resolve correctly
- richer preview panels for examples that launch local dev servers inside `WebContainers`

## Final Decision

Build an embedded, desktop-first runnable docs experience using:

- `MDX` for article content
- per-section source workspaces
- build-generated browser snapshots
- per-section manifests for runtime mapping
- `WebContainers` for in-browser execution
- a custom `Monaco`-based drawer IDE
- manifest-approved command execution only in V1

This gives the project a focused runnable learning environment without the ongoing infrastructure burden of remote sandboxes.
