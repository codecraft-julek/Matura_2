// All app URLs in one place (Polish slugs, because students see them).

export const ROUTES = {
  home: "/",
  login: "/logowanie",
  signup: "/rejestracja",
  onboarding: "/witaj",
  forgotPassword: "/nie-pamietam-hasla",
  newPassword: "/nowe-haslo",
  /** Where links from Supabase e-mails land (password reset, e-mail confirmation). */
  authConfirm: "/auth/potwierdz",
  dashboard: "/panel",
  account: "/konto",
  exams: "/arkusze",
  essays: "/wypracowania",
  newEssay: "/wypracowania/nowe",
  tutor: "/tutor",
  notes: "/notatki",
  newNote: "/notatki/nowa",
  flashcards: "/fiszki",
  newDeck: "/fiszki/nowa",
  premium: "/premium",
  checkout: "/premium/platnosc",
  premiumDone: "/premium/gotowe",
  /** Public exam pages for Google (no login): structure, official PDFs, "solve it here". */
  publicExams: "/arkusze-maturalne",
  privacy: "/polityka-prywatnosci",
  contact: "/kontakt",
  terms: "/regulamin",
  goodbye: "/do-zobaczenia",
  dataExport: "/konto/eksport",
} as const;

// Pages that require a logged-in student. proxy.ts sends everyone else to the login page.
export const PROTECTED_PREFIXES = [ROUTES.dashboard, ROUTES.onboarding, ROUTES.account, ROUTES.exams, ROUTES.essays, ROUTES.tutor, ROUTES.notes, ROUTES.flashcards, ROUTES.premium, ROUTES.newPassword];

// Pages a logged-in student shouldn't see (they get sent to the dashboard instead).
export const AUTH_PAGES = [ROUTES.login, ROUTES.signup];

// Only allow redirects to our own pages after login (prevents "open redirect" tricks
// like /logowanie?next=https://evil.com).
export function safeNextPath(next: string | null | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return ROUTES.dashboard;
}

// Exam URLs, e.g. /arkusze/2025-maj-angielski-pp/egzamin
export const examRoutes = {
  overview: (id: string) => `${ROUTES.exams}/${id}`,
  practice: (id: string) => `${ROUTES.exams}/${id}/cwiczenia`,
  timed: (id: string) => `${ROUTES.exams}/${id}/egzamin`,
  result: (id: string, attemptId: string) => `${ROUTES.exams}/${id}/wynik/${attemptId}`,
};

export const essayRoute = (id: string) => `${ROUTES.essays}/${id}`;
export const tutorChatRoute = (id: string) => `${ROUTES.tutor}/${id}`;
export const noteRoute = (id: string) => `${ROUTES.notes}/${id}`;
export const checkoutRoute = (plan: string) => `${ROUTES.checkout}?plan=${plan}`;
export const publicExamRoute = (id: string) => `${ROUTES.publicExams}/${id}`;
export const deckRoute = (id: string) => `${ROUTES.flashcards}/${id}`;
export const studyRoute = (id: string, all = false) => `${ROUTES.flashcards}/${id}/nauka${all ? "?wszystkie=1" : ""}`;
