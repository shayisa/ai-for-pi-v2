# State Dependencies

> **Purpose**: Document what state affects what, preventing cascading bugs when making changes

## State Overview

The application state is organized into **8 domains**, each managed by a custom hook:

| Domain | Hook | Key State | Affects |
|--------|------|-----------|---------|
| Newsletter | `useNewsletterGeneration` | newsletter, loading, progress, error | Preview, Drive save, Email |
| Topics | `useTopicSelection` | topics, customTopic, suggestions | Newsletter generation |
| Audience | `useAudienceSettings` | audience, tone, flavors, imageStyle | Newsletter generation, Trending |
| Trending | `useTrendingContent` | trendingContent, sources, fetching | Topic suggestions |
| Google | `useGoogleWorkspace` | auth, settings, workflowActions | Drive, Sheets, Gmail |
| Presets | `usePresets` | presets | Load/save configurations |
| History | `useHistory` | history | Load previous newsletters |
| Subscribers | `useSubscribers` | subscribers, lists | Email distribution |

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │   authData      │
                    │ (Google OAuth)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Drive   │  │  Sheets  │  │  Gmail   │
        │  save    │  │  logging │  │  send    │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  newsletter   │◄───────────┐
                    │   (result)    │            │
                    └───────┬───────┘            │
                            │                    │
              ┌─────────────┼─────────────┐      │
              │             │             │      │
              ▼             ▼             ▼      │
        ┌──────────┐  ┌──────────┐  ┌──────────┐│
        │  topics  │  │ audience │  │  images  ││
        │          │  │   tone   │  │ (style)  ││
        └────┬─────┘  └────┬─────┘  └──────────┘│
             │              │                    │
             └──────────────┼────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   trending    │
                    │   sources     │
                    └───────────────┘
```

---

## State Mutation Chains

### Chain 1: Newsletter Generation

```
User clicks "Generate Newsletter"
    │
    ├─► setLoading("Generating...")
    ├─► setProgress(10)
    ├─► setError(null)
    ├─► setNewsletter(null)
    │
    ├─► API: generateNewsletterContent()
    │       │
    │       ├─► setProgress(40)
    │       │
    │       └─► API: generateImage() × N sections
    │               │
    │               └─► setProgress(80)
    │
    ├─► setNewsletter(result)
    ├─► setProgress(100)
    ├─► addToHistory(result)
    │
    └─► setLoading(null)
```

**If any step fails:**
```
catch(error)
    │
    ├─► setError({ message, onRetry })
    └─► setLoading(null)
```

### Chain 2: Topic Selection → Trending Fetch

```
User selects audience
    │
    ├─► setSelectedAudience(updated)
    │
    └─► Effect triggers fetchTrendingContent()
            │
            ├─► setIsFetchingTrending(true)
            │
            ├─► API: fetchTrendingSources()
            │
            ├─► setTrendingSources(sources)
            ├─► setTrendingContent(filtered)
            │
            └─► setIsFetchingTrending(false)
```

### Chain 3: Google Auth → Workflow Actions

```
User signs in with Google
    │
    ├─► setAuthData({ access_token, ... })
    ├─► setIsGoogleApiInitialized(true)
    │
    └─► Effect triggers loadGoogleSettings()
            │
            ├─► setGoogleSettings(settings)
            │
            └─► Effect triggers loadPresetsFromSheet()
                    │
                    └─► setPresets(loaded)
```

---

## Critical Dependencies

### 1. Newsletter → Everything Downstream

| When newsletter changes... | These must update... |
|---------------------------|---------------------|
| newsletter.sections | Image URLs in preview |
| newsletter.subject | Email subject line |
| newsletter | History entry |
| newsletter | Drive file content |

**Rule**: Always update newsletter through the hook, never directly.

### 2. AuthData → All Google Operations

| Operation | Requires |
|-----------|----------|
| saveToDrive | authData.access_token |
| loadFromDrive | authData.access_token |
| logToSheet | authData.access_token |
| sendEmail | authData.access_token |
| loadPresets | authData.access_token |
| savePresets | authData.access_token |

**Rule**: Check `authData?.access_token` before any Google operation.

### 3. Audience → Trending Sources

| When audience changes... | Effect |
|-------------------------|--------|
| Any audience toggle | Refetch trending sources |
| All audiences deselected | Clear trending content |

**Rule**: Debounce audience changes to avoid excessive API calls.

---

## State Isolation Rules

### DO: Keep state in appropriate hook

```typescript
// GOOD: Newsletter state stays in useNewsletterGeneration
const { newsletter, generate } = useNewsletterGeneration();

// Component just uses the hook
function GeneratePage() {
  const { newsletter, generate, loading } = useNewsletterGeneration();
  // ...
}
```

### DON'T: Spread state across components

```typescript
// BAD: State leaking into components
function GeneratePage() {
  const [localNewsletter, setLocalNewsletter] = useState(null);
  // This creates duplicate state!
}
```

### DO: Use callbacks for cross-hook communication

```typescript
// GOOD: Hook provides callback
const { newsletter } = useNewsletterGeneration();
const { addToHistory } = useHistory();

// After generation succeeds:
if (newsletter) {
  addToHistory(newsletter);
}
```

### DON'T: Access other hook internals

```typescript
// BAD: Reaching into other hook's implementation
const { setHistoryItems } = useHistory(); // Don't expose setters
historyItems.push(newItem); // Direct mutation!
```

---

## Error State Contract

All hooks that can error follow this pattern:

```typescript
interface ErrorState {
  message: string;
  onRetry?: () => Promise<void>;
  code?: string;  // For programmatic handling
}

// Usage in hook:
const [error, setError] = useState<ErrorState | null>(null);

// Setting error with retry:
setError({
  message: "Failed to generate newsletter",
  onRetry: () => generate(lastRequest),
  code: "GENERATION_FAILED"
});

// Clearing error:
setError(null);
```

---

## Loading State Contract

Loading states use descriptive strings (not booleans):

```typescript
// Type
type LoadingState = string | null;

// Examples
setLoading("Generating newsletter content...");
setLoading("Creating images...");
setLoading("Saving to Drive...");
setLoading(null); // Done
```

**Why strings?** Users see meaningful progress messages, not just spinners.

---

## localStorage Dependencies

| Key | Written By | Read By | Format |
|-----|------------|---------|--------|
| `newsletterPresets` | usePresets | usePresets | JSON array |
| `generationHistory` | useHistory | useHistory | JSON array |
| `googleSettings` | useGoogleWorkspace | useGoogleWorkspace | JSON object |

**Rule**: Always use try-catch when reading localStorage (can throw if corrupted).

---

## Testing State Changes

To verify a state change doesn't break dependencies:

1. **Find the chain**: Use this document to find downstream effects
2. **Check all consumers**: Search codebase for state variable usage
3. **Test the chain**: Manually trigger the state change, verify all effects
4. **Add regression test**: Write test that verifies the chain

Example test:
```typescript
it('updates history when newsletter is generated', async () => {
  const { result: newsletter } = renderHook(() => useNewsletterGeneration());
  const { result: history } = renderHook(() => useHistory());

  await act(() => newsletter.current.generate(mockRequest));

  expect(history.current.items).toHaveLength(1);
  expect(history.current.items[0].newsletter).toEqual(newsletter.current.newsletter);
});
```
