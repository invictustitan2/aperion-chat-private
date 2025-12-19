# Aperion UI Refactor Roadmap (Tailored)

## Context and Goals

This roadmap reflects an audit of the aperion-chat-private repository's existing UI code. Rather than imposing a generic enterprise kit, it aligns recommendations to the current implementation: a Tailwind-driven chat application with custom glassmorphism classes (`.glass` and `.glass-dark`), message streaming, rich actions, and episodic/semantic memory features. The aim is to achieve **ship speed, consistency and delight** for a single‑user, memory‑backed system without layering unnecessary tooling.

## What Already Exists

✅ **Tailwind CSS** is used extensively via utility classes; there is no standalone design token file. Custom classes like `glass-dark` provide blurred backgrounds with borders.

✅ **Color usage** centres on emerald tints for primary actions and neutral greys for backgrounds and text.

✅ **Component patterns** are implemented inline rather than via a reusable UI kit. For example, message bubbles and conversation items are defined directly in `Chat.tsx` with Tailwind classes and small variations rather than imported from `ui/Button` etc.

✅ **Toast notifications and alerts** already exist through local patterns (e.g. error messages rendered as inline panels with icons) instead of an external library.

✅ **Streaming message handling and WebSocket hooks** are built‑in. A lot of code deals with auto‑scroll, typing indicators, voice recording and PDF export – any UI changes must respect these behaviours.

## High‑Level Principles

### 1. Tokens in Tailwind Only

Define a small set of colour and spacing tokens in the Tailwind config rather than a parallel CSS token file. Runtime theming can be achieved by exposing a handful of CSS variables (e.g. `--surface`, `--text`, `--accent`). This keeps the styling system unified and avoids refactoring two sources of truth.

### 2. One Toast System

Reuse the existing toast/alert pattern instead of introducing a new library like `react-hot-toast`. The repository already has alert patterns; adding another would increase surface area and inconsistency.

### 3. Lightweight UI Lab

Skip Storybook for now. Instead add an internal route such as `/ui-lab` that renders component variations (buttons, inputs, cards) for visual regression and manual testing. This route isn't bundled into production and doesn't require additional tooling.

### 4. Virtualisation is Optional

Only introduce `@tanstack/react-virtual` after profiling proves that long conversation threads (>1000 messages) degrade performance. The current list rendering is adequate for typical usage and simpler to maintain.

### 5. Aperion Design Language

Document a set of styling rules that reflect your personality and goals. This "vibe" will guide future UI decisions:

- ✨ **Readable first, cinematic second**
- 🎛️ **Controls feel like cockpit toggles, not bubbly social UI**
- 🧠 **Memory and provenance surfaces are always accessible**
- 🎨 **No noisy gradients unless they convey state** (e.g. streaming indicator)
- ⌨️ **Every action has a keyboard path**

---

## Phase Plan

### Phase 1 – Foundation 🏗️

**Status:** 🔄 In Progress

#### 1.1 Tailwind Theme Tokens

- [ ] Update `tailwind.config.ts` to define colour and spacing scales reflecting Aperion's palette (emerald/teal for primary actions, neutral greys for backgrounds)
- [ ] Expose runtime CSS variables (`--surface`, `--text`, `--accent`) if dynamic theming is needed
- [ ] Document token usage in `index.css`

#### 1.2 Core Primitives

- [ ] Extract **Button** component from existing code (keep minimal)
- [ ] Extract **Input** component with label, error, and icon support
- [ ] Extract **Card** component with variant props
- [ ] Place all primitives in `apps/web/src/components/ui/`
- [ ] Each component accepts `variant` and `size` props

#### 1.3 Skeleton States

- [ ] Create `Skeleton` component with animated backgrounds
- [ ] Replace loading spinners with skeletons for:
  - Conversation list
  - Message history
  - Settings panels

#### 1.4 /ui-lab Route

- [ ] Create `pages/UILab.tsx` route
- [ ] Import and render all core primitives with variants
- [ ] Add note that this route should be excluded from production builds
- [ ] Document how to access (e.g., `/ui-lab` in development only)

#### 1.5 Unify Toast/Alert Pattern

