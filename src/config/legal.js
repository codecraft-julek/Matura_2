// The owner hasn't published these yet, so the documents leave them out for the testing period.
// Do not substitute the brand or author for the natural person legally providing the service.
// Selling for real needs all three: the build fails with a pk_live_ key while any is missing.
export const LEGAL_OPERATOR = Object.freeze({
  brand: 'Ogarnij Maturę',
  status: 'działalność nierejestrowana',
  fullName: null,
  address: null,
  email: 'ogarnijmature@o2.pl',
  phone: null,
})

/** What the law requires before selling to consumers and the documents don't state yet. */
export const missingOperatorDetails = (op = LEGAL_OPERATOR) => ['fullName', 'address', 'phone'].filter(field => !op[field])

export const LEGAL_VERSION = '2026-11-02'
export const LEGAL_UPDATED = '2 listopada 2026'
export const LEGAL_DRAFT_NOTICE = 'Wersja na okres testów. Serwis nie przyjmuje jeszcze prawdziwych płatności. Pełne dane usługodawcy (imię i nazwisko, adres, telefon) podamy przed rozpoczęciem sprzedaży.'

// Confirmed by the owner; no claim about EU-only processing by every subprocessor.
export const DATABASE_LOCATION = 'Frankfurt nad Menem, Niemcy (UE)'
export const BACKUP_RETENTION = 'Do 7 dni, jeśli dostawca bazy danych wykonuje kopie w używanym planie'
export const LOG_RETENTION = 'Do 30 dni, zgodnie z ustawieniami dostawców. Dłużej tylko wtedy, gdy są potrzebne do wyjaśnienia konkretnego incydentu lub sprawy.'
