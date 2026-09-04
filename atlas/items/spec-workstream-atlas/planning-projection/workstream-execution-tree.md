---
id: spec-workstream-atlas.planning-projection.workstream-execution-tree
kind: experience
title: Workstream Execution Tree
parent: spec-workstream-atlas.planning-projection
status: shaping
horizon: now
supports:
  - spec-workstream-atlas.planning-projection
  - spec-workstream-atlas.atlas-model.plan
relatedPlans:
  - plans/done/124-implicit-personal-execution-streams-mvp.md
  - plans/done/125-explicit-session-forking-and-routing.md
  - plans/done/126-session-archival-and-activity-recency.md
  - plans/done/127-inline-session-fork-selection.md
---

[[spec-workstream-atlas.planning-projection.workstream-execution-tree|Workstream Execution Tree]]
is an actor-scoped navigation lens over shared
[[spec-workstream-atlas.atlas-model.plan|Plan]] lineage.

It should show where a line of work began, which child Plans each intervention spawned, the path
into the current focus, completed branches, and the sibling or ancestor branches available for
resumption. Parent/child lineage supplies the tree; dependencies, shaping, support, and related
links remain lateral relations in the wider Atlas graph.

The first product slice is [[spec-workstream-atlas.atlas-model.execution-stream|Execution Stream]]:
one open implicit Stream per User, bounded by an explicit close action. Attributable merged Pull
Requests append activity and move focus; when none is open, the next attributable merge starts one.
The tree is therefore a projection of live Atlas state over shared Plan lineage, not another Plan
document. Those facts do not own the included Plans, change their canonical lifecycle, assign work,
or grant authorization.

Parallel work is represented by selecting one or more visible Plan branches and forking them into
a new explicit Session. The source Session keeps its activity and remains open; the fork begins
with the selected Plans as exact roots, a lineage link to its source, and no copied PR history.
The rail switches among simultaneous open Sessions and bounded recent history without reconstructing
work from Git history.

Fork selection begins in an explicit mode on the Session tree itself, preserving the collapse,
done-state, and spatial context the User is already viewing. Checked branches remain local to that
Session and flow into a **Fork new Session** review dialog with an exact selected count. The dialog
can filter candidates by Plan title, source, or status without mutating the current selection;
switching Sessions, cancelling selection mode, or completing the fork clears that local state.

Repository activity cannot infer this parallelism safely. Each explicit Session exposes a stable ID,
addressable URL, and copyable LLM instruction requiring `Atlas-Session: <id>` in future PR bodies.
Valid directives route activity to exactly that User-owned open Session. Invalid explicit routing
fails closed rather than guessing an implicit destination; untagged PRs retain the original implicit
Session behavior.

Sessions uses a fixed workspace shell rather than one vertically scrolling page. The session rail
owns temporal context: Stream title, open/closed state, recent intervals, and the explicit close
boundary. The Plan tree and merged-Pull-Request activity are sibling panels with independent scroll
regions. Tree state is a local viewing concern: a User may hide done Plans and collapse or expand
branches without changing Plan lifecycle, Stream membership, or shared Atlas source.

Merged-Pull-Request activity leads with the Pull Request title and links it to the source PR. A
violet merge glyph carries the merged-state convention without repeating `PR` and `merged` in the
primary line; the linked repository and PR number remain secondary metadata, while the activity
time sits at the opposite edge for quick scanning. Session lifecycle actions keep a visible text
label, including `Close`, rather than relying on an unexplained icon.

Open or closed Sessions may be archived without becoming deleted or changing their routing
lifecycle. The rail hides archived Sessions by default and can reveal them explicitly; an
addressable archived Session reveals that group automatically. Valid merged-Pull-Request activity
automatically resurfaces an archived open Session. Every open, recent, or archived row shows the
exact time of its latest activity, or `No PRs yet` when the Session has no activity.

The tree may also show explicitly referenced but unmaterialized targets as empty branch tips. Such
a target records authorial intent and an incoming relation without pretending that a complete Plan
or Atlas Item already exists. Materializing it should resolve that existing reference and preserve
its provenance.

An addressable part within an existing Item is different: it remains a fragment of its containing
Item until an explicit promotion gives it independent identity and lifecycle.
