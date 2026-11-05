# 141. Read-Only Plan Assistant

Status: current

Definition level: shaping

## Summary

Add a small floating Atlas assistant that answers questions about Plans from a bounded,
Workspace-authorized context. Use Ontahi model-backed Domain Operation execution rather than
shipping the complete Atlas projection to a provider or introducing a shell-capable agent runtime.

Provider selection and credentials begin as deployment configuration. Workspace-owned BYOK remains
the intended settings form, but secret storage, encryption, budgets, and rotation are a separate
security slice rather than fields added directly to `AtlasWorkspace`.

## Context

Atlas already owns structured Plans, Items, relations, Source records, and evidence. A useful first
assistant does not need a cloned repository or general-purpose VM: the host can retrieve a small set
of relevant Plan records and invoke one read-only model-backed Operation. This tests the interaction,
context boundary, citations, and Ontahi consumer API before granting filesystem or mutation tools.

The Todo example proves two adjacent Ontahi paths: model commands interpret natural language into a
canonical Graph request, while `modelOperation(...)` executes an already selected typed Operation
against bounded host-assembled context. Atlas needs the latter for synthesized answers over several
retrieved Plan fragments.

## Scope

1. Declare one Workspace-scoped `askPlans` Operation with typed question, answer, and citations.
2. Retrieve a bounded set of relevant Plans locally without sending the whole snapshot.
3. Configure OpenAI or Anthropic from server environment variables; never expose keys to the browser.
4. Render a compact floating, read-only chat on the main Atlas surface.
5. Link citations back to Atlas Plan detail.
6. Hide the assistant honestly when no model is configured.

## Non-Goals

1. No shell, Git checkout, filesystem, VM, container, or arbitrary tool execution.
2. No Plan mutation, proposal application, commit, or Pull Request creation.
3. No resumable autonomous agent loop or durable conversation memory.
4. No Workspace BYOK persistence UI in this slice.
5. No complete snapshot or unbounded Markdown context sent to a provider.
6. No claim of production prompt-injection hardening beyond the explicit read-only boundary.

## Proposed Form

```text
floating question
  -> AtlasWorkspace.askPlans
      -> authorize Workspace membership
      -> lexical candidate retrieval over Plan title/path/Markdown
      -> bounded context (top Plans, per-document and total character limits)
      -> modelOperation(provider-neutral, structured output)
      -> answer + cited Plan identities
  -> chat reply with Atlas links
```

Deployment configuration:

```text
ATLAS_LLM_PROVIDER=openai | anthropic
ATLAS_LLM_MODEL=<provider model id>
OPENAI_API_KEY=... | ANTHROPIC_API_KEY=...
ATLAS_LLM_URL=<optional provider endpoint override>
```

Future Workspace BYOK should persist only encrypted secret material or a host secret reference plus
safe metadata such as provider, model, status, and key suffix. Usage policy, budgets, and who may use
the provider remain explicit Workspace administration concerns.

The intended onboarding interaction makes this optional configuration a distinct step after Source
selection: `Off` remains a valid explicit choice; `On` selects a provider, model, and
provider-specific parameters before the final Workspace summary. Atlas must not render that form as
functional until the server can write encrypted secret material without returning it through Graph
reads or Runtime Protocol responses.

## Execution Slices

### Slice 1 — bounded model-backed Operation

- [x] Add provider-neutral deployment configuration and adapters.
- [x] Declare the typed Workspace `askPlans` Operation.
- [x] Retrieve and bound relevant Plan context under trusted Workspace authority.
- [x] Validate citations against the supplied candidates.
- [x] Cover unavailable provider, unauthorized Workspace, bounded context, and invalid citations.

### Slice 2 — floating read-only chat

- [x] Add compact closed, composing, pending, answered, and failed states.
- [x] Invoke through the shared Ontahi Runtime Protocol.
- [x] Render citations as links to Plan detail.
- [x] Keep independent exchanges without implying durable memory.
- [x] Hide the affordance when deployment model configuration is absent.

