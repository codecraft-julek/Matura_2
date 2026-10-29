// All routes of the app. Polish slugs identical to the old Next.js app (Stripe return URLs,
// Supabase e-mail links, SEO links and students' bookmarks keep working).
//
// meta.layout: 'public' (site header/footer) | 'auth' (centered card) | 'app' (logged-in shell) | 'bare'
// meta.title:  static <title>; pages with data-dependent titles use usePageTitle().
// meta.wide:   app pages that need the full width (split view with the PDF).
// Access rules come from PROTECTED_PREFIXES / AUTH_PAGES in src/config/routes.ts, not from meta.

import { createRouter, createWebHistory } from 'vue-router'
import { AUTH_PAGES, PROTECTED_PREFIXES, ROUTES } from '@/config/routes'
import { fullTitle } from '@/composables/usePageTitle'
import { useAuthStore } from '@/stores/auth'

const page = loader => loader // readability: every page is lazy-loaded

const routes = [
  // Public
  { path: '/', component: page(() => import('@/pages/public/Landing.vue')), meta: { layout: 'public', title: '' } },
  { path: '/arkusze-maturalne', component: page(() => import('@/pages/public/PublicExams.vue')), meta: { layout: 'public', title: 'Arkusze maturalne CKE z odpowiedziami' } },
  { path: '/arkusze-maturalne/:examId', component: page(() => import('@/pages/public/PublicExam.vue')), meta: { layout: 'public', title: 'Arkusz maturalny' } },
  { path: '/kontakt', component: page(() => import('@/pages/public/Contact.vue')), meta: { layout: 'public', title: 'Kontakt' } },
  { path: '/regulamin', component: page(() => import('@/pages/public/Terms.vue')), meta: { layout: 'public', title: 'Regulamin' } },
  { path: '/polityka-prywatnosci', component: page(() => import('@/pages/public/Privacy.vue')), meta: { layout: 'public', title: 'Polityka prywatności' } },
  { path: '/do-zobaczenia', component: page(() => import('@/pages/public/Goodbye.vue')), meta: { layout: 'public', title: 'Do zobaczenia' } },
  { path: '/trening/polski-2026', component: page(() => import('@/exam/ExamPage.vue')), meta: { layout: 'bare', title: 'Polski 2026 — trening z arkuszem' } },

  // Account
  { path: '/logowanie', component: page(() => import('@/pages/auth/Login.vue')), meta: { layout: 'auth', title: 'Logowanie' } },
  { path: '/rejestracja', component: page(() => import('@/pages/auth/Signup.vue')), meta: { layout: 'auth', title: 'Załóż konto' } },
  { path: '/nie-pamietam-hasla', component: page(() => import('@/pages/auth/ForgotPassword.vue')), meta: { layout: 'auth', title: 'Nie pamiętam hasła' } },
  { path: '/nowe-haslo', component: page(() => import('@/pages/auth/NewPassword.vue')), meta: { layout: 'auth', title: 'Nowe hasło', skipOnboarding: true } },
  { path: '/auth/potwierdz', component: page(() => import('@/pages/auth/AuthConfirm.vue')), meta: { layout: 'auth', title: 'Potwierdzanie' } },
  { path: '/witaj', component: page(() => import('@/pages/app/Welcome.vue')), meta: { layout: 'auth', title: 'Witaj', skipOnboarding: true } },
  { path: '/panel', component: page(() => import('@/pages/app/Dashboard.vue')), meta: { layout: 'app', title: 'Panel' } },
  { path: '/konto', component: page(() => import('@/pages/app/Account.vue')), meta: { layout: 'app', title: 'Konto' } },
  { path: '/konto/eksport', redirect: '/konto' },

  // Exams
  { path: '/arkusze', component: page(() => import('@/pages/exams/ExamList.vue')), meta: { layout: 'app', title: 'Arkusze' } },
  { path: '/arkusze/:examId', component: page(() => import('@/pages/exams/ExamOverview.vue')), meta: { layout: 'app', title: 'Arkusz' } },
  { path: '/arkusze/:examId/cwiczenia', component: page(() => import('@/pages/exams/Solve.vue')), props: { mode: 'practice' }, meta: { layout: 'app', title: 'Tryb ćwiczeń', wide: true } },
  { path: '/arkusze/:examId/egzamin', component: page(() => import('@/pages/exams/Solve.vue')), props: { mode: 'timed' }, meta: { layout: 'app', title: 'Egzamin na czas', wide: true } },
  { path: '/arkusze/:examId/wynik/:attemptId', component: page(() => import('@/pages/exams/Result.vue')), meta: { layout: 'app', title: 'Wynik' } },

  // Essays
  { path: '/wypracowania', component: page(() => import('@/pages/essays/EssayList.vue')), meta: { layout: 'app', title: 'Wypracowania' } },
  { path: '/wypracowania/nowe', component: page(() => import('@/pages/essays/NewEssay.vue')), meta: { layout: 'app', title: 'Nowe wypracowanie' } },
  { path: '/wypracowania/:essayId', component: page(() => import('@/pages/essays/Essay.vue')), meta: { layout: 'app', title: 'Wypracowanie' } },

  // Tutor
  { path: '/tutor', component: page(() => import('@/pages/tutor/TutorHome.vue')), meta: { layout: 'app', title: 'Tutor AI' } },
  { path: '/tutor/:chatId', component: page(() => import('@/pages/tutor/TutorChatPage.vue')), meta: { layout: 'app', title: 'Rozmowa z tutorem' } },

  // Notes
  { path: '/notatki', component: page(() => import('@/pages/notes/NoteList.vue')), meta: { layout: 'app', title: 'Notatki' } },
  { path: '/notatki/nowa', component: page(() => import('@/pages/notes/NewNote.vue')), meta: { layout: 'app', title: 'Nowa notatka' } },
  { path: '/notatki/:noteId', component: page(() => import('@/pages/notes/Note.vue')), meta: { layout: 'app', title: 'Notatka' } },

  // Flashcards
  { path: '/fiszki', component: page(() => import('@/pages/flashcards/DeckList.vue')), meta: { layout: 'app', title: 'Fiszki' } },
  { path: '/fiszki/nowa', component: page(() => import('@/pages/flashcards/NewDeck.vue')), meta: { layout: 'app', title: 'Nowa talia' } },
  { path: '/fiszki/:deckId', component: page(() => import('@/pages/flashcards/Deck.vue')), meta: { layout: 'app', title: 'Talia' } },
  { path: '/fiszki/:deckId/nauka', component: page(() => import('@/pages/flashcards/Study.vue')), meta: { layout: 'app', title: 'Nauka' } },

  // Premium
  { path: '/premium', component: page(() => import('@/pages/premium/Premium.vue')), meta: { layout: 'app', title: 'Premium' } },
  { path: '/premium/platnosc', component: page(() => import('@/pages/premium/Checkout.vue')), meta: { layout: 'app', title: 'Płatność' } },
  { path: '/premium/gotowe', component: page(() => import('@/pages/premium/PaymentDone.vue')), meta: { layout: 'app', title: 'Płatność zakończona' } },

  // Old hash URL of the demo (#/test/polski-2026) is rewritten in main.js; 404 last.
  { path: '/:pathMatch(.*)*', component: page(() => import('@/pages/NotFound.vue')), meta: { layout: 'public', title: 'Nie ma takiej strony' } },
]

