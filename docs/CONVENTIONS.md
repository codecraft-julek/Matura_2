# Ogarnij Maturę 2.0 — conventions for the Vue app

Read with `docs/MIGRATION-PLAN.md`. The old Next.js app (`~/Documents/Web-Projects/Matura`) is the
functional source of truth: same data calls, same limits, same Polish copy (improved where the plan says UX).

## Stack and aliases

- Vue 3.5 `<script setup>` (JS), Vite 8, vue-router 4 (history mode), pinia, supabase-js, zod 4, Lucide (`@lucide/vue`).
- `@/` → `src/`, `@shared/` → `supabase/functions/_shared/` (zod schemas, rubrics, limits shared with Edge Functions).
- TS files copied 1:1 from the old app stay TS (`src/config/*.ts`, `src/lib/**/*.ts`); import them from JS as usual.
- No `v-html` for anything that comes from users or AI. Render parsed structures (`parseTutorText`, note blocks…) as elements.

## Where things live

| What | Where |
|---|---|
| Route table + guard (session, onboarding, `?next=`) | `src/router/index.js` (all routes already exist) |
| Supabase client (one) | `import { supabase } from '@/lib/supabase'` |
| Edge Functions | `@/lib/ai` (`streamEssayFeedback`, `streamTutorReply`, `streamNote`, `streamFlashcards`, `gradeOpenAnswers`, `startCheckout`, `openBillingPortal`), generic `callEdge` / `streamEdge` in `@/lib/edge` |
| Data functions per feature | `src/lib/api/<feature>.js` — thin async functions over `supabase.from(...)`/`rpc(...)` that **throw** on read errors and return `{ ok, error }` for writes |
| URLs | `ROUTES`, `examRoutes`, `essayRoute`, … from `@/config/routes` (never hard-code paths) |
| Session + profile | `useAuthStore()` → `user`, `email`, `profile`, `ensureProfile(force)`, `patchProfile(values)`, `signOut(scope)` |
| Plan + AI limits | `useBillingStore()` → `loadBilling()`, `loadAllowances()`, `allowanceFor('essay_feedback'|'tutor'|'open_grading'|'notes'|'flashcards')`, `refreshAllowances()` (call after every AI use or 429) |
| Toasts / confirm | `useUiStore()` → `toast(msg, 'ok'|'error'|'info')`, `await confirm({ title, body, confirmLabel, danger })` (never `window.confirm`) |
| Docked tutor | `useUiStore().setTutorDocked(true/false)` reserves `--tutor-w` on the right (≥1024px) |
| Ratings 👍/👎 | `<AiRating kind targetId :initial question variant>` + `myRating`, `myRatings` from `@/lib/api/ratings` |
| Formatting | `@/lib/format` (`formatDate`, `formatDateTime`, `timeAgo`, `plural`, `count`, `countWords`) |
| Page data | `useAsync(loader, { watch })` → `{ data, loading, error, reload }` from `@/composables/useAsync` |
| Titles | route `meta.title`; data-dependent: `usePageTitle(() => deck.value?.name)` |
| Drafts | `useDraft(key, initial)` (localStorage) |
| Polling | `usePolling(() => isPending, check, { interval: 3000 })` |

## UI kit (`src/ui/`, shared — do not edit, add feature components under `src/components/<feature>/`)

`AppField` (label/hint/error/counter, slot gets `{ id, describedby, invalid }`), `AppDialog` (native `<dialog>`, `v-model:open`, `#actions` slot),
`PageSkeleton`, `EmptyState` (icon, title, text, CTA slot), `ErrorState` (`@retry`), `StatTile`, `AiRating`, `AllowanceNote`,
`Captcha` (`@token`, `:reset-key`; `captchaEnabled` export), `PasswordInput` (`v-model`, `strength`), `BrandLink`.

## CSS (`src/style.css` + `src/styles/app.css`)

