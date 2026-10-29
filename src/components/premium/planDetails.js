// What each plan card lists (the homepage, /premium and the prerendered homepage all use this).
// Names and prices live in src/config/plans.ts; the real AI limits in the plan_limits table.

export const PLAN_DETAILS = {
  free: {
    label: 'NA START',
    description: 'Wchodzisz i robisz swoje. Bez zobowiązań.',
    features: ['Arkusze CKE bez limitu', 'Fiszki i powtórki bez limitu', '2 sprawdzenia wypracowania na tydzień', 'Tutor: 10 wiadomości dziennie'],
    footnote: 'Bez karty. Bez zobowiązań.',
  },
  monthly: {
    label: 'PREMIUM',
    features: ['Wszystko z darmowego', '2 sprawdzenia wypracowania dziennie', 'Tutor: 50 wiadomości dziennie', 'Notatki i fiszki z AI codziennie'],
    footnote: 'Anulujesz, kiedy chcesz.',
  },
  matura: {
    label: 'DO SAMEJ MATURY',
    features: ['Wszystkie korzyści Premium', 'Dostęp do 31 maja 2027', 'Jedna płatność, bez subskrypcji'],
    footnote: 'BLIK, karta albo Przelewy24.',
  },
}
