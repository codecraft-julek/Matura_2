// Reproducible logo proofs, platform PNGs, and a portable research / usage guide.
import { createCanvas, GlobalFonts, loadImage, Path2D } from '@napi-rs/canvas'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { OM_PATH, BRAND_COLORS as colors, BRAND_METRICS as metrics, markSvg, badgeSvg } from '../src/brand/identity.js'

const root = join(import.meta.dirname, '..')
const docs = join(root, 'docs')
mkdirSync(docs, { recursive: true })
const fontFiles = ['latin', 'latin-ext'].map(subset => join(root, `node_modules/@fontsource-variable/manrope/files/manrope-${subset}-wght-normal.woff2`))
for (const file of fontFiles) {
  if (!GlobalFonts.registerFromPath(file, 'Manrope')) throw new Error(`Cannot load ${file}`)
}

for (const [name, size, svg] of [
  ['favicon-16.png', 16, badgeSvg({ compact: true })],
  ['favicon-32.png', 32, badgeSvg({ compact: true })],
  ['apple-touch-icon.png', 180, badgeSvg()],
]) {
  const canvas = createCanvas(size, size)
  canvas.getContext('2d').drawImage(await loadImage(Buffer.from(svg)), 0, 0, size, size)
  writeFileSync(join(root, 'public', name), canvas.toBuffer('image/png'))
}

const canvas = createCanvas(1400, 1060)
const ctx = canvas.getContext('2d')
const path = new Path2D(OM_PATH)
function rect(x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}
function text(value, x, y, size = 18, weight = 500, color = colors.ink) {
  ctx.font = `${weight} ${size}px "Manrope"`
  ctx.fontVariationSettings = `"wght" ${weight}`
  ctx.fillStyle = color
  ctx.fillText(value, x, y)
}
function mark(x, y, size, color = colors.ink) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / metrics.grid, size / metrics.grid)
  ctx.fillStyle = color
  ctx.fill(path, 'evenodd')
  ctx.restore()
}
function lockup(x, y, size, fontSize, gap, color = colors.ink) {
  mark(x, y, size, color)
  ctx.save()
  ctx.letterSpacing = `${-fontSize * .035}px`
  text('ogarnij', x + size + gap, y + size / 2 - fontSize * .14, fontSize, 750, color)
  text('maturę.', x + size + gap, y + size / 2 + fontSize * .95, fontSize, 750, color)
  ctx.restore()
}

rect(0, 0, 1400, 1060, colors.paper)
text('OGARNIJ MATURĘ / TOŻSAMOŚĆ WIZUALNA', 64, 58, 14, 700)
text('OM. Jeden wspólny pion.', 64, 122, 42, 750)
text('Autorska ligatura: miękkie O, zdecydowane M, otwarte wnętrze.', 64, 158, 19)
lockup(67, 214, 176, 54, 36)
text('01 / Znak i nazwa', 64, 448, 14, 650)

rect(700, 198, 636, 272, colors.ink)
lockup(750, 244, 144, 44, 30, colors.lime)
text('02 / Wersja odwrócona', 748, 442, 14, 650, colors.lime)

rect(64, 514, 1272, 1, '#dce2d8')
text('03 / Rzeczywista skala', 64, 552, 14, 650)
text('04 / Jeden kolor', 510, 552, 14, 650)
text('05 / Siatka i światło', 950, 552, 14, 650)
for (const [index, size] of [16, 24, 32, 48].entries()) {
  const x = 64 + index * 99
  mark(x, 602, size)
  text(`${size} px`, x, 686, 13)
  const badge = await loadImage(Buffer.from(badgeSvg({ compact: true })))
  ctx.drawImage(badge, x, 716, size, size)
}
text('Symbol / ikona przeglądarki', 64, 799, 13)
mark(510, 595, 102, '#000000')
rect(666, 582, 144, 144, '#000000')
mark(687, 603, 102, '#ffffff')
text('Czytelny bez koloru i efektów', 510, 799, 13)