- Buttons: `.button` + `.button-dark` (primary) / `.button-lime` (highlight CTA) / `.button-outline` (secondary) / `.button-danger` / `.button-ghost`; size `.button-sm`, `.button-large`; `.icon-button`, `.text-button`, `.link`.
- Layout: `.page-header` (h1 + p, optional `.page-kicker`, `.breadcrumbs`), `.section-title`, `.section-gap`, `.stack`, `.row`, `.row-between`, `.grid-2`, `.grid-3`, `.stat-grid`.
- Surfaces: `.card` (+ `.card-tinted` green, `.card-purple` AI, `.card-sand` flashcards, `.card-dark`), `.card-link`, `.card-title`, `.card-meta`, `.list` + `.list-row`.
- Forms: `.form`, `.field`, `.input`, `.textarea`, `.select`, `.chip-group` + `.chip` (wrap a hidden checkbox/radio), `.tabs`, `.check-row`, `.form-actions`, `.field-error`, `.field-hint`.
- Feedback: `.alert` + `-error|-ok|-warn|-info`, `.badge` + `-ok|-warn|-error|-info|-lime|-dark`, `.progress > span`, `.skeleton`.
- Tokens only (no new hex colours in components unless they are tints of existing palette): `--green`, `--lime`, `--paper`, `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-strong`, `--text`, `--text-soft`, `--accent`, `--ok/-bg/-line`, `--warn/-bg/-line`, `--error/-bg/-line`, `--info/-bg/-line`, `--radius-sm|--radius|--radius-lg`, `--shadow-sm|--shadow|--shadow-pop`, `--heading` (Manrope), body font DM Sans.
- Colour roles: AI = purple tints (`.card-purple`, `--info`), flashcards = sand (`.card-sand`), exams = green tints (`.card-tinted`). Correct = `--ok`, partial/“do porównania” = `--warn`, wrong = `--error`. Text on lime is always `--green`.
- Inputs are 16px on mobile (no iOS zoom). Feature CSS goes in `<style scoped>`.
- Print: elements with `.no-print` are hidden; the app header/bottom bar hide automatically.

## Page pattern

```vue
<script setup>
import { useRoute } from 'vue-router'
import { useAsync } from '@/composables/useAsync'
import PageSkeleton from '@/ui/PageSkeleton.vue'
import ErrorState from '@/ui/ErrorState.vue'
import EmptyState from '@/ui/EmptyState.vue'
import { listDecks } from '@/lib/api/flashcards'
const { data, loading, error, reload } = useAsync(() => listDecks())
</script>
<template>
  <PageSkeleton v-if="loading && !data" />
  <ErrorState v-else-if="error" @retry="reload" />
  <template v-else>
    <header class="page-header"><div><span class="page-kicker">Fiszki</span><h1>Twoje talie<span class="accent-dot">.</span></h1><p>…</p></div> <RouterLink class="button button-dark" …>…</RouterLink></header>
    <EmptyState v-if="!data.length" … />
    …
  </template>
</template>
```

- A row that does not exist (RLS hides it or bad id) → render `NotFound` (`import NotFound from '@/pages/NotFound.vue'`) in place, don't redirect.
- After a write: update local state (or `reload()`), never full-page reload.
- Network errors in writes: show an inline `.alert-error` or a toast, keep the user's input.
- Accessibility: one `h1` per page, `aria-live` for async messages, focus the heading after step changes, buttons have text or `aria-label`.
- Copy: Polish, short, friendly, no jargon (old app texts are the baseline).

## Rules for parallel work

- Only edit files in your assigned area. Shared files (`src/router`, `src/stores`, `src/ui`, `src/styles`, `src/lib/edge.js`, `src/lib/ai.js`, `src/layouts`, `src/config`) are owned by the integrator: if you need a change there, describe it in your final report instead.
- Don't run `npm install`, don't commit, don't touch `supabase/` (backend stays unchanged).
- Verify with `npx vite build` (errors in files outside your area may come from another agent working in parallel — ignore those) and `npx vitest run`.
