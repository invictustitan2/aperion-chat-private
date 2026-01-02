# Aperion Chat - Phase 3 Roadmap

> **Status:** Legacy
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Dev
> \
> **Canonical for:** Historical planning snapshot only

This roadmap is a historical snapshot and is not maintained as current truth.

For current reality, prefer:

- `docs/PROJECT_STATE.md`
- `docs/DEPLOY_PROD_RUN.md`
- `docs/API_REFERENCE.md`

> **Theme**: Deep Intelligence & Premium Experience  
> **Focus**: UI Polish, Memory Architecture, Schema Evolution, and New Capabilities

---

## Deferred from Phase 2 (Reference)

The following items require external infrastructure or manual processes:

| Item                       | Reason                   |
| -------------------------- | ------------------------ |
| Push Notifications         | Requires VAPID key setup |
| Document Uploads (PDF/TXT) | Complex chunking logic   |
| Voice Continuous Mode      | Browser API work         |
| External Log Streaming     | Requires Logpush config  |
| Uptime Monitoring          | External service         |
| D1 Automated Backups       | Cloudflare dashboard     |
| Session Management/JWT     | Infrastructure setup     |
| Content Security Policy    | CF Pages config          |
| Screen Reader Testing      | Manual QA                |

---

## 1. Memory Architecture Upgrades

**Objective**: Transform memory from storage to intelligent knowledge graph.

### 1.1 Memory Relationships & Graph

- [x] Add `relationships` table for memory-to-memory links.
- [x] Implement "related memories" feature in Memory page.
- [ ] Create visual memory graph (D3.js or similar).
- [ ] Add automatic relationship detection via AI.

### 1.2 Memory Importance Scoring

- [x] Add `importance` column to episodic/semantic tables.
- [ ] Implement decay algorithm for old memories.
- [ ] Add "pin" functionality for important memories.
- [ ] Surface high-importance memories in Chat context.

### 1.3 Memory Categories & Tags

- [x] Add `tags` column (JSON array) to memory tables.
- [x] Create tag management UI in Memory page.
- [x] Implement tag-based filtering and search.
- [ ] Auto-suggest tags based on content analysis.

### 1.4 Memory Timeline View

- [ ] Create timeline visualization for episodic memories.
- [ ] Add date range picker for memory exploration.
- [ ] Implement "On this day" feature showing past memories.

---

## 2. Schema Evolution & Data Model

**Objective**: Prepare database for advanced features and scale.

### 2.1 Conversation Threads

- [x] Create `conversations` table (id, title, created_at, updated_at).
- [x] Add `conversation_id` FK to episodic table.
- [x] Implement conversation list UI in sidebar.
- [x] Add conversation renaming and deletion.

### 2.2 User Preferences Table

- [x] Create `preferences` table for user settings.
- [x] Migrate theme preference from localStorage.
- [x] Add AI personality/tone preferences.
- [ ] Store notification and privacy settings.

### 2.3 Media Attachments

- [ ] Create `attachments` table linking media to memories.
- [ ] Store image metadata (dimensions, analysis).
- [ ] Implement attachment gallery view.
- [ ] Add attachment preview in chat bubbles.

### 2.4 Audit Trail Enhancements

- [ ] Add `actions` table for user activity tracking.
- [ ] Log memory edits, deletions, and access.
- [ ] Create audit log viewer in admin section.

---

## 3. UI Enhancements & Polish

**Objective**: Elevate the interface to premium, production-grade quality.

### 3.1 Chat Experience Upgrades

- [x] Add message reactions (thumbs up/down for AI responses).
- [x] Implement message editing (user messages).
- [x] Add copy-to-clipboard for AI responses.
- [x] Create expandable code blocks with syntax highlighting.
- [x] Add share message/conversation feature.

### 3.2 Rich Message Rendering

- [x] Full Markdown support with GFM extensions.
- [x] LaTeX/KaTeX for mathematical expressions.
- [x] Mermaid diagram rendering in chat.
- [x] Collapsible sections for long responses.

### 3.3 Voice & Audio Enhancements

- [ ] Add audio waveform visualization during playback.
- [ ] Implement voice speed controls.
- [ ] Add transcription display during voice chat.
- [ ] Create voice history with playback.

### 3.4 Mobile Experience

- [ ] Implement swipe gestures for navigation.
- [ ] Add pull-to-refresh on list views.
- [ ] Optimize touch targets for mobile.
- [ ] Add bottom sheet dialogs for actions.

---

## 4. New UI Tabs & Features

**Objective**: Add meaningful new capabilities through dedicated interfaces.

### 4.1 Analytics Dashboard (New Tab)

