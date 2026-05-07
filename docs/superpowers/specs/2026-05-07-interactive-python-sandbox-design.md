# Interactive Python Sandbox For Docs

Date: 2026-05-07
Status: Draft approved in conversation, awaiting file review
Owner: Codex + project author

## Summary

This document defines the first design for adding runnable Python course examples to the docs site.

The product goal is not to build a general-purpose online IDE. The goal is to turn selected course sections into runnable learning environments while keeping the reading experience primary.

The chosen direction is:

- self-hosted `Daytona` sandboxes
- a custom web IDE embedded into the docs site
- `Monaco Editor + file tree + run button + read-only terminal-style output panel` in V1
- no public raw terminal in V1
- sandbox scope is `anonymous visitor x section`
- section snapshots are isolated and immutable from later chapters
- docs remain written in `MDX`
- runnable behavior is driven by per-section manifests

## Goals

- Let readers run selected Python examples directly from the docs site.
- Keep the docs page as the primary UI; the editor opens on demand.
- Support chapter and section snapshots so earlier course content never drifts when later lessons evolve.
- Support both section-level project opening and code-block-level actions.
- Keep the first release cheap enough to self-host and simple enough to ship.

## Non-Goals

- Building a fully open-ended cloud IDE in V1
- Mobile interactive editing in V1
- Persistent long-term workspaces in V1
- Login, registration, billing, or classroom submission flows in V1
- Arbitrary shell access in V1

## Product Decisions

### Reading And Editing Experience

- Default state: docs page only
- Trigger state: clicking `Run` or `Edit` opens a right-side workspace drawer
- Supported interaction pattern: `A + C`
  - drawer-style IDE
  - command blocks can directly trigger sandbox startup and execution

### Sandbox Scope

- One sandbox per `visitor x section`
- Sandbox is reused within the same section
- Sandbox state is kept for a short TTL only
- Reader changes are temporary and are not the product's long-term storage model

### Content Semantics

- The course has progressive chapters, but every section must map to a runnable isolated snapshot
- A section opens its own complete snapshot
- The article body may show only the snippet relevant to that section step
- Clicking a snippet should open the full section workspace and focus the relevant file location

### Infrastructure Direction

- Do not use CodeSandbox SDK due to projected runtime cost
- Self-host `Daytona`
- Build a custom embedded IDE experience instead of embedding a full third-party IDE product

## User Experience

### V1 Reader Flow

1. Reader opens a docs page on desktop.
2. Reader sees normal code blocks by default.
3. A runnable block exposes an action such as `Run`, `Edit`, or `Open Example`.
4. On first interaction, the site starts or restores the section sandbox.
5. The right-side workspace drawer opens.
6. Depending on the trigger:
   - command blocks show the output panel and run the mapped command
   - file snippets open the mapped file in the editor
   - project-open actions open the section's default file

### V1 Workspace Drawer

The drawer contains:

- a top toolbar with section title, sandbox status, and reset action
- a file tree for the current section snapshot
- a writable `Monaco` editor for temporary in-session edits
- a read-only terminal-style output panel for command execution logs and program output

V1 intentionally excludes:

- public raw terminal input
- arbitrary shell execution
- long-lived workspace persistence
- explicit long-term save semantics

### Mobile Policy

Interactive editing is desktop-only in V1. Mobile users see a message that the runnable environment is available on desktop.

## Content Model

### Authoring Model

Docs content remains in `MDX`.

Each runnable section gets a companion directory that stores:

- the complete runnable workspace snapshot
- a structured manifest describing how the MDX content maps to that workspace

Recommended structure:

```text
app/docs/{chapter}/{section}/page.mdx
examples/{chapter}/{section}/workspace/
examples/{chapter}/{section}/manifest.json
examples/{chapter}/{section}/README.md
```

### Why Section Snapshots

The course is progressive, but each section must remain independently runnable.

That requires:

- immutable section snapshots
- no runtime dependence on the latest version of the overall project
- no assumption that chapter N can safely reuse chapter N+1 code

### Manifest Responsibilities

The manifest is the contract between docs content and runtime behavior.

It should include:

- section identity
- snapshot identity
- workspace root
- default file to open
- startup behavior
- block mappings

Suggested shape:

