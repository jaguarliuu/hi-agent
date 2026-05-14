# Runtime Config System For Labs And Playgrounds

Date: 2026-05-14
Status: Draft approved in conversation, awaiting file review
Owner: Codex + project author

## Summary

This document defines a site-wide runtime configuration system for labs and future playground-based agent examples.

The current playground model only exposes a small whitelist of environment variables through `manifest.startup.env`. That is too narrow for the product direction. Users need to supply arbitrary runtime configuration, including but not limited to model endpoints, API keys, vector database settings, retrieval parameters, callback endpoints, and other custom variables.

The chosen direction is:

- make runtime config a first-class platform capability, not a provider-specific feature
- let each lab declare a recommended config schema without limiting user-defined variables
- support two scopes of persisted values:
  - global defaults for the whole site
  - per-lab overrides
- resolve the final config at runtime and output both:
  - injected environment variables for command execution
  - a generated `.env` file inside the workspace
- treat the generated `.env` file as a derived runtime artifact, not the source of truth

Because the site has not launched yet, the manifest format can be changed directly. No backward-compatibility layer is required for the old `startup.env` model.

## Goals

- Support arbitrary user-defined runtime variables across all labs and future playgrounds.
- Let each lab recommend commonly useful fields without locking users into those fields.
- Provide a clear two-layer model:
  - global defaults
  - current lab overrides
- Persist configuration locally in the browser for fast repeated use.
- Inject resolved configuration into the WebContainer runtime and generate a workspace `.env` file automatically.
- Keep sensitive values masked in the UI by default.

## Non-Goals

- Server-side config storage or account sync in V1
- Secrets-manager-grade storage guarantees
- Multiple named profiles or environment switching in V1
- Bi-directional editing between the UI and the generated `.env` file
- Provider-specific configuration logic in the platform layer
- Runtime connectivity validation for remote services
- Complex schema DSL or arbitrary custom validators in V1

## Product Decisions

### Runtime Config Is Platform-Level

The system is not an OpenAI settings panel. It is a general runtime configuration system that can support AI model vendors, vector stores, storage providers, callbacks, tracing, and any other environment-driven dependency.

The platform owns the configuration mechanism. Individual labs only declare recommended schema metadata.

### Source Of Truth

The source of truth is the structured configuration store in the browser:

- global values
- per-lab override values

The generated `.env` file is a runtime output. Users do not directly edit it as the main configuration surface.

### Scope Model

Every runtime variable resolves through a fixed precedence order:

1. schema defaults
2. persisted global values
3. persisted per-lab overrides

Per-lab overrides can explicitly disable inherited global values for the current lab.

### Manifest Direction

The old manifest whitelist model is removed. Runtime config is declared through a new `config` section on each manifest.

The manifest remains responsible for describing the runnable workspace and section actions, but runtime config recommendations move into the new `config` structure.

## Manifest Model

Each runnable lab manifest should expose a `config` section.

Suggested shape:

```json
{
  "id": "labs-01-webcontainers-pilot",
  "title": "WebContainers 实验小节",
  "snapshotId": "labs-01-webcontainers-pilot-v2",
  "snapshotUrl": "/webcontainer-snapshots/labs-01-webcontainers-pilot.bin",
  "defaultOpenFile": "src/main.js",
  "startup": {
    "installCommands": [],
    "runCommands": [
      { "cmd": "npm", "args": ["run", "chat"] }
    ]
  },
  "config": {
    "envFilePath": ".env",
    "allowCustom": true,
    "schema": [
      {
        "key": "OPENAI_API_KEY",
        "label": "API Key",
        "description": "Used by the demo chat client",
        "input": "secret",
        "required": false,
        "defaultValue": "",
        "writeToEnv": true
      },
      {
        "key": "VECTOR_DB_URL",
        "label": "Vector DB URL",
        "description": "Optional retrieval backend",
        "input": "text",
        "required": false,
        "defaultValue": "",
        "writeToEnv": true
      }
    ]
  },
  "blocks": []
}
```

### `config` Responsibilities

- `envFilePath`
  - optional
  - defaults to `.env`
- `allowCustom`
  - should be `true`
  - allows user-defined variables outside the schema
- `schema`
  - recommended fields for this lab
  - each field describes UI metadata and default behavior

### Schema Field Metadata

Each schema field should support:

- `key`
- `label`
- `description`
- `input`
  - `text`
  - `secret`
  - `textarea`
  - `boolean`
  - `number`
  - `select`
- `required`
- `defaultValue`
- `writeToEnv`
- optional grouping metadata for UI display

Schema metadata does not limit the final resolved config. Users may add any custom key.

## Stored Config Model

The browser store contains two top-level scopes:

- `global`
- `labs`

`labs` is keyed by manifest id.

Suggested persisted shape:

```ts
interface RuntimeConfigSnapshot {
  version: 1;
  global: Record<string, RuntimeConfigValue>;
  labs: Record<string, Record<string, RuntimeConfigValue>>;
}

interface RuntimeConfigValue {
  value: string;
  enabled: boolean;
  isSecret: boolean;
  source: 'schema' | 'custom';
  updatedAt: string;
}
```

