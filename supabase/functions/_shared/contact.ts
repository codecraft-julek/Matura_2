import { z } from "zod";

// Contact form, shared by the Edge Function `contact-submit` (Deno) and the website (Next.js).

export const CONTACT_TOPICS = [
  { value: "question", label: "Pytanie" },
  { value: "bug", label: "Coś nie działa" },
  { value: "idea", label: "Pomysł na funkcję" },
  { value: "cooperation", label: "Współpraca" },
  { value: "other", label: "Inne" },
] as const;

export const contactSchema = z.object({
  name: z.string().trim().max(80, "Maksymalnie 80 znaków.").default(""),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Ten adres jest za długi.")
    .pipe(z.email("Sprawdź adres e-mail, na niego odpowiemy.")),
  topic: z.enum(["question", "bug", "idea", "cooperation", "other"], { error: "Wybierz temat." }),
  message: z
    .string()
    .trim()
    .min(10, "Napisz trochę więcej (co najmniej 10 znaków).")
    .max(4000, "Wiadomość może mieć maksymalnie 4000 znaków."),
  /** Cloudflare Turnstile token (checked when the secret is set). */
  captchaToken: z.string().max(4096).optional(),
});
export type ContactInput = z.input<typeof contactSchema>;

export type ContactResponse = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const topicLabel = (value: string) => CONTACT_TOPICS.find((t) => t.value === value)?.label ?? value;
