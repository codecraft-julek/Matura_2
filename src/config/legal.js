// The empty address is the owner's choice: the documents offer it on request by e-mail.
// Do not substitute the brand or author for the natural person legally providing the service.
// Selling for real needs name and phone: the build fails with a pk_live_ key while either is missing.
export const LEGAL_OPERATOR = Object.freeze({
  brand: 'Ogarnij Maturę',
  status: 'działalność nierejestrowana',
  fullName: 'Piotr Goraj',
  address: null,
  email: 'ogarnijmature@o2.pl',
  phone: '+48 695 485 160',
})

/** Seller details the documents must state before selling to consumers. */
export const missingOperatorDetails = (op = LEGAL_OPERATOR) => ['fullName', 'phone'].filter(field => !op[field] || op[field].startsWith('['))

export const LEGAL_VERSION = '2026-11-07'
export const LEGAL_UPDATED = '7 listopada 2026'
// The privacy policy has its own version: new recipients do not change the accepted terms or the checkout declarations.
export const PRIVACY_VERSION = '2026-11-09'
export const PRIVACY_UPDATED = '9 listopada 2026'
export const LEGAL_DRAFT_NOTICE = null

// Confirmed by the owner; no claim about EU-only processing by every subprocessor.
export const DATABASE_LOCATION = 'Frankfurt nad Menem, Niemcy (UE)'
export const BACKUP_RETENTION = 'Do 7 dni, jeśli dostawca bazy danych wykonuje kopie w używanym planie'
export const LOG_RETENTION = 'Do 30 dni, zgodnie z ustawieniami dostawców. Dłużej tylko wtedy, gdy są potrzebne do wyjaśnienia konkretnego incydentu lub sprawy.'
