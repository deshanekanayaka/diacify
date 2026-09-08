---
name: Diacify
description: A tabbed chart binder for a solo clinician's patient list and per-patient chart — kraft-ground, one institutional accent, monospace clinical register.
colors:
  ground: "#efe6d3"
  tab-surface: "#fff9ec"
  ink: "#262220"
  ink-muted: "#6b5f52"
  accent: "#3e6e5e"
  accent-ink: "#f5f1e6"
  tab-blank: "#b0473c"
  tab-blank-text: "#8f362c"
  danger: "#a3352b"
  risk-medium: "#a67c2e"
  risk-medium-text: "#83601f"
typography:
  label:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem–2.25rem"
    fontWeight: 400
    lineHeight: normal
    letterSpacing: "0.01em"
  heading:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: normal
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem–1rem"
    fontWeight: 400
    lineHeight: normal
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  strip-top: "8px 8px 0 0"
  tab: "0 10px 10px 0"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  drawer-gap: "0.6rem"
  form-gap: "0.75rem"
  tab-block: "0.85rem"
  md: "1rem"
  tab-inline: "1.25rem"
  detail-form-gap: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  tab-patient:
    backgroundColor: "{colors.tab-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    padding: "0.85rem 1.25rem"
  tab-new-chart-closed:
    backgroundColor: "transparent"
    textColor: "{colors.tab-blank}"
    rounded: "{rounded.tab}"
    padding: "0.85rem 1.25rem"
  input-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0.4rem 0.5rem"
  visit-tab-strip-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.strip-top}"
    padding: "0.5rem 1.1rem"
  visit-tab-strip-item-active:
    backgroundColor: "{colors.tab-surface}"
    textColor: "{colors.accent}"
    rounded: "{rounded.strip-top}"
    padding: "0.5rem 1.1rem"
  risk-result:
    backgroundColor: "{colors.tab-surface}"
    rounded: "{rounded.tab}"
    padding: "1.25rem 1.5rem"
---

# Design System: Diacify

## Overview

**Creative North Star: "The Tabbed Chart Binder"**

Diacify reads as a drawer of physical chart dividers, not a generic
rounded-card app. Each patient is a tab you'd flip past in a manila
folder binder: a kraft-colored ground, a cream tab surface, a solid
color spine on the left edge, and a chart-label typewriter register
for identity and clinical data. The system is flat and restrained by
deliberate choice — it borrows the folder-tab *silhouette* (the
asymmetric flipped-corner radius, the colored spine, a thin flat
offset shadow standing in for a folder edge) without reaching for
literal paper texture, grain, or skeuomorphic ornament.

The second shipped surface — the per-patient detail screen — extends
the same world one level deeper instead of introducing a new one: a
patient's own chart gets its own miniature pair of chart-tabs
(History / New Visit), built from the same tab-shape and spine
language at a smaller scale. Two raises were made on top of the
committed world, and both stayed inside it rather than reaching for
new materials: the scored risk verdict gets a large, dedicated
monospace readout (still on the cream tab surface, still the flipped
tab radius, still the folder-edge shadow — deliberately not a dark
"instrument panel" treatment), and past-visit rows expand in place as
an accordion instead of navigating to a second screen.

This is a solo clinician's live, in-the-room tool (see PRODUCT.md), so
the system stays quiet: one institutional teal accent marks the
committed/active action, a rust-red spine marks the one blank,
not-yet-committed "new chart" tab, a new gold/amber tier marks
medium clinical risk, and everything else recedes into ink-on-kraft
text. The system now has one heading tier — the patient reference
rendered large, still in monospace — where the list surface had none;
everything else remains label- and body-scale text arranged as tab
rows.

**Honest scope note:** this file was written directly from shipped
source (`theme.css`, component CSS, and component markup) across both
surfaces, with no in-browser screenshot pass in either build session —
no browser-automation capability was available. For the patient-detail
surface, a live full-stack round-trip (curl) verified the risk-scoring
wiring; the visual rendering itself was checked only by the user's own
screenshots, not by an automated capture. `SignInForm` remains
explicitly excluded from this system (see Do's and Don'ts).

**Key Characteristics:**
- Kraft/manila ground with one institutional teal accent, used sparingly
- A clinical/identity register set in monospace (patient reference,
  dates, vitals values, risk score and category); everything else in
  the system sans stack
- Flat folder-tab silhouette: asymmetric radius, colored left spine,
  thin flat offset shadow — no blur, no paper grain, no literal
  skeuomorphism — now reused at two scales (patient tabs, and the
  mini History/New Visit tabs and accordion rows inside a patient's
  own chart)