- [ ] Audit existing error/success message patterns
- [ ] Create consistent `Alert` component if needed
- [ ] Delete unused toast libraries from `package.json`
- [ ] Document alert usage patterns

#### 1.6 A11y Focus Utilities

- [ ] Add `focus-visible` ring classes in Tailwind
- [ ] Apply to all interactive elements
- [ ] Audit keyboard navigation for new components
- [ ] Test with screen reader

---

### Phase 2 – Chat Interface Refinement 💬

**Status:** ⏸️ Not Started

#### 2.1 Message Bubbles

- [ ] Refactor user and AI message bubbles into `MessageBubble` component
- [ ] Factor out repeated logic (actions, model/version info)
- [ ] Use core `Card` component internally
- [ ] Maintain existing streaming behaviour
- [ ] Keep derived‑memory indicators

#### 2.2 Conversation List

- [ ] Extract conversation list items into `ConversationItem` component
- [ ] Add visual cues for:
  - Selected state
  - Unread state
  - Renaming state
- [ ] Support keyboard navigation

#### 2.3 Chat Input Improvements

- [ ] Enhance input area with:
  - Auto-resizing textarea
  - Character counter
  - Slash-command autocomplete
- [ ] Ensure send button is disabled when pending
- [ ] Integrate voice recording with new `Button` primitive

#### 2.4 Mobile Ergonomics

- [ ] Ensure message list scrolls to bottom on viewport changes
- [ ] Verify input controls are reachable on small screens
- [ ] Evaluate pull-to-refresh (nice-to-have for later)

---

### Phase 3 – Navigation & Search 🧭

**Status:** ⏸️ Not Started

#### 3.1 Grouped Navigation

- [ ] Reorganise sidebar into grouped sections:
  - "Main" (Chat, Memory)
  - "Intelligence" (Knowledge, Insights, Analytics)
  - "Administration" (Identity, Settings, Status, Logs)
- [ ] Add collapsible groups if list grows
- [ ] Document navigation hierarchy

#### 3.2 Command Palette

- [ ] Enhance existing command palette with:
  - Categories (pages, actions, conversations)
  - Keyboard shortcuts display
  - Search results highlighting
- [ ] Use `cmdk` library if appropriate or stick with custom implementation

#### 3.3 UI-Lab Expansion

- [ ] Add new components to `/ui-lab` as they're created
- [ ] Document component API and variants

---

### Phase 4 – Performance & Polish ⚡

**Status:** ⏸️ Not Started

#### 4.1 Code Splitting

- [ ] Introduce React `lazy` imports for seldom-used pages:
  - Analytics
  - Settings
  - System Status
  - Logs
- [ ] Add skeleton placeholders during loading
- [ ] Measure bundle size impact

#### 4.2 Bundle Audit

- [ ] Run bundle analyser: `pnpm vite build --report`
- [ ] Identify large dependencies
- [ ] Remove or replace heavy icons/libraries
- [ ] Document findings and optimizations

#### 4.3 Theming Packs

- [ ] Add alternative themes:
  - Light mode
  - "Slate" mode
- [ ] Toggle via CSS variables defined in Phase 1
- [ ] Store preference in user settings

#### 4.4 Optional Virtualisation

- [ ] Profile message rendering in long conversations (>1000 messages)
- [ ] **Only if** stuttering is observed:
  - Integrate `@tanstack/react-virtual`
  - Document scroll-to-bottom and streaming integration
  - Test auto-scroll behaviour thoroughly

---

### Phase 5 – Delighters ✨

**Status:** ⏸️ Not Started

#### 5.1 Micro-interactions

- [ ] Add animations for:
  - Copying links
  - Toggling memory write
  - Rating responses
  - Message send success
- [ ] Honour `prefers-reduced-motion` user preference
- [ ] Keep animations subtle (100-300ms)

#### 5.2 Custom Dashboard Widgets

- [ ] Use Recharts for analytics visualization
- [ ] Add charts for:
  - Message counts over time
  - Memory usage trends
  - Response time metrics
- [ ] **Only implement after core chat feels polished**