const gx = 966, gy = 590, unit = 2.6
ctx.strokeStyle = '#e0e5dc'
ctx.lineWidth = 1
for (let i = 0; i <= 64; i += 4) {
  ctx.beginPath()
  ctx.moveTo(gx + i * unit, gy)
  ctx.lineTo(gx + i * unit, gy + 64 * unit)
  ctx.moveTo(gx, gy + i * unit)
  ctx.lineTo(gx + 64 * unit, gy + i * unit)
  ctx.stroke()
}
mark(gx, gy, 64 * unit)
text('64', 1156, 610, 15, 750)
text('siatka', 1156, 631, 13)
text('10', 1156, 670, 15, 750)
text('grubość pionów', 1156, 691, 13)
text('12', 1156, 730, 15, 750)
text('światło O', 1156, 751, 13)
text('Jedna geometria we wszystkich plikach', 950, 799, 13)

rect(64, 844, 1272, 1, '#dce2d8')
text('06 / Przykład nagłówka', 64, 883, 14, 650)
lockup(64, 925, 43, 20, 11)
text('Arkusze', 532, 951, 16)
text('Wypracowania', 658, 951, 16)
text('Jak to działa', 849, 951, 16)
rect(1128, 916, 208, 54, colors.ink)
text('Zacznij naukę', 1174, 950, 16, 650, colors.paper)
text('Konstrukcja i próby optyczne; nie jest to badanie rozpoznawalności z użytkownikami.', 64, 1020, 13)
writeFileSync(join(docs, 'brand-preview.png'), canvas.toBuffer('image/png'))

