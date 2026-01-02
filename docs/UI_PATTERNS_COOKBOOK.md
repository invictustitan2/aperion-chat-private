# Aperion UI Patterns Cookbook

**Purpose:** Detailed implementation patterns and component usage examples. Reference documentation for developers.

---

## Component Usage Patterns

### Buttons

```tsx
import { Button } from './components/ui';

// Primary CTA
<Button variant="primary" size="md">
  Save Changes
</Button>

// With loading state
<Button variant="primary" isLoading={isPending}>
  Saving...
</Button>

// With icons
<Button
  variant="secondary"
  leftIcon={<Download />}
  rightIcon={<ExternalLink />}
>
  Export
</Button>

// Full width
<Button variant="primary" fullWidth>
  Sign In
</Button>

// Disabled state
<Button variant="danger" disabled={!canDelete}>
  Delete Account
</Button>
```

**Variants:**

- `primary` - Main actions (emerald gradient)
- `secondary` - Alternative actions (glass)
- `ghost` - Tertiary actions (transparent)
- `danger` - Destructive actions (red gradient)

**Sizes:** `xs`, `sm`, `md` (default), `lg`

---

### Inputs

```tsx
import { Input } from './components/ui';

// Basic
<Input
  label="Email"
  placeholder="your@email.com"
  type="email"
/>

// With error
<Input
  label="Password"
  error="Password must be at least 8 characters"
  type="password"
/>

// With helper text
<Input
  label="Username"
  helperText="This will be your display name"
/>

// With icons
<Input
  label="Search"
  placeholder="Search conversations..."
  leftIcon={<Search className="w-4 h-4" />}
  rightIcon={
    <button onClick={handleClear}>
      <X className="w-4 h-4" />
    </button>
  }
/>
```

---

### Cards

```tsx
import { Card } from './components/ui';

// Basic container
<Card variant="glass-dark" padding="lg">
  <h3>Content Title</h3>
  <p>Content body...</p>
</Card>

// Hoverable (for clickable cards)
<Card variant="elevated" padding="md" hoverable>
  <div onClick={handleClick}>
    Interactive content
  </div>
</Card>

// No padding (for custom layouts)
<Card variant="default" padding="none">
  <CustomLayout />
</Card>
```

**Variants:**

- `default` - Standard bg-white/5
- `glass` - Semi-transparent blur
- `glass-dark` - Darker glass for nesting
- `elevated` - With shadow

**Padding:** `none`, `sm`, `md`, `lg`

---

### Dialogs / Sheets (Radix)

Use the wrapper components from `apps/web/src/components/ui/` (Radix-based) for any modal, sheet, or details overlay.

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "./components/ui";

// Modal
<Dialog>
  <DialogTrigger asChild>
    <button className="radius-full bg-white/5 border border-white/10 tap44">
      Open
    </button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Settings</DialogTitle>
      <DialogDescription>Update preferences</DialogDescription>
    </DialogHeader>
    <DialogBody>
      <div className="text-sm text-gray-200">…</div>
    </DialogBody>
    <DialogFooter>
      <DialogClose asChild>
        <button className="radius-full bg-white/5 border border-white/10 tap44 px-3">
          Close
        </button>
      </DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Sheet
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent variant="sheet" sheetSide="right">
    <div className="p-4 border-b border-white/10">
      <div className="text-sm font-semibold text-white">Panel</div>
    </div>
    <div className="p-4 flex-1 overflow-y-auto">…</div>
  </DialogContent>
</Dialog>
```

Rules:

- No bespoke overlays; use `DialogContent` with `variant="sheet"` for drawers.
- Focus trapping + Esc-to-close comes from Radix.

---

### Dropdown Menus (Radix)

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/ui";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="radius-full bg-white/5 border border-white/10 tap44">
      Actions
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onSelect={() => doThing()}>Rename</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => doThingElse()}>Delete</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem disabled>Disabled item</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>;
```

Recommended for composite rows (conversation/message actions):

