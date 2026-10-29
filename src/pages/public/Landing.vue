<script setup>
// The public homepage (logged-in students are sent to /panel by the router guard).
// Real calls to action: signup, login, checkout; the public demo exam (/trening/polski-2026) and
// the DemoDialog showcase stay for visitors who want to look around without an account.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, Clock, FileCheck2, FileText, GraduationCap, Heart, Layers, MessageCircle, NotebookPen, Play, Plus, RotateCw, Sparkles, WandSparkles } from '@lucide/vue'
import BrandMark from '@/components/BrandMark.vue'
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
let revealObserver

function openDemo(tab = 'exercise') {
  if (tab === 'exercise') router.push(EXAM_ROUTE)
  else demo.value.open(tab)
}

onMounted(() => {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          revealObserver.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08 })
    document.querySelectorAll('[data-reveal]').forEach((element) => {
      element.classList.add('will-reveal')
      revealObserver.observe(element)
    })
  }
})

onBeforeUnmount(() => {
  revealObserver?.disconnect()
})
</script>

<template>
  <div class="landing">
    <section class="hero container" aria-labelledby="hero-heading">
      <div class="hero-copy">
        <div class="hero-eyebrow"><span class="status-dot"></span> MATURA 2027 & 2028 <span class="eyebrow-divider"></span> POLSKI I ANGIELSKI</div>
        <h1 id="hero-heading">Matura?<br />Spokojnie,<br /><span class="highlight-word">ogarniesz.<svg viewBox="0 0 420 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 13Q190-2 414 8M36 18Q219 5 390 15" /></svg></span><BrandMark class="heading-spark" /></h1>
        <p class="hero-description">Prawdziwe arkusze CKE sprawdzane od razu,<br class="hide-narrow" /> feedback AI do wypracowań, notatki i fiszki.<br class="hide-narrow" /> Twój plan na maturę. Bez spiny.</p>
        <div class="hero-buttons">
          <RouterLink class="button button-lime button-large" :to="ROUTES.signup">Załóż darmowe konto <ArrowUpRight :size="21" /></RouterLink>
          <RouterLink class="hero-secondary" :to="EXAM_ROUTE"><span class="play-icon"><Play :size="13" fill="currentColor" /></span> Wypróbuj bez konta</RouterLink>
        </div>
        <div class="hero-reassurance"><span><Check :size="14" /> Bez karty płatniczej</span><span><Check :size="14" /> Arkusze i fiszki bez limitu</span></div>
        <p class="hero-login">Masz już konto? <RouterLink :to="ROUTES.login" class="link">Zaloguj się</RouterLink></p>
      </div>
      <ProductPreview @open-demo="openDemo" />
      <a class="hero-scroll" href="#narzedzia"><ArrowDown :size="14" /> ODKRYJ NARZĘDZIA</a>
    </section>

    <div class="benefits-strip"><div class="container benefits-inner"><span><FileCheck2 :size="20" /> Arkusze CKE 2023–2026</span><i></i><span><BookOpen :size="20" /> Polski i angielski</span><i></i><span><Heart :size="20" /> Twoje tempo</span></div></div>

    <section id="narzedzia" class="tools-section section-spacing container" aria-labelledby="tools-heading">
      <div class="section-heading" data-reveal><div><span class="eyebrow section-eyebrow"><span class="little-line"></span> TWÓJ TOOLKIT</span><h2 id="tools-heading">Mniej zakuwania.<br />Więcej <span class="text-muted-green">ogarniania.</span></h2></div><span class="section-aside">4 narzędzia. Jeden cel. <ArrowDown :size="18" /></span></div>
      <div class="tool-grid has-four">
        <article class="tool-card worksheet-card" data-reveal><div class="tool-topline"><span class="tool-icon"><FileText :size="23" /></span><span class="tool-number">01 / ARKUSZE</span></div><h3>Arkusze.<br />Bez niespodzianek.</h3><p>Majowe arkusze CKE 2023–2026. Sprawdzasz od razu według klucza.</p><div class="worksheet-mini" aria-hidden="true"><div class="mini-sheet-top"><span><span class="subject-dot"></span> Język polski</span><span>CKE</span></div><strong>Twój następny mały krok</strong><div class="mini-sheet-lines"><i></i><i></i></div><div class="mini-sheet-bottom"><span><Check :size="12" /> Twój rytm. Twój progres.</span><span class="small-round-arrow"><ArrowUpRight :size="16" /></span></div></div><RouterLink class="tool-link" :to="EXAM_ROUTE">Rozwiąż przykładowy trening <ArrowUpRight :size="19" /></RouterLink></article>
        <article class="tool-card feedback-card" data-reveal><div class="tool-topline"><span class="tool-icon"><WandSparkles :size="23" /></span><span class="tool-number">02 / FEEDBACK AI</span></div><h3>Twój tekst.<br />Konkretny feedback.</h3><p>Kryterium po kryterium według zasad CKE. Wiesz, co poprawić.</p><div class="feedback-mini" aria-hidden="true"><span class="mini-feedback-label"><Sparkles :size="13" /> TWÓJ FEEDBACK</span><div><span class="mini-check"><Check :size="14" /></span><p><strong>Trafny argument</strong><br />Dobrze dobrana lektura.</p></div><div><span class="mini-lightbulb"><Sparkles :size="14" /></span><p><strong>Dodaj kontekst</strong><br />Wzmocnij swoją tezę.</p></div></div><button type="button" class="tool-link" @click="openDemo('essay')">Zobacz przykładowy feedback <ArrowUpRight :size="19" /></button></article>
        <article class="tool-card notes-card" data-reveal><div class="tool-topline"><span class="tool-icon"><NotebookPen :size="23" /></span><span class="tool-number">03 / NOTATKI AI</span></div><h3>Zdjęcie zeszytu.<br />Gotowa notatka.</h3><p>Zdjęcie, PDF albo prezentacja. Dostajesz oś czasu, mapę myśli i quiz.</p><div class="notes-mini" aria-hidden="true"><span class="mini-notes-label"><Sparkles :size="12" /> OŚ CZASU · ROMANTYZM</span><ol><li><b>1822</b> „Ballady i romanse”</li><li><b>1830</b> powstanie listopadowe</li><li><b>1864</b> koniec powstania styczniowego</li></ol></div><RouterLink class="tool-link" :to="ROUTES.signup">Zrób pierwszą notatkę <ArrowUpRight :size="19" /></RouterLink></article>
        <article class="tool-card flashcards-card" data-reveal><div class="tool-topline"><span class="tool-icon"><Layers :size="23" /></span><span class="tool-number">04 / FISZKI</span></div><h3>Mała powtórka.<br />Dużo w głowie.</h3><p>Z PDF-a, strony albo filmu. Powtórki układają się same.</p><div class="mini-flashcard-stack"><div class="stack-back" aria-hidden="true"></div><button type="button" class="mini-flashcard" :class="{ flipped: featureFlipped }" :aria-label="featureFlipped ? 'Pokaż pytanie na fiszce' : 'Odwróć przykładową fiszkę'" @click="featureFlipped = !featureFlipped"><span>LALKA · SZYBKA POWTÓRKA</span><strong>{{ featureFlipped ? 'Bolesław Prus.' : 'Kto napisał „Lalkę”?' }}</strong><span class="flip-caption"><RotateCw :size="12" /> {{ featureFlipped ? 'Ogarnięte!' : 'Kliknij i odwróć' }}</span></button></div><button type="button" class="tool-link" @click="openDemo('flashcards')">Odpal przykładowe fiszki <ArrowUpRight :size="19" /></button></article>
      </div>
      <div class="more-tools" data-reveal><span>I jeszcze:</span><span><Clock :size="16" /> Egzamin na czas</span><span><MessageCircle :size="16" /> Tutor AI przy zadaniu</span><span><Layers :size="16" /> Import z Quizletu i Anki</span></div>
    </section>

    <section id="jak-to-dziala" class="how-section" aria-labelledby="how-heading"><div class="container how-inner"><div class="how-intro" data-reveal><div><span class="eyebrow section-eyebrow"><span class="little-line"></span> JAK TO DZIAŁA?</span><h2 id="how-heading">Mały krok. <span>Duży progres.</span></h2></div><BrandMark class="how-spark" /></div><div class="steps"><article class="step" data-reveal><div class="step-track"><span>01</span><i></i><ArrowRight :size="18" /></div><h3>Załóż darmowe konto.</h3><p>Pół minuty, bez karty płatniczej.</p></article><article class="step" data-reveal><div class="step-track"><span>02</span><i></i><ArrowRight :size="18" /></div><h3>Poćwicz po swojemu.</h3><p>Arkusz, wypracowanie, notatka czy fiszki? Pięć minut też robi różnicę.</p></article><article class="step" data-reveal><div class="step-track"><span>03</span><i></i><Check :size="18" /></div><h3>Sprawdź. I ogarnięte.</h3><p>Wynik według klucza CKE i konkretne wskazówki, co dalej.</p></article></div></div></section>

    <section class="about-section container" aria-labelledby="about-heading" data-reveal>
      <div class="about-symbol" aria-hidden="true"><GraduationCap :size="28" /><span>od maturzystów</span></div>
      <div>
        <span class="eyebrow"><span class="little-line"></span> KTO ZA TYM STOI?</span>
        <h2 id="about-heading">Dwójka studentów, którzy dopiero co <span>sami zdawali maturę.</span></h2>
        <p>Pamiętamy czekanie tydzień na sprawdzone wypracowanie, więc robimy narzędzie, którego nam wtedy brakowało. Coś nie działa albo masz pomysł? <RouterLink :to="ROUTES.contact" class="link">Napisz do nas</RouterLink>, czytamy każdą wiadomość.</p>
      </div>
      <div class="about-doodle" aria-hidden="true"><span>trzymamy kciuki!</span><svg viewBox="0 0 90 55" fill="none"><path d="M5 8c20 6 40 22 52 40m0 0-12-3m12 3 2-12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg></div>
    </section>

    <section id="cennik" class="pricing-section section-spacing" aria-labelledby="pricing-heading"><div class="container"><div class="centered-heading" data-reveal><span class="eyebrow section-eyebrow"><span class="little-line"></span> CENNIK</span><h2 id="pricing-heading">Dobry start <span class="text-muted-green">kosztuje zero.</span></h2><p class="pricing-lead">Arkusze CKE i fiszki są darmowe bez limitu. Premium daje więcej narzędzi AI, kiedy nauka przyspiesza.</p></div><PlanCards variant="landing" data-reveal /><p class="pricing-source">Płatności obsługuje Stripe. Nie widzimy danych Twojej karty.</p></div></section>

    <section id="faq" class="faq-section section-spacing container" aria-labelledby="faq-heading"><div class="faq-heading" data-reveal><span class="eyebrow section-eyebrow"><span class="little-line"></span> FAQ</span><h2 id="faq-heading">Jeszcze <br />jakieś pytania?</h2><p>Nie ma tu Twojego? <RouterLink :to="ROUTES.contact" class="link">Napisz do nas</RouterLink>.</p><MessageCircle class="faq-doodle" :size="60" :stroke-width="1" /></div><div class="faq-list" data-reveal><article v-for="(faq, index) in faqs" :key="faq.question" class="faq-item" :class="{ open: openFaq === index }"><h3><button type="button" :aria-expanded="openFaq === index" :aria-controls="`faq-answer-${index}`" @click="openFaq = openFaq === index ? null : index"><span>{{ faq.question }}</span><Plus :size="21" /></button></h3><div v-show="openFaq === index" :id="`faq-answer-${index}`" class="faq-answer"><p>{{ faq.answer }}</p></div></article></div></section>

    <section class="final-cta container" aria-labelledby="cta-heading" data-reveal><BrandMark class="cta-star star-left" /><div class="cta-copy"><span class="eyebrow">TWÓJ PIERWSZY KROK</span><h2 id="cta-heading">To co, <span>ogarniamy?</span></h2><RouterLink class="button button-dark button-large" :to="ROUTES.signup">Jasne, zakładam konto <ArrowUpRight :size="20" /></RouterLink><span class="cta-footnote">Bez karty płatniczej · zajmie Ci pół minuty</span></div><BrandMark class="cta-star star-right" /><span class="cta-handwriting" aria-hidden="true">let’s do this!</span></section>
  </div>
  <DemoDialog ref="demo" />
