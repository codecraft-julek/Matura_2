import { z } from "zod";

// Shared between the form (Next.js, in the browser) and the Edge Function (Supabase, Deno).
// The function ALWAYS re-validates: never trust what the browser sends.
// Keep this file free of Node- or Deno-specific code so both runtimes can import it.

// Bump this whenever you change the wording of the consent checkbox.
// It is saved with every signup, so you can prove which text each person agreed to.
export const CONSENT_VERSION = "2026-10-17";

export const SUBJECTS = [
  { value: "polish", label: "Polski" },
  { value: "english", label: "Angielski" },
] as const;

export const MATURA_YEARS = [
  { value: "2027", label: "2027" },
  { value: "2028", label: "2028" },
  { value: "other", label: "Inny" },
] as const;

// Turns an empty or missing UTM value into null and caps its length,
// so nobody can stuff huge strings into the database via the URL.
const trackingParam = z
  .string()
  .trim()
  .max(100)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Ten adres jest za długi.")
    .pipe(z.email("Sprawdź adres e-mail, coś jest nie tak.")),
  subjects: z
    .array(z.enum(["polish", "english"]), { error: "Zaznacz przynajmniej jeden przedmiot." })
    .min(1, "Zaznacz przynajmniej jeden przedmiot.")
    .transform((list) => [...new Set(list)]),
  maturaYear: z.enum(["2027", "2028", "other"], {
    error: "Wybierz rok matury.",
  }),
  consentPrivacy: z.literal(true, { error: "Potrzebujemy Twojej zgody, żeby wysłać Ci powiadomienie." }),
  ageConfirmed: z.literal(true, { error: "Potwierdź, proszę, swój wiek." }),
  // Honeypot: real users never see this field, so it should always be empty.
  website: z.string().optional(),
  utmSource: trackingParam,
  utmMedium: trackingParam,
  utmCampaign: trackingParam,
  ref: trackingParam,
});

export type WaitlistInput = z.input<typeof waitlistSchema>;
export type WaitlistData = z.output<typeof waitlistSchema>;

export type WaitlistResponse =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<keyof WaitlistInput, string>> };
