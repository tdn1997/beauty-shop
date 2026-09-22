# BeautyShop — Storefront, Expanded Catalog, and Authentication Plan

- **Date:** 2026-09-22
- **Status:** Proposed — not implemented
- **Boundary:** Documentation only. Do not implement application code, run migrations/seeds, or alter `plans/beautyshop.md` in this task.

## 1. Objective and constraints

Extend BeautyShop into a responsive, accessible storefront backed by a public database catalog, with secure login/logout/session restoration, owned-address checkout, and admin UI/APIs available only to authenticated administrators.

Follow `CLAUDE.md`: Nest modules use `api → application → infrastructure` around a pure `domain`; dependencies point inward; application ports isolate adapters; controllers stay thin; time uses injected `Clock`; money uses `Money`/`bigint`, never JS `number`; and every slice follows TDD red–green–refactor. Tests start with `should`, use `arrange`/`confirm`/`act`/`assert`, and prove failures leave state unchanged.

## 2. Current state

- npm workspaces: Next.js 15/React 19, NestJS 11, Prisma 6/PostgreSQL, Vitest, Testcontainers.
- Web has a rose/cream Vietnamese design, Be Vietnam Pro, and `apps/web/src/styles/tokens.css`; improve rather than replace it.
- `apps/web/src/app/page.tsx` renders four hard-coded products from `apps/web/src/lib/catalog.ts` with blank thumbnails.
- Prisma has `Product`, `ProductVariant`, `InventoryLot`, and `CustomerAddress`, but no users/sessions. Seed has 4 products, 7 variants, 7 lots, one address, and can overwrite stock on rerun.
- Quote/checkout trust `request.user.customerId`; admin trusts role `admin`; `apps/api/src/main.ts` and `app.module.ts` establish no authenticated principal. Web proxies inject fixed identity/admin headers, which are not authentication.
- Header always shows Admin; admin layout has no session gate and displays `Admin Test`.
- Admin server pages self-fetch without forwarding cookies; orders turns failures into empty results.
- Checkout omits `currency: 'VND'` and expects `id`, `grandTotal`, and top-level `status` instead of `orderId`, `quote`, and `payment.status`.
- Quote ignores the address and hard-codes TP. Hồ Chí Minh.
- API money is bigint/string; web uses unsafe `parseFloat`/`parseInt`.
- Root `npm test` currently targets API and may discover Docker integration specs; there are no web tests. README claims require reconciliation.

Evidence: `apps/api/prisma/{schema.prisma,seed.ts}`, `apps/api/src/{main.ts,app.module.ts}`, ordering checkout controller/request/service, pricing quote controller, and web header/API routes/admin orders/catalog/tokens files.

## 3. Scope

**Include:** responsive storefront/cart/checkout/login/admin; public DB catalog; 16 products/27 variants/27 base lots; one admin and two customer accounts with three owned addresses; login/logout/restoration/expiry/disable/demotion; UI visibility plus server authorization; quote/checkout/address/money/idempotency fixes; automated API/PostgreSQL/web/browser coverage.

**Exclude:** registration, recovery, OAuth, MFA, CMS/catalog editing, new payments, payment reconciliation, server carts, reviews, ratings, and wishlist.

## 4. UX and visual design

### Storefront

- Retain tokens, rose/cream palette, and Be Vietnam Pro; refine spacing, type scale, contrast, focus, and responsiveness.
- Hero CTA anchors to catalog.
- Category and text search include result count, clear, and no-results. Fetch the complete bounded 16-product set and filter locally; never present partial-page search as full catalog search.
- Use local licensed/original illustrations via `next/image`, stable aspect ratio, alt text, fallback, and README provenance.
- Show Vietnamese categories/descriptions, variant labels, and exact formatted VND string prices; IDs remain distinct from SKUs.
- Derive stock labels from inventory. Accessibly select the first available variant; disable unavailable variants and add-to-cart for fully sold-out products.
- Include loading, retryable error, empty, and add feedback states.

### Navigation/auth