- Put a single actions trigger in the row.
- Put stable `data-testid` hooks on trigger + items.
- Use `onSelect` (Radix) rather than `onClick`.

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button
      type="button"
      data-testid="conversation-actions-trigger"
      aria-label="Conversation actions"
      className="tap44"
    >
      …
    </button>
  </DropdownMenuTrigger>

  <DropdownMenuContent align="end">
    <DropdownMenuItem
      data-testid="conversation-action-rename"
      onSelect={() => onStartRename(id, title)}
    >
      Rename
    </DropdownMenuItem>
    <DropdownMenuItem
      data-testid="conversation-action-delete"
      onSelect={() => onDelete(id)}
    >
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Tooltips (Radix)

Use tooltips for icon-only buttons (desktop/keyboard discoverability). Provide `aria-label` always.

```tsx
import { IconButtonTooltip } from "./components/ui";

<IconButtonTooltip label="Open operator panel">
  <button aria-label="Open operator panel" className="radius-full tap44">
    …
  </button>
</IconButtonTooltip>;
```

Note: tooltips degrade gracefully on coarse pointers (mobile).

---

### Tabs (Radix)

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui";

<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="a">A</TabsTrigger>
    <TabsTrigger value="b">B</TabsTrigger>
  </TabsList>
  <TabsContent value="a">A content</TabsContent>
  <TabsContent value="b">B content</TabsContent>
</Tabs>;
```

---

### Toasts / Notices (Radix)

The app exposes a single global Toast system (Radix). Use it for transient notices (errors, success, “saved”).

```tsx
import { useSimpleToast } from "./components/ui";

const { show, toast } = useSimpleToast();

return (
  <>
    {toast}
    <button
      onClick={() =>
        show({ title: "Saved", description: "Preferences updated" })
      }
    >
      Save
    </button>
  </>
);
```

---

### Skeletons

```tsx
import {
  Skeleton,
  MessageSkeleton,
  ConversationListSkeleton,
  PageSkeleton,
} from './components/ui';

// Basic skeleton
<Skeleton width={200} height={20} />
<Skeleton width="100%" height={80} variant="rectangular" />
<Skeleton width={40} height={40} variant="circular" />

// Pre-built message skeleton
{isLoading ? (
  <>
    <MessageSkeleton />
    <MessageSkeleton isUser />
    <MessageSkeleton />
  </>
) : (
  messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
)}

// Conversation list skeleton
{conversationsLoading ? (
  <ConversationListSkeleton count={5} />
) : (
  <ConversationList conversations={conversations} />
)}

// Full page skeleton
{isInitializing ? <PageSkeleton /> : <PageContent />}
```

---

### Empty States

```tsx
import {
  NoConversationsState,
  EmptyConversationState,
  AllMessagesEmptyState,
  ErrorState,
} from "./components/EmptyStates";

// No conversations
{
  conversations.length === 0 && (
    <NoConversationsState onCreate={handleCreateConversation} />
  );
}

// Empty conversation selected
{
  selectedConversation && messages.length === 0 && <EmptyConversationState />;
}

// Welcome state
{
  !selectedConversation && <AllMessagesEmptyState />;
}

// Error with retry
{
  error && <ErrorState message={error.message} onRetry={() => refetch()} />;
}
```

---

## Design Token Usage

### Colors

```tsx
// Rule: do not invent new palette tokens.
// Use existing Tailwind primitives already used in the app, and the shared utilities.

// Glass surfaces
className = "glass";
className = "glass-dark";

// Text + borders (existing neutrals)
className = "text-gray-200";
className = "text-gray-500";
className = "border-white/10";

// State accents (existing)
className = "text-emerald-400";
className = "bg-emerald-600/20 border-emerald-500/20";
className = "text-red-400 bg-red-500/20";
```

### Typography

```tsx
// Headings
className = "text-2xl font-bold tracking-tight";

// Body text
className = "text-base text-gray-200";