- Two surfaces are shaped so far: the patient list / add-patient
  drawer, and the per-patient detail chart (history, new-visit entry,
  risk readout)

## Colors

A warm, paper-adjacent neutral ground carries one cool institutional
accent, a rust "filing" hue for the one blank tab, and — new in the
detail surface — a small clinical risk scale that deliberately stays
inside the same kraft/cream material rather than introducing a
separate instrument-panel palette.

### Primary
- **Institutional Teal** (`#3e6e5e`): the accent. Marks the primary
  submit action, a patient tab's left spine, the active mini-tab in
  the History/New Visit strip, and — reused, not redefined — low risk
  in the `RiskResult` readout.
- **Warm Ivory** (`#f5f1e6`): text color on top of the teal accent
  (`button-primary`'s label).

### Neutral
- **Kraft Ground** (`#efe6d3`): the page background (`body`). The
  manila-folder base every surface sits on, list and detail alike.
- **Tab Cream** (`#fff9ec`): the raised surface color for a patient
  tab, the opened "new chart" tab, the active mini-tab, `VisitForm`,
  `RiskResult`, and each `VisitHistoryRow` — one recurring "raised
  paper" surface color across both surfaces.
- **Near-Black Ink** (`#262220`): primary text color.
- **Muted Ink** (`#6b5f52`): secondary text — tab dates, field labels,
  the mini-tab strip's inactive labels, history-row status copy.
- **Rust/Blank-Filing Red** (`#b0473c`): the spine and label color of
  the pinned "+ New chart" tab only. A *filing* color, not a clinical
  color — never appears on a real patient tab or in risk scoring.
- **Rust Text-Safe** (`#8f362c`, `--tab-blank-text`): a darkened
  variant of the filing rust, used only where that hue carries text
  rather than a border/spine. Added this session after an audit found
  `#b0473c` on kraft is 4.44:1 — just under the 4.5:1 body-text floor;
  the darker value is 1:1-safe replacement for text contexts only.
  The spine/border use is unaffected (non-text contrast floor is
  lower).
- **Danger** (`#a3352b`): inline form validation error text, and high
  clinical risk in `RiskResult`/`VisitHistoryRow`.

### Risk scale (new, patient-detail surface only)
- **Risk Low** — reuses `--accent` (`#3e6e5e`). No new token.
- **Risk Medium — Gold** (`#a67c2e`, category text/spine; `#83601f`
  for the smaller confidence-line text at `--risk-color-text`): a new
  amber tier, added because low/high alone can't express a mid-band
  clinical result. The two-value split exists because `#a67c2e` is
  3.6:1 on the cream tab surface — enough for the large uppercase
  category readout (>3:1 large-text floor) but not for the smaller
  confidence-warning line, which uses the darker `#83601f` instead.
- **Risk High** — reuses `--danger` (`#a3352b`). No new token.

### Named Rules

**The One Spine Rule.** A patient-list tab's left-edge spine carries
exactly one color and one state: solid teal for a committed patient
record, dashed rust for the blank unopened "new chart" tab, solid
rust once that tab is open and mid-entry. No filing-color spine
carries clinical meaning.

**The Risk-Is-Its-Own-Scale Rule.** Clinical risk (low/medium/high) is
a separate three-value scale from filing status. It reuses the
existing teal (low) and danger red (high) rather than inventing new
hues for those two ends, and adds exactly one new hue (gold, medium)
for the tier neither existing color could honestly express. Don't add
a fourth risk tier or a new color for an existing tier without
checking contrast against the cream tab surface first — the
low/text-safe-gold/high split above already accounts for the
3:1/4.5:1 floors on this ground.

**Build note (evidenced divergence, carried from the list-surface
pass):** the direction contract named a two-color "warm tab-color set"
(`#C9A15A` gold + `#B0473C` rust) for filing color. Only `#b0473c`
ever shipped as the filing token. The medium-risk gold added this
session (`#a67c2e`) is a coincidentally similar hue but a distinct
token, introduced for a different reason (clinical scoring, not
filing) — don't conflate the two or treat the unused `#C9A15A` as
having shipped.

## Typography

**Body Font:** System UI stack — `-apple-system, BlinkMacSystemFont,
"Segoe UI", Roboto, sans-serif` (`--font-ui`)
**Label/Mono Font:** `ui-monospace, "SF Mono", Menlo, monospace`
(`--font-label`)

**Character:** A plain system sans for all UI chrome, paired with a
typewriter-register monospace for the clinical/identity data layer —
the patient reference, dates, vitals values, lab units, and the risk
score and category. The mono face is what makes a tab, a form field,
or a readout feel like a chart entry rather than a generic UI row.

### Hierarchy
- **Heading** (mono, `1.5rem`, regular weight): the patient reference
  as the detail page's `<h1>` (`.patient-detail__reference`) — the
  system's first and only heading-scale text. Still monospace,
  reinforcing that even at heading size this is chart identity, not
  display typography.
- **Instrument readout** (mono, `2.25rem`, `font-weight: 600`,
  uppercase, `letter-spacing: 0.02em`): the risk category text in
  `RiskResult` — the single largest and heaviest text in the shipped
  system, reserved for the scored verdict alone.
- **Label** (mono, ranging `0.75rem`–`1rem` depending on context): the
  patient reference/date on a list tab, the reference input, every
  `VisitForm` value input, lab units, history-row dates and detail
  values, and the risk score line (`Score 82.0 / 100`).
- **Body** (system sans, `~0.75–1rem`, regular weight): everything
  else — form labels, fieldset legends, button and mini-tab text, the
  empty/loading/error prompts, the history-row risk-category badge.

No display or hero scale exists anywhere in the shipped system; the
one heading tier above is still built from the identity/mono face,
not a separate display font.

### Named Rules

**The Mono-Is-Clinical-Register Rule** *(evidenced expansion of the
prior "Mono-Is-Identity" rule)*. The list surface used monospace only
for chart identity (reference, date). The detail surface's build
shows the register is broader than that: monospace now consistently
marks any clinical or numeric data point — vitals values, lab units,
the risk score, the risk category, and the page heading — while
system sans stays reserved for UI chrome, labels, and prose. Still
never decorative: don't use monospace for a heading that isn't
identity-derived, a button, or body copy.

## Layout

**Patient list:** a single vertical column of tab rows, newest-first,
capped at `max-width: 32rem` (`.patient-drawer`), flex column (`gap:
0.6rem`) of `<li>` rows under one `<ul>`. The pinned "+ New chart" tab
always renders first.

**Patient detail:** no explicit container max-width on the page
itself; the mini-tab strip, `VisitForm`, `RiskResult`, and the visit
history list each cap at `max-width: 40rem` independently — a
narrower column than nothing, wider than the 32rem list drawer,
suiting a form/readout rather than a row list. `VisitForm` and each
expanded `VisitHistoryRow` detail panel lay their fields out with
`grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr))` (form)
or `minmax(10rem, 1fr)` (history detail) — a responsive auto-fill
grid, the system's only grid usage so far.

No responsive breakpoints exist in either surface's shipped CSS; both
rely on the auto-fill grid and flex-column layouts to reflow instead
of an explicit breakpoint strategy.

Internal tab padding is `0.85rem 1.25rem` (list). The mini-tab strip
uses a tighter `0.5rem 1.1rem`. `VisitForm` and `RiskResult` use
`1.25rem 1.5rem`/`1.25rem`. Form-row gaps are `0.75rem` (new-chart
form) or `1.25rem` (`VisitForm`, larger because it groups a required
block and an optional fieldset rather than a flat field list).

## Elevation & Depth

Flat, with one deliberate exception carried forward unchanged into the
detail surface: every tab-shaped element — patient tabs, the risk
readout, and each history row — carries the same single flat,
non-blurred offset shadow, `box-shadow: 0 2px 0 var(--tab-shadow)`
(`rgba(38, 34, 32, 0.18)`), standing in for a folder edge, not ambient
light. The mini History/New Visit tab strip is the one shape in the
system that does *not* carry this shadow — it sits flush against the
page like a real folder-tab divider rather than a raised card, which
is consistent with the shadow's "folder edge" purpose rather than a
gap in coverage.

### Shadow Vocabulary
- **Folder-edge** (`box-shadow: 0 2px 0 rgba(38, 34, 32, 0.18)`, now a
  named custom property `--tab-shadow`): every patient/new-chart tab,
  the `RiskResult` readout, and every `VisitHistoryRow`.

### Named Rules

**The One Shadow Rule.** There is exactly one shadow value in the
system, now expressed as `--tab-shadow` and reused identically across
both surfaces. Don't introduce blur, layered shadows, or
hover-elevation — the folder-edge shadow is flat by definition.

## Shapes

**The Flipped-Tab Radius.** Every tab-shaped element — patient tabs,
the new-chart tab, the `RiskResult` readout, and every
`VisitHistoryRow` — uses the same asymmetric radius,
`border-radius: 0 10px 10px 0`, square on the left where the spine
sits, rounded on the right. This is now confirmed as the system's
recurring signature across two surfaces, not a one-off.

**The mini-tab strip variant.** `VisitTabStrip` reuses the tab
language at a different silhouette: `border-radius: 8px 8px 0 0`
(rounded top, square bottom, no bottom border) — a top-tab, not a
side-tab, because it sits above the content it switches rather than
beside it. This is a deliberate second silhouette in the same family,
not a departure: still asymmetric, still a folder-tab shape, oriented
for its position in the layout.

Borders stay thin and low-contrast: `1px solid rgba(38, 34, 32, 0.1)`
frames cream surfaces (patient tabs, `VisitForm`, `RiskResult`,
history rows); `1px solid rgba(38, 34, 32, 0.2)` frames the mini-tab
strip buttons; `1px solid rgba(38, 34, 32, 0.25)` frames inputs and
the secondary button. Dashed hairlines (`1px dashed rgba(38, 34, 32,
0.15–0.2)`) mark internal dividers — the `VisitForm` optional-labs
fieldset, and the border between a `VisitHistoryRow` summary and its
expanded detail. The `6px` solid/dashed left spine remains a border,
not a background fill, everywhere it appears (patient tabs,
`RiskResult`, history rows).

## Components

### Buttons
- **Shape:** symmetric `6px` radius, `font-weight: 600`.
- **Primary:** teal background (`#3e6e5e`), ivory text (`#f5f1e6`),
  `0.5rem 1rem` (new-chart Save) or `0.6rem 1.25rem` (`VisitForm`'s
  "Record visit") padding. `VisitForm`'s submit gets a `:hover`
  (`#345c4e`) and `:disabled` (`opacity: 0.7`) state the list
  surface's buttons don't define.
- **Secondary/Ghost:** transparent background, `1px solid rgba(38,
  34, 32, 0.25)` border, ink text, `0.5rem 1rem` padding — the
  new-chart form's Cancel and the detail page's post-submit actions
  ("Record another visit", "View in history"), now with a shared
  `:hover` fill (`rgba(38, 34, 32, 0.06)`).

### Cards / Tabs (signature component)
- **Corner Style:** flipped `0 10px 10px 0` radius (see Shapes).
- **Background:** `#fff9ec` (tab cream) for a real patient tab, the
  opened new-chart tab, `VisitForm`, `RiskResult`, and history rows;
  `transparent` for the closed, unopened new-chart tab.
- **Shadow Strategy:** the one folder-edge shadow (see Elevation).
- **Border:** `6px` colored left spine (teal, rust, or — new — the
  risk color) plus a faint `1px` hairline outline on real surfaces.
- **Internal Padding:** `0.85rem 1.25rem` (list tabs); `1rem 1.25rem`
  (open new-chart form); `1.25rem 1.5rem` (`RiskResult`); `0.85rem
  1.25rem` (history row summary).

### Inputs / Fields
- **Style:** `1px solid rgba(38, 34, 32, 0.25)` border, `4px` radius,
  monospace type, transparent (list) or unspecified/inherited
  background. `VisitForm` extends this to 11 numeric `<input
  type="number">` fields (5 required, 6 optional under a "Labs
  (optional)" `<fieldset>`), each with a mono unit suffix
  (`.visit-form__unit`, `0.75rem`).
- **Error:** validation text renders in `#a3352b` (danger), `0.85rem`,
  `role="alert"` — same treatment in both the new-chart form and
  `VisitForm`. No visual error state on the input border itself in
  either surface.
- **Focus:** **new, global.** `theme.css` now defines
  `:focus-visible { outline: 2px solid var(--accent); outline-offset:
  2px; }` at the root — the first focus treatment in the system,
  applying to every interactive element (tabs, buttons, inputs,
  mini-tabs, accordion summaries) rather than being defined
  per-component. This closes the previous surface's documented gap
  ("no custom focus-visible treatment... relies on browser default").

### Navigation
The mini `VisitTabStrip` (History / New Visit) is the system's first
navigation-like chrome: two `role="tab"` buttons, transparent by
default with muted-ink text, switching to cream background + teal
text/border when `aria-selected="true"`. `gap: 0.4rem` between the two
buttons, `1.25rem` margin below the strip before its content panel.
Otherwise still minimal — a plain `← Patients` text link
(`.patient-detail__back`, `0.85rem`, muted ink, ink on hover) is the
only other wayfinding chrome, and there is still no persistent app
header or nav bar.

### Visit Tab Strip (signature component)
A two-item, top-rounded (`8px 8px 0 0`) tab pair switching a patient's
own chart between History and New Visit — the same tab-shape language
as the list surface's side-tabs, reoriented for its position above
content instead of beside it. `font-weight: 600`, `0.9rem`. Inactive:
transparent, muted-ink text, `1px solid rgba(38,34,32,0.2)` border
with no bottom border (so the active tab visually joins its panel).
Active: cream background, teal text and border.

### Risk Result (signature component)
The scored risk verdict as a dedicated, large monospace readout —
the raise this surface makes over a small inline tag. Cream surface,
flipped-tab radius, folder-edge shadow, `6px` left spine in the risk
color (teal/gold/danger). Category text is `2.25rem`, uppercase,
`font-weight: 600` — the single largest text in the system. A
secondary mono score line (`Score 82.0 / 100`, muted ink) and an
optional low-confidence warning line (in the risk-color-text variant)
sit below it. Deliberately does not introduce a dark "instrument
panel" material — the direction contract's raise is answered inside
the committed kraft/cream world, not with a new surface identity.

### Visit History List / Row (signature component)
An accordion of past visits, newest first, each row closed to a
compact tab (date + risk-category badge) and expanding in place to a
`<dl>` of full vitals plus the risk score — the raise this surface
makes instead of navigating to a second screen. Closed row: same
cream/flipped-radius/folder-shadow/spine language as a patient tab,
spine colored by that visit's risk category (or muted ink if
unscored). Expanded: a dashed `1px` divider separates the summary
from an `auto-fill` grid of `dt`/`dd` pairs (mono values, sans
labels). The summary button gets a `#fef4dc` hover fill — a value
used once, in this one place; treat it as this component's own hover
state, not a new system-wide surface token. Empty/loading/error states
render as dashed-bordered placeholder rows in the same tab silhouette,
reusing the shape rather than inventing a distinct empty-state pattern.

### Global states (new)
`theme.css` now defines two root-level states beyond individual
components: `::selection { background: var(--accent); color:
var(--accent-ink); }` (teal highlight, ivory text) and the
`:focus-visible` ring described under Inputs. Both apply everywhere,
not per-component — the first system-wide interaction states recorded
in this file.

## Do's and Don'ts

### Do:
- **Do** keep the flipped `0 10px 10px 0` radius exclusive to
  tab-shaped rows (patient tabs, the new-chart tab, `RiskResult`,
  history rows) — the system's one signature side-tab silhouette.
- **Do** use the `8px 8px 0 0` top-tab radius only for tab strips that
  sit above the content they switch (`VisitTabStrip`) — it is a
  distinct, position-driven variant of the same family, not a
  competing general radius.
- **Do** keep the folder-edge shadow (`--tab-shadow`) flat and
  identical everywhere it's used; it is the system's only shadow.
- **Do** reserve monospace (`--font-label`) for the clinical/identity
  register — reference, date, vitals, lab units, risk score/category,
  the one heading — never for decorative headings, buttons, or prose.
- **Do** keep filing color (rust) and clinical risk color
  (teal/gold/danger) semantically separate scales, even though the
  medium-risk gold and the unused filing gold happen to be visually
  similar — they are different tokens for different meanings.
- **Do** check contrast against the actual background (kraft ground
  vs. cream tab surface) before adding a new color at text size — the
  system already carries two evidenced fixes for this
  (`--tab-blank-text`, the medium-risk text/border split).

### Don't:
- **Don't** add a drop-shadow, blur, or hover-elevation to a tab — the
  system uses exactly one flat offset shadow, on purpose.
- **Don't** introduce a fourth risk tier or a new UI accent color
  without checking it against the existing teal/rust/gold/danger set
  first — the palette is a closed, purpose-built set, not an open one.
- **Don't** treat `SignInForm`'s inline, unstyled markup as part of
  this system. Still out of scope, still needs its own design pass.
- **Don't** carry the unused `#C9A15A` gold filing color from the
  direction contract into new work as if it shipped. (The medium-risk
  gold, `#a67c2e`, is a real but separate token — see Colors.)
- **Don't** promote the `VisitHistoryRow` summary's `#fef4dc` hover
  fill into a system-wide token; it's evidenced exactly once and
  isn't a system yet.
- **Don't** reach for a dark "instrument panel" surface for readouts
  or scores — `RiskResult` is the confirmed counter-example: the
  build deliberately kept the scored verdict inside the committed
  kraft/cream material instead of introducing a competing one.
