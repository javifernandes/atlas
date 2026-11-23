# 156. Incremental Entity derivation and materialization

Status: current

## Summary

Make Atlas the first adopter of a provider-neutral incremental derivation mechanism: a committed
Source `ChangeSet` identifies affected inputs, a versioned Materializer derives only the affected
artifacts and Entities, and publication preserves the same logical Projection Revision that a full
rebuild would have produced.

The implementation should begin as a behavioral SPI in Ontahí, where applications can plug in
arbitrary dependency and derivation behavior. Atlas will prove that SPI with Markdown-backed
WorkItems, Plans, Atlas Items, and their relations. BookOps should then exercise the same mechanism
with Parts, Chapters, and other content nodes. Only after those two consumers expose the common
shape should Ontahí add a higher-level declarative API over Entities that compiles to the SPI.

## Context

Plans 152 and 155 made observation incremental at the Source-record boundary and introduced exact,
durable file ChangeSets. Parsing and semantic derivation still rebuild the complete Workspace even
though most Pull Requests modify fewer than ten files. The next optimization is therefore not a
more sophisticated cache policy; it is dependency-aware derivation from an exact committed delta.

Ontahí research Plan `ontahi://plans/164-derived-models-projections-and-provenance` established the
conceptual model. Executable Plan
`ontahi://plans/169-replicated-versioned-models-kernel-and-materializer-spi` now supplies the
provider-neutral acceptance kernel and behavioral Materializer SPI. This Atlas plan is their first
concrete adopter.

## Architectural Layers

### 1. Runtime kernel

The provider-neutral kernel should carry only invariants shared by applications:

- exact input Source Revision and accepted ChangeSet;
- stable derivation and implementation version identity;
- dependency index and affected-set calculation;
- stable derived-artifact or Entity identity;
- atomic acceptance of a target frontier;
- rebuild, incremental update, validation, and repair as distinct operations;
- proof that incremental and full derivation are logically equivalent.

### 2. Behavioral Materializer SPI

The first public integration surface should be behavior, not a premature DSL. A Materializer can
interpret an application input, declare or discover dependencies, produce artifact/Entity changes,
and report diagnostics. Exact TypeScript is deferred to the Ontahí provider plan, but the contract
must be able to express this shape:

```ts
type MaterializationResult<Artifact, EntityChange> = {
  artifacts: Artifact[]
  entityChanges: EntityChange[]
  dependencies: Dependency[]
  diagnostics: Diagnostic[]
}

interface Materializer<Input, Artifact, EntityChange> {
  readonly id: string
  readonly version: string
  derive(input: Input, context: DerivationContext): Promise<MaterializationResult<Artifact, EntityChange>>
}
```

Applications remain free to implement one-to-one, one-to-many, many-to-one, cross-record, or
externally backed derivations. The kernel must not assume one file equals one Entity even though
that is the first common shape in Atlas and BookOps.

### 3. Declarative Entity API

After Atlas and BookOps prove the behavioral contract, Ontahí can reflect the recurring subset as
a declaration centered on Entities: input Sources or Selections, output Entity definitions,
identity, dependencies, transformation version, and consistency requirements. That declaration is
authoring syntax over the SPI, not a replacement for it; irregular applications retain the
behavioral escape hatch.

### 4. Optional physical policies

Cooling, eviction, hot/warm/cold tiers, product plans, restore latency, and storage-vendor choices
can later become plugins or policies over reconstructible derived state. They are benefits of the
architecture, not requirements for this plan and not justification for delaying incremental
derivation.

## Atlas Adoption

Atlas should initially derive in two explicit stages:

```txt
SourceRecord@contentHash
  -> ParsedRecordArtifact@materializerVersion
  -> Entity changes + semantic dependencies
  -> atomic Projection Revision
```

The first slice may keep global atomic graph publication. Incremental work means that unchanged
record artifacts and Entity derivations are reused; it does not require exposing a partially
updated graph. Creates, updates, deletes, and file moves must all invalidate the correct artifacts
and relations. Any unknown dependency, version mismatch, ChangeSet gap, or failed equivalence check
falls back to a full rebuild.

Artifact identity should include at least Source-record identity, content hash, and Materializer
version. Semantic dependency identity must be explicit enough that changing one record invalidates
cross-record outputs without reparsing unrelated records.

The reusable pressure is media-neutral even though Atlas begins with Markdown. The candidate
portable shape is `VersionedRecord -> DerivedArtifact<Payload>`: stable record identity, content
fingerprint, parser/Materializer identity and version, a serializable payload, current observation
lineage, and dependency evidence. Markdown parsing is one adapter over that shape; JSON, YAML,
source code, or other record media should be able to supply different parsers without changing the
acceptance and invalidation model.

Do not extract or stabilize that record-artifact API from Atlas alone. BookOps must first reuse the
behavior with its own Markdown payloads, hierarchy, ordering, and cross-record dependencies. A
later non-Markdown proof should then test whether content hashing, serialization, lineage rebinding,
and affected-record calculation are genuinely independent of Markdown. Application payloads and
cross-record assembly remain application-owned even if the envelope becomes generic.

## BookOps Validation

BookOps is the intended second adopter, not another implementation copied into Atlas. Its Markdown
Sources derive content-node Entities such as Parts and Chapters and should exercise hierarchy,
ordering, cross-record references, and shapes that are not identical to Atlas Plans and Items.