- Unresolved session is neutral and never flashes Admin; lookup outage is error, not privilege.
- Anonymous: Login. Customer: display name + Logout, no Admin. Admin: display name + Logout + Admin.
- Refresh SSR/client state after login/logout; revalidate on focus or use a cooperative tab broadcast so stale tabs do not retain privilege.
- Safe user DTO/provider is rendering state, never authority.

### Cart, login, checkout, admin

- Cart includes imagery, quantities, and exact summary.
- Login includes labels, show-password, autocomplete, validation, loading, generic credential failure, and distinct validation/429/outage states.
- Accept only safe local return paths; reject absolute, protocol-relative, cross-origin, and encoded bypasses. Preserve anonymous cart through login; customer return to admin falls back safely without a loop.
- Checkout loads actual owned addresses and blocks if empty; quotes the selected address province; sends `currency: 'VND'`; maps exact response; preserves `UNKNOWN` and never initiates again; success cannot be hidden by empty-cart redirect.
- A 401 retains cart but clears private address/quote/attempt/admin state and requires login.
- Admin resolves real identity, preserves physical/reserved/available inventory and payment/shipping distinctions, and never renders auth/network/server failure as empty data. Server pages use a backend helper, not self-fetch.

### Accessibility/responsiveness

Meet WCAG 2 AA contrast; skip link, landmarks, headings/labels, visible focus, logical order, announced async feedback, 44px targets, and reduced-motion behavior. Verify keyboard-only operation and 360px/tablet/desktop layouts.

## 5. Schema, catalog, and migrations

Add additive `Product` fields: `description`, `category`, `imagePath`, `imageAlt`, `displayOrder`. Add `ProductVariant.displayName`, separate from the full order-line snapshot name. Use safe defaults/nullability and explicit backfill; never edit prior migrations.

Add `User`: id, normalized unique email, displayName, passwordHash, enum role `CUSTOMER | ADMIN`, enabled, timestamps. Add `Session`: id, user FK, unique tokenHash, createdAt, expiresAt, optional revokedAt, expiry index. Explicitly backfill legacy identity before address FK tightening. Preserve `test-customer-1`, its default address, historical identities, and order snapshots; never reassign them. Admin can shop, so all three users own addresses.

### Public `GET /products`

Return active products with active variants only; omit products without returned variants; stable product/variant ordering; product IDs distinct from SKUs; decimal-string money; advisory availability from unblocked, unexpired lots as `onHand - reserved`. Expose no lot IDs, internal user data, or internal rows. Use a catalog application read port and scoped Prisma projection; inventory crosses an application port, never a cross-module infrastructure import. Reservation remains authoritative at checkout. Quote must reject active variants whose parent is hidden, draft, archived, or discontinued.

## 6. Canonical catalog fixtures

Canonical categories: `serum`, `sunscreen`, `cleansing`, `toner`, `moisturizer`, `lips`, `body`, `mask`, `hair`.

|   # | Product                | Category    | Variant → VND price                |
| --: | ---------------------- | ----------- | ---------------------------------- |
|   1 | Serum Dưỡng Ẩm         | serum       | 15 ml → 150,000; 30 ml → 280,000   |
|   2 | Kem Chống Nắng SPF50+  | sunscreen   | 50 g → 220,000; 100 g → 390,000    |
|   3 | Sữa Rửa Mặt CeraVe     | cleansing   | 100 ml → 95,000                    |
|   4 | Tinh Chất Vitamin C    | serum       | 10 ml → 180,000; 20 ml → 340,000   |
|   5 | Toner Cấp Ẩm           | toner       | 150 ml → 165,000; 250 ml → 245,000 |
|   6 | Nước Tẩy Trang Dịu Nhẹ | cleansing   | 100 ml → 89,000; 400 ml → 229,000  |
|   7 | Dầu Tẩy Trang          | cleansing   | 100 ml → 195,000; 200 ml → 325,000 |
|   8 | Kem Dưỡng Ceramide     | moisturizer | 30 g → 185,000; 50 g → 275,000     |
|   9 | Serum Niacinamide      | serum       | 15 ml → 145,000; 30 ml → 265,000   |
|  10 | Serum Retinol Dịu Nhẹ  | serum       | 30 ml → 320,000                    |
|  11 | Son Dưỡng Môi          | lips        | clear → 75,000; pink → 85,000      |
|  12 | Sữa Dưỡng Thể          | body        | 250 ml → 175,000; 400 ml → 255,000 |
|  13 | Kem Dưỡng Tay          | body        | 50 g → 65,000                      |
|  14 | Mặt Nạ Cấp Ẩm          | mask        | 1 piece → 25,000; 5 pack → 115,000 |
|  15 | Dầu Gội Dịu Nhẹ        | hair        | 300 ml → 185,000                   |
|  16 | Dầu Xả Dưỡng Ẩm        | hair        | 250 ml → 175,000                   |