// Metadata/labels
className = "text-2xs font-mono text-gray-500 uppercase";

// Code
className = "font-mono text-sm bg-black/20 px-2 py-1 rounded";
```

### Spacing

```tsx
// Tight grouping
className = "gap-1 md:gap-2";

// Comfortable spacing
className = "gap-3 md:gap-4";

// Section spacing
className = "gap-6 md:gap-8";

// Extended spacing
className = "gap-18"; // 4.5rem for special layouts
```

### Glass Effects

```tsx
// Light glass (overlays, tooltips)
className = "glass";

// Dark glass (panels, modals)
className = "glass-dark";

// Manual glass (custom needs)
className = "bg-white/10 backdrop-blur-md border border-white/10";
```

---

## Animation Patterns

### Page Transitions

```tsx
// Fade in
className="animate-fade-in"

// Slide up
className="animate-slide-up"

// Custom timing
style={{ animationDuration: '200ms' }}
```

### Micro-interactions

```tsx
// Button hover
className = "transition-all duration-200 hover:scale-105";

// Focus states
className = "focus-ring-visible";

// Pulse (loading indicator)
className = "animate-pulse-slow";
```

### Respect User Preferences

```tsx
// Disable animations if user prefers reduced motion
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in {
    animation: none;
  }
}
```

---

## Accessibility Patterns

### Focus Management

```tsx
// Always use focus-ring-visible
<button className="focus-ring-visible">
  Click me
</button>

// Custom focus (rare cases)
<div
  tabIndex={0}
  className="focus:outline-none focus:ring-2 focus:ring-emerald-500"
>
  Custom focusable
</div>
```

### ARIA Labels

```tsx
// Button with icon only
<button aria-label="Close dialog">
  <X className="w-4 h-4" />
</button>

// Input with visible label
<Input label="Email" id="email-input" />

// Input with aria-label
<input aria-label="Search" />

// Current state
<button aria-current="page">
  Active Tab
</button>

// Pressed state
<button aria-pressed={isToggled}>
  Toggle
</button>
```

### Keyboard Navigation

```tsx
// Escape to close
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    onClose();
  }
};

// Arrow navigation
if (e.key === "ArrowDown") {
  e.preventDefault();
  moveSelectionDown();
}

// Enter vs Shift+Enter
if (e.key === "Enter" && !e.shiftKey) {
  e.preventDefault();
  onSubmit();
}
```

---

## Form Patterns

### Basic Form

```tsx
<form onSubmit={handleSubmit} className="space-y-4">
  <Input
    label="Name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    error={errors.name}
    required
  />

  <Input
    label="Email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    error={errors.email}
    required
  />

  <div className="flex gap-3">
    <Button type="submit" variant="primary" isLoading={isSubmitting}>
      Save
    </Button>
    <Button type="button" variant="ghost" onClick={onCancel}>
      Cancel
    </Button>
  </div>
</form>
```

### Inline Editing

```tsx
const [isEditing, setIsEditing] = useState(false);
const [value, setValue] = useState(initialValue);

{
  isEditing ? (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") handleCancel();
      }}
      autoFocus
    />
  ) : (
    <div onClick={() => setIsEditing(true)}>{value}</div>
  );
}
```

---

## Loading State Patterns

### Inline Loading

```tsx
<Button variant="primary" isLoading={isPending}>
  {isPending ? "Saving..." : "Save"}
</Button>
```

### List Loading

```tsx
{
  isLoading ? (
    <ConversationListSkeleton count={5} />
  ) : error ? (
    <ErrorState message={error.message} onRetry={refetch} />
  ) : conversations.length === 0 ? (
    <NoConversationsState onCreate={handleCreate} />
  ) : (
    conversations.map((c) => <ConversationItem key={c.id} conversation={c} />)
  );
}
```

### Progressive Loading

```tsx
// Show cached data immediately
{
  data ? <MessageList messages={data} /> : <MessageSkeleton />;
}

