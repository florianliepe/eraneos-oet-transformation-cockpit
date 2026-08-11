# ZM-PROD-04 — Cockpit usability and design refinement

## Objective

Raise the Transformation Cockpit to a consistent, accessible Eraneos product experience across desktop, tablet and mobile.

## Work package

1. Consolidate typography, spacing, colour, surface, status and interaction tokens.
2. Improve information density and hierarchy across overview, registers, review and operations.
3. Add global search, saved filters, configurable table columns and contextual cross-links.
4. Standardise loading, empty, error, success and recovery states.
5. Complete keyboard navigation, visible focus, semantic labels and contrast remediation.
6. Optimise responsive navigation and high-density tables for tablet and mobile.
7. Add visual regression coverage for primary workflows and states.

## Acceptance gate

- Primary cockpit workflows are usable at desktop, tablet and mobile breakpoints.
- Keyboard-only navigation reaches every interactive control.
- No critical automated accessibility or contrast violation remains.
- Visual snapshots cover normal, empty, loading, error and recovery states.

## Deployment outcome

Merge and deploy the verified design system and cockpit refinements before domain expansion.

## Implementation record

- Consolidated spacing, typography, surface, status, focus and motion-preference tokens while preserving the established Eraneos palette.
- Added keyboard-first global search across deliverables, risks, issues, actions, decisions, dependencies, assumptions, changes and meetings.
- Added reusable saved searches, Ctrl/Cmd+K activation, result cross-links into the owning cockpit view and explicit empty search guidance.
- Added persistent configurable columns for governed register cards.
- Added a skip link, semantic current-page navigation, named icon controls, live loading/error regions, replay confirmation and a mobile navigation scrim.
- Improved mobile search, dense register metadata and column configuration without removing desktop information density.
- Added automated keyboard-name and WCAG-AA token contrast checks plus visual captures for desktop, tablet, mobile, empty, loading, error and recovery-ready states.