</template>

<style scoped>
.hero-login { margin-top: 14px; font-size: 13px; color: var(--text-soft); }

/* Four tools: 4 columns on wide screens, 2×2 on tablets, 1 column on phones (style.css). */
@media (min-width: 1101px) {
  .tool-grid.has-four { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
  .has-four .tool-card { padding: 24px 22px 20px; }
  .has-four .tool-card h3 { font-size: 23px; letter-spacing: -.8px; }
  .has-four .tool-card > p { font-size: 13.5px; }
}
@media (min-width: 681px) and (max-width: 1100px) {
  .tool-grid.has-four { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.notes-card { background: #f2f8e1; border-color: #e2edc4; }
.notes-card .tool-icon { background: #e4f0c2; border-color: #d3e3a4; color: #6b8a2f; }
.notes-card .tool-number { color: #7d8f4f; }
.notes-card > p { color: #7c8669; }
.notes-card .tool-link { border-color: #dbe6bd; }
.notes-mini { height: 133px; margin-top: 22px; margin-bottom: 26px; padding: 13px 15px; background: #fdfef8; border: 1px solid #dcef9f; border-radius: 10px; transform: rotate(1.5deg); }
.mini-notes-label { display: flex; align-items: center; gap: 5px; font-size: 8px; letter-spacing: .6px; color: #7d8f4f; font-weight: 650; }
.notes-mini ol { list-style: none; margin: 10px 0 0 4px; padding: 0 0 0 14px; border-left: 2px solid #c9df8a; display: flex; flex-direction: column; gap: 8px; }
.notes-mini li { position: relative; font-size: 11px; color: #6f7a5c; line-height: 1.3; }
.notes-mini li::before { content: ''; position: absolute; left: -20px; top: 3px; width: 8px; height: 8px; border-radius: 50%; background: var(--lime); border: 2px solid #8daf45; }
.notes-mini b { font-family: var(--heading); color: var(--green); margin-right: 4px; }
button.tool-link { color: inherit; }
.more-tools { flex-wrap: wrap; }
.more-tools > span:first-child { font-size: 13px; }
.more-tools > span:not(:first-child) { font-size: 14px; }

.about-section h2 { font-size: 32px; }
.about-section p { font-size: 15px; line-height: 1.75; color: #6f7a69; }
.about-section > div:nth-child(2) > .eyebrow { font-size: 10px; display: inline-flex; margin-bottom: 14px; }
.pricing-lead { max-width: 52ch; margin-inline: auto; font-size: 15px !important; line-height: 1.6; }
.faq-heading p { font-size: 14px; }
.cta-footnote { font-size: 11px; }

@media (max-width: 1100px) { .hide-narrow { display: none; } }
@media (max-width: 850px) { .about-section h2 { font-size: 27px; } .about-section p { font-size: 14px; } }
@media (max-width: 680px) {
  .more-tools { flex-direction: column; align-items: flex-start; gap: 12px; }
  .about-section h2 { font-size: 26px; }
}
</style>