- [x] Create `/analytics` route and page.
- [x] Display memory growth charts over time.
- [x] Show AI usage statistics (approx via assistant message metrics).
- [x] Visualize topic distribution in memories.
- [x] Add daily/weekly/monthly activity summary.

### 4.2 Knowledge Base (New Tab)

- [x] Create `/knowledge` route for curated knowledge.
- [x] Allow promoting semantic memories to knowledge.
- [x] Implement knowledge categorization.
- [x] Add knowledge search and browse interface.
- [ ] Create knowledge export (JSON/Markdown).

### 4.3 Insights & Patterns (New Tab)

- [x] Create `/insights` route for AI-generated insights.
- [x] Generate periodic memory summaries.
- [ ] Identify recurring topics and themes.
- [ ] Surface connections between memories.
- [ ] Create "memory digest" feature.

### 4.4 Quick Actions (Command Palette)

- [x] Implement Cmd+K command palette.
- [x] Add quick navigation actions.
- [x] Include quick memory search.
- [x] Add quick settings toggles.
- [ ] Support custom shortcuts.

---

## 5. Existing Tab Enhancements

**Objective**: Improve each existing page with new capabilities.

### 5.1 Chat Tab Additions

- [x] Add conversation history sidebar.
- [x] Implement "New Conversation" button.
- [x] Add context indicator showing memory usage.
- [x] Create AI personality selector.
- [x] Add response regeneration button.

### 5.2 Memory Tab Additions

- [ ] Add bulk actions (delete, tag, export).
- [ ] Implement memory merging for duplicates.
- [ ] Add memory source/provenance display.
- [ ] Create memory comparison view.
- [ ] Add memory edit functionality.

### 5.3 Identity Tab Additions

- [ ] Add avatar upload with image cropping.
- [ ] Create custom fields for extended profile.
- [ ] Add identity export/import.
- [ ] Implement identity backup feature.

### 5.4 Settings Tab Additions

- [ ] Add theme color customization.
- [ ] Create API key management section.
- [ ] Add data export (full backup) feature.
- [ ] Implement "danger zone" with data deletion.
- [ ] Add notification preferences.

---

## 6. AI & Intelligence Upgrades

**Objective**: Make AI interactions smarter and more contextual.

### 6.1 Contextual Memory Injection

- [ ] Implement smart memory selection for context.
- [ ] Add relevance scoring for memory retrieval.
- [ ] Create memory citation in AI responses.
- [ ] Show which memories influenced response.

### 6.2 AI Personas

- [ ] Create persona system with different tones.
- [ ] Add persona switching in settings.
- [ ] Implement custom system prompts.
- [ ] Store persona preferences per conversation.

### 6.3 Proactive AI Features

- [ ] Implement "suggested questions" after responses.
- [ ] Add "related topics" suggestions.
- [ ] Create memory organization suggestions.
- [ ] Generate periodic insight notifications.

---

## Prioritization

| Priority | Feature              | Impact | Effort |
| -------- | -------------------- | ------ | ------ |
| **P0**   | Conversation Threads | High   | Medium |
| **P0**   | Analytics Dashboard  | High   | Medium |
| **P0**   | Chat Message Actions | High   | Low    |
| **P1**   | Memory Tags          | High   | Low    |
| **P1**   | Knowledge Base       | High   | High   |
| **P1**   | Command Palette      | Medium | Low    |
| **P2**   | Memory Graph         | Medium | High   |
| **P2**   | AI Personas          | Medium | Medium |
| **P2**   | Timeline View        | Low    | Medium |

---

## Migration Notes

### Required Schema Changes

```sql
-- 1. Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT
);

-- 2. Add conversation_id to episodic
ALTER TABLE episodic ADD COLUMN conversation_id TEXT REFERENCES conversations(id);

-- 3. Tags for memories
ALTER TABLE episodic ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE semantic ADD COLUMN tags TEXT DEFAULT '[]';

-- 4. Memory importance
ALTER TABLE episodic ADD COLUMN importance REAL DEFAULT 0.5;
ALTER TABLE semantic ADD COLUMN importance REAL DEFAULT 0.5;

-- 5. User preferences
CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 6. Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  memory_type TEXT NOT NULL, -- 'episodic' or 'semantic'
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  filename TEXT,
  size INTEGER,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

-- 7. Audit actions
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

-- 8. Memory relationships
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);
```

---

## Success Metrics

- **Conversation adoption**: 80% of chats in named conversations
- **Memory engagement**: 50% increase in memory views
- **Analytics usage**: Daily active usage of dashboard
- **Knowledge curation**: 20+ curated knowledge items
- **Mobile satisfaction**: Improved touch interaction scores

---

_Last Updated: December 2024_