// Update in background
{
  isFetching && (
    <div className="fixed top-4 right-4">
      <Loader2 className="w-4 h-4 animate-spin" />
    </div>
  );
}
```

---

## Mobile Patterns (iPhone 15 First)

### iPhone-First Responsive Layouts

**Index/Detail Pattern (Mandatory)**
On mobile, never show sidebar + content simultaneously if it cramps the view.

```tsx
// Chat Layout Logic
const isMobile = useMediaQuery("(max-width: 768px)");
const [view, setView] = useState<"index" | "detail">("index");

return isMobile ? (
  view === "index" ? (
    <ConversationList onSelect={() => setView("detail")} />
  ) : (
    <ChatDetail onBack={() => setView("index")} />
  )
) : (
  <SplitView>
    <Sidebar />
    <ChatDetail />
  </SplitView>
);
```

### Mobile Chat Navigation

**Drawer Pattern**
Use for secondary actions, but NOT for primary conversation switching if possible.

```tsx
<Drawer isOpen={isOpen} onClose={close}>
  <ConversationList />
</Drawer>
```

**Back Button (Detail View)**
Always fixed top-left in detail view.

```tsx
<button
  className="fixed top-0 left-0 p-3 pt-[env(safe-area-inset-top)] z-50"
  aria-label="Back to conversations"
>
  <ChevronLeft className="w-6 h-6" />
</button>
```

### Safe Area Insets

```tsx
// Bottom padding for iOS home indicator
className = "pb-[calc(1rem+env(safe-area-inset-bottom))]";

// Top padding for notch
className = "pt-[calc(1rem+env(safe-area-inset-top))]";
```

### Touch Targets

```tsx
// Minimum 44x44px
className="min-h-11 min-w-11 p-2"

// Icon buttons
<button className="p-3"> {/* 48px total */}
  <Icon className="w-5 h-5" />
</button>
```

### Responsive Layout

```tsx
// Stack on mobile, row on desktop
className = "flex flex-col md:flex-row gap-4";

// Hide on mobile
className = "hidden md:block";

// Different sizing
className = "text-sm md:text-base";
className = "p-3 md:p-6";
```

---

## Performance Patterns

### Code Splitting

```tsx
// Lazy load routes
const Analytics = lazy(() => import("./pages/Analytics"));

<Suspense fallback={<PageSkeleton />}>
  <Analytics />
</Suspense>;
```

### Memoization

```tsx
// Expensive computations
const filtered = useMemo(() => {
  return conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );
}, [conversations, search]);

// Callbacks to prevent re-renders
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

---

## Error Handling Patterns

### Inline Errors

```tsx
<Input
  label="Email"
  value={email}
  error={emailError}
  onChange={handleEmailChange}
/>
```

### Page-level Errors

```tsx
{
  error ? (
    <ErrorState
      message={error.message}
      onRetry={() => queryClient.invalidateQueries()}
    />
  ) : (
    <PageContent />
  );
}
```

### Toast Notifications

```tsx
// Success
toast.success("Changes saved successfully");

// Error
toast.error("Failed to save changes");

// Info
toast.info("New message received");
```

---

## Testing Patterns

### Component Tests

```tsx
describe("MessageBubble", () => {
  it("calls onCopy when copy button is clicked", () => {
    const handleCopy = vi.fn();
    render(<MessageBubble message={mockMessage} onCopy={handleCopy} />);

    const copyButton = screen.getByLabelText("Copy message");
    fireEvent.click(copyButton);

    expect(handleCopy).toHaveBeenCalledWith(
      mockMessage.id,
      mockMessage.content,
    );
  });

  it("is keyboard accessible", () => {
    render(<MessageBubble message={mockMessage} onCopy={vi.fn()} />);

    const copyButton = screen.getByLabelText("Copy message");
    copyButton.focus();

    expect(document.activeElement).toBe(copyButton);
  });
});
```

---

**Version:** 1.0  
**Last Updated:** 2025-12-18  
**Companion to:** UI_VIBE_RULES.md
