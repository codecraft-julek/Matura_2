<script setup>
// The public homepage (logged-in students are sent to /panel by the router guard).
// Real calls to action: signup, login, checkout; the public demo exam (/trening/polski-2026) and
// the DemoDialog showcase stay for visitors who want to look around without an account.
//
// Looks: one accent (lime), hairlines and type do the work. No entrance animations, no decorative
// motion: hover states only say "this is a link / a button".
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowUpRight, BookOpen, Check, Clock, FileCheck2, FileText, Heart, Layers, MessageCircle, NotebookPen, Play, Plus, RotateCw, Sparkles, WandSparkles } from '@lucide/vue'
import ProductPreview from '@/components/ProductPreview.vue'
import DemoDialog from '@/components/DemoDialog.vue'
import PlanCards from '@/components/premium/PlanCards.vue'
import { faqs } from '@/data'
import { EXAM_ROUTE } from '@/exam/examData'
import { ROUTES } from '@/config/routes'
import { SITE } from '@/config/site'
import { PAGE_SEO, homeJsonLd } from './seo'
import { useSeo } from './useSeo'

useSeo(() => ({ ...PAGE_SEO.home, jsonLd: homeJsonLd(faqs, SITE.url) }))

const router = useRouter()
const demo = ref(null)
const featureFlipped = ref(false)
const openFaq = ref(null)

function openDemo(tab = 'exercise') {
  if (tab === 'exercise') router.push(EXAM_ROUTE)
  else demo.value.open(tab)
}
</script>

