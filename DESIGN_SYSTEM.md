# Thread Theory Home — Design System

Source of truth: `app/globals.css` (tokens + primitives) and `app/layout.tsx` (fonts).
Use this as the reference for every new screen. Prefer existing CSS variables and class primitives over new ad-hoc styles.

---

## 1. Brand essence

Cream paper • navy ink • gold accent. Editorial, calm, generous whitespace. Glassy translucent surfaces over a warm gradient background. Serif display + clean sans body. Quiet motion (rise + fade only).

---

## 2. Color tokens

| Token            | Value                          | Use                                        |
| ---------------- | ------------------------------ | ------------------------------------------ |
| `--paper`        | `#f6efe5`                      | Base cream background                      |
| `--paper-deep`   | `#eadfcf`                      | Background gradient terminal               |
| `--panel`        | `rgba(255,252,247,0.78)`       | Default glass surface (hero, tile)         |
| `--panel-strong` | `rgba(255,252,247,0.90)`       | Denser surface (cards, panels, modal)      |
| `--ink`          | `#1d2740`                      | Primary text, primary button bg            |
| `--ink-soft`     | `#5d615f`                      | Body copy, secondary text                  |
| `--gold`         | `#b78a49`                      | Accent: labels, links, focus ring          |
| `--gold-soft`    | `rgba(183,138,73,0.18)`        | Accent fill (badge, focus glow)            |
| `--line`         | `rgba(29,39,64,0.12)`          | Default border                             |
| `--line-soft`    | `rgba(29,39,64,0.08)`          | Subtle border (cards, table rows)          |
| `--success`      | `#486a4a`                      | Active timeline step only                  |

Body background is fixed (do not override per page):
```
radial-gradient(circle at top, rgba(255,255,255,0.7), transparent 30%),
linear-gradient(180deg, #fbf6ef 0%, var(--paper) 55%, #f2e7d8 100%)
```

---

## 3. Typography

Fonts are loaded in `app/layout.tsx` as CSS variables.

- **Display** — `var(--font-display)` → Cormorant Garamond (serif). Weights 400/500/600/700. Used for `h1`–`h3`, `.brand-mark`, `.nav-wordmark`. Always `font-weight: 500` and `letter-spacing: -0.04em` unless overridden.
- **Body** — `var(--font-body)` → Manrope (sans). Weights 400/500/600/700. Default for `body`, paragraphs, buttons, inputs, captions.

### Type scale (use `clamp` — do not hardcode px on headings)

| Role                      | Size                              | Line     |
| ------------------------- | --------------------------------- | -------- |
| Hero `h1`                 | `clamp(2.7rem, 10vw, 5.9rem)`     | `0.95`   |
| Policy header `h1`        | `clamp(3.2rem, 11vw, 6rem)`       | `0.88`   |
| Admin/tracking `h1`       | `clamp(2.4rem, 8vw, 4.4rem)`      | `0.94`   |
| Section `h2`              | `clamp(2.2rem, 6vw, 4rem)`        | `0.96`   |
| Panel `h2`                | `clamp(1.55rem, 6vw, 2.2rem)`     | `1.04`   |
| Gallery title             | `clamp(1.6rem, 4.4vw, 2.1rem)`    | `1.08`   |
| Body `p`                  | `1rem`                            | `1.7`    |
| Policy `p`                | `1rem`                            | `1.8`    |

### Eyebrow / label (the gold all-caps text)

Class: `.panel-label`, `.kicker`, `.tile-eyebrow`, `.tile-label` — all identical.
Spec: `color: var(--gold)`, `font-size: 0.72rem`, `letter-spacing: 0.22em`, `text-transform: uppercase`.
Use one per surface, at the top, to announce what the surface is.

---

## 4. Spacing scale

Use these vars; avoid arbitrary `px` for layout gutters and section rhythm.

| Token       | Value   | Typical use                          |
| ----------- | ------- | ------------------------------------ |
| `--space-1` | `12px`  | Inline gaps                          |
| `--space-2` | `18px`  | Form gaps, card grid gaps            |
| `--space-3` | `24px`  | Block gaps inside sections           |
| `--space-4` | `32px`  | Section internals, footer columns    |
| `--space-5` | `48px`  | Section padding                      |
| `--space-6` | `72px`  | Page bottom, between major regions   |
| `--space-7` | `108px` | Generous page-end breathing room     |

Inside hero/panels/tiles, the convention is `rem`-based padding (`1rem` mobile → `1.3rem`+ on ≥960px) — keep that pattern.

---

## 5. Radius, shadow, blur

| Token         | Value                                 | Use                            |
| ------------- | ------------------------------------- | ------------------------------ |
| `--radius-sm` | `14px`                                | Small chips                    |
| `--radius-md` | `20px`                                | Buttons-as-blocks, small cards |
| `--radius`    | `26px`                                | Default surface (hero, panel)  |
| `--radius-lg` | `34px`                                | Hero on ≥960px                 |
| —             | `28px` / `32px`                       | Modals, admin/tracking cards   |
| —             | `999px`                               | Pills (buttons, badges, dots)  |
| `--shadow`    | `0 24px 60px rgba(31,26,20,0.08)`     | Default lifted surface         |
| `--shadow-soft` | `0 14px 34px rgba(31,26,20,0.06)`   | Inner cards, badges            |

Glass surfaces use `backdrop-filter: blur(14–20px)` + translucent `--panel*` background + `1px solid var(--line)` border. This is the house look — do not flatten it.