Exactly 16 products, 27 variants, 27 base lots. Preserve existing identifiers/prices/seven lot codes. Use stable explicit IDs/SKUs for new rows, e.g. `prod-toner` and `SKU-TONER-150ML`. Vitamin C 10 ml stock is 0; SPF50+ 100 g stock is 5; document deterministic 20–100 stock for every other variant. Prices are illustrative; descriptions contain no medical or sales claims. Draft/discontinued/expired/blocked fixtures are test-only.

## 7. Seed strategy

```text
apps/api/prisma/seed/catalog.fixtures.ts
apps/api/prisma/seed/users.fixtures.ts
apps/api/prisma/seed/seed-demo.ts
apps/api/prisma/seed.ts                 # thin CLI
```

- Explicit development/demo opt-in; reject production.
- Validate fixtures and required secrets before the transaction; apply atomically.
- Update deterministic catalog metadata; create missing lots; never overwrite existing lot `onHand`, `reserved`, or `version`.
- Never reset passwordHash, role, enabled state, or edited addresses on ordinary rerun.
- Reject conflicting identifiers, emails, and SKUs rather than hijacking rows.
- Disconnect in `finally`, exit nonzero on failure, log counts only.
- Normal `db:down`/`db:up` retains volume. Document separate destructive fresh-demo reset for disposable DBs.

Users: `admin@beautyshop.test` ADMIN; `customer@beautyshop.test` CUSTOMER preserving `test-customer-1`; `customer2@beautyshop.test` CUSTOMER with a distinct address/province. Require strong caller-supplied `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_PASSWORD`, `SEED_CUSTOMER2_PASSWORD`; commit/log no defaults and do not rotate automatically.

## 8. IAM, sessions, and policy

Define async `PasswordHasher` port. Implement Node `crypto.scrypt` with random salt, versioned parameters, bounded/benchmarked work, constant-time comparison, input limits, and equivalent dummy verification for unknown accounts. Argon2id is an explicit alternative, not a second simultaneous scheme absent migration need.

### Session flow

1. Browser posts login to same-origin Next.
2. Next calls Nest; Nest verifies credentials and creates a cryptorandom opaque token.
3. Nest stores only token hash and returns raw token only to Next server.
4. Next strips token from browser JSON and sets HttpOnly cookie.
5. Next server forwards cookie as bearer to Nest.
6. Nest verifies hash, expiry, revocation, and current enabled/role, then attaches typed principal.
7. Logout revokes and clears cookie.

Use 8-hour absolute expiry aligned in DB/cookie. Cookie: Secure under HTTPS, `SameSite=Lax`, `Path=/`, no Domain; document development versus production `__Host-` naming. No localStorage token, JWT, or refresh subsystem. Never trust identity headers. Principal id/customerId must be consistent for idempotency. Reload current role/enabled on every request.

| Endpoint                                                | Policy                  |
| ------------------------------------------------------- | ----------------------- |
| `GET /products`                                         | Public                  |
| `POST /auth/login`                                      | Public, throttled       |
| `GET /auth/me`                                          | Valid session           |
| `POST /auth/logout`                                     | Repeatable revocation   |
| `GET /addresses`                                        | Current user only       |
| `POST /quote`, `GET /quote/preview`, `POST /checkout`   | Session + owned address |
| `GET /orders`, `GET /orders/:id`, `GET /inventory/lots` | Admin only              |

