// Plans shown on /premium and the homepage (texts only). What is actually charged lives in
// supabase/functions/_shared/billing.ts (a test checks the prices match), and the real AI limits
// live in the database table plan_limits: if you change a limit there, update FEATURES below.

export type PlanId = "free" | "monthly" | "matura";

export type Plan = {
  id: PlanId;
  name: string;
  price: string;
  /** Monthly plan: what every month after the first one costs. */
  renewalPrice?: string;
  period: string;
  note?: string;
  badge?: string;
  cta: string;
};

export const PLANS: Plan[] = [
  { id: "free", name: "Darmowy", price: "0 zł", period: "na zawsze", cta: "Twój obecny plan" },
  {
    id: "monthly",
    name: "Premium",
    price: "24,99 zł",
    renewalPrice: "29,99 zł",
    period: "za pierwszy miesiąc",
    note: "Potem 29,99 zł miesięcznie. Anulujesz, kiedy chcesz.",
    badge: "najczęściej wybierany",
    cta: "Wybierz Premium",
  },
  {
    id: "matura",
    name: "Pakiet do matury",
    price: "129 zł",
    period: "jednorazowo, do 31 maja 2027",
    note: "Bez subskrypcji. Płacisz raz i masz spokój do matury.",
    badge: "najbardziej się opłaca",
    cta: "Kup pakiet",
  },
];

/** Feature comparison: [label, free, premium (monthly and matura are the same)]. */
export const FEATURES: [string, string, string][] = [
  ["Arkusze CKE, tryb ćwiczeń i egzamin na czas", "bez limitu", "bez limitu"],
  ["Nauka fiszek, import z Quizletu i Anki", "bez limitu", "bez limitu"],
  ["Sprawdzenie wypracowania przez AI", "1 na tydzień", "2 dziennie"],
  ["Ocena odpowiedzi otwartych (polski)", "1 na tydzień", "10 dziennie"],
  ["Tutor AI", "5 wiadomości dziennie", "50 wiadomości dziennie"],
  ["Notatki AI ze zdjęć i plików", "1 na tydzień", "5 dziennie"],
  ["Fiszki z AI (PDF, YouTube, strony)", "2 na tydzień", "10 dziennie"],
];

/** The last moment of the Pakiet. Must match MATURA_PASS_UNTIL in supabase/functions/_shared/billing.ts. */
export const PASS_UNTIL = "2027-05-31T23:59:59+02:00";

export const PAID_PLANS = PLANS.filter((p) => p.id !== "free");
export const planById = (id: string | undefined) => PAID_PLANS.find((p) => p.id === id) ?? null;
