# ZM-PROD-16 — Mobile navigation and accessibility hardening

## Zielmodus instruction

Preserve the Eraneos visual system and all visible governance information while
making the project cockpit operable at mobile, tablet and desktop breakpoints.
Every navigation surface must expose its state and relationship, move keyboard
focus predictably, close with standard keyboard conventions and restore focus
to the initiating control. Reduced motion, visible focus, text-labelled status
and responsive decision context remain mandatory.

## Acceptance gate

- The mobile menu trigger identifies and controls the project navigation.
- Opening the menu moves focus to its close action.
- Escape and the close action dismiss the menu and return focus to the trigger.
- Existing heading-focus, contextual-help, reduced-motion, contrast and named
  control contracts remain green.
- Desktop, tablet and mobile visual coverage continues to preserve governance
  state and the Eraneos product hierarchy.

## Implementation status

Implemented locally on 2026-08-13. The focused accessibility and visual suite
passes 10/10, the release and Pages gates pass, and the dedicated Chromium and
Firefox compatibility suite passes 2/2. The complete browser run passed 109
tests and encountered one transient pre-application navigation abort in its
embedded compatibility case; the isolated mandatory compatibility rerun passed
both browsers without page errors. Release and live verification remain.
