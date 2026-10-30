// Checkout consent is a request to start an ongoing service, never a withdrawal-right waiver.
export const PURCHASE_CONSENT_VERSION = '2026-10-30';
export const EARLY_START_LABEL = 'Żądam rozpoczęcia świadczenia Premium od razu, przed upływem 14 dni. Zachowuję prawo do odstąpienia; przy jego wykonaniu usługa już spełniona może być rozliczona proporcjonalnie na zasadach opisanych w regulaminie.';

export function validPurchaseConsents(consents: unknown, termsVersion: unknown): boolean {
  if (!consents || typeof consents !== 'object' || termsVersion !== PURCHASE_CONSENT_VERSION) return false;
  const c = consents as Record<string, unknown>;
  // withdrawal is a wire-compatibility alias used while the previous Edge Function is deployed.
  // The current server requires earlyStart explicitly; an old waiver checkbox is insufficient.
  return c.terms === true && c.age === true && c.earlyStart === true;
}

export function purchaseConsentMetadata(at: string) {
  return {
    consents: `terms+age+early_start@${at}`,
    consent_text_version: PURCHASE_CONSENT_VERSION,
    early_start_requested: 'true',
    withdrawal_right: 'preserved',
  };
}
