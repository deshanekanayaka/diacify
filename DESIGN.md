---
name: Diacify
description: A tabbed chart binder for a solo clinician's patient list — kraft-ground, one institutional accent, monospace chart labels.
colors:
  ground: "#efe6d3"
  tab-surface: "#fff9ec"
  ink: "#262220"
  ink-muted: "#6b5f52"
  accent: "#3e6e5e"
  accent-ink: "#f5f1e6"
  tab-blank: "#b0473c"
  danger: "#a3352b"
typography:
  label:
    fontFamily: "ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.85rem–1rem"
    fontWeight: 400
    lineHeight: normal
    letterSpacing: "0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.85rem–1rem"
    fontWeight: 400
    lineHeight: normal
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  tab: "0 10px 10px 0"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  drawer-gap: "0.6rem"
  form-gap: "0.75rem"
  tab-block: "0.85rem"
  md: "1rem"
  tab-inline: "1.25rem"
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
---

# Design System: Diacify

## Overview

**Creative North Star: "The Tabbed Chart Binder"**

Diacify's patient list reads as a drawer of physical chart dividers, not
a generic rounded-card app list. Each patient is a tab you'd flip past in
a manila folder binder: a kraft-colored ground, a cream tab surface, a
solid color spine on the left edge, and a chart-label typewriter register
for the reference and date. The system is flat and restrained by
deliberate choice — it borrows the folder-tab *silhouette* (the
asymmetric flipped-corner radius, the colored spine, a thin flat
offset shadow standing in for a folder edge) without reaching for
literal paper texture, grain, or skeuomorphic ornament.

This is a solo clinician's live, in-the-room tool (see PRODUCT.md), so
the system stays quiet: one institutional teal accent marks the
committed/active action, a rust-red spine marks the one blank,
not-yet-committed tab, and everything else recedes into ink-on-kraft
text. There is no display face and no hero typography anywhere in the
shipped surface — the whole vocabulary so far is label-scale and
body-scale text arranged as tab rows.

**Honest scope note:** this file was written directly from the shipped
source (`theme.css`, component CSS, and component markup) with no
in-browser screenshot pass — no browser-automation capability was
available in this build session. Every value below is grounded in code,
not a visual QA pass. `SignInForm` is explicitly excluded from this
system (see Do's and Don'ts); it is a plain, unstyled functional form
still waiting for its own design pass.

**Key Characteristics:**
- Kraft/manila ground with one institutional teal accent, used sparingly
- Chart-label typography set in monospace; everything else in the system
  sans stack
- Flat folder-tab silhouette: asymmetric radius, colored left spine, thin
  flat offset shadow — no blur, no paper grain, no literal skeuomorphism
- Only one surface is shaped so far: the patient list / add-patient
  drawer

## Colors

A warm, paper-adjacent neutral ground carries one cool institutional
accent; a second warm/rust hue exists only to mark the single
not-yet-real "new chart" tab, never to signal clinical risk.

### Primary
- **Institutional Teal** (`#3e6e5e`): the accent. Marks the primary
  submit action and the patient tab's left spine — the one recurring
  color that says "this is a real, committed record."