#### 5.3 Haptic Feedback (Mobile)

- [ ] Provide gentle vibration on:
  - Send message
  - Error states
  - Long-press actions
- [ ] Check `navigator.vibrate` support
- [ ] Make it subtle and optional

---

## Testing Posture 🧪

### Unit Tests

- [ ] Each UI primitive (Button, Input, Card) must have tests covering:
  - All variants
  - Disabled states
  - Keyboard focus behaviour

### Integration Tests

- [ ] Cover critical flows:
  - Sending a message (including error state)
  - Renaming/deleting conversations
  - Toggling semantic memory write
  - Exporting chat history
  - Voice recording

### Visual Regression

- [ ] Use `/ui-lab` route for visual testing
- [ ] Capture snapshots via headless browser
- [ ] Detect unintended styling changes

### Accessibility

- [ ] Keyboard navigation works for all interactions
- [ ] Screen reader announces state changes
- [ ] Focus is visible and logical
- [ ] Color contrast meets WCAG AA standards

---

## Implementation Checklist

### Immediate Actions (This Week)

- [ ] Update `tailwind.config.ts` with Aperion tokens
- [ ] Create `components/ui/Button.tsx`
- [ ] Create `components/ui/Input.tsx`
- [ ] Create `components/ui/Card.tsx`
- [ ] Create `components/ui/Skeleton.tsx`
- [ ] Create `pages/UILab.tsx`
- [ ] Add focus utilities to `index.css`

### Near-term (Next 2 Weeks)

- [ ] Refactor `MessageBubble` component
- [ ] Refactor `ConversationItem` component
- [ ] Enhance chat input with auto-resize
- [ ] Test mobile experience thoroughly

### Medium-term (Next Month)

- [ ] Implement grouped navigation
- [ ] Enhance command palette
- [ ] Add code splitting for large pages
- [ ] Run bundle audit

### Long-term (As Needed)

- [ ] Add theming packs
- [ ] Consider virtualisation if performance requires
- [ ] Add analytics visualizations
- [ ] Implement micro-interactions

---

## Metrics & Success Criteria

### Performance

- Bundle size: Target < 300KB gzipped
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- No frame drops during scrolling

### Developer Experience

- Component reusability: > 80%
- Time to add new feature: Reduced by 30%
- Code duplication: Reduced by 50%

### User Experience

- All actions keyboard-accessible
- Mobile usability: Smooth and responsive
- Loading states: Always informative
- Errors: Always actionable

---

## Design Language Reference

### Color Philosophy

```
Primary Actions: Emerald/Teal gradient (#10b981)
Backgrounds: Deep grays with subtle gradients
Text: High contrast white/gray (> 4.5:1)
Surfaces: Glass morphism with backdrop-blur
Accents: Used sparingly for state (purple = streaming)
```

### Typography Scale

```
Code/Data: font-mono, tracking-tight
Headers: font-bold, tracking-tight
Body: antialiased, line-height-relaxed
Small: text-xs/text-sm with uppercase for labels
```

### Spacing Rhythm

```
Tight: gap-1/gap-2 for grouped controls
Comfortable: gap-3/gap-4 for sections
Generous: gap-6/gap-8 for page layout
```

### Animation Timing

```
Instant feedback: 100ms
Standard transition: 200-250ms
Complex animation: 300-500ms
Always honor prefers-reduced-motion
```

### Border Radius

```
Buttons/Inputs: rounded-xl (0.75rem)
Cards: rounded-2xl (1rem)
Avatars: rounded-full
Callouts: rounded-lg (0.5rem)
```

---

## Closing Notes

This roadmap intentionally omits generic enterprise features (e.g. Storybook, full CSS tokens, always-on virtualisation) that do not align with your private, single‑user chat system. The focus is on **consolidating what already exists**, improving consistency, and gradually layering enhancements only after they prove valuable.

Feel free to adapt timelines or phases based on resource availability and emerging needs. The goal is **ship speed and delight**, not checkbox completion.

---

**Version:** 1.0  
**Last Updated:** 2025-12-18  
**Status:** Phase 1 In Progress  
**Owner:** Single Developer (You!)