<template>
  <div class="landing">
    <section class="hero container" aria-labelledby="hero-heading">
      <div class="hero-copy">
        <p class="hero-eyebrow">Matura 2027 i 2028 <span class="eyebrow-divider"></span> polski, angielski, biologia</p>
        <h1 id="hero-heading">Matura?<br />Spokojnie,<br /><span class="highlight-word">ogarniesz.</span></h1>
        <p class="hero-description">Prawdziwe arkusze CKE sprawdzane od razu, feedback AI do wypracowań, notatki i fiszki. Twój plan na maturę. Bez spiny.</p>
        <div class="hero-buttons">
          <RouterLink class="button button-lime button-large button-arrow" :to="ROUTES.signup">Załóż darmowe konto <ArrowUpRight :size="20" /></RouterLink>
          <RouterLink class="hero-secondary" :to="EXAM_ROUTE"><span class="play-icon"><Play :size="13" fill="currentColor" /></span> Wypróbuj bez konta</RouterLink>
        </div>
        <div class="hero-reassurance"><span><Check :size="14" /> Bez karty płatniczej</span><span><Check :size="14" /> Arkusze i fiszki bez limitu</span></div>
        <p class="hero-login">Masz już konto? <RouterLink :to="ROUTES.login" class="link">Zaloguj się</RouterLink></p>
      </div>
      <ProductPreview @open-demo="openDemo" />
    </section>

    <div class="benefits-strip"><div class="container benefits-inner"><span><FileCheck2 :size="20" /> Arkusze CKE 2023–2026</span><i></i><span><BookOpen :size="20" /> Polski, angielski, biologia</span><i></i><span><Heart :size="20" /> Twoje tempo</span></div></div>

    <section id="narzedzia" class="tools-section section-spacing container" aria-labelledby="tools-heading">
      <div class="section-label"><span>Narzędzia</span><span>4 narzędzia, jeden cel</span></div>
      <h2 id="tools-heading" class="landing-title">Mniej zakuwania.<br />Więcej ogarniania.</h2>
      <div class="tool-grid">
        <article class="tool-card worksheet-card">
          <div class="tool-head"><span class="tool-icon"><FileText :size="21" /></span><h3>Arkusze.<br />Bez niespodzianek.</h3></div>
          <p>Majowe arkusze CKE 2023–2026. Sprawdzasz od razu według klucza.</p>
          <div class="worksheet-mini" aria-hidden="true"><div class="mini-sheet-top"><span>Język polski · maj 2026</span><span>CKE</span></div><strong>Zadanie 3. Prawda czy fałsz?</strong><div class="mini-sheet-lines"><i></i><i></i><i></i></div><div class="mini-sheet-bottom"><span><Check :size="12" /> 1/1 pkt według klucza</span><span>zadanie 3 z 21</span></div></div>
          <RouterLink class="tool-link" :to="EXAM_ROUTE">Rozwiąż przykładowy trening</RouterLink>
        </article>
        <article class="tool-card feedback-card">
          <div class="tool-head"><span class="tool-icon"><WandSparkles :size="21" /></span><h3>Twój tekst.<br />Konkretny feedback.</h3></div>
          <p>Kryterium po kryterium według zasad CKE. Wiesz, co poprawić.</p>
          <div class="feedback-mini" aria-hidden="true"><div><span class="mini-check"><Check :size="14" /></span><p><strong>Trafny argument</strong><br />Dobrze dobrana lektura.</p></div><div><span class="mini-lightbulb"><Sparkles :size="14" /></span><p><strong>Dodaj kontekst</strong><br />Wzmocnij swoją tezę.</p></div></div>
          <button type="button" class="tool-link" @click="openDemo('essay')">Zobacz przykładowy feedback</button>
        </article>
        <article class="tool-card notes-card">
          <div class="tool-head"><span class="tool-icon"><NotebookPen :size="21" /></span><h3>Zdjęcie zeszytu.<br />Gotowa notatka.</h3></div>
          <p>Zdjęcie, PDF albo prezentacja. Dostajesz oś czasu, mapę myśli i quiz.</p>
          <div class="notes-mini" aria-hidden="true"><span class="mini-notes-label">Oś czasu · romantyzm</span><ol><li><b>1822</b> „Ballady i romanse”</li><li><b>1830</b> powstanie listopadowe</li><li><b>1864</b> koniec powstania styczniowego</li></ol></div>
          <RouterLink class="tool-link" :to="ROUTES.signup">Zrób pierwszą notatkę</RouterLink>
        </article>
        <article class="tool-card flashcards-card">
          <div class="tool-head"><span class="tool-icon"><Layers :size="21" /></span><h3>Mała powtórka.<br />Dużo w głowie.</h3></div>
          <p>Z PDF-a, strony albo filmu. Powtórki układają się same.</p>
          <div class="mini-flashcard-stack"><button type="button" class="mini-flashcard" :class="{ flipped: featureFlipped }" :aria-label="featureFlipped ? 'Pokaż pytanie na fiszce' : 'Odwróć przykładową fiszkę'" @click="featureFlipped = !featureFlipped"><span>Lalka · szybka powtórka</span><strong>{{ featureFlipped ? 'Bolesław Prus.' : 'Kto napisał „Lalkę”?' }}</strong><span class="flip-caption"><RotateCw :size="12" /> {{ featureFlipped ? 'Ogarnięte' : 'Kliknij i odwróć' }}</span></button></div>
          <button type="button" class="tool-link" @click="openDemo('flashcards')">Odpal przykładowe fiszki</button>
        </article>
      </div>
      <div class="more-tools"><span>I jeszcze:</span><span><Clock :size="16" /> Egzamin na czas</span><span><MessageCircle :size="16" /> Tutor AI przy zadaniu</span><span><Layers :size="16" /> Import z Quizletu i Anki</span></div>
    </section>

    <section id="jak-to-dziala" class="how-section" aria-labelledby="how-heading">
      <div class="container how-inner">
        <div class="section-label"><span>Jak to działa</span><span>Trzy kroki</span></div>
        <h2 id="how-heading" class="landing-title">Mały krok. Duży progres.</h2>
        <ol class="steps">
          <li class="step"><span class="step-no">01</span><h3>Załóż darmowe konto.</h3><p>Pół minuty, bez karty płatniczej.</p></li>
          <li class="step"><span class="step-no">02</span><h3>Poćwicz po swojemu.</h3><p>Arkusz, wypracowanie, notatka czy fiszki? Pięć minut też robi różnicę.</p></li>
          <li class="step"><span class="step-no">03</span><h3>Sprawdź. I ogarnięte.</h3><p>Wynik według klucza CKE i konkretne wskazówki, co dalej.</p></li>
        </ol>
      </div>
    </section>

    <section class="about-section container" aria-labelledby="about-heading">
      <div class="section-label"><span>Kto za tym stoi</span><span>Od maturzystów</span></div>
      <div class="about-grid">
        <h2 id="about-heading">Dwójka studentów, którzy dopiero co sami zdawali maturę.</h2>
        <p>Pamiętamy czekanie tydzień na sprawdzone wypracowanie, więc robimy narzędzie, którego nam wtedy brakowało. Coś nie działa albo masz pomysł? <RouterLink :to="ROUTES.contact" class="link">Napisz do nas</RouterLink>, czytamy każdą wiadomość.</p>
      </div>
    </section>

    <section id="cennik" class="pricing-section section-spacing" aria-labelledby="pricing-heading">
      <div class="container">
        <div class="section-label"><span>Cennik</span><span>Płatności obsługuje Stripe</span></div>
        <div class="pricing-head">
          <h2 id="pricing-heading" class="landing-title">Dobry start kosztuje zero.</h2>
          <p class="pricing-lead">Arkusze CKE i fiszki są darmowe bez limitu. Premium daje więcej narzędzi AI, kiedy nauka przyspiesza.</p>
        </div>
        <PlanCards variant="landing" />
        <p class="pricing-source">Nie widzimy danych Twojej karty. Fakturę i anulowanie załatwisz w panelu, bez pisania do nas.</p>
      </div>
    </section>

    <section id="faq" class="faq-section section-spacing container" aria-labelledby="faq-heading">
      <div class="faq-heading">
        <div class="section-label"><span>Pytania</span></div>
        <h2 id="faq-heading" class="landing-title">Jeszcze jakieś pytania?</h2>
        <p>Nie ma tu Twojego? <RouterLink :to="ROUTES.contact" class="link">Napisz do nas</RouterLink>.</p>
      </div>
      <div class="faq-list">
        <article v-for="(faq, index) in faqs" :key="faq.question" class="faq-item" :class="{ open: openFaq === index }">
          <h3><button type="button" :aria-expanded="openFaq === index" :aria-controls="`faq-answer-${index}`" @click="openFaq = openFaq === index ? null : index"><span>{{ faq.question }}</span><Plus :size="20" /></button></h3>
          <div :id="`faq-answer-${index}`" class="faq-answer" :aria-hidden="openFaq !== index"><div><p>{{ faq.answer }}</p></div></div>
        </article>
      </div>
    </section>

    <section class="final-cta container" aria-labelledby="cta-heading">
      <div class="cta-copy">
        <h2 id="cta-heading">To co, ogarniamy?</h2>
        <RouterLink class="button button-dark button-large button-arrow" :to="ROUTES.signup">Zakładam konto <ArrowUpRight :size="20" /></RouterLink>
        <span class="cta-footnote">Bez karty płatniczej. Zajmie Ci pół minuty.</span>
      </div>
    </section>
  </div>
  <DemoDialog ref="demo" />
