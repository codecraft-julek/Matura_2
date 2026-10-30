import { describe, expect, it } from 'vitest'
import { LEGAL_VERSION } from '../src/config/legal'
import { TERMS_VERSION } from '../src/config/site'
import { legalDocuments, termsDocument, privacyDocument, withdrawalForm } from '../src/content/legal/documents'
import { documentDownloadPath, escapeHtml, renderLegalArticle, renderLegalBlocks, standaloneLegalDocument } from '../src/content/legal/render'
import { PURCHASE_CONSENT_VERSION, EARLY_START_LABEL, purchaseConsentMetadata, validPurchaseConsents } from '../supabase/functions/_shared/purchase-consents'

describe('checkout declarations and withdrawal rights', () => {
  const consents = { terms: true, age: true, earlyStart: true }
  it('keeps the accepted terms, generated documents and server consent text version aligned', () => {
    expect(TERMS_VERSION).toBe(LEGAL_VERSION)
    expect(PURCHASE_CONSENT_VERSION).toBe(LEGAL_VERSION)
    for (const doc of legalDocuments) expect(doc.version).toBe(LEGAL_VERSION)
  })
  it('requires explicit current declarations and rejects an old withdrawal waiver', () => {
    expect(validPurchaseConsents(consents, LEGAL_VERSION)).toBe(true)
    for (const field of Object.keys(consents)) expect(validPurchaseConsents({ ...consents, [field]: false }, LEGAL_VERSION)).toBe(false)
    expect(validPurchaseConsents({ terms: true, age: true, withdrawal: true }, LEGAL_VERSION)).toBe(false)
    expect(validPurchaseConsents(consents, '2026-10-17')).toBe(false)
    expect(validPurchaseConsents(null, LEGAL_VERSION)).toBe(false)
  })
  it('records an immediate-service request without recording surrender of the withdrawal right', () => {
    const proof = purchaseConsentMetadata('2026-10-30T12:00:00Z')
    expect(proof.withdrawal_right).toBe('preserved')
    expect(proof.early_start_requested).toBe('true')
    expect(proof.consents).toBe('terms+age+early_start@2026-10-30T12:00:00Z')
    expect(EARLY_START_LABEL).toContain('Zachowuję prawo do odstąpienia')
  })
})

describe('accessible and downloadable legal documents', () => {
  it.each(legalDocuments)('renders every section of $title in the static and downloadable copies', doc => {
    expect(new Set(doc.sections.map(s => s.id)).size).toBe(doc.sections.length)
    const staticPage = renderLegalArticle(doc)
    const download = standaloneLegalDocument(doc)
    expect(staticPage).toContain(documentDownloadPath(doc))
    expect(download).toContain('lang="pl"')
    expect(download).not.toContain('<script')
    for (const section of doc.sections) {
      expect(staticPage).toContain(`id="${section.id}"`)
      expect(download).toContain(escapeHtml(section.title))
      expect(download).toContain(renderLegalBlocks(section.blocks))
    }
  })
  it('escapes operator-supplied text rather than treating it as executable HTML', () => {
    expect(renderLegalBlocks([{ type: 'paragraph', text: '<script>alert("x")</script>' }])).toBe('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>')
  })
  it('keeps contact links usable when a document is saved and opened offline', () => {
    const copy = standaloneLegalDocument(termsDocument, 'https://matura-2.vercel.app')
    expect(copy).toContain('href="https://matura-2.vercel.app/kontakt?sprawa=odstapienie"')
    expect(copy).toContain('href="#odstapienie"')
  })
  it('offers withdrawal, complaint and privacy contact routes without requiring a purchase ID', () => {
    expect(renderLegalArticle(termsDocument)).toContain('/kontakt?sprawa=odstapienie')
    expect(renderLegalArticle(termsDocument)).toContain('/kontakt?sprawa=reklamacja')
    expect(renderLegalArticle(privacyDocument)).toContain('/kontakt?sprawa=dane')
    expect(withdrawalForm).toContain('nie jest obowiązkowy')
  })
})
