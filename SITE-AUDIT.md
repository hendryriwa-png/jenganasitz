# JengaNasi — Live Site Audit

**Site:** https://jenganasitz.vercel.app/
**Date:** 27 October 2026
**Scope:** Homepage, navigation, search/filter, cart, auth/vendor onboarding, checkout, legal page, SEO/a11y, security, deployment config.
**Method:** Live browser testing (desktop 1440px, tablet 648/768px, phone 375px), Lighthouse + axe-core, network/console inspection, and comparison against the local source in this repo.

---

> **Post-remediation status (27 Oct 2026):** The P0/P1 findings below were fixed and deployed to production. The live build was verified for admin sign-in, customer/vendor registration, session restore, RLS, CSP/security headers, robots/sitemap, and responsive layout; Lighthouse Accessibility, Best Practices, and SEO are 100. The exposed token was removed from the deployment and is already invalid. **Storefront realism pass (27 Oct 2026):** the catalogue is now DB-driven with 10 verified vendors and 51 active products across all 12 categories and 6 regions; hero stats, featured vendors, vendor cards and filters read from Supabase. Product detail, vendor filtering, server-side checkout (`place_marketplace_order`), order confirmation, customer order history, vendor product add/edit/remove, and vendor order-status updates were implemented and tested. Legacy test accounts were removed, and all 44 unique product image URLs were verified HTTP 200. `?demo=1` intentionally forces the demo catalogue with checkout disabled. **Still open:** SMTP/password-reset delivery, and vendor KYC document storage (uploads remain preview-only — no Supabase Storage bucket yet).

---

## What changed in the storefront realism pass

- **Catalogue:** 10 verified Tanzanian vendors and 51 active products seeded across Cement, Steel, Roofing, Tiles, Paint, Plumbing, Electrical, Tools, Timber, Aggregates, Sanitary, and Hardware. Vendor rows are display-only; real vendor accounts remain separate.
- **Storefront:** products, hero counts, featured vendor names, vendor cards, ratings, product counts, and category counts are read from Supabase. Vendor cards open a filtered product view. Product cards open a detail modal with stock, description, vendor, and quantity limits.
- **Checkout:** `place_marketplace_order` validates product availability and stock server-side, creates one order per vendor with a shared order number, decrements stock, and returns a confirmation. Payment is cash or M-Pesa on delivery.
- **Accounts:** customers see order history in **My Account**. Vendors can add, edit, and soft-remove products, and advance their own orders through confirmed/delivered.
- **Security:** order writes are server-side; vendors may only update the `status` column on their own orders. Public vendor data comes from the narrow `public_vendors` view, not the vendors table.
- **Demo mode:** `?demo=1` forces the demo catalogue and disables checkout.

---

## Verdict

The storefront looks credible and loads fast, but it is a **static shell, not a working marketplace**. The product query is broken, product/category search does nothing, checkout is a stub, and vendor KYC documents are never stored. Two things should be handled before anything else: a **GitHub token is publicly downloadable from the deployment**, and on a 375px phone the **navigation, cart, and account controls are unreachable**.

| Severity | Count | Themes |
|---|---|---|
| P0 — Critical | 3 | Exposed credential, mobile nav/cart unreachable, product data broken |
| P1 — High | 7 | Search/filter no-ops, stub checkout, desktop hero overlap, KYC discarded, XSS, DB drift |
| P2 — Medium | 9 | SEO, social previews, accessibility, CSP, placeholder legal copy, dead links |

---

## P0 — Fix immediately

### 1. GitHub personal access token is public at `/deploy.js`

`https://jenganasitz.vercel.app/deploy.js` is served with `200` and contains a hardcoded `ghp_…` token for `hendryriwa-png/jenganasi-tanzania` (line 4).

- Anyone can download it. It is also almost certainly committed to the Git repo (`.gitignore` only lists `.vercel` and `.env*`).
- **Revoke the token now** at GitHub → Settings → Developer settings → Personal access tokens, then rotate.
- Check the repo's audit log/commits for unauthorized pushes.
- Delete `deploy.js` from the repo and history, and stop shipping it.
- Add a `.vercelignore` (or ship from a `public/` output folder) so source/config files aren't uploaded:

```
.git
.github
supabase
node_modules
deploy.js
set-secrets.js
debug-secrets.js
check-*.js
test-*.js
find-*.js
final-*.js
audit.js
.env*
```

Good news: `.env.local` is **not** exposed (it falls back to `index.html`).

### 2. On phones, the header pushes the menu off-screen and hides the cart/account

At 375px (measured with Chrome device metrics):

- `scrollWidth` = **483px** vs viewport **375px** — the page scrolls sideways.
- `.nav-actions` spans **146 → 451px**; the hamburger starts at **x = 475px**, i.e. completely off-screen.
- At ≤768px, `.nav-actions .dropdown, .nav-actions #authBtn { display: none }` (live `styles.css` line 632) removes the cart and account buttons with **no alternative entry point**.
- Adding to cart shows a toast with no "View cart" action, so on mobile the cart is unreachable.

Net effect on a 375px phone: no menu, no cart, no sign-in — the only visible controls are the location bar and a clipped "Become a Vendor" button.

Fix: hide the location button and/or shorten the vendor button below ~480px, keep the hamburger inside the viewport, and move **Cart** and **Sign in** into the mobile menu. Test 320/360/375/414px.

### 3. Featured Products are hardcoded demo data because the DB query fails

Console on every load:

```
POST/GET …/rest/v1/products?select=*&status=eq.active&order=created_at.desc&limit=20  → 400
Products query failed: column products.created_at does not exist
```

`loadProducts()` catches the error and calls `loadMockProducts()` (`app.js` line 647), so visitors see six fake products and fake vendors.

Related:
- The `products`, `vendors` and `customers` tables are **empty** in production (`GET` returns `[]`).
- The mock data references dead Unsplash images: `photo-1581093458791…` and `photo-1558618047…` both return **404** (4 broken images visible: cement product, PVC product, and two vendor avatars).
- If the query is fixed while the table is empty, `renderProducts()` renders a blank section — there is no empty state.

Fix: add/select a real ordering column (`created_at` or `id`), seed or import products, add a "No products yet" state, and host images locally or verify every URL.

---

## P1 — High

### 4. Search and category filtering do nothing

Clicking Search or a category only rewrites the hash:

