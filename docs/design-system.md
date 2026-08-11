# Transformation Cockpit design system

## Product character

The cockpit uses the current Eraneos visual language: restrained black and warm-neutral surfaces, orange as the product accent, generous editorial headings and compact operational density. Status colour is semantic and never reused as branding. Every status must also have a text label.

## Canonical tokens

Tokens live in `src/app/globals.css`; components must consume them instead of introducing local approximations.

| Purpose | Token | Contract |
| --- | --- | --- |
| Brand text | `--brand-ink` | Primary text and dark navigation surface |
| Canvas | `--brand-warm-gray` | Public, workspace and cockpit background |
| Accent | `--brand-orange` / `--brand-orange-deep` | Primary action, selected state and focus emphasis |
| Surfaces | `--paper`, `--surface-subtle`, `--surface-raised` | Cards, panels and grouped controls |
| Boundaries | `--line`, `--soft-line` | Structural and internal separation |
| Semantic state | `--success`, `--amber`, `--red`, `--unknown` | Health only; always paired with visible text |
| Focus | `--focus-ring` | Keyboard-visible focus; never remove without an equivalent |
| Spacing | `--space-1` through `--space-6` | 4–32 px rhythm |
| Radius | `--radius-sm` through `--radius-lg` | Controls, panels and hero surfaces |

## Status language

- Green: evidence shows the item is within agreed tolerance.
- Amber: attention is required, but a recovery decision is not yet critical.
- Red: accountable decision or recovery is required.
- Unknown: evidence is missing, stale or not assessed. Unknown must never be rendered or aggregated as green.

## Reusable interaction contracts

- `.button`: minimum target, disabled state, focus state and primary/secondary/ghost hierarchy.
- `.panel`: standard governed content boundary.
- `.section-kicker`: compact context label; never the only heading.
- `.error-banner` / `.success-banner`: announced state with a named dismiss action.
- `.rag-*`, `.status-*`, `.trend-*`: semantic colour plus visible text.
- `.context-help`: non-modal contextual guidance; opens with focus, closes on Escape and restores focus.
- `.first-use-guide`: dismissible, browser-local guidance; it does not change project or governance state.

## Responsive and accessibility baseline

- Desktop: persistent 256 px navigation and full action hierarchy.
- Compact desktop/tablet below 1120 px: reduced navigation and content gutters.
- Mobile below 800 px: off-canvas navigation, compact top actions and single-column decision surfaces.
- All journeys require named controls, keyboard operation, visible focus, logical landmarks and WCAG AA contrast.
- `prefers-reduced-motion: reduce` suppresses non-essential animation and transitions.
- Forced-colour mode preserves selected state and health indicators.
- Charts, relationship maps and timelines must include text explanations and source references; decorative visualisation is not a substitute for governed values.

## Governance clarity

Use the same sequence everywhere: draft, proposal, review, publish. Explain missing evidence and blocked authority in plain language. Design must never conceal review state, object version, source record, confidence, actor or publication boundary for the sake of visual simplicity.
