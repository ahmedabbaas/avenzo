# AVENZO Engineering Guardrails

These rules are permanent project constraints for every engineering task.

## 1. Inspect before changing

Before modifying an existing area, inspect its current route, components, data flow,
styles, database/RLS dependencies, mobile behavior, and tests. Do not begin with a
rewrite just because a different implementation looks cleaner.

When the architecture is not already understood, produce a short architecture/risk
report before implementation.

## 2. Preserve working product behavior

Use this decision order:

**Improve > Preserve > Replace**

- Reuse an existing component before creating a duplicate.
- Extend the existing architecture before introducing a parallel architecture.
- Fix root causes instead of stacking temporary workarounds.
- Do not remove or rebuild a working feature without a concrete technical reason.
- If a rewrite is necessary, document why, what can regress, and how regression is
  prevented before changing it.

## 3. Phase changes

Meaningful work should be split into focused phases. After every phase run the full
review loop before proceeding:

1. Architecture and code review
2. Functional and edge-case review
3. UI/alignment/spacing review
4. Typography/icon consistency review
5. Responsive/mobile parity review
6. Accessibility review
7. Security/auth/RLS/data-exposure review
8. Performance/network/render/query review
9. Regression review
10. Fix discovered issues, then report remaining risks

## 4. Visual system

The final visual authority for authenticated product surfaces is
`app/avenzo-design-system.css`.

Do not append another competing global theme block to `app/globals.css`.
Use centralized tokens for colors, spacing, radius, shadows, typography, and motion.

The current AVENZO palette intentionally avoids the legacy lime theme. Web and
Android must remain visually aligned.

## 5. Web and Android parity

AVENZO Android is a Capacitor shell over the production web app with native/mobile
CSS and JavaScript enhancements. A user-facing visual or navigation change must be
checked in both:

- Web responsive UI
- `mobile-shell/app-mobile.css`
- Capacitor/native chrome where relevant

Do not fix web by silently breaking the APK, or vice versa.

## 6. Security and data

- Preserve Supabase RLS and authorization checks.
- Never trust client-provided IDs or privileged flags.
- Never expose service-role credentials in browser/mobile code.
- Validate uploads and user input at the strongest practical boundary.
- Keep auth, MFA, rate limiting, block/privacy rules, and message permissions intact.
- Database migrations should be additive/reversible where practical and reviewed for
  policy/index/regression impact.

## 7. Definition of done

A task is not complete merely because it renders or compiles. It must be functional,
visually intentional, responsive, accessible, secure, performant, maintainable,
tested, and integrated with existing architecture.

Before reporting completion, run the repository quality gate and explicitly note any
remaining risk that could not be verified automatically.
