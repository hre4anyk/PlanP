# Regata Design System

## Philosophy

Bold, award-winning dark UI. No generic templates. No AI slop aesthetic.

**Design Resources:**
- **[shadcn/ui](https://ui.shadcn.com/)** — Reference for component patterns, accessibility, interaction design. Analyze before any UI/design task.
- **[Awwwards](https://www.awwwards.com/)** — Inspiration for award-winning dark UI patterns

---

## Brand Kit

> **Use this section for ALL visual assets**: banners, videos, thumbnails, social posts, presentations.


**Logo Don'ts:**
- Never use on light backgrounds without dark container
- Never stretch or distort
- Never add effects (shadows, gradients, outlines)
- Never use accent color for full wordmark (accent is for highlights only)

### Typography

```
Headlines:        Clash Display (Bold, 700)
                  - H1: 4rem / 64px (hero headlines)
                  - H2: 2.5rem / 40px (section headers)
                  - H3: 1.5rem / 24px (card headers)

Body:             Satoshi (Regular 400, Medium 500)
                  - Body: 1rem / 16px
                  - Small: 0.875rem / 14px
                  - Caption: 0.75rem / 12px

Mono:             JetBrains Mono (code, technical data)
```

**Font Loading (for external assets):**
```html
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@700&f[]=satoshi@400,500,700&display=swap" rel="stylesheet">
```

### Color System

```
Background:
  --bg-dark:      #0a0a0f     (page background)
  --bg-elevated:  #111116     (sections, cards)
  --bg-card:      #16161c     (elevated cards)

Text:
  --text-primary:   #ffffff   (headlines, important)
  --text-secondary: #a0a0a8   (body text)
  --text-muted:     #6b6b75   (captions, labels)

Accent:
  --accent:         #FF4D2E   (CTAs, highlights, urgency)
  --accent-hover:   #ff6b4a   (button hover)
  --accent-glow:    rgba(255, 77, 46, 0.15)  (ambient effects)

Borders:
  --border-subtle:  rgba(255, 255, 255, 0.06)
  --border-medium:  rgba(255, 255, 255, 0.1)
```

### Spacing System (8px Grid)

```
xs:   4px   (tight spacing, inline elements)
sm:   8px   (default gap)
md:   16px  (between related elements)
lg:   24px  (between sections)
xl:   32px  (major section breaks)
2xl:  48px  (page sections)
3xl:  64px  (hero padding)
```

### Image & Video Style

**Photography:**
- Dark, moody lighting
- High contrast
- Avoid stock photo aesthetics
- Real people > illustrations
- No AI-generated faces

**Video:**
- Dark backgrounds (#0a0a0f or darker)
- Accent color for highlights/text overlays
- Clash Display for titles
- Satoshi for lower thirds
- No cheesy transitions (cuts only, subtle fades)

**Thumbnails:**
- Dark background with accent color highlight
- Face + bold text formula
- Max 3-4 words
- Clash Display Bold for text

### Brand Voice

```
Tone:       Direct, confident, slightly provocative
Register:   Professional but not corporate
Avoid:      Buzzwords, "AI-powered", "revolutionary", "game-changer"
Prefer:     Specific claims, numbers, outcomes
```

**Voice Examples:**
- ❌ "Revolutionary AI-powered lead qualification"
- ✅ "Talk to visitors before they bounce. 60 seconds, not 60 hours."

- ❌ "Leverage our cutting-edge solution"
- ✅ "Stop losing leads to slow response times."

### Asset Checklist (Before Publishing)

- [ ] Uses Clash Display for headlines
- [ ] Uses Satoshi for body text
- [ ] Dark background (#0a0a0f or similar)
- [ ] Accent color is #FF4D2E (not green, not blue)
- [ ] No stock photo aesthetic
- [ ] No AI slop patterns (see anti-patterns below)
- [ ] Claims are specific, not vague

---

**Anti-patterns (NEVER use):**
- Purple/blue gradients on white backgrounds
- Generic fonts (Inter, Roboto, Arial, system-ui)
- Stock-looking imagery or clichéd visuals
- Generic geometric shapes or abstract blobs

### Expanded AI Slop Tells (Updated Jan 2026)

**Lazy "cool" (screams AI-generated):**
- Glassmorphism (backdrop-filter: blur) — overused, dated
- Neon/cyan-on-dark glow effects — signals "developer tool"
- Monospace fonts for "hacker vibe" — unless actually showing code
- Excessive gradient glows on CTAs and cards

**Lazy "impact" (feels unearned):**
- Gradient backgrounds for visual interest alone
- Sparklines and micro-charts as decoration
- Elastic/bouncy animations everywhere
- Big number + small label + gradient accent layout template

**Layout traps:**
- Cardocalypse — everything is a card, cards inside cards
- Thick colored border rounded cards
- Massive rounded Lucide icons above every heading
- Hiding complexity in modals ("let's just put this in a modal")
- Japanese-style UX writing (extreme redundancy in labels)

**Color mistakes:**
- Gray text on colored backgrounds (low contrast)
- Pure black (#000) or pure white (#FFF) without nuance
- Using accent colors at full opacity (too aggressive)

**How to self-check:**
1. Does this look like every other AI landing page? Remove it.
2. Could this design exist in 2019? Good — timeless beats trendy.
3. Is this element adding information or just "vibes"? Cut vibes.

**Landing page specific anti-patterns:**
- Fake trust signals (logos of companies that don't use you)
- Same metrics shown 3+ times on one page
- Multiple accent colors competing for attention
- Animated elements that don't guide toward CTA

---

## Color Palette

### Base Colors
```
Background:       #0B0B0F (deep black)
Card Background:  #141419 (elevated surface)
Input Background: #1C1C24 (form fields)
Border Default:   rgba(255, 255, 255, 0.04)
Border Subtle:    rgba(255, 255, 255, 0.06)
Border Active:    rgba(255, 255, 255, 0.1)
```

### Text Colors
```
White:            #FFFFFF (headlines, primary text)
Muted:            #7A7A85 (secondary text, labels)
Subtle:           #4A4A52 (tertiary text, timestamps)
```

### Accent Colors
```
Primary Green:    #00FF94 (success, CTAs, active states)
Warning Amber:    #FFB800 (caution, medium intent)
Danger Pink:      #FF3366 (urgent, errors, call requested)
Info Blue:        #60A5FA (completed states)
```

### Status-Specific Colors

| Status | Text Color | Background | Border |
|--------|------------|------------|--------|
| Browsing | #9CA3AF | rgba(55, 65, 81, 0.5) | rgba(55, 65, 81, 0.8) |
| High Intent | #FFB800 | rgba(255, 184, 0, 0.15) | rgba(255, 184, 0, 0.3) |
| Call Requested | #FF3366 | rgba(255, 51, 102, 0.2) | rgba(255, 51, 102, 0.5) |
| On Call | #00FF94 | rgba(0, 255, 148, 0.2) | rgba(0, 255, 148, 0.5) |
| Call Done | #60A5FA | rgba(59, 130, 246, 0.15) | rgba(59, 130, 246, 0.3) |

### Staleness Indicator Colors
```
Active Now (<30s):      #00FF94, bg rgba(0, 255, 148, 0.15)
Recently Active (<2m):  #FFB800, bg rgba(255, 184, 0, 0.15)
May Have Left (>2m):    #FF3366, bg rgba(255, 51, 102, 0.15)
Unknown:                #4A4A52, bg rgba(74, 74, 82, 0.2)
```

---

## Typography

### Font Stack
```css
Headlines:  'Clash Display', sans-serif
Body:       system-ui (optimized for dashboard readability)
Mono:       'JetBrains Mono', monospace (session IDs, code)
```

### Font Sizes
```
text-2xl:  1.5rem (large numbers, counts)
text-xl:   1.25rem (section headers)
text-sm:   0.875rem (body text)
text-xs:   0.75rem (labels, metadata, badges)
```

---

## Components

### Cards
```css
.card {
  background: #141419;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 0.5rem; /* rounded-lg */
  padding: 1rem;
}

.card-elevated {
  background: rgba(0, 0, 0, 0.3);
}
```

### Badges / Pills
```css
.badge {
  padding: 0.25rem 0.5rem; /* px-2 py-1 */
  border-radius: 0.25rem; /* rounded */
  font-size: 0.75rem; /* text-xs */
  font-weight: 500; /* font-medium */
  display: flex;
  align-items: center;
  gap: 0.375rem; /* gap-1.5 */
}

/* Always use inline styles for colors - NOT Tailwind classes */
/* Example: style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }} */
```

### Status Dots
```css
.status-dot {
  width: 0.375rem; /* w-1.5 */
  height: 0.375rem; /* h-1.5 */
  border-radius: 9999px; /* rounded-full */
  /* Color matches parent badge */
}
```

### Buttons
```css
.btn-primary {
  background: #00FF94;
  color: #0B0B0F;
  padding: 0.5rem 1rem; /* px-4 py-2 */
  border-radius: 0.5rem; /* rounded-lg */
  font-weight: 500;
  font-size: 0.875rem; /* text-sm */
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #7A7A85;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-danger {
  background: #FF3366;
  color: #FFFFFF;
}

.btn-warning {
  color: #FFB800;
  border: 1px solid rgba(255, 184, 0, 0.3);
}
```

### Inputs
```css
.input {
  background: #1C1C24;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem; /* rounded-lg */
  padding: 0.5rem 0.75rem; /* px-3 py-2 */
  font-size: 0.875rem; /* text-sm */
  color: #FFFFFF;
}

.input::placeholder {
  color: #6B7280; /* gray-500 */
}
```

---

## Layout Patterns

### Section Headers
```jsx
<h3 className="text-xs font-medium uppercase tracking-wider mb-3"
    style={{ color: '#4A4A52' }}>
  Section Title
</h3>
```

### Meta Information Row
```jsx
<p className="text-xs" style={{ color: '#7A7A85' }}>
  <span style={{ color: '#00FF94' }}>42 pts</span>
  {' · '}
  <span style={{ color: '#4A4A52' }}>session-id</span>
  {' · '}
  Requested 2m ago
</p>
```

### Flex Layouts
```
justify-between items-center  — Header rows with actions
flex items-center gap-2       — Inline badge groups
flex flex-wrap gap-1.5        — Tag/chip collections
space-y-3                     — Stacked cards
grid grid-cols-4 gap-3        — Status count grid
```

---

## Animation

### Pulse (for urgent items)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Usage: animation: pulse 2s infinite */
```

### Transitions
```css
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
```

### Hover States
```css
hover:bg-red-500/20   — Destructive actions
hover:bg-white/5      — Subtle links
hover:bg-amber-500/20 — Warning actions
```

---

## Important Implementation Notes

1. **Always use inline styles for dynamic colors** — NOT Tailwind color classes
   - Tailwind classes like `text-amber-400` or `bg-[#FF3366]/20` may not work at runtime
   - Use `style={{ color: '#FFB800' }}` instead

2. **Keep color definitions in helper functions** — like `getStatusConfig()`, `getStalenessColor()`

3. **Maintain consistency** — when adding new UI elements, check this doc first

4. **Test dark mode rendering** — some browsers render rgba differently

---

## Landing Page Design System

> **Reference files**: `index.html` (production), `index-urgent-dark-v2.html` (approved direction)

### One-Accent-Color Rule

**CRITICAL**: Landing pages use ONE accent color only. Multiple accent colors = visual noise.

```
Landing Page Accent:  #FF4D2E (orange-red/vermillion)
```

This color is used for:
- CTA buttons
- Highlighted text spans
- Hover states
- Icon accents
- Stats values

**Why not green (#00FF94)?** Green is reserved for dashboard/app success states. Landing pages need urgency — orange-red signals action.

### Landing Page Color Variables

```css
:root {
    --bg-dark: #0a0a0f;
    --bg-elevated: #111116;
    --bg-card: #16161c;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a8;
    --text-muted: #6b6b75;
    --accent: #FF4D2E;           /* Single accent color */
    --accent-glow: rgba(255, 77, 46, 0.15);
    --border-subtle: rgba(255, 255, 255, 0.06);
    --border-medium: rgba(255, 255, 255, 0.1);
}
```

### Ambient Glow Effects

Subtle radial glow behind hero creates depth without being "AI slop":

```css
.hero::before {
    content: '';
    position: absolute;
    top: -200px;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 600px;
    background: radial-gradient(ellipse, var(--accent-glow) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
}
```

**Key**: Very low opacity (0.15), large blur radius, positioned behind content.

### Shimmer Animation (CTAs)

Premium feel for primary buttons without being "bouncy":

```css
@keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
}

.btn-primary {
    background: linear-gradient(
        90deg,
        var(--accent) 0%,
        #ff6b4a 25%,
        var(--accent) 50%,
        #ff6b4a 75%,
        var(--accent) 100%
    );
    background-size: 200% auto;
    animation: shimmer 3s linear infinite;
}
```

### Stats Bar Component

Social proof strip immediately after hero. Single source of metrics — never duplicate.

```html
<section class="stats-bar">
    <div class="container">
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-value">&lt;60s</div>
                <div class="stat-label">Response time</div>
            </div>
            <!-- 3 more items -->
        </div>
    </div>
</section>
```

```css
.stats-bar {
    padding: 48px 0;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 32px;
    text-align: center;
}

.stat-value {
    font-family: 'Clash Display', sans-serif;
    font-size: 2.75rem;
    font-weight: 700;
    color: var(--accent);
}
```

### FAQ Accordion Component

Objection-handling before CTA. Only one item open at a time.

```css
.faq-item {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.3s;
}

.faq-item:hover {
    border-color: var(--border-medium);
}

.faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease-out;
}

.faq-item.active .faq-answer {
    max-height: 300px;
}

.faq-icon {
    transition: transform 0.3s;
}

.faq-item.active .faq-icon {
    transform: rotate(45deg);
}
```

### Logo Cloud (Trust Signals)

**CRITICAL**: Only use logos of ACTUAL customers. Never use aspirational logos (Stripe, Linear, etc.).

```html
<div class="logo-cloud">
    <span class="logo-cloud-label">Trusted by</span>
    <img src="[actual-customer-logo-url]" alt="Customer Name"
         style="height: 28px; filter: brightness(0) invert(1); opacity: 0.7;">
</div>
```

```css
.logo-cloud {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border-subtle);
}

.logo-cloud img {
    filter: brightness(0) invert(1);  /* Force white */
    opacity: 0.7;
    transition: opacity 0.2s;
}

.logo-cloud img:hover {
    opacity: 1;
}
```

### Widget Styling (for Regata Landing Page)

The widget on Regata's own landing page uses `REGATA_CONFIG` to match the brand. This is set in `../index.html`:

```javascript
window.REGATA_CONFIG = {
  theme: {
    primaryColor: '#FF4D2E',           // Orange-red accent
    primaryColorHover: '#ff6b4a',
    cardBackground: '#16161c',         // Solid dark
    cardBorder: 'rgba(255, 255, 255, 0.06)',
    textColor: '#ffffff',
    subtextColor: '#a0a0a8',
    accentColor: '#FF4D2E',
    fontFamily: "'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif"
  }
};
```

**Note**: Each client has their own `REGATA_CONFIG` on their site. Never change pixel.js defaults — use config instead.

---

### Content Deduplication Rule

**NEVER show the same metrics/stats in multiple sections.**

Before adding any stat or metric, check:
1. Does this already appear in the Stats Bar?
2. Is this repeated in a "Results" section?
3. Is this duplicated in a pricing comparison?

**Single source of truth**: Stats Bar below hero is THE place for key metrics.

---

### Responsive Copy Pattern

Mobile screens need shorter copy. Use visibility classes to show different text lengths per breakpoint:

```css
/* Desktop: full copy */
.desktop-only {
    display: block;
}
.mobile-only {
    display: none;
}

@media (max-width: 768px) {
    .desktop-only {
        display: none;
    }
    .mobile-only {
        display: block;
    }
}
```

**Usage in HTML:**
```html
<p class="desktop-only">Your competitors respond in 60 seconds. You respond in 48 hours. That's why they're closing deals you never even knew existed.</p>
<p class="mobile-only">Your competitors respond in 60 seconds. You respond in 48 hours.</p>
```

**Guidelines:**
- Desktop copy: Full context, emotional hooks, complete sentences
- Mobile copy: Core message only, ~50% shorter, still punchy
- Never lose the key value prop — just compress it
- Apply to: hero subtitles, problem card descriptions, feature descriptions, how-it-works steps

---

## Quick Reference: Copy-Paste Snippets

### Status Badge
```jsx
<span
  className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1.5"
  style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
>
  <span>{config.icon}</span>
  {config.label}
</span>
```

### Staleness Indicator
```jsx
<span
  className="px-2 py-1 rounded text-xs flex items-center gap-1"
  style={{ background: staleness.bg, color: staleness.color }}
>
  <span className="w-1.5 h-1.5 rounded-full" style={{ background: staleness.color }} />
  {formatRelativeTime(lastSeen)}
</span>
```

### Score Badge
```jsx
<span
  className="px-2 py-1 rounded text-xs font-medium"
  style={{
    background: score >= 40 ? 'rgba(0, 255, 148, 0.15)' : 'rgba(255, 184, 0, 0.15)',
    color: score >= 40 ? '#00FF94' : '#FFB800'
  }}
>
  {score} pts
</span>
```