### Slice 3 — evaluate the next execution boundary

- [x] Observe question quality, context misses, latency, and resource usage.
- [ ] Decide whether structured Atlas retrieval is sufficient.
- [ ] Introduce an ephemeral checkout/sandbox only if real questions require repository history,
      arbitrary files, or command execution not represented by Atlas.
- [ ] Shape Workspace BYOK secret storage separately from assistant interaction.

## Verification

- [x] The browser never receives provider credentials.
- [x] Anonymous or non-member callers cannot invoke the assistant in a private Workspace.
- [x] Each successful answer cites only Plans present in its bounded context.
- [x] Context enforces candidate, per-document, and total character limits.
- [x] The assistant cannot mutate Atlas or invoke undeclared tools.
- [x] Provider absence and failure are honest recoverable UI states.
- [x] `pnpm verify` passes.

## Decisions

1. Start with one model-backed read-only Operation, not a general agent runtime.
2. Retrieval is host-controlled and bounded; the provider receives no Atlas authority.
3. Citations are typed output and revalidated against supplied context.
4. Deployment configuration precedes Workspace BYOK persistence.
5. A VM is justified only by demonstrated need for shell, checkout, or arbitrary repository access.

## Open Questions

1. Is simple lexical retrieval adequate before embeddings or a derived semantic index?
2. Should a follow-up question carry previous exchange text, cited Plans, or remain independent?
3. Does BYOK belong to Workspace, a reusable Provider Connection, or a grantable secret resource?
4. Which usage metadata is safe and useful to expose to owners without leaking provider responses?

## Closure / Evolution

Not closed. The first checkpoint is one typed, bounded `askPlans` Operation with deterministic
provider doubles before attaching the floating UI.

### 2026-11-01 — first vertical assistant slice

Atlas now composes OpenAI or Anthropic from server-only deployment configuration and exposes
`AtlasWorkspace.askPlans` through the shared Runtime Protocol. The host reauthorizes active
Membership from Principal plus requested Workspace, retrieves at most eight relevant Plans, bounds
each Markdown document and total context, treats Markdown as untrusted evidence, and revalidates all
model citations against the supplied candidates.

The main Atlas surface renders a floating independent-exchange chat only when a provider, model, and
credential are configured. It exposes no mutation, shell, repository checkout, or provider secret.

Implementation uncovered that receiver-owned Graph policy authority is not currently propagated as
custom Operation invocation context. Atlas therefore does not trust the browser Workspace ID and
reauthorizes Membership inside its server capability. A future Ontahi plan may unify or explicitly
relate those authority surfaces.

The local no-PostgreSQL development path now grants an authenticated in-memory User authority over
the canonical default Workspace. This keeps the UI mount condition and the bridged Operation's
authorization boundary aligned; deployed Atlas instances with `DATABASE_URL` continue to require a
persisted active Membership.

The first interaction pass replaces raw preformatted output and always-visible citation badges with
a bounded, internally scrolling conversation panel, lightweight Markdown typography, and one
collapsed source disclosure. Opening a cited Plan writes the Explorer's real `node` and `full`
route state and notifies the existing navigation listener while preserving the open conversation;
the cited Plan detail and its answer context remain available together. Model instructions avoid
appending a second Sources section because citations remain structured UI data.
The composer submits with `Command+Enter` or `Control+Enter` while plain Enter remains available for
multiline questions.

Plan references now render as inline hypertext from structured, revalidated citations; the separate
source disclosure was removed because it repeated the answer and consumed scarce panel space. The
model is asked to emit exact Plan-id Markdown links, while the client also decorates exact cited
titles as a compatibility fallback.

Local development wraps Atlas's shared Runtime Transport with `@ontahi/devtools` from the same
coordinated Ontahí release. Its bounded in-memory Activity panel captures complete local protocol
payloads and debug model-resource evidence; production disables diagnostics and does not mount the
panel. Provider credentials never cross the Runtime Protocol boundary.
