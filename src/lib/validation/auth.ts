import { z } from "zod";

// Validation rules for accounts. Used in the browser (instant feedback) and in Server Actions.
// Password rules match the Supabase Auth settings in supabase/config.toml (min 8, letters + digits).

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Ten adres jest za długi.")
  .pipe(z.email("Sprawdź adres e-mail, coś jest nie tak."));

export const passwordSchema = z
  .string()
  .min(8, "Hasło musi mieć co najmniej 8 znaków.")
  .max(72, "Hasło może mieć maksymalnie 72 znaki.")
  .regex(/[a-zA-Z]/, "Hasło musi zawierać literę.")
  .regex(/\d/, "Hasło musi zawierać cyfrę.");

export const signupSchema = z.object({
  email,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "Musisz zaakceptować regulamin i politykę prywatności." }),
  ageConfirmed: z.literal(true, { error: "Potwierdź, proszę, swój wiek." }),
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Hasła się różnią.", path: ["confirm"] });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Wpisz hasło."),
});

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Jak mamy się do Ciebie zwracać?")
    .max(40, "Maksymalnie 40 znaków."),
  subjects: z
    .array(z.enum(["polish", "english"]), { error: "Zaznacz przynajmniej jeden przedmiot." })
    .min(1, "Zaznacz przynajmniej jeden przedmiot.")
    .transform((list) => [...new Set(list)]),
  maturaYear: z.enum(["2027", "2028", "other"], { error: "Wybierz rok matury." }),
});

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Turns zod issues into { field: firstMessage } for showing under inputs. */
export function toFieldErrors<T>(error: z.ZodError): FieldErrors<T> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out as FieldErrors<T>;
}

// Supabase Auth returns English error codes. Map the common ones to friendly Polish.
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "Nieprawidłowy e-mail lub hasło.";
    case "user_already_exists":
    case "email_exists":
      return "Masz już konto na ten adres. Zaloguj się.";
    case "weak_password":
      return "To hasło jest za słabe. Użyj co najmniej 8 znaków, liter i cyfr.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.";
    case "email_address_invalid":
      return "Ten adres e-mail wygląda na nieprawidłowy.";
    case "same_password":
      return "Nowe hasło musi być inne niż obecne.";
    case "captcha_failed":
      return "Nie udało się sprawdzić, czy nie jesteś botem. Odśwież stronę i spróbuj ponownie.";
    case "signup_disabled":
      return "Rejestracja jest chwilowo wyłączona.";
    default:
      return "Coś poszło nie tak. Spróbuj ponownie za chwilę.";
  }
}
