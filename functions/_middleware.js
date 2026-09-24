// Cloudflare Pages Function — runs for every request to this site.
// Instead of 58 duplicated pre-rendered HTML files (7MB+ of repeated
// app code), this serves ONE index.html and injects the correct
// <title>, meta description, and OG/Twitter tags server-side based on
// the requested path. Search engines and social-media link previews
// see fully-formed per-page metadata; the app itself is identical
// either way since routing has always happened client-side via the
// URL hash.

import ROUTES from './routes.json';

const SITE = 'https://yorkwork.co.uk';

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  let path = url.pathname;

  // Only intercept clean directory-style paths; let real static assets
  // (favicon, robots.txt, sitemap.xml, etc.) pass through untouched.
  if (!path.endsWith('/')) {
    return next();
  }

  const route = ROUTES[path];
  const response = await next(); // fetches the base index.html asset
  if (!route) return response;

  const html = await response.text();
  const fullUrl = SITE + path;
  const title = escAttr(route.title);
  const desc = escAttr(route.description);
  const image = route.image;

  let out = html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${desc}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${fullUrl}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${desc}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${fullUrl}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${image}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${desc}">`)
    .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${image}">`);

  // Bootstrap the client-side hash router so a direct visit to e.g.
  // /product/15/ lands on that product, matching the old pre-rendered
  // pages' behaviour.
  const hash = route.product
    ? `#/product${path.replace(/^\/product|\/$/g, '')}`
    : `#${path.replace(/\/$/, '')}`;
  const bootstrap = `<script>if(!window.location.hash) window.location.hash = "${hash}";</script>\n<script>`;
  out = out.replace('\n<script>\n', '\n' + bootstrap + '\n');

  if (route.product) {
    const jsonld = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": route.name,
      "description": route.description,
      "image": route.image,
      "offers": {
        "@type": "Offer",
        "url": fullUrl,
        "priceCurrency": "GBP",
        "price": route.price,
        "availability": "https://schema.org/InStock"
      }
    };
    const marker = '</script>\n\n<link rel="preconnect" href="https://fonts.googleapis.com">';
    const insertion = `</script>\n\n<script type="application/ld+json">\n${JSON.stringify(jsonld)}\n</script>\n\n<link rel="preconnect" href="https://fonts.googleapis.com">`;
    out = out.replace(marker, insertion);
  }

  return new Response(out, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