```json
{
  "id": "chat-02-core-concepts",
  "title": "1.2 Core Concepts",
  "snapshotId": "chat-02-core-concepts-v1",
  "workspaceRoot": "workspace",
  "defaultOpenFile": "main.py",
  "startup": {
    "installCommands": ["pip install -r requirements.txt"],
    "runCommands": ["python main.py"],
    "env": ["OPENAI_API_KEY"]
  },
  "blocks": [
    {
      "blockId": "install-deps",
      "type": "command",
      "command": "pip install -r requirements.txt"
    },
    {
      "blockId": "main-py-snippet",
      "type": "file-snippet",
      "path": "main.py",
      "anchor": "chat-streaming-loop"
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

These components should accept a stable `blockId`. Runtime behavior is looked up from the current section manifest rather than embedded directly in the MDX body.

## Runtime Architecture

### High-Level Components

The system has three layers:

- `Docs Frontend`
  - Next.js + Nextra docs site
  - renders article content, action buttons, and the workspace drawer
- `Session API`
  - server-side control plane owned by this project
  - creates, restores, and resets section sandboxes
- `Daytona`
  - self-hosted sandbox infrastructure
  - executes Python code, manages files, and provides editor/preview primitives

### Frontend Responsibilities

- render code-block actions
- open and close the workspace drawer
- request sandbox session creation or restoration
- connect the editor UI to the remote workspace
- render output logs
- restore short-lived section sessions

### Backend Responsibilities

- store Daytona credentials and connection details
- map `visitorId + sectionId` to sandbox sessions
- create sandboxes from section snapshots
- manage TTL, reset, and cleanup state
- validate that only approved manifest actions can be executed
- expose minimal session and command APIs to the frontend

### Daytona Responsibilities

- provide isolated sandboxes
- hold section workspace files
- execute approved commands
- expose file operations and language tooling
- later provide real terminal access if V3 is implemented

## Web IDE Design

### Chosen V1 Stack

- `Monaco Editor`
- custom file tree
- read-only terminal-style output panel, likely implemented with `xterm.js` or an equivalent log shell
- run actions driven by manifest commands

This stack is chosen because it fits a docs-side drawer better than a full remote VS Code shell and avoids the product weight of a complete IDE framework.

### V1 Editing Semantics

V1 allows temporary edits inside the current sandbox session, but it does not introduce a full explicit save product.

That means:

- the editor is writable
- changes live inside the current short-lived sandbox
- a run action may apply the current working file state inside that sandbox
- V2 adds clearer saved/dirty state, file save behavior, and better error-location UX

### Why Not A Full IDE Shell In V1

Rejected V1 options:

- `OpenVSCode Server`
  - fast to demo, but awkward to embed deeply into the docs layout
- `Eclipse Theia`
  - powerful, but too heavy for the first iteration

The product need is "embedded learning workspace", not "general IDE parity".

## Session Model

### Identity

V1 has no login. Use an anonymous browser identity:

- create a `visitorId` in local storage or cookie
- send it with all sandbox-related requests

### Session Key

Primary lookup key:

```text
visitorId + sectionId
```

### Lifecycle

On first runnable action in a section:

1. frontend loads the section manifest
2. frontend requests a sandbox session
3. backend checks for an active unexpired session for the visitor and section
4. if present, restore it
5. if absent, create a new Daytona sandbox from the section snapshot
6. return the metadata needed to connect the editor UI

### Reuse

- all runnable actions inside the same section reuse the same sandbox
- the sandbox keeps temporary reader edits during the TTL window
- the reader can explicitly reset to the original section snapshot

### Expiration

- sessions are short-lived
- after expiration, the next interaction creates a fresh sandbox from the snapshot
- this keeps infrastructure cost and operational complexity bounded

## Command Execution Model

### V1 Rule

The reader cannot execute arbitrary shell commands in V1.

Only manifest-approved commands are allowed.

### Behavior

When a `command` block is triggered:

- ensure the section sandbox exists
- open the drawer to the output panel
- execute the mapped command
- stream logs and completion state to the UI

This preserves a guided learning product while avoiding early security and abuse problems.

## File Location Model

When a `file-snippet` block is triggered:

- ensure the section sandbox exists
- open the drawer to the editor
- locate the mapped file
- jump to the mapped anchor or symbol

Anchor- or symbol-based mapping is preferred over raw line numbers because line numbers drift as content evolves.

## Error Handling

### User-Facing States

The frontend should distinguish:

- sandbox starting
- workspace ready
- command running
- command succeeded
- command failed
- sandbox unavailable

### Common Failure Cases

- snapshot missing or malformed
- sandbox creation failure
- dependency installation failure
- command timeout
- runtime error in reader code
- expired session

### Recovery Actions

Provide:

- retry current action
- reset this section workspace
- copy logs or error details
- desktop-only reminder for unsupported devices

## Security And Cost Controls

### V1 Guardrails

- no raw terminal input
- no arbitrary shell commands
- no long-term persistence
- short TTL sandboxes
- one sandbox per `visitor x section`
- command execution only through manifest entries

### Why This Matters

The project is self-hosting Daytona to reduce vendor runtime spend, but self-hosting does not remove risk. It shifts cost and security responsibility onto the project.

V1 must therefore minimize the attack surface and limit accidental resource burn.

## Rollout Plan

### V1

- Monaco editor
- file tree
- run button
- output panel
- no real terminal
- one Daytona sandbox per `visitor x section`
- reset to section snapshot

### V2

- file save behavior inside the current sandbox session
- explicit run state
- error location and highlighting
- course step and code line linkage

### V3

- real `xterm` terminal access
- sandbox idle cleanup
- stronger resource limits
- user quotas

### V4

- persistent workspaces
- assignment submission
- AI teaching assistant feedback

## Testing Strategy

### Manual Acceptance

For each runnable section:

- opening a snippet starts or restores the correct section sandbox
- opening a snippet focuses the correct file
- running a command executes only the mapped command
- resetting returns the section to the original snapshot
- revisiting within TTL restores state
- revisiting after TTL creates a clean sandbox

### Regression Coverage

Add automated coverage for:

- manifest parsing and validation
- section-to-snapshot resolution
- command allowlisting
- session lookup and expiration logic
- frontend state transitions for starting, ready, running, and failed

## Future Evolution

The design deliberately starts with explicit manifests and independently maintained section workspaces.

Later, the project can add:

- snapshot export automation from a main teaching repo
- manifest generation helpers
- doc linting that checks whether `blockId` values resolve correctly

This keeps V1 practical while leaving a path toward lower authoring overhead.

## Final Decision

Build an embedded, desktop-first runnable docs experience using:

- `MDX` for article content
- per-section snapshot workspaces
- per-section manifests for runtime mapping
- self-hosted `Daytona` sandboxes
- a custom `Monaco`-based drawer IDE
- manifest-approved command execution only in V1

This gives the project a focused learning environment rather than an expensive or overbuilt general IDE.
