// Escape owner-supplied details too. Legal copy contains no runtime HTML.
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
export const documentDownloadPath = doc => `/dokumenty/${doc.id}-${doc.version}.html`

export function renderLegalBlocks(blocks) {
  const e = escapeHtml
  return blocks.map(block => {
    if (block.type === 'paragraph') return `<p>${e(block.text)}</p>`
    if (block.type === 'list') return `<ul>${block.items.map(item => `<li>${e(item)}</li>`).join('')}</ul>`
    if (block.type === 'links') return `<ul class="legal-links">${block.items.map(item => `<li><a href="${e(item.href)}">${e(item.label)}</a></li>`).join('')}</ul>`
    if (block.type === 'table') return `<div class="legal-table"><table><thead><tr>${block.headers.map(header => `<th scope="col">${e(header)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map((cell, index) => index ? `<td>${e(cell)}</td>` : `<th scope="row">${e(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`
    throw new Error(`Unknown legal content block: ${block.type}`)
  }).join('\n')
}

export function renderLegalArticle(doc, { downloadable = true } = {}) {
  const e = escapeHtml
  return `<article class="public-page legal-page"><p class="legal-draft" role="note">${e(doc.notice)}</p>
<header><h1>${e(doc.title)}</h1><p>Aktualizacja: ${e(doc.updated)} · Wersja ${e(doc.version)}</p><p class="legal-lead">${e(doc.summary)}</p>${downloadable ? `<p><a href="${documentDownloadPath(doc)}" download>Pobierz dokument (HTML)</a></p>` : ''}</header>
<nav class="legal-toc" aria-label="Spis treści"><strong>W tym dokumencie</strong><ol>${doc.sections.map(section => `<li><a href="#${e(section.id)}">${e(section.title)}</a></li>`).join('')}</ol></nav>
<div class="prose">${doc.sections.map(section => `<section id="${e(section.id)}"><h2>${e(section.title)}</h2>${renderLegalBlocks(section.blocks)}</section>`).join('\n')}</div></article>`
}

export const legalStyles = `
.legal-page{width:min(900px,calc(100% - 48px));margin:48px auto 80px;color:#213d33;font:16px/1.75 system-ui,sans-serif}
.legal-page h1{font-size:clamp(32px,5vw,44px);line-height:1.15;letter-spacing:-1.5px;margin:0 0 14px}
.legal-page h2{font-size:23px;line-height:1.35;letter-spacing:-.5px;margin:0 0 18px}
.legal-page p{margin:14px 0}.legal-page li{margin:10px 0}.legal-page a{text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}
.legal-page section{margin-top:40px!important;scroll-margin-top:120px}.legal-page ul{padding-left:24px}
.legal-lead{font-size:18px;color:#516359}.legal-draft{background:#fff4db;border:1px solid #e3d5b0;border-radius:10px;padding:16px;font-size:14px}
.legal-toc{background:#edf2e8;padding:22px 26px;border-radius:12px;margin:28px 0}.legal-toc ol{padding:0;list-style:none;columns:2;column-gap:28px}.legal-toc li{break-inside:avoid;font-size:14px}
.legal-table{overflow-x:auto;margin:20px 0}.legal-table table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.65}.legal-table th,.legal-table td{text-align:left;vertical-align:top;border:1px solid #dfe4da;padding:14px;min-width:150px}.legal-table thead{background:#edf2e8}.legal-table tbody th{width:28%;font-weight:650}
.legal-links{font-size:14px}.legal-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.legal-actions a{text-decoration:none}
@media(max-width:600px){.legal-page{width:calc(100% - 32px);font-size:15px}.legal-toc ol{columns:1}.legal-table th,.legal-table td{padding:10px;min-width:130px}}
@media print{.site-header,.site-footer,.legal-actions,.legal-toc,.privacy-choice,.no-print{display:none!important}.legal-page{width:100%;margin:0;font-size:11pt;color:#000}.legal-page section{scroll-margin:0}.legal-page h2{break-after:avoid;font-size:15pt}.legal-table{overflow:visible}.legal-table tr{break-inside:avoid}a{color:inherit}.legal-draft{border-color:#aaa;background:none}}
`

export function standaloneLegalDocument(doc, origin = '') {
  const article = renderLegalArticle(doc, { downloadable: false })
    .replace(/href="\/(?!\/)([^"\n]*)"/g, (_, path) => `href="${escapeHtml(origin)}/${path}"`)
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(doc.title)} — Ogarnij Maturę — ${escapeHtml(doc.version)}</title><style>${legalStyles}</style></head><body>${article}<p class="legal-page">Kopia dokumentu. Oświadczenia i żądania należy wysłać do usługodawcy; zapisanie tego pliku nie wysyła żadnego zgłoszenia.</p></body></html>`
}