export const isProtected = path => PROTECTED_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))
// The homepage counts as an "auth page": logged-in students go straight to their dashboard.
const isGuestOnly = path => path === ROUTES.home || AUTH_PAGES.includes(path)

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved
    if (to.hash) return { el: to.hash, top: 96 }
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  await auth.ready()

  if (!auth.isLoggedIn && isProtected(to.path)) {
    return { path: ROUTES.login, query: { next: to.fullPath } } // keeps e.g. ?plan=matura
  }
  if (auth.isLoggedIn && isGuestOnly(to.path)) return ROUTES.dashboard

  if (auth.isLoggedIn && isProtected(to.path)) {
    let profile
    try { profile = await auth.ensureProfile() } catch { return true } // offline: let the page show its error state
    if (!profile) {
      // Session without a profile row (account deleted elsewhere): start over.
      await auth.signOut('local')
      return { path: ROUTES.login, query: { next: to.fullPath } }
    }
    if (!profile.onboarded_at && !to.meta.skipOnboarding) return { path: ROUTES.onboarding, query: { next: to.fullPath } }
  }
  return true
})

router.afterEach(to => {
  if (to.meta.title !== undefined) document.title = fullTitle(to.meta.title)
})

// A new deploy removed the old lazy chunk: reload once to fetch the new version.
router.onError((error, to) => {
  if (/Failed to fetch dynamically imported module|Importing a module script failed/.test(String(error?.message))) {
    window.location.assign(to.fullPath)
  }
})