- **Warm Ivory** (`#f5f1e6`): text color on top of the teal accent
  (`button-primary`'s label).

### Neutral
- **Kraft Ground** (`#efe6d3`): the page background (`body`). The
  manila-folder base the whole surface sits on.
- **Tab Cream** (`#fff9ec`): the raised surface color for a patient tab
  and the opened "new chart" tab — one step lighter than the kraft
  ground, standing in for a paper card laid on the drawer.
- **Near-Black Ink** (`#262220`): primary text color (`body`, tab
  reference labels).
- **Muted Ink** (`#6b5f52`): secondary text — tab dates, field labels,
  the empty-state prompt.
- **Rust/Blank-Filing Red** (`#b0473c`): the spine and label color of
  the pinned "+ New chart" tab only. It is a *filing* color (this tab
  isn't a patient yet), not a clinical-risk color — it never appears on
  a real patient tab.
- **Danger** (`#a3352b`): inline form validation error text only.

### Named Rules

**The One Spine Rule.** A tab's left-edge spine carries exactly one
color and one state: solid teal for a committed patient record, dashed
rust for the blank unopened "new chart" tab, solid rust once that tab
is open and mid-entry. No other spine color exists in the shipped
system — don't introduce a second "risk" or "status" color on this
edge; the direction contract is explicit that filing color and clinical
color never share a hue.

**Build note (evidenced divergence):** the direction contract named a
two-color "warm tab-color set" (`#C9A15A` gold + `#B0473C` rust) for
filing color. Only `#b0473c` (`--tab-blank`) actually shipped as a
token or appears anywhere in the component CSS; `#C9A15A` is not
present in the build. Documenting the shipped single rust value only —
don't back-fill the unused gold into future work as if it were live.

## Typography

**Body Font:** System UI stack — `-apple-system, BlinkMacSystemFont,
"Segoe UI", Roboto, sans-serif` (`--font-ui`)
**Label/Mono Font:** `ui-monospace, "SF Mono", Menlo, monospace`
(`--font-label`)

**Character:** A plain system sans for all UI chrome, paired with a
typewriter-register monospace reserved for chart-identity data — the
reference code, the date, and the reference input field. The mono face
is what makes a tab read as a chart label rather than a list row.

### Hierarchy
- **Label** (mono, 1rem for the reference / 0.85rem for the date,
  `letter-spacing: 0.01em` on the reference): the patient's `reference`
  and `created_at` date on a tab, and the live reference text input in
  the new-chart form. This is the only place monospace appears.
- **Body** (system sans, ~0.85–1rem, regular weight): everything else —
  form labels, fieldset legend, button text, the empty-state prompt,
  loading/error copy.

No display or headline scale exists in the shipped surface — there is
no page title or hero text anywhere in `PatientListPage`.

### Named Rules

**The Mono-Is-Identity Rule.** Monospace is reserved for chart-identity
data (reference, date, the reference input) and nothing else. It is not
a general-purpose UI or heading font — using it decoratively elsewhere
would blur the one signal it currently carries.

## Layout

A single vertical column of tab rows, newest-first, capped at
`max-width: 32rem` (`.patient-drawer`), with no grid — just a flex
column (`gap: 0.6rem`) of `<li>` tab rows under one `<ul>`. The pinned
"+ New chart" tab always renders first, above every patient tab. No
responsive breakpoints exist yet in the shipped CSS; the layout is a
narrow single-column drawer regardless of viewport, which happens to
suit the in-room, at-hand-device use case described in PRODUCT.md
without yet encoding a deliberate breakpoint strategy.

Internal tab padding is `0.85rem 1.25rem` (block/inline). The
open-form state tightens to `1rem 1.25rem` with a `0.75rem` gap between
form rows.

## Elevation & Depth

Flat, with one deliberate exception: every tab (patient or new-chart)
carries a single flat, non-blurred offset shadow — `box-shadow: 0 2px 0
rgba(38, 34, 32, 0.18)` — standing in for a folder edge, not ambient
light. There is no blur radius anywhere in the shipped shadow value and
no elevation change on hover/focus. This is the confirmed direction
("thin folder-edge shadow only, no literal paper grain"), not an
invented decorative device — it is the one place the system departs
from pure flatness, and it departs on purpose.

### Shadow Vocabulary
- **Folder-edge** (`box-shadow: 0 2px 0 rgba(38, 34, 32, 0.18)`): every
  tab row, patient or new-chart, in any state.

### Named Rules

**The One Shadow Rule.** There is exactly one shadow value in the
system, used identically on every tab. Don't introduce blur, layered
shadows, or hover-elevation — the folder-edge shadow is flat by
definition.

## Shapes

**The Flipped-Tab Radius.** Every tab (`patient-tab`, `new-chart-tab`)
uses an asymmetric radius — `border-radius: 0 10px 10px 0` — square on
the left where the spine sits, rounded on the right, the physical
silhouette of a folder tab. This is the system's one recurring
geometric signature; it does not appear anywhere else (buttons and
inputs use ordinary symmetric radii: `6px` for buttons, `4px` for the
text input).

Borders are thin and low-contrast: `1px solid rgba(38, 34, 32, 0.1)`
frames a patient tab; `1px solid rgba(38, 34, 32, 0.25)` frames inputs
and the secondary button. The tab spine itself is a `6px` solid (or
`dashed`, for the unopened blank tab) left border in the role color —
the spine is a border, not a background fill.

## Components

### Buttons
- **Shape:** symmetric `6px` radius, `0.5rem 1rem` padding, `font-weight: 600`.
- **Primary:** teal background (`#3e6e5e`), ivory text (`#f5f1e6`) — the
  new-chart form's "Save" submit.
- **Secondary/Ghost:** transparent background, `1px solid rgba(38, 34,
  32, 0.25)` border, ink text — the form's "Cancel" button. No hover or
  focus-visible treatment is defined yet in the shipped CSS for either
  variant.

### Cards / Tabs (signature component)
- **Corner Style:** flipped `0 10px 10px 0` radius (see Shapes).
- **Background:** `#fff9ec` (tab cream) for a real patient tab and the
  opened new-chart tab; `transparent` (showing the kraft ground through)
  for the closed, unopened new-chart tab.
- **Shadow Strategy:** the one folder-edge shadow (see Elevation).
- **Border:** `6px` colored left spine (teal solid for a patient,
  rust dashed/solid for the blank tab) plus a faint `1px` hairline
  outline on real patient tabs only.
- **Internal Padding:** `0.85rem 1.25rem` (closed/patient); `1rem
  1.25rem` when the new-chart tab is open and showing its form.

### Inputs / Fields
- **Style:** `1px solid rgba(38, 34, 32, 0.25)` border, `4px` radius,
  monospace type for the reference field, transparent background.
- **Error:** validation text renders below the form in `#a3352b`
  (danger), `0.85rem`, with `role="alert"`. No visual error state
  (border color change, etc.) is applied to the input itself yet — only
  the message text is styled.
- **Focus:** no custom focus-visible treatment is defined in the
  shipped CSS; inputs currently rely on browser default focus styling.

### Navigation
No navigation chrome exists yet — the shipped app is a single surface
(`App.tsx` renders either `SignInForm` or `PatientListPage` with no
header, nav, or route chrome). Not documented because it doesn't exist
yet, not because it was rejected.

## Do's and Don'ts

### Do:
- **Do** keep the flipped `0 10px 10px 0` radius exclusive to tab-shaped
  rows (patient tabs, the new-chart tab) — it's the system's one
  signature silhouette, not a general card radius.
- **Do** keep the folder-edge shadow flat (`0 2px 0`, no blur) on every
  tab; it is the system's only shadow.
- **Do** reserve monospace (`--font-label`) for chart-identity data
  (reference, date) — never for headings, buttons, or body copy.
- **Do** keep filing color (rust, `#b0473c`) and the institutional
  accent (teal, `#3e6e5e`) semantically separate — spine color signals
  "committed record vs. blank tab," never clinical risk.

### Don't:
- **Don't** add a drop-shadow, blur, or hover-elevation to a tab — the
  system uses exactly one flat offset shadow, on purpose (direction
  contract: "thin folder-edge shadow only, no literal paper grain").
- **Don't** introduce a second accent color for a new UI role without
  checking it against the existing teal/rust split first — the palette
  is currently two functional hues plus neutrals, not an open set.
- **Don't** treat `SignInForm`'s inline, unstyled markup as part of this
  system. It's explicitly out of scope for the Tabbed Chart Binder
  direction and still needs its own design pass — don't copy its plain
  form styling into a new patient-facing surface.
- **Don't** carry the unused `#C9A15A` gold filing color from the
  direction contract into new work as if it shipped — it never appears
  in the build; only `#b0473c` does.