</template>

<style scoped>
.hero-login { margin-top: 16px; font-size: 14px; color: var(--muted); }

/* Four tools in an uneven grid: the free sheets get the wide card, flashcards the other one. */
.tool-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.worksheet-card { grid-column: span 2; }
.flashcards-card { grid-column: span 2; }
@media (min-width: 1101px) {
  .worksheet-card .worksheet-mini { max-width: 520px; }
  .flashcards-card .mini-flashcard-stack { max-width: 420px; }
}
@media (max-width: 1100px) {
  .tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .worksheet-card, .flashcards-card { grid-column: span 2; }
}
@media (max-width: 680px) {
  .tool-grid { grid-template-columns: 1fr; }
  .worksheet-card, .flashcards-card { grid-column: auto; }
}

.notes-mini { margin-top: 24px; margin-bottom: 26px; padding: 16px 18px; background: var(--paper); border: 1px solid var(--border); border-radius: 12px; }
.mini-notes-label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); }
.notes-mini ol { list-style: none; margin: 12px 0 0 4px; padding: 0 0 0 16px; border-left: 2px solid #c9df8a; display: flex; flex-direction: column; gap: 10px; }
.notes-mini li { position: relative; font-size: 13.5px; color: #4f5c4b; line-height: 1.4; }
.notes-mini li::before { content: ''; position: absolute; left: -22px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--lime); border: 2px solid #8daf45; }
.notes-mini b { font-family: var(--heading); color: var(--green); margin-right: 6px; font-variant-numeric: tabular-nums; }

.about-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 40px 64px; align-items: start; padding-top: 36px; }
.about-grid h2 { font-size: clamp(28px, 3.2vw, 38px); line-height: 1.2; letter-spacing: -1.3px; font-weight: 700; text-wrap: balance; }
.about-grid p { font-size: 16px; line-height: 1.75; color: #566355; max-width: 52ch; }
@media (max-width: 850px) { .about-grid { grid-template-columns: 1fr; gap: 20px; padding-top: 28px; } }

.pricing-head { display: flex; justify-content: space-between; align-items: end; gap: 40px; }
.pricing-lead { max-width: 44ch; font-size: 16px; line-height: 1.65; color: #566355; margin-bottom: 6px; }
@media (max-width: 850px) { .pricing-head { flex-direction: column; align-items: start; gap: 14px; } }
</style>
