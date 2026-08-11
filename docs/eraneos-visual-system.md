# Eraneos visual system

The Transformation Cockpit uses the current Eraneos visual language as an enterprise-product system: warm neutral surfaces, near-black typography, generous whitespace, precise geometry and a restrained orange interaction accent. The application does not reproduce the Eraneos marketing-site layout.

## Identity

- Product name: **eraneos Transformation Cockpit**
- Suite line: **part of OET AI Suite**
- The approved mark is stored at `public/brand/eraneos-mark.png`.
- The runtime has no dependency on the original Downloads location.
- The previous CSS-drawn glyph has been removed.

The supplied raster mark is the currently approved source. Replace it with an official vector asset when one is available; keep the same component API and accessible product label.

## Typography

The UI requests `Mona Sans` first and falls back to `Segoe UI`, Arial and Helvetica. No font file is bundled. Mona Sans or Eraneos Display must only be added when Eraneos supplies a web-licensed, distributable font package. Eraneos Display is reserved for expressive editorial headings and is not required for cockpit operation.

## Tokens

Brand and semantic tokens are centralized in `src/app/globals.css`:

| Token | Purpose |
| --- | --- |
| `--brand-ink` | Primary text and dark navigation |
| `--brand-warm-gray` | Application canvas |
| `--brand-orange` | Primary interaction and brand accent |
| `--brand-orange-deep` | Hover states and accessible accent text |
| `--paper` | Elevated surfaces |
| `--line`, `--soft-line` | Structural separators |
| `--success`, `--amber`, `--red`, `--unknown` | Independent operational status colors |
| `--focus-ring` | Consistent keyboard focus treatment |

Orange communicates Eraneos identity and interaction. It must not replace green, amber, red or unknown in RAG, approval, workflow-health or governance states.

## Accessibility and responsive use

- Interactive controls expose a visible `:focus-visible` outline.
- Text and controls target WCAG 2.2 AA contrast.
- The shell retains desktop, tablet and mobile layouts.
- Status is communicated with labels in addition to color.
- Forced-colors mode retains borders and status markers.

## Asset provenance

The mark was supplied by the product owner from the Eraneos presentation asset set. No website images, CSS, fonts or other licensed material were copied from `eraneos.com`. The public website was used only as a visual reference.

