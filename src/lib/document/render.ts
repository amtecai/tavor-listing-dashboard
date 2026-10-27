// SummaryFields -> the Tavor "Property Opportunity Summary" as one HTML document.
// Layout, type sizes and colours are measured from Tavor's example PDF (6 A4 pages, pages 3-4
// landscape), not from the earlier web template. All units are points, so 1:1 with the PDF.
import type { Development, Row, SummaryFields } from '../types'

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const img = (field: string, src: string | null, cls: string, alt: string) =>
  `<div class="frame ${cls}${src ? '' : ' empty'}"><img data-field="${field}" src="${esc(src ?? '')}" alt="${esc(alt)}"></div>`

const paragraphs = (text: string) =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('')

const rows = (prefix: string, list: Row[]) =>
  list.map((r, i) => `<div class="row"><span data-field="${prefix}.${i}.label">${esc(r.label)}</span><span class="v" data-field="${prefix}.${i}.value">${esc(r.value)}</span></div>`).join('')

const header = `<img class="wordmark" src="/brand/wordmark.png" alt="Tavor Partners"><img class="mark" src="/brand/symbol.png" alt="">`

const development = (d: Development, i: number) => `<div class="dev">
  ${img(`developments.${i}.image`, d.image, 'dev-img', d.name)}
  <div class="dev-name" data-field="developments.${i}.name">${esc(d.name)}</div>
  <div class="dev-address" data-field="developments.${i}.address">${esc(d.address)}</div>
  <div class="dev-type" data-field="developments.${i}.type">${esc(d.type)}</div>
  <div class="dev-desc fit" data-field="developments.${i}.description">${esc(d.description)}</div>
</div>`

export const DOCUMENT_CSS = `
@font-face{font-family:Newsreader;src:url(/fonts/Newsreader60-Regular.woff2) format('woff2');font-weight:400}
@font-face{font-family:Poppins;src:url(/fonts/Poppins-Light.woff2) format('woff2');font-weight:300}
@font-face{font-family:Poppins;src:url(/fonts/Poppins-LightItalic.woff2) format('woff2');font-weight:300;font-style:italic}
@font-face{font-family:Poppins;src:url(/fonts/Poppins-Regular.woff2) format('woff2');font-weight:400}
@font-face{font-family:Poppins;src:url(/fonts/Poppins-Medium.woff2) format('woff2');font-weight:500}
:root{--bg:#EDEDE8;--green:#08403B;--ink:#000}
@page portrait{size:595.5pt 842.25pt;margin:0}
@page landscape{size:842.25pt 595.5pt;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Poppins,sans-serif;color:var(--ink);background:#d6d5cf}
.page{position:relative;overflow:hidden;background:var(--bg);width:595.5pt;height:842.25pt;page:portrait;break-after:page}
.page.landscape{width:842.25pt;height:595.5pt;page:landscape}
.page:last-child{break-after:auto}
.page>*{position:absolute}
.serif{font-family:Newsreader,serif;font-weight:400;color:var(--green)}
.frame{overflow:hidden}
.frame img{display:block;width:100%;height:100%;object-fit:cover}
.frame.empty{background:#dcdcd5}
.frame.empty img{visibility:hidden}
.wordmark{left:36pt;top:39.2pt;width:99.2pt}
.mark{right:36pt;top:36.2pt;width:30pt}
.landscape .mark{right:36pt}
.pno{right:36pt;top:807.4pt;font-size:10pt;line-height:14pt;color:var(--green)}
.landscape .pno{top:560.7pt}
/* cover */
.cover-mark{left:36pt;top:37pt;width:57.5pt}
.cover-title{left:169.9pt;top:86.8pt;font-size:28pt;line-height:33pt}
.hero{left:169.8pt;top:200pt;width:389.7pt;height:465.2pt}
.cover-address{right:36pt;top:681pt;width:389.7pt;text-align:right;font-size:12pt;font-weight:300;line-height:16.8pt;color:var(--green)}
.cover-date{right:37.7pt;top:795.3pt;font-size:12pt;line-height:16.8pt;color:var(--green)}
.stacked{left:36pt;top:772.2pt;width:79.8pt}
/* opportunity */
.photo{left:230.5pt;top:80.5pt;width:329pt;height:351.5pt}
.h1{left:36pt;font-size:28pt;line-height:28pt}
.table{left:36pt;width:523.5pt;border-top:.5pt solid var(--green)}
.row{display:flex;justify-content:space-between;gap:12pt;border-bottom:.5pt solid var(--green);font-size:12pt;line-height:16.8pt;padding:4.4pt 4.9pt 0 2.8pt}
.row span:first-child{font-weight:300;color:var(--green);white-space:nowrap}
.row .v{text-align:right}
.details .row{height:25.5pt}
.demo .row{height:23.97pt;padding-top:5.2pt}
.description{left:38.8pt;top:695pt;width:509pt;height:116pt;column-count:2;column-gap:22pt;column-fill:auto;font-size:10pt;font-weight:300;line-height:14.27pt}
.description p+p{break-before:column}
/* floor plan + aerial */
.h2{left:36pt;top:74.6pt;font-size:22pt;line-height:22pt}
.plan{left:36pt;top:118.5pt;width:770.2pt;height:417pt;display:flex;justify-content:center;align-items:flex-start}
.plan img{max-width:100%;max-height:100%;display:block}
.plan.empty{background:#dcdcd5}
.aerial{left:35.5pt;top:155.5pt;width:770.7pt;height:350.5pt}
/* demographics + developments */
.devs{left:36pt;top:487.5pt;width:523.5pt;display:grid;grid-template-columns:repeat(4,1fr);column-gap:11.83pt}
.devs>*{position:static}
.dev>div:not(.frame){padding-right:3pt}
.dev-img{height:82.5pt}
.dev-name{margin-top:10.3pt;height:34.2pt;font-size:12pt;line-height:16.8pt;font-weight:500;color:var(--green)}
.dev-address{height:42.5pt;font-size:10pt;font-weight:300;line-height:11.3pt;color:var(--green);padding-top:1.35pt}
.dev-type{height:27.9pt;font-size:10pt;line-height:14pt}
.dev-desc{height:118pt;overflow:hidden;font-size:10pt;line-height:11.25pt;padding-top:1.4pt;hyphens:manual}
/* back cover */
.back-mark{left:36pt;top:36pt;width:52.2pt}
.cta{left:175pt;font-size:24pt;line-height:28.5pt;letter-spacing:-.015em}
.qr{left:175.5pt;top:479.8pt;width:97.7pt}
.back-stacked{left:36pt;top:775.2pt;width:72.2pt}
.disclaimer{left:162.2pt;top:776.9pt;width:398pt;font-size:7pt;font-style:italic;font-weight:300;line-height:13.5pt;color:var(--green)}
@media screen{
  body{padding:24px 0}
  .page{margin:0 auto 24px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08)}
}
@media print{body{background:none}}
`