const sources = [
  ['Google Design', 'Evolving the Google Identity', 'https://design.google/library/evolving-google-identity', 'Kształty geometryczne wymagają korekt optycznych i oceny w różnych skalach. System to także wersja przeznaczona do małych powierzchni.', 'Oceniono OM w 16, 24, 32 i 48 px. Favicon ma mniej marginesu niż awatar; geometria liter pozostaje wspólna.'],
  ['IBM Design Language', '8-bar logo', 'https://www.ibm.com/design/language/ibm-logos/8-bar/', 'Wersje jasne i ciemne, kontrast, proporcje oraz wolna przestrzeń są częścią specyfikacji marki. IBM stosuje też własne korekty optyczne.', 'Przygotowano wersje zieloną, limonkową, czarną i białą. Zachowano tę samą geometrię po sprawdzeniu na jasnym i ciemnym tle.'],
  ['Pentagram', 'MIT Media Lab', 'https://www.pentagram.com/work/mit-media-lab', 'Spójna siatka może porządkować zarówno monogram, jak i szerszą rodzinę znaków.', 'OM ma siatkę 64 jednostek, piony o grubości 10 i wspólny element obu liter. Nie zapożycza kształtu znaku MIT.'],
  ['Pentagram', 'Tigermilk', 'https://www.pentagram.com/work/tigermilk', 'Monogram TM powstaje z relacji elementów liter i przestrzeni między nimi. To przykład integracji inicjałów z typografią.', 'O i M łączy jeden pion. Nie dokładamy drugiego symbolu ani obrysu wokół liter.'],
  ['Pentagram', 'Digital Turbine', 'https://www.pentagram.com/work/digital-turbine/story', 'Symbol i logotyp mogą korzystać z pokrewnej geometrii i działać w różnych układach cyfrowych.', 'Monogram połączono z używanym już w aplikacji Manrope. Nazwa zachowuje zwarty układ w dwóch wierszach.'],
  ['Mastercard', 'Brand requirements', 'https://www.mastercard.com/brandcenter/us/en/brand-requirements/mastercard.html', 'Praktyczny system określa minimalny rozmiar, pole ochronne i warunki kontrastu.', 'Ustalono własne minima i pole ochronne OM. Wartości Mastercard dotyczą ich marki, nie są uniwersalną normą.'],
  ['Nielsen Norman Group', 'Centered Logos Hurt Website Navigation', 'https://www.nngroup.com/articles/centered-logos/', 'Położenie logo i powrót na stronę główną mają znaczenie dla nawigacji.', 'Logo pozostaje u góry po lewej i prowadzi na stronę główną. Badanie nie dowodzi skuteczności samego kształtu OM.'],
]
const fontSource = readFileSync(join(root, 'node_modules/@fontsource-variable/manrope/wght.css'), 'utf8')
const fontCss = fontFiles.map(file => {
  const filename = file.slice(file.lastIndexOf('/') + 1)
  const range = fontSource.split(filename)[1].match(/unicode-range:\s*([^;]+);/)[1]
  return `@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2');font-weight:200 800;unicode-range:${range}}`
}).join('\n')
const symbol = markSvg({ decorative: true })
const lime = markSvg({ color: colors.lime, decorative: true })
const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ogarnij Maturę — logo i zasady marki</title><style>
${fontCss}
:root{color-scheme:light;--ink:${colors.ink};--paper:${colors.paper};--lime:${colors.lime}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 Manrope,Arial,sans-serif}main{max-width:1120px;margin:auto;padding:54px 32px 80px}h1,h2,h3{line-height:1.15;letter-spacing:-.035em}h1{font-size:clamp(36px,6vw,68px);max-width:850px;margin:24px 0}h2{font-size:30px;margin:0 0 24px}h3{font-size:21px}p{max-width:780px}a{color:inherit;text-underline-offset:4px}section{margin-top:60px;padding-top:36px;border-top:1px solid #dce2d8}.eyebrow{font-size:12px;font-weight:750;letter-spacing:.08em}.lead{font-size:20px}.hero{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:42px 0}.panel{min-height:240px;display:flex;align-items:center;justify-content:center;padding:36px;background:#edf0e7}.reverse{background:var(--ink);color:var(--lime)}.lockup{display:flex;align-items:center;gap:24px}.lockup svg{width:112px;height:112px;flex-shrink:0}.name{font-size:34px;font-weight:750;line-height:1.04;letter-spacing:-.035em}.name span{display:block;margin-top:3px}.sizes{display:flex;gap:48px;align-items:end;flex-wrap:wrap}.sample{display:flex;flex-direction:column;align-items:start;gap:20px}.sample small{font-size:12px}.mono{display:flex;gap:16px;flex-wrap:wrap;margin:24px 0}.mono>div{width:150px;height:150px;display:grid;place-items:center}.mono svg{width:90px;height:90px}.swatches{display:flex;gap:20px;flex-wrap:wrap}.swatch{padding-top:70px;border-top:64px solid var(--swatch);min-width:180px}.swatch code{display:block}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;vertical-align:top;padding:18px 14px;border-bottom:1px solid #dce2d8}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em}td:first-child{width:23%}.table-wrap{overflow:auto}ul{padding-left:23px}li{margin:10px 0}.note{font-size:14px;color:#516359}.assets{display:flex;gap:12px;flex-wrap:wrap}.assets a{border:1px solid #b7c4b5;padding:9px 15px;text-decoration:none;font-size:14px}@media(max-width:680px){main{padding:32px 20px}.hero{grid-template-columns:1fr}.panel{min-height:200px}.lockup svg{width:88px;height:88px}.name{font-size:29px}.sizes{gap:28px}th,td{padding:12px 8px;min-width:180px}}
</style></head><body><main>
<div class="eyebrow">OGARNIJ MATURĘ / SPECYFIKACJA LOGO / 30.10.2026</div>
<h1>Dwie litery.<br>Jeden wspólny pion.</h1>
<p class="lead">Abstrakcyjny monogram OM: zaokrąglone O przechodzi we wspólny pion i zdecydowane M. Znak działa samodzielnie oraz obok pełnej nazwy.</p>
<div class="hero"><div class="panel"><div class="lockup">${symbol}<div class="name">ogarnij<span>maturę.</span></div></div></div><div class="panel reverse"><div class="lockup">${lime}<div class="name">ogarnij<span>maturę.</span></div></div></div></div>
<p>Nie ma jednej obowiązującej normy „nowoczesnego logo”. Poniższa specyfikacja przekłada praktyki opisane przez zespoły projektowe na konkretny znak tej aplikacji: prostą sylwetkę, otwarte wnętrze, spójną typografię i kontrolę w małych rozmiarach.</p>
<section><h2>Konstrukcja i typografia</h2><ul>
<li><strong>Siatka 64 × 64:</strong> główny rysunek mieści się w granicach x = 3–61, y = 8–56. Piony mają grubość 10, a światło O ma szerokość 12 jednostek.</li>
<li><strong>Wspólny pion:</strong> litery tworzą jeden wypełniony kształt z otworem. Nie ma nakładających się obrysów, przypadkowych szczelin ani przechylenia.</li>
<li><strong>Nazwa:</strong> Manrope, grubość 750, odstępy −0,035 em, interlinia 1,04. Dwa wiersze: „ogarnij” i „maturę.”; odstęp między nimi 3 px w nagłówku.</li>
<li><strong>Nagłówek:</strong> kontener znaku 43 × 46 px, nazwa 20 px, odstęp 11 px. Na najmniejszych ekranach: 32 × 35 px, nazwa 16 px, odstęp 8 px.</li>
<li><strong>Pole ochronne:</strong> wokół samodzielnego znaku zostaw co najmniej 10 jednostek siatki od granic rysunku. Wokół całego zestawu z nazwą użyj tej samej wartości przeskalowanej do rozmiaru symbolu. Ikony aplikacji i przeglądarki mają własne kadrowanie opisane niżej.</li>
</ul><p class="note">Porównano również zaokrągloną ligaturę małych liter. Odrzucono ją w przeglądzie wizualnym: połączenie przypominało „am”, a wąskie szczeliny utrudniały odczyt w małej skali.</p></section>
<section><h2>Najpierw mała skala</h2><div class="sizes">${[16,24,32,48].map(size => `<div class="sample"><div style="width:${size}px;height:${size}px">${symbol}</div><small>${size} px · symbol</small><div style="width:${size}px;height:${size}px">${badgeSvg({ compact: true })}</div><small>${size} px · favicon</small></div>`).join('')}</div><p>Minimalny rozmiar samodzielnego symbolu: 16 × 16 px. Zestaw z nazwą: symbol co najmniej 32 px i litery co najmniej 16 px. Próbki powyżej są wyświetlane w podanych rozmiarach CSS.</p><p>Favicon wypełnia 96% pola siatki; awatar i ikona Apple — 82%. To różnica w marginesach, nie inny rysunek liter. Pliki PNG 16 i 32 px uzupełniają skalowalny SVG.</p></section>
<section><h2>Kolor jest opcją, czytelność — warunkiem</h2><div class="mono"><div style="background:white">${markSvg({color:'#000000',decorative:true})}</div><div style="background:black">${markSvg({color:'#ffffff',decorative:true})}</div><div style="background:${colors.ink}">${lime}</div></div><div class="swatches">${Object.entries({ 'Zieleń':colors.ink,'Limonka':colors.lime,'Papier':colors.paper }).map(([name,color]) => `<div class="swatch" style="--swatch:${color}">${name}<code>${color}</code></div>`).join('')}</div><p>Podstawowe połączenie: zielony znak na jasnym tle. Odwrócone: limonka lub biel na zieleni. Limonki nie używaj jako samodzielnego logo na jasnym tle. Zachowaj proporcje i pole ochronne; nie obracaj, nie rozciągaj i nie dodawaj cieni, gradientów ani obrysów.</p></section>
<section><h2>Źródła i decyzje projektowe</h2><p>Przegląd oparto na opisach projektów i oficjalnych wytycznych poniżej. Wartości liczbowe innych marek nie są przenoszone automatycznie na OM. Badania nawigacji pomagają w umiejscowieniu logo; nie potwierdzają skuteczności jego nowego kształtu.</p><div class="table-wrap"><table><thead><tr><th>Źródło</th><th>Wniosek z materiału</th><th>Zastosowanie w OM</th></tr></thead><tbody>${sources.map(([org,title,url,finding,decision]) => `<tr><td><strong>${org}</strong><br><a href="${url}">${title}</a></td><td>${finding}</td><td>${decision}</td></tr>`).join('')}</tbody></table></div></section>
<section><h2>Pliki i kontrola spójności</h2><p>Jedynym źródłem geometrii jest <code>src/brand/identity.js</code>. Korzystają z niego komponent Vue, statyczny nagłówek i generator plików. Po zmianie znaku uruchom <code>npm run brand:build</code>.</p><div class="assets"><a href="../public/logo.svg">Znak SVG</a><a href="../public/brand/om-avatar.svg">Awatar SVG</a><a href="../public/brand/om-black.svg">Czarny SVG</a><a href="../public/brand/om-white.svg">Biały SVG</a><a href="../public/brand/om-lime.svg">Limonkowy SVG</a><a href="brand-preview.png">Plansza PNG</a></div><p class="note">Wykonano próby optyczne w małej skali i w jednym kolorze. To przegląd projektowy, nie badanie rozpoznawalności z użytkownikami ani obietnica wzrostu konwersji. Plansza PNG pokazuje przykładowy nagłówek, nie zrzut ekranu przeglądarki.</p></section>
</main></body></html>`
writeFileSync(join(docs, 'BRAND-GUIDELINES.html'), html)
console.log('Generated platform PNGs, docs/brand-preview.png, and docs/BRAND-GUIDELINES.html.')
