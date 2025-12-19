# Aperion UI Vibe Rules

**Purpose:** Sharp, enforceable guardrails for PR review. Not a manual—a checklist.

---

## 10 Core Rules

### 1. **Readable first, cinematic second**

- Min 16px base text
- Max-width 672px for content
- Line-height ≥ 1.5
- Contrast ≥ 4.5:1 (WCAG AA)

### 2. **Keyboard path for everything**

- All interactive elements Tab-accessible
- Focus rings required (use `.focus-ring-visible`)
- Escape dismisses, Enter confirms
- Shift+Enter for newline in textarea

### 3. **Memory/provenance is one gesture away**

- AI message metadata visible on hover or always (mobile)
- Model version, derived memories, response time shown
- Never hide core functionality behind multiple clicks

### 4. **No gradients unless conveying state**

- ✅ Allowed: Primary CTA, streaming indicator, recording state
- ❌ Forbidden: Decorative backgrounds, hover effects

### 5. **No novelty UI**

- Animations ≤ 350ms
- No confetti, sparkles, excessive celebration
- Controls feel like instruments, not toys

### 6. **Glassmorphism with purpose only**

- Use `.glass` or `.glass-dark` only
- Blur = layering (modals, overlays, panels)
- Never blur main content

### 7. **Skeletons > Spinners**

- Use `MessageSkeleton`, `ConversationListSkeleton`, `PageSkeleton`
- Spinners only for inline button actions (save, delete)
- Never show blank void

### 8. **Empty states are informative**

- Icon + title + description + optional action
- Use `Card` with `glass-dark` variant
- Description explains next action

### 9. **Typography hierarchy is strict**

- Headings: `font-bold`, `tracking-tight`
- Code/Data: `font-mono`, `tracking-tight`
- Labels: `text-2xs`/`text-xs`, `uppercase`, `text-gray-500`

### 10. **One toast/alert system**

- Inline alerts for scoped errors
- Toast for global events
- Never add multiple notification libraries

---

## 5 Anti-Rules (Never Do This)

### ❌ 1. Multiple button styles across codebase

**Wrong:**

```tsx
<button className="bg-green-500 px-3 py-2">Save</button>
<button className="bg-emerald-600 px-4 py-2.5">Save</button>
```

**Right:**

```tsx
<Button variant="primary">Save</Button>
```

### ❌ 2. Hover-only controls (no keyboard access)

**Wrong:**

```tsx
<div className="opacity-0 hover:opacity-100">Delete</div>
```

**Right:**

```tsx
<div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
  <button className="focus-ring-visible">Delete</button>
</div>
```

### ❌ 3. Vague loading or empty states

**Wrong:**

```tsx
{
  isLoading && <div>Loading...</div>;
}
<div>No data</div>;
```

**Right:**

```tsx
{
  isLoading && <MessageSkeleton />;
}
<EmptyState title="No messages yet" description="Start typing" />;
```

### ❌ 4. Arbitrary padding/spacing

**Wrong:**

```tsx
<div className="p-6 m-3">...</div>
```

**Right:**

```tsx
<Card variant="glass-dark" padding="lg">
  ...
</Card>
```

### ❌ 5. Form inputs without labels

**Wrong:**

```tsx
<input type="text" placeholder="Email" />
```

**Right:**

```tsx
<Input label="Email" placeholder="your@email.com" />
```

---

## PR Checklist

Copy this into every PR touching UI:

```
- [ ] All interactive elements are Tab-accessible
- [ ] Focus rings visible on keyboard navigation
- [ ] Used design tokens (Button, Input, Card)
- [ ] Loading states use skeletons (not spinners)
- [ ] Empty states are informative
- [ ] No arbitrary gradients or animations
- [ ] Typography uses approved scale
- [ ] Tested with keyboard only
- [ ] Tested at mobile width (375px)
```

---

## Enforcement

1. **Code Review:** Reviewer checks PR checklist
2. **Manual QA:** Navigate UI with keyboard only
3. **Visual Regression:** Compare `/ui-lab` screenshots

**When in doubt:** Readable, keyboard-accessible, no novelty.

---

**Version:** 2.0 (Refactored)  
**Last Updated:** 2025-12-18  
**Lines:** 139 (was 320)