// Shrinks text in .fit boxes (description, development blurbs) until it fits its frame.
export const FIT_SCRIPT = `
(function(){
  function fit(){
    document.querySelectorAll('.fit').forEach(function(el){
      el.style.fontSize='';el.style.lineHeight='';
      var size=parseFloat(getComputedStyle(el).fontSize),lh=parseFloat(getComputedStyle(el).lineHeight)/size,min=size*0.8;
      var over=function(){return el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1};
      while(over()&&size>min){size-=0.25;el.style.fontSize=size+'px';el.style.lineHeight=(size*lh)+'px'}
    });
  }
  function scale(){
    if(matchMedia('print').matches)return;
    var widest=0;document.querySelectorAll('.page').forEach(function(p){widest=Math.max(widest,p.offsetWidth)});
    var z=Math.min(1,(window.innerWidth-32)/widest);document.body.style.zoom=z>0?z:1;
  }
  window.__tavorLayout=function(){fit();scale()};
  (document.fonts?document.fonts.ready:Promise.resolve()).then(window.__tavorLayout);
  window.addEventListener('resize',scale);
})();
`

export function renderDocument(f: SummaryFields): string {
  const title = `Property Opportunity Summary · ${f.address}`
  const pages = [
    `<section class="page opportunity">
  ${header}
  ${img('photo', f.photo, 'photo', 'Property photo')}
  <h2 class="serif h1" style="top:457.2pt">Opportunity Details</h2>
  <div class="table details" style="top:506.2pt">${rows('details', f.details)}</div>
  <div class="description fit" data-field="description">${paragraphs(f.description)}</div>
  <div class="pno">{{n}}</div>
</section>`,
    f.floorPlan &&
      `<section class="page landscape floorplan">
  ${header}
  <h2 class="serif h2">Floor Plan</h2>
  <div class="plan"><img data-field="floorPlan" src="${esc(f.floorPlan)}" alt="Floor plan"></div>
  <div class="pno">{{n}}</div>
</section>`,
    `<section class="page landscape aerial-page">
  ${header}
  <h2 class="serif h2">Aerial Overview</h2>
  ${img('aerialImage', f.aerialImage, 'aerial', 'Aerial overview')}
  <div class="pno">{{n}}</div>
</section>`,
    `<section class="page demographics">
  ${header}
  <h2 class="serif h1" style="top:92.7pt;line-height:33pt">Demographic<br>Insights</h2>
  <div class="table demo" style="top:194.7pt">${rows('demographics', f.demographics)}</div>
  <h2 class="serif h1" style="top:400pt;line-height:33pt">Development<br>Activity</h2>
  <div class="devs">${f.developments.slice(0, 4).map(development).join('')}</div>
  <div class="pno">{{n}}</div>
</section>`,
    `<section class="page back">
  <img class="back-mark" src="/brand/symbol.png" alt="">
  <p class="serif cta" style="top:259.85pt">Looking for<br>something else?</p>
  <p class="serif cta" style="top:367.15pt">Tell us more about your<br>leasing requirements</p>
  <img class="qr" data-field="qrImage" src="${esc(f.qrImage)}" alt="QR code">
  <img class="back-stacked" src="/brand/stacked.png" alt="Tavor Partners">
  <p class="disclaimer" data-field="disclaimer">${esc(f.disclaimer)}</p>
  <div class="pno">{{n}}</div>
</section>`,
  ].filter(Boolean) as string[]
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
<section class="page cover">
  <img class="cover-mark" src="/brand/symbol.png" alt="">
  <h1 class="serif cover-title">Property<br>Opportunity<br>Summary</h1>
  ${img('heroImage', f.heroImage, 'hero', f.address)}
  <div class="cover-address" data-field="address">${esc(f.address)}</div>
  <img class="stacked" src="/brand/stacked.png" alt="Tavor Partners">
  <div class="cover-date" data-field="date">${esc(f.date)}</div>
</section>
${pages.map((page, i) => page.replace('{{n}}', String(i + 2))).join('\n')}
<script>${FIT_SCRIPT}</script>
</body>
</html>`
}