---

## 6. Layout

- `--container: 1120px`. Always wrap content in `.container`:
  ```
  width: min(calc(100% - 1.25rem * 2), var(--container));
  margin: 0 auto;
  ```
- Page structure: `.page-shell` → `Nav` → `<main>` → `PublicFooter`.
- Sections inside the landing use `.hero`, `.gallery`, `.info-grid`, `.founder-note`. They sit directly in `.container`, separated by `margin-top: 1rem`.
- Policy pages use `.policy-shell` → `.policy-header` → `.policy-content > .policy-stack`.

### Breakpoints

| Width    | Effect                                                                 |
| -------- | ---------------------------------------------------------------------- |
| `≥720px` | Nav links visible, 3-col gallery & info-grid, 2-col form rows, tables show |
| `≥960px` | Hero becomes 2-col (`1.1fr 0.9fr`), larger padding, `--radius-lg`       |

Mobile-first. Default to single column; add columns at 720+.

---

## 7. Buttons

Base class `.btn` — pill, min-height 48, uppercase, `letter-spacing: 0.1em`, `font-size: 0.82rem`. Hover lifts by `translateY(-1px)`.

| Variant         | Background                | Foreground | Border        |
| --------------- | ------------------------- | ---------- | ------------- |
| `.btn-primary`  | `var(--ink)`              | `#fffaf2`  | none, soft navy shadow |
| `.btn-secondary`| `rgba(255,255,255,0.34)`  | `var(--ink)` | `var(--line)` |
| `.btn-light`    | `#fffaf2`                 | `var(--ink)` | transparent |

Nav CTA uses `.btn.btn-primary.nav-cta` (shorter pill, 40px tall, smaller font).
Inline anchor-as-link: `.text-link` (navy, bold, animated `→`). Gold variant for IG: `.gallery-handle`, `.footer-instagram-link`.

---

## 8. Surface primitives

All three share `1px solid var(--line)` + `--radius` + translucent panel bg + `--shadow` + blur:

- **`.hero`** — 1 col mobile / 2 col ≥960px. Contains `.hero-main` (copy) and `.hero-aside` (note + image).
- **`.panel`** — uses `--panel-strong`; the standard content block. Compose with `.panel-label` + `h2` + `p`.
- **`.tile`** — used in `.gallery-grid` (3-col on ≥720px). Image on top with subtle gradient overlay, copy block below.

Admin/tracking surfaces (`.tracking-card`, `.admin-header`, `.login-panel`, `.admin-panel`) are the same recipe but with larger radius (28–32px) and `--line-soft` borders.

Inner sub-cards (`.card`, `.tracking-info`, `.stat-card`, `.booking-card`) use `rgba(255,251,245,0.72–0.82)` + `--shadow-soft`.

---

## 9. Forms

```
.form-grid       → grid, gap 14px
.form-row        → grid; 2 cols at ≥720px
.field           → grid, gap 8px (label + control)
.field input/textarea/select →
  padding 13px 14px, border-radius 16px,
  border var(--line), bg rgba(255,252,247,0.92)
:focus           → border var(--gold) + 4px var(--gold-soft) glow
```

Textareas: `min-height: 116px`, `resize: vertical`.

---

## 10. Status, badges, misc

- `.badge` — pill, `--gold-soft` bg, navy text, 32px tall.
- `.status-step.active .status-dot` — fills with `--success` and gets an 8px gold-green halo. All other dots use muted navy.
- `.empty-state` — dashed navy border on cream tint.
- Tables: `.bookings-table` — uppercase tracked headers in `--ink-soft`; row separator `--line-soft`; on mobile, swap to `.bookings-cards`.

---

## 11. Motion

Only one motion pattern: enter-reveal.

```
.reveal             → opacity 0 → 1, translateY 16 → 0,
                      700ms cubic-bezier(0.22, 1, 0.36, 1)
.reveal-delay-1     → 100ms
.reveal-delay-2     → 180ms
.reveal-delay-3     → 260ms
```

Hover transitions: 140–220ms ease, transform/color/box-shadow only. No bouncy easings. No parallax. No autoplay video.

---

## 12. Accessibility

- Focus is always visible: `2px solid var(--gold)` outline, 3px offset. Don't remove.
- Min tap target: 44–48px (matches `.btn` min-height).
- Decorative images: `alt=""`. Content images: descriptive `alt`. Decorative SVGs: `aria-hidden="true"`.
- Use `aria-label` / `aria-labelledby` on every landmark `section` (see landing page for the pattern).
- All external links: `target="_blank" rel="noreferrer"`.

---

## 13. Composition rules (when building a new screen)

1. Wrap the route body in `.page-shell` (or `.policy-shell`/`.admin-shell`/`.tracking-shell` for that genre).
2. Put `<Nav />` at the top and `<PublicFooter />` at the bottom for public-facing pages.
3. Inside `<main>`, use one `.container`. Lay out direct children as sections.
4. Each section starts with a `.panel-label` (eyebrow), then the heading, then body — same rhythm as the landing.
5. Reach for `.panel` first. Only invent a new surface class if none of `.hero / .panel / .tile / .card` fit.
6. Use existing tokens; do not introduce new colors, radii, or shadows without adding them to `:root` and this doc.
7. Keep one motion family (`.reveal*`). Don't add new keyframes for decoration.
8. Verify mobile (≤719px), tablet (720–959px), and desktop (≥960px) — the only breakpoints in the system.