Guard Nest endpoints and Next admin layout plus every privileged fetch. Return 401 anonymous, 403 authenticated wrong-role. For browser mutations login/logout/checkout, reject missing/untrusted `Origin` and match configured origins exactly. Nest uses Next-forwarded bearer, not browser-cookie auth. Require HTTPS and no permissive credentialed CORS. Rate-limit by trusted source + normalized account; do not trust arbitrary forwarded IP. Use maintained throttler or bounded adapter, documenting single-instance memory limits. Generic credential errors; distinct validation/429/outage. Redact secrets; `Cache-Control: no-store` for auth/private data; fail closed on lookup outage.

## 9. Web integration and checkout invariants

Add server-only `apps/web/src/lib/server/api-client.ts` and `session.ts` using Next 15 `await cookies()`. Add auth context/types and login/logout/me handlers; replace quote/checkout/orders/inventory proxies and add address route. Remove all fixed headers; deliberately forward bearer and allowed origin. Logout succeeds only after confirmed revoke/already-invalid; network failure remains retryable and does not falsely promise logout.

Use exact string/bigint computations. Idempotency key is stable for one unchanged attempt over user, address, currency, and normalized cart; uncertain retry reuses it; a new purchase gets a new key even for identical cart. Preserve ownership-before-replay. Keep `UNKNOWN` and do not initiate again.

## 10. Implementation phases

### Phase 0 — Contracts and baseline

**Dependencies:** none.

Write failing API regressions for forged headers, quote/checkout contracts, and failure-as-empty; define stable DTO/error contracts; add minimal web Vitest/RTL/jsdom and Playwright scripts/config; split API unit and Docker integration commands; document current root-test behavior without claiming green.

**Acceptance:** regressions reproduce current bypass/gaps and intended runners are discoverable.

### Phase 1 — Schema, fixtures, cryptography

**Dependencies:** Phase 0.

Add new migrations/backfill, importable fixtures and guarded atomic seed, env examples, chosen password adapter, and discoverable seed integration specs. Verify fresh and upgrade migrations and seed twice.

**Acceptance:** exact 16/27/27 plus 3 users/addresses; second run preserves counts, hashes, role/enabled, edited addresses, reservations, quantities, versions; missing secrets/collisions fail atomically.

### Phase 2 — Nest IAM and authorization

**Dependencies:** Phase 1.

Add IAM domain/application ports/adapters/API and `iam.module`; login/me/logout, session/principal resolution, expiry, guards, origin policy, throttling, redaction; update app composition/controllers as necessary; remove identity-header trust.

**Acceptance:** login/me/repeat logout work; 401/403 differ; forged headers grant nothing; expiry/revoke/disable/demotion apply next request.

### Phase 3 — Catalog, inventory, addresses, quote

**Dependencies:** catalog needs Phase 1; addresses need Phase 2.

Add catalog service/query port/DTO/scoped Prisma repository/products controller/module; inventory read port; pricing parent-product visibility; owned-address query/controller/adapter; application-layer address-aware quote.

**Acceptance:** DB supplies all 16 public products; hidden variants are not displayed/purchased; foreign address denied; selected province used.

### Phase 4 — Next auth and protected server data

**Dependencies:** Phase 2.

Add server helpers, auth context/types/routes/UI, secure cookie/token stripping, safe redirect handling, header matrix, protected admin layout/pages, address route, and corrected authenticated proxies. Admin pages call backend helper and render failures explicitly.

**Acceptance:** refresh/logout/role matrix works without privilege flash; raw token never reaches browser storage/JSON; direct admin UI/API access denied; no fixed headers, self-fetch, or failure-as-empty.

### Phase 5 — Storefront and shopping integration

**Dependencies:** Phases 3 + 4.

Replace fixture array with typed DB loading; build hero/search/filter/cards/variants/images/states; improve cart; implement owned-address exact checkout, VND DTOs, errors/success/UNKNOWN, 401 clearing, and attempt keys; refine existing UI/tokens for accessibility/responsiveness.

**Acceptance:** full desired shopping flow uses real API without hard-coded catalog/identity, unsafe money, or unsafe repeated payment.

### Phase 6 — Security integration and docs

**Dependencies:** all phases.

Run unit, real PostgreSQL, web, and browser matrices including real concurrency. Reconcile README/CLAUDE with actual counts/commands, seed/setup/session/deployment, image provenance, persistent volume/reset, and payment/throttle limitations. Mark unrun tests explicitly.