The declarative Entity API should not be stabilized until both adopters can be expressed without
hiding application-specific behavior or forcing a one-file/one-Entity assumption.

## Execution Slices

1. [x] Link the executable provider plan:
       `ontahi://plans/169-replicated-versioned-models-kernel-and-materializer-spi`.
2. [x] Define the minimal runtime kernel and behavioral Materializer SPI in Ontahí, including
       identity, dependency, affected-set, provenance, and safe rebuild contracts.
3. [x] Add versioned parsed-record artifacts in Atlas and reuse unchanged artifacts for an exact
       ChangeSet.
   - [x] Extract a per-record parsing boundary and prove that assembling its artifacts is equivalent
         to the existing global parser.
   - [x] Persist compatible artifacts by Source Record identity, content hash, and Materializer
         version.
     - [x] Store the accepted frontier, Materializer state, dependency evidence, and complete
           artifact set as one scope-local PostgreSQL checkpoint.
     - [x] Reject stale checkpoint writers with a Source-frontier compare-and-swap and hydrate
           readers from one repeatable-read snapshot.
   - [x] Connect exact ChangeSets to affected artifact reuse through an in-process Ontahí
         Materializer proof.
   - [x] Hydrate accepted state, dependencies, and artifacts from Atlas persistence, then connect the
         Materializer to production reconciliation.
4. Derive only affected Atlas Entities and semantic dependencies while retaining atomic Projection
   Revision publication and full-rebuild fallback.
5. Run incremental and full derivation in comparison mode until equivalence and invalidation
   evidence are sufficient to make incremental execution primary.
6. Adopt the SPI in BookOps as the second concrete shape.
7. Extract the recurring Entity-oriented declaration into Ontahí, compiling it to the behavioral
   SPI and preserving the custom implementation escape hatch.

## Verification

- A one-record create, update, delete, or move derives the same logical Projection Revision as a
  full rebuild without parsing every unchanged record.
- Cross-record dependency changes invalidate every affected Entity and no unrelated Entity.
- Materializer version changes invalidate incompatible artifacts deterministically.
- Duplicate delivery and replay remain idempotent; ChangeSet gaps and unknown dependencies fall
  back to full observation/rebuild.
- A failed incremental derivation cannot publish a partial logical revision.
- Atlas and BookOps can share kernel/SPI contracts while retaining different parsers and semantic
  behavior.
- The behavioral SPI can express a derivation that the future declarative Entity API does not.

## Non-Goals

- Cooling, eviction, hot/warm/cold states, product tiers, pricing, or readiness SLOs.
- A storage vendor or automatic Workspace lifecycle policy.
- Partial graph publication in the first Atlas adoption.
- Stabilizing a declarative Entity DSL before the second adopter supplies evidence.
- Multi-master replication, offline convergence, or a CRDT engine.
- Copying the Ontahí provider plan or BookOps adoption plan into Atlas.

## Decisions

- Treat incremental derivation as the immediate objective; physical lifecycle policy is optional
  future work.
- Put the generic runtime kernel and behavioral SPI in Ontahí; keep this plan responsible for Atlas
  adoption and equivalence evidence.
- Design behavior first, then derive a declarative Entity API from at least Atlas and BookOps.
- Preserve full rebuild as recovery, validation oracle, and repair mechanism.
- Keep logical Projection Revision identity independent from whether it was produced incrementally
  or by full derivation.
- Treat Markdown as the first record parser adapter, not as part of the generic replicated-model
  contract; extract a media-neutral record-artifact envelope only after Atlas and BookOps evidence.

## Open Questions

1. Which dependency edges can Atlas infer during parsing, and which must a Materializer declare?
2. Does the first Entity-change vocabulary reuse ChangeSet operations directly or use a smaller
   provider-neutral mutation result?
3. What comparison window and evidence threshold are sufficient before incremental execution
   becomes primary?
4. Which BookOps derivation best challenges the one-file/one-Entity assumption?
5. Which envelope fields and invalidation rules remain identical after BookOps and a non-Markdown
   JSON or YAML adopter exercise the same behavior?

## Closure / Evolution

Current. Reshaped from adaptive storage policy to incremental Entity derivation. Plans 154 and 155
provide exact Source revisions and durable ChangeSets; parent Plan 153 coordinates the broader
line. Ontahí Plans 164 and 169 own the provider-neutral model and executable SPI. The first Atlas
slice extracts a versioned per-record parsing artifact and comparison path. The next proof binds
exact Source ChangeSets to the Ontahí Materializer, reparses only affected records, preserves a full
artifact set, and falls back to rebuild when removal evidence is unknown. Atlas now has a durable,
atomic PostgreSQL checkpoint for the accepted frontier, Materializer state, dependency evidence,
and portable artifacts, including optimistic protection against stale writers. Production
reconciliation now hydrates that checkpoint through Ontahí, reparses only ChangeSet-affected or
incompatible records, assembles and publishes the same complete Projection Revision, and advances
the checkpoint afterward. A missing, stale, version-incompatible, or dependency-incomplete
checkpoint falls back to full parsing. This completes the intended incremental-parsing cut; the
next slice is incremental Entity and semantic-dependency derivation, after measuring this smaller
change and evaluating the record-artifact pattern in BookOps. Cooling, eviction, and tier policy
remain possible later plugins but have no execution slice here.
