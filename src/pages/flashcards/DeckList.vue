<script setup>
// /fiszki — the student's decks with card count and how many cards are due today.
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { CircleCheck, Layers, Plus, Repeat } from '@lucide/vue'
import { useAsync } from '@/composables/useAsync'
import { ROUTES, deckRoute, studyRoute } from '@/config/routes'
import { DECK_SOURCE, listDecks } from '@/lib/api/flashcards'
import { count } from '@/lib/format'
import { useBillingStore } from '@/stores/billing'
import AllowanceNote from '@/ui/AllowanceNote.vue'
import EmptyState from '@/ui/EmptyState.vue'
import ErrorState from '@/ui/ErrorState.vue'
import PageSkeleton from '@/ui/PageSkeleton.vue'

const CARDS = ['fiszka', 'fiszki', 'fiszek']
const billing = useBillingStore()
const { data: decks, loading, error, reload } = useAsync(() => listDecks())
onMounted(() => billing.loadAllowances().catch(() => {}))
const dueTotal = computed(() => (decks.value ?? []).reduce((n, d) => n + d.due, 0))
</script>

<template>
  <PageSkeleton v-if="loading && !decks" />
  <ErrorState v-else-if="error" @retry="reload" />
  <template v-else>
    <header class="page-header">
      <div>
        <span class="page-kicker"><Layers :size="14" /> Fiszki</span>
        <h1>Twoje fiszki<span class="accent-dot">.</span></h1>
        <p>Zrób fiszki z PDF-a, Worda, prezentacji, zdjęć, strony albo filmu na YouTube. Powtórki układają się same: fiszka wraca wtedy, kiedy zaczynasz ją zapominać.</p>
      </div>
      <div class="header-cta">
        <RouterLink :to="ROUTES.newDeck" class="button button-dark"><Plus :size="18" /> Nowa talia</RouterLink>
        <AllowanceNote :allowance="billing.allowanceFor('flashcards')" />
      </div>
    </header>

    <EmptyState v-if="!decks.length" :icon="Layers" title="Nie masz jeszcze fiszek" text="Wgraj prezentację z lekcji albo zdjęcie notatek i zobacz, co z tego wyjdzie.">
      <RouterLink :to="ROUTES.newDeck" class="button button-dark">Zrób pierwszą talię</RouterLink>
    </EmptyState>

    <template v-else>
      <div class="card card-sand due-banner" :class="{ 'all-done': dueTotal === 0 }">
        <span class="due-icon" aria-hidden="true"><Repeat v-if="dueTotal" :size="20" /><CircleCheck v-else :size="20" /></span>
        <p><span class="muted">Do powtórki dziś:</span> <strong class="tabular">{{ dueTotal }}</strong> <span v-if="dueTotal === 0" class="muted">— wszystko powtórzone, brawo!</span></p>
      </div>

      <section aria-labelledby="decks-title" class="section-gap" style="margin-top: 26px">
        <h2 id="decks-title" class="section-title">Twoje talie</h2>
        <ul class="deck-grid">
          <li v-for="d in decks" :key="d.id" class="deck-card">
            <RouterLink :to="deckRoute(d.id)" class="deck-link">
              <span class="deck-title">{{ d.title }}</span>
              <span class="card-meta">{{ count(d.cards, CARDS) }} · {{ DECK_SOURCE[d.source_kind] ?? d.source_kind }}</span>
            </RouterLink>
            <div class="deck-foot">
              <RouterLink v-if="d.due > 0" :to="studyRoute(d.id)" class="button button-dark button-sm"><Repeat :size="15" /> Powtórz {{ d.due }}</RouterLink>
              <span v-else class="badge badge-ok"><CircleCheck :size="13" /> na dziś gotowe</span>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </template>
</template>

<style scoped>
.header-cta { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
@media (max-width: 760px) { .header-cta { align-items: flex-start; } }
.due-banner { display: flex; align-items: center; gap: 14px; padding: 16px 20px; }
.due-banner p { font-size: 15px; }
.due-banner strong { font-family: var(--heading); font-size: 22px; letter-spacing: -.5px; }
.due-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: #eae2cc; color: #99885f; flex-shrink: 0; }
.all-done .due-icon { background: var(--ok-bg); color: var(--ok); }
.deck-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
.deck-card { position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 16px; padding: 18px; border-radius: var(--radius-lg); background: #fffcf5; border: 1px solid #e9e0ce; box-shadow: var(--shadow-sm); transition: transform .2s, box-shadow .2s; }
.deck-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
.deck-link { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
/* The whole card opens the deck; the study button sits above that link. */
.deck-link::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
.deck-link:focus-visible { outline: none; }
.deck-link:focus-visible::after { outline: 3px solid var(--focus); outline-offset: 3px; }
.deck-title { font-family: var(--heading); font-weight: 750; font-size: 17px; line-height: 1.35; letter-spacing: -.3px; overflow-wrap: anywhere; }
.deck-foot { position: relative; z-index: 1; display: flex; }
</style>