**Acceptance:** security passes end-to-end and documentation claims only observed results.

Dependency summary: 0 → 1 → 2; Phase 3 catalog needs 1 and address needs 2; 4 needs 2; 5 needs 3+4; 6 needs all.

## 11. Test matrix

**API/security:** normalization/duplicates/malformed/limits; password/dummy verification/redaction; expiry/revoke/disable/demotion; throttle; 401/403/forged headers/admin list+detail; exact origins; address/province; active/draft/archived variant combinations; bigint JSON; inventory expiry; checkout replay/rollback/reservation/UNKNOWN; architecture tests.

**PostgreSQL:** fresh + upgrade constraints/indexes; seed twice hashes/counts and operational state; atomic secret/collision failure; persisted sessions; true inventory/idempotency concurrency.

**Web:** role matrix/unresolved/outage; login errors/429/redirect bypass; cookie stripping/no-store/origin/auth forwarding/expiry/truthful logout; catalog selection/availability/images/retry; checkout exact payload/result/success/UNKNOWN/large money/idempotency; 401 cart preservation/private clearing; no SSR confidentiality leak.

**Browser:** anonymous sees 16/no Admin/full filters; cart survives customer login and owned-address checkout; customer never sees Admin; direct admin page/API denied; admin works; refresh/logout/Back/expiry/revoke/disable/demotion protected; foreign address/sold-out blocked; stock rechecked; outages not empty/privileged; accessibility at 360/tablet/desktop.

## 12. Commands to run later — not now

```bash
npm run db:generate
npm run db:up
npm run db:migrate
npm run db:seed --workspace=@beautyshop/api # local secrets + explicit opt-in first
npm test
npm run typecheck
npm run build --workspace=@beautyshop/api
npm run build --workspace=@beautyshop/web
```

Add separate API unit/integration/web/browser commands. Clarify root test may discover Docker specs and reconcile README's no-Postgres claim. Never commit actual passwords.

## 13. Risks and assumptions

- One browser-visible Next origin proxies to Nest; topology changes require renewed origin/cookie/trusted-source design.
- Demo email/password only; no registration/recovery; admin can shop.
- VND only; strings in transport, bigint/Money in calculations.
- Local illustrations acceptable with provenance; document or remove Google-font build network dependence.
- Preserve legacy IDs/backfill/order snapshots; no production reset.
- Private SSR/auth is no-store and cannot leak between users.
- Nest live role/enabled checks are authoritative, never headers/client state.
- Seeds are opt-in, nondestructive, and collision-safe; reset is disposable-only.
- Catalog inventory is advisory; checkout reservation authoritative.
- Auth/address/catalog/contract/idempotency fixes are checkout prerequisites.
- In-memory throttling is single-instance only; use distributed storage before scaling.
- Avoid scope creep into excluded identity/payment/social features.

## 14. Final acceptance checklist

- [ ] This plan exists at `plans/storefront-catalog-auth.md`; `plans/beautyshop.md` is unchanged.
- [ ] Additive fresh/upgrade migrations and legacy backfill succeed without editing old migrations.
- [ ] DB catalog has exactly 16 products, 27 variants, 27 base lots in stable order.
- [ ] Three users/addresses require caller-supplied strong passwords.
- [ ] Reseed is atomic, deterministic, collision-safe, guarded, and preserves operational/user state.
- [ ] Login, restore, 8-hour expiry, repeat logout/revoke, disable, demotion work.
- [ ] Admin appears only for resolved authenticated admin, with Nest enforcement on every admin route/fetch.
- [ ] Forged headers, unsafe redirects, foreign addresses, stale role state cannot bypass policy.
- [ ] Checkout uses selected owned address, exact VND/string-money contracts, stable attempt keys, safe UNKNOWN.
- [ ] Storefront/cart/checkout/login/admin meet responsive accessibility requirements.
- [ ] API, real-PostgreSQL, web, and browser results are recorded accurately; unrun suites labeled.
- [ ] README and CLAUDE current-state/deployment claims match implementation and commands actually run.

This plan authorizes planning only. Application implementation, migrations, and seed execution are deferred.