```js
// app.js
window.location.href = `#products?search=${encodeURIComponent(query)}`;
window.location.href = `#products?category=${categoryId}`;
```

Nothing parses `search` or `category`, and no render is triggered. Verified: searching "cement" returned all 6 products; clicking **Electrical** (zero products) also returned all 6. Reloading the resulting URL doesn't filter either.

Fix: read the params on load/`hashchange`, filter `allProducts`, render chips/empty states, and scroll after filtering.

### 5. Checkout, product detail, and vendor profile are placeholders

```js
function viewProduct() { showToast('Product detail view coming soon', 'info'); }
function viewVendor()  { showToast('Vendor profile coming soon', 'info'); }
async function placeOrder() { showToast('Order placement coming soon', 'info'); closeModal('checkoutModal'); }
```

The cart, quantity controls, delivery form and totals all work, but the final action is a toast. The "Place Order" button also doesn't validate the address/phone fields. Either implement order creation (the `place-order` edge function already exists) or remove checkout until it works.

### 6. Desktop hero overlaps the photo

At 1440px:

| Element | Right edge | Hero image starts |
|---|---|---|
| `h1` text ("…JengaNasi") | **768px** | **716px** |
| Search bar | **828px** | 716px |
| Floating "Easy Returns" card | 644 → 801px | 716px |
| Floating "Verified Vendors" card | 1348 → **1504px** | extends past the 1432px viewport |

The headline and search bar sit on top of the photo, and one floating card is cut off by the viewport. Cause: `.hero-content { max-width: 720px }` while `.hero-image { position:absolute; width:50%; right:0 }`, with no reserved space or breakpoint handoff. The floating cards are visible on live (the local CSS already hides them — that fix isn't deployed).

Fix: constrain hero content to the left column (`max-width: calc(50% - gap)`) at ≥1025px, remove/clip the floating cards, and test 1280/1440/1920.

### 7. Vendor KYC documents are collected but never uploaded or saved

- The four file inputs (NIDA, business licence, BRELA, TIN) are **not required**.
- `handleFilePreview()` only renders a local preview; files are never sent to Supabase Storage.
- `handleVendorRegister()` reads `form.vendorNationalId`, `form.vendorTin`, `form.brela`, `form.licence`, `form.vendorBank` — **none of these fields exist** in the form, so those values are always `null`.
- "TIN Number" is a file input, not a number field.
- On profile-insert failure it calls `_supabase.auth.admin.deleteUser(...)`, which requires a service-role key and will fail from the browser, leaving an orphan auth user.

For a marketplace that advertises verified vendors, this is both a broken flow and a compliance gap (collecting national ID documents without storing them securely). Implement a Storage bucket + signed uploads, make the documents required, and validate NIDA/TIN as text.

### 8. `esc()` doesn't escape anything — stored XSS risk

```js
function esc(str) {
  return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
    .replace(/"/g, '"').replace(/'/g, '&#039;');
}
```

Only the apostrophe is escaped. `esc('<b>x</b> & "q"')` returns the identical string. Product names, categories, units and vendor names are injected with `innerHTML`, and `p.image`/`p.id` are inserted raw into attributes and inline `onclick`. A vendor-supplied product name like `<img src=x onerror=…>` would execute for every visitor.

Fix:

```js
const ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc = (s) => String(s).replace(/[&<>"']/g, c => ESC[c]);
```

Also validate URLs (`https:` only) before putting them in `src`.

### 9. Production Supabase is out of sync with the migrations

- `products.created_at` is missing (query fails).
- The profile RPCs from `20260101000001_create_profile_functions.sql` don't exist in the live project (`PGRST202` on both).
- The migrations enable RLS on `customers`/`vendors` but define **no INSERT policy**; the web app inserts profiles directly from the client, so profile creation after signup is likely denied (the error is only logged as a warning).
- The vendor path then tries `auth.admin.deleteUser`, which can't work client-side.

Run the migrations against production, verify policies, and do profile creation server-side (the `sign-up` edge function was written for this but isn't called by the UI).

### 10. Edge-function source is publicly served

`/supabase/functions/sign-up/index.ts`, `sign-in`, `place-order`, `vendor-dashboard`, `notify-login` all return `200` with source (served as `video/mp2t` because of the `.ts` extension). No secrets are inside — keys come from `Deno.env` — but this exposes internal logic and is sloppy. Exclude `supabase/` from the deployment.

---

## P2 — Medium

### 11. `robots.txt` and `sitemap.xml` are fake

Both return `200 text/html` containing `index.html` (catch-all rewrite in `vercel.json`). Lighthouse SEO = **83** because of it. Add real files at the repo root:

```
# robots.txt
User-agent: *
Allow: /
Sitemap: https://jenganasitz.vercel.app/sitemap.xml
```

Also add `<meta name="robots" content="index,follow">` only after real product URLs exist; right now there's nothing to index beyond the homepage.

### 12. Social previews will be blank

`og:image`, `twitter:image` and the schema.org `image` are `data:image/svg+xml,…` URIs. Facebook, WhatsApp, X and LinkedIn do not render `data:` URIs for previews (and most don't accept SVG). Generate a 1200×630 PNG at a stable URL.

### 13. Accessibility — Lighthouse 95, axe 33 contrast failures

- **Contrast (serious):** amber `#f59e0b` on white = **2.14:1** (logo accent, hero accent, star ratings, reviews); price `#d97706` = 3.18:1; unit `#94a3b8` = 2.56:1. White text on amber buttons also = 2.14:1. Use a darker amber (e.g. `#b45309`) or dark text on amber.
- **Heading order:** vendor `<h4>` jumps from `<h2>`; footer `<h4>`s likewise. Use `h3`.
- **Footer landmark:** `<footer>` is inside `<main>`; move it out.
- **Unlabeled icon buttons:** `#authBtn` and 5 modal close buttons (location, forgot, reset, info, checkout) have no `aria-label`.
- **ARIA misuse:** `role="listitem"` on 24 `<article>` elements (`aria-allowed-role`); use `<ul>/<li>` or drop the roles.
- **Focus management:** modals don't move focus inside and don't trap/restore it. Escape and overlay-click do close them, which is good.

### 14. No Content-Security-Policy

HSTS, `X-Frame-Options: DENY`, `nosniff` and `Referrer-Policy` are set — good. Add a CSP; the app uses inline `onclick` and `innerHTML`, so start with `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net` and tighten over time. Also add `Permissions-Policy` (geolocation is used) and `Cross-Origin-Opener-Policy`.

### 15. Legal copy is a placeholder

Terms, Privacy and the fee structure are each a single paragraph (`openInfoModal`). There is no company registration, physical address, refund policy, data-retention or KYC handling language — not adequate for a marketplace that collects NIDA/BRELA/TIN documents. `legal.html` exists but is orphaned (nothing links to it).

### 16. Dead links and "View All" dead ends

17 `href="#"` links: Deals, Help Center, Shipping Info, Returns, Careers, Press, Blog, Vendor Dashboard, Pricing, Partner Program. "View All Products" and "View All Vendors" point back to `#products`/`#vendors` (no listing pages). Either build the pages or remove the links.

### 17. Marketing numbers contradict the database

"10,000+ products", "500+ vendors", "50,000+ orders", category counts (156 cement products, etc.) are hardcoded while the tables are empty. Fine for a demo, risky for trust/legal once real customers arrive. Drive them from the DB or label as illustrative.

### 18. PWA icons are SVG data URIs

`manifest.json` icons are inline SVG. Android install prompts generally expect 192/512 PNG; some browsers reject data-URI icons. Ship real PNGs.

### 19. Deployment is ahead of/behind the repo

The live site differs from the local source: live has **6** mock products, local has **12**; live shows hero floating cards, local CSS hides them; hero styles are different. Confirm which is the source of truth before fixing, or fixes will land in the wrong place. (The local files look like a newer redesign.)

---

## What works

- Fast and light: ~265 KB transferred, DOMContentLoaded ~1.3 s, load ~2.3 s on this connection.
- Correct viewport meta, good title/description, canonical URL, schema.org `OnlineStore`, manifest.
- Security headers: HSTS (2 years, preload), `X-Frame-Options: DENY`, `nosniff`, referrer policy.
- Supabase anon key is a proper `anon` JWT (public by design); no service-role key in the client.
- Location modal: 31 regions, updates both desktop/mobile labels and persists the selection.
- Sorting (price/rating/newest), cart add/quantity, password-strength meter, step-based auth modal, file previews, toasts, mobile menu toggle, Escape/overlay close all behave.
- Anon REST access is RLS-filtered (returns `[]`), and `.env.local` isn't downloadable.
- Lighthouse: Accessibility 95, Best Practices 100.

---

## Suggested order of work

1. **Today:** revoke the GitHub token; delete `deploy.js`; add `.vercelignore`; redeploy.
2. **Day 1:** fix the mobile header (cart/account in the menu, hamburger on-screen at 320–414px).
3. **Day 1:** fix the products schema/query, add an empty state, replace the four 404 images.
4. **Day 2:** make search/category filters real; fix the desktop hero overlap.
5. **Day 2:** fix `esc()` + add CSP; align Supabase migrations/policies and test a real signup.
6. **Week 1:** implement or hide checkout/product/vendor pages; build the vendor document upload; real robots/sitemap/OG image; contrast and label fixes; replace legal placeholders.

---

### Evidence snapshots (local temp)

- `C:\Users\hendr\AppData\Local\Temp\opencode\audit\desktop-1440.png` — hero overlap at 1440px
- `C:\Users\hendr\AppData\Local\Temp\opencode\audit\cdp-375-nomobile.png` — header cropping at 375px
- `C:\Users\hendr\AppData\Local\Temp\opencode\audit\lighthouse.json` — full Lighthouse report (from the audit run)