Notes:

- Lab scope stores only the local override layer, not a copied full resolved config.
- Secret values are still browser-local values, not hardened secrets.
- Versioning is required so future storage migrations remain possible.

## Resolution Model

Runtime config resolution is a pure data transformation.

Inputs:

- manifest config schema
- persisted global values
- persisted current-lab values

Outputs:

- `resolvedEnv: Record<string, string>`
- generated `.env` file text
- effective field list for UI display

### Merge Rules

Precedence:

1. schema defaults
2. global values
3. per-lab values

Rules:

- same-key entries override earlier layers
- disabled values are excluded from final output
- schema fields and custom fields use the same merge behavior
- booleans and numbers are serialized to strings before runtime injection

## Runtime Injection

The runtime path is:

1. read manifest config
2. load persisted config from browser storage
3. resolve effective config for the current lab
4. generate `.env` file text
5. mount or prepare workspace
6. write `.env` into the workspace
7. launch shell and run commands with the resolved environment map

This must support both patterns:

- examples that read `process.env`
- examples that depend on a `.env` file

### `.env` Generation Rules

The platform owns serialization. Labs do not manually assemble `.env` content.

Rules:

- only write items where:
  - `enabled = true`
  - `value` is non-empty
  - `writeToEnv` is not explicitly false
- keep output order stable:
  - schema-defined keys first
  - custom keys after
  - each group sorted by key
- escape values safely for `.env` compatibility
- mask secret values in previews, but write real values to the workspace runtime file

### Update Behavior

When a user edits config while the playground is already open:

- persist to browser storage immediately
- regenerate the effective config immediately
- rewrite the workspace `.env` file in place
- apply the new environment on the next command execution or next shell start

The platform does not promise hot mutation of already-running processes.

## UI And Interaction Model

The UI exposes two scopes:

- `Runtime Config`
  - global defaults for the site
- `This Lab Config`
  - current-lab overrides inside the playground

### Default Editing Model

Default rows should stay simple:

- key
- value
- masked or plain secret state
- enabled toggle

Advanced actions should be hidden behind explicit row expansion instead of crowding the default row.

### Global Scope

The global screen should show:

- recommended fields
- custom variables
- a read-only effective `.env` preview

### Lab Scope

The lab screen should show:

- inherited values from global scope
- `Override` action
- `Disable` action
- lab-only custom variables
- a read-only effective output preview for the current lab

If a field inherits from global scope, the default row should show a compact summary such as `Using global value`.

### Custom Variables

Users must always be able to add custom variables even when a lab provides recommended schema fields.

At minimum, custom variable creation supports:

- key
- value
- secret flag
- enabled flag

### Secret UX

Secret values:

- are masked by default
- do not appear in clear text in summaries or previews
- require explicit reveal interaction

## Validation And Error Handling

The platform performs only light, generic validation.

### Validation Rules

- key must be non-empty
- key must be valid as an environment variable name
- duplicate keys are not allowed within the same editing scope
- number inputs must parse correctly
- boolean inputs must serialize to stable string values

The platform does not validate whether:

- URLs are reachable
- API keys are valid
- vector databases are online
- remote services accept the supplied credentials

Those are runtime concerns owned by the example code or the external service.

### Error Handling

Config editor errors:

- stay local to the edited field
- do not invalidate unrelated saved values

Runtime preparation errors:

- fail the playground startup with a clear message
- identify schema or serialization errors directly

Runtime command failures:

- remain normal command failures shown through terminal output
- are not rewritten into misleading generic config errors

## Security Boundary

Sensitive fields are a UX concern in V1, not a hardened storage boundary.

The system should clearly communicate that:

- secret fields are masked in the interface
- secrets still live in browser-local storage in this version
- V1 is designed for convenience and repeatability, not high-assurance secret custody

## Testing Strategy

Testing should cover four layers.

### 1. Pure Unit Tests

- manifest config parsing
- stored snapshot parsing and defaults
- config resolution precedence
- disabled inheritance behavior
- schema and custom key coexistence
- `.env` serialization and escaping

### 2. WebContainer Runtime Unit Tests

- workspace preparation writes the generated `.env`
- shell and command execution receive the resolved environment
- updated config affects the next command run

### 3. Component Tests

- global config screen rendering
- lab override screen rendering
- override, disable, and restore-inheritance actions
- secret masking and reveal interaction
- custom variable creation
- effective output preview updates

### 4. Manifest Coverage

- example manifests include valid `config` declarations
- labs without appropriate schema do not regress runtime startup

## Direct Migration Strategy

Because the site has not launched yet:

- manifests can be upgraded directly to the new `config` shape
- old `startup.env` whitelist behavior should be removed instead of preserved
- playground internals should converge on a single runtime config pipeline

This keeps the implementation simpler and avoids long-lived dual-path logic in the runtime.
