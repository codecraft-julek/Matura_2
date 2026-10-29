<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, FileCheck2, FileText, Heart, Layers, Menu, MessageCircle, Play, Plus, RotateCw, Sparkles, WandSparkles, X, Zap } from '@lucide/vue'
import BrandMark from './components/BrandMark.vue'
import ProductPreview from './components/ProductPreview.vue'
import DemoDialog from './components/DemoDialog.vue'
import { faqs, plans } from './data'
import { EXAM_ROUTE } from './exam/examData'

const menuOpen = ref(false)
const demo = ref(null)
const featureFlipped = ref(false)
const openFaq = ref(null)
let revealObserver

function openDemo(tab = 'exercise', plan = null) {
  menuOpen.value = false
  if (tab === 'exercise' && !plan) {
    window.location.hash = EXAM_ROUTE
    return
  }
  demo.value.open(tab, plan)
}

function closeMenu(event) {
  if (event.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  document.addEventListener('keydown', closeMenu)
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
  document.removeEventListener('keydown', closeMenu)
  revealObserver?.disconnect()
})
</script>

<template>
  <a class="skip-link" href="#main">Przejdź do treści</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="#" aria-label="Ogarnij Maturę — strona główna"><span class="brand-icon"><BrandMark /></span><span>ogarnij<span class="brand-second">maturę.</span></span></a>
      <nav class="desktop-navigation" aria-label="Menu główne"><a href="#narzedzia">Narzędzia</a><a :href="EXAM_ROUTE">Arkusz 2026</a><a href="#cennik">Cennik</a><a href="#faq">FAQ</a></nav>
      <div class="header-actions"><button class="text-button desktop-demo" @click="openDemo()">Zobacz demo <ArrowUpRight :size="16" /></button><button class="button button-dark header-cta" @click="openDemo()">Zacznij za darmo <ArrowUpRight :size="16" /></button><button class="menu-toggle icon-button" :aria-expanded="menuOpen" aria-controls="mobile-navigation" :aria-label="menuOpen ? 'Zamknij menu' : 'Otwórz menu'" @click="menuOpen = !menuOpen"><X v-if="menuOpen" :size="24" /><Menu v-else :size="24" /></button></div>
    </div>
    <nav v-if="menuOpen" id="mobile-navigation" class="mobile-navigation" aria-label="Menu mobilne"><a href="#narzedzia" @click="menuOpen = false">Narzędzia <ArrowUpRight :size="18" /></a><a :href="EXAM_ROUTE" @click="menuOpen = false">Arkusz 2026 <ArrowUpRight :size="18" /></a><a href="#cennik" @click="menuOpen = false">Cennik <ArrowUpRight :size="18" /></a><a href="#faq" @click="menuOpen = false">FAQ <ArrowUpRight :size="18" /></a><button class="button button-lime" @click="openDemo()">Wypróbuj demo <ArrowRight :size="18" /></button></nav>
  </header>

  <main id="main">
    <section class="hero container" aria-labelledby="hero-heading">
      <div class="hero-copy">
        <div class="hero-eyebrow"><span class="status-dot"></span> MATURA 2027 & 2028 <span class="eyebrow-divider"></span> TWÓJ NOWY PLAN</div>
        <h1 id="hero-heading">Matura?<br />Spokojnie,<br /><span class="highlight-word">ogarniesz.<svg viewBox="0 0 420 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 13Q190-2 414 8M36 18Q219 5 390 15" /></svg></span><BrandMark class="heading-spark" /></h1>
        <p class="hero-description">Arkusze, fiszki i feedback AI.<br />Twój plan na maturę. Bez spiny.</p>
        <div class="hero-buttons"><button class="button button-lime button-large" @click="openDemo()">Zaczynam za darmo <ArrowUpRight :size="21" /></button><a class="hero-secondary" href="#jak-to-dziala"><span class="play-icon"><Play :size="13" fill="currentColor" /></span> Jak to działa?</a></div>
        <div class="hero-reassurance"><span><Check :size="14" /> Bez karty płatniczej</span><span><Check :size="14" /> W Twoim tempie</span></div>
      </div>
      <ProductPreview @open-demo="openDemo" />
      <a class="hero-scroll" href="#narzedzia"><ArrowDown :size="14" /> ODKRYJ NARZĘDZIA</a>
    </section>

    <div class="benefits-strip"><div class="container benefits-inner"><span><FileCheck2 :size="20" /> Arkusze CKE</span><i></i><span><BookOpen :size="20" /> Polski i angielski</span><i></i><span><Heart :size="20" /> Twoje tempo</span></div></div>

    <section id="narzedzia" class="tools-section section-spacing container" aria-labelledby="tools-heading">
      <div class="section-heading" data-reveal><div><span class="eyebrow section-eyebrow"><span class="little-line"></span> TWÓJ TOOLKIT</span><h2 id="tools-heading">Mniej zakuwania.<br />Więcej <span class="text-muted-green">ogarniania.</span></h2></div><span class="section-aside">3 narzędzia. Jeden cel. <ArrowDown :size="18" /></span></div>
      <div class="tool-grid">
        <article class="tool-card worksheet-card" data-reveal><div class="tool-topline"><span class="tool-icon"><FileText :size="23" /></span><span class="tool-number">01 / PRAKTYKA</span></div><h3>Arkusze.<br />Bez niespodzianek.</h3><p>Ćwicz na arkuszach CKE. Sprawdzaj od razu.</p><div class="worksheet-mini" aria-hidden="true"><div class="mini-sheet-top"><span><span class="subject-dot"></span> Język polski</span><span>CKE</span></div><strong>Twój następny mały krok</strong><div class="mini-sheet-lines"><i></i><i></i></div><div class="mini-sheet-bottom"><span><Check :size="12" /> Twój rytm. Twój progres.</span><span class="small-round-arrow"><ArrowUpRight :size="16" /></span></div></div><button class="tool-link" @click="openDemo('exercise')">Rozwiąż zadanie <ArrowUpRight :size="19" /></button></article>
        <article class="tool-card feedback-card" data-reveal><div class="tool-topline"><span class="tool-icon"><WandSparkles :size="23" /></span><span class="tool-number">02 / FEEDBACK AI</span></div><h3>Twój tekst.<br />Konkretny feedback.</h3><p>Wiesz, co działa. I co jeszcze poprawić.</p><div class="feedback-mini"><span class="mini-feedback-label"><Sparkles :size="13" /> TWÓJ FEEDBACK</span><div><span class="mini-check"><Check :size="14" /></span><p><strong>Trafny argument</strong><br />Dobrze dobrana lektura.</p></div><div><span class="mini-lightbulb"><Sparkles :size="14" /></span><p><strong>Dodaj kontekst</strong><br />Wzmocnij swoją tezę.</p></div></div><button class="tool-link" @click="openDemo('essay')">Zobacz feedback <ArrowUpRight :size="19" /></button></article>
        <article class="tool-card flashcards-card" data-reveal><div class="tool-topline"><span class="tool-icon"><Layers :size="23" /></span><span class="tool-number">03 / FISZKI</span></div><h3>Mała powtórka.<br />Dużo w głowie.</h3><p>Pięć minut na fiszki? Zawsze dobry pomysł.</p><div class="mini-flashcard-stack"><div class="stack-back" aria-hidden="true"></div><button class="mini-flashcard" :class="{ flipped: featureFlipped }" :aria-label="featureFlipped ? 'Pokaż pytanie na fiszce' : 'Odwróć przykładową fiszkę'" @click="featureFlipped = !featureFlipped"><span>LALKA · SZYBKA POWTÓRKA</span><strong>{{ featureFlipped ? 'Bolesław Prus.' : 'Kto napisał „Lalkę”?' }}</strong><span class="flip-caption"><RotateCw :size="12" /> {{ featureFlipped ? 'Ogarnięte!' : 'Kliknij i odwróć' }}</span></button></div><button class="tool-link" @click="openDemo('flashcards')">Odpal fiszki <ArrowUpRight :size="19" /></button></article>
      </div>
    </section>

    <section id="jak-to-dziala" class="how-section" aria-labelledby="how-heading"><div class="container how-inner"><div class="how-intro" data-reveal><div><span class="eyebrow section-eyebrow"><span class="little-line"></span> JAK TO DZIAŁA?</span><h2 id="how-heading">Mały krok. <span>Duży progres.</span></h2></div><BrandMark class="how-spark" /></div><div class="steps"><article class="step" data-reveal><div class="step-track"><span>01</span><i></i><ArrowRight :size="18" /></div><h3>Wybierz narzędzie.</h3><p>Arkusz, wypracowanie czy fiszki?</p></article><article class="step" data-reveal><div class="step-track"><span>02</span><i></i><ArrowRight :size="18" /></div><h3>Poćwicz po swojemu.</h3><p>Pięć minut też robi różnicę.</p></article><article class="step" data-reveal><div class="step-track"><span>03</span><i></i><Check :size="18" /></div><h3>Sprawdź. I ogarnięte.</h3><p>Każda odpowiedź to krok do przodu.</p></article></div></div></section>

    <section id="cennik" class="pricing-section section-spacing" aria-labelledby="pricing-heading"><div class="container"><div class="centered-heading" data-reveal><span class="eyebrow section-eyebrow"><span class="little-line"></span> CENNIK</span><h2 id="pricing-heading">Dobry start <span class="text-muted-green">kosztuje zero.</span></h2></div><div class="pricing-grid"><article v-for="plan in plans" :key="plan.label" class="pricing-card" :class="{ featured: plan.featured }" data-reveal><div v-if="plan.featured" class="recommended-label"><Zap :size="13" fill="currentColor" /> WIĘCEJ MOCY</div><span class="plan-label">{{ plan.label }}</span><h3>{{ plan.name }}</h3><div class="plan-price">{{ plan.price }}<span>zł</span><small>{{ plan.period }}</small></div><div class="pricing-divider"></div><ul class="plan-features"><li v-for="feature in plan.features" :key="feature"><Check :size="16" />{{ feature }}</li></ul><button class="button full-width" :class="plan.featured ? 'button-lime' : 'button-outline'" @click="openDemo('exercise', plan.price === '0' ? null : plan)">{{ plan.button }} <ArrowUpRight :size="18" /></button><p class="plan-note">{{ plan.featured ? 'Anulujesz, kiedy chcesz.' : plan.price === '0' ? 'Bez karty. Bez zobowiązań.' : 'Bez subskrypcji.' }}</p></article></div><p class="pricing-source">Podgląd oferty Ogarnij Maturę · bez płatności.</p></div></section>

    <section id="faq" class="faq-section section-spacing container" aria-labelledby="faq-heading"><div class="faq-heading" data-reveal><span class="eyebrow section-eyebrow"><span class="little-line"></span> FAQ</span><h2 id="faq-heading">Jeszcze<br />jakieś pytania?</h2><MessageCircle class="faq-doodle" :size="60" :stroke-width="1" /></div><div class="faq-list" data-reveal><article v-for="(faq, index) in faqs" :key="faq.question" class="faq-item" :class="{ open: openFaq === index }"><h3><button :aria-expanded="openFaq === index" :aria-controls="`faq-answer-${index}`" @click="openFaq = openFaq === index ? null : index"><span>{{ faq.question }}</span><Plus :size="21" /></button></h3><div v-show="openFaq === index" :id="`faq-answer-${index}`" class="faq-answer"><p>{{ faq.answer }}</p></div></article></div></section>

    <section class="final-cta container" aria-labelledby="cta-heading" data-reveal><BrandMark class="cta-star star-left" /><div class="cta-copy"><span class="eyebrow">TWÓJ PIERWSZY KROK</span><h2 id="cta-heading">To co, <span>ogarniamy?</span></h2><button class="button button-dark button-large" @click="openDemo()">Jasne, zaczynam <ArrowUpRight :size="20" /></button></div><BrandMark class="cta-star star-right" /><span class="cta-handwriting" aria-hidden="true">let’s do this!</span></section>
  </main>

  <footer class="site-footer container"><div class="footer-top"><a class="brand" href="#" aria-label="Ogarnij Maturę — wróć na górę"><span class="brand-icon"><BrandMark /></span><span>ogarnij<span class="brand-second">maturę.</span></span></a><p>Mniej stresu. Więcej przyszłości.</p><nav aria-label="Menu w stopce"><a href="#narzedzia">Narzędzia</a><a href="#cennik">Cennik</a><a href="#faq">FAQ</a><a href="https://matura-theta.vercel.app/" target="_blank" rel="noopener noreferrer">Oryginalna strona <ArrowUpRight :size="13" /></a></nav></div><div class="footer-bottom"><span>© {{ new Date().getFullYear() }} Ogarnij Maturę · Projekt koncepcyjny</span><span>Nie jesteśmy powiązani z CKE.</span></div></footer>
  <DemoDialog ref="demo" />
</template>
