---
title: Six Critical Prevention Strategies for Common Development Issues
category: patterns
severity: P1
component: all
date: 2026-01-05
symptoms:
  - Incomplete features shipped (UI but no API wiring)
  - Silent failures (console.log instead of API calls)
  - Props quietly ignored due to name mismatches
  - Agent tools missing from executor registry
  - Memory leaks from uncleared timeouts
  - Dynamic Tailwind classes not generated
root_cause: Missing pre-commit validation, incomplete feature checklists, TypeScript strictness gaps
solution_pattern: Automated checks, code review checklists, test requirements, documentation updates
tags:
  [
    console-stubs,
    prop-mismatch,
    executor-validation,
    memory-leak,
    tailwind-jit,
    feature-completeness,
  ]
---

# Six Critical Prevention Strategies

**Purpose:** Prevent 6 recurring bugs that waste debugging time and cause customer-facing issues.

**Each strategy includes:**

- Code review checklist (catch during PR)
- Automated validation (pre-commit hook)
- TypeScript/ESLint rules (prevent at write-time)
- Test requirements (prevent at runtime)
- Documentation & quick reference

---

## 1. Console.log Stub Anti-Pattern

### Problem

UI event handlers contain placeholder `console.log` statements instead of calling real API endpoints. The feature looks complete (button renders, click works) but silently does nothing.

**Example:**

```typescript
// BAD: looks complete, silently fails
const handlePublish = async () => {
  console.log('Publishing draft...');
  setPublishing(true);
};

// Result: button clicks, nothing happens, no error shown
```

**Impact:**

- Features look done in QA but don't work
- No error messages (silent failure is worse than visible error)
- Developers think feature is complete
- Shipping incomplete code to production

### Root Cause

- "Just testing the UI" mentality → stub with console.log
- Forgot to replace stub before committing
- No pre-commit validation
- ESLint doesn't warn about console in production code

### Prevention Strategies

#### Strategy 1: Code Review Checklist

**During PR Review, check:**

```markdown
# Console.log Stub Detection Checklist

- [ ] No `console.log/warn/error` in event handlers
- [ ] No `console.log` in mutation hooks (useState setters)
- [ ] No `console.log` without corresponding API call above or below
- [ ] Search PR for `console.log` with grep: `git show --format="" -p | grep console.log`
- [ ] If found, request removal or justification in test files only
- [ ] Check git blame on `console.log` lines - are they recent adds?
```

**Review Comment Template:**

````markdown
### Console.log Detected in Handler

Line 42:

```typescript
const handlePublish = async () => {
  console.log('Publishing...'); // ← REMOVE THIS
  // Missing API call here!
};
```
````

**Issue:** This handler logs but doesn't call an API. Is the implementation incomplete?

**Fix:** Either:

1. Add the API call: `await apiClient.publishDraft(...)`
2. If this is intentional stub code, move to a separate test file or mark with `// TODO`
3. Add proper error handling, not logging

````

#### Strategy 2: ESLint Rule with Context

**Add to `.eslintrc.js` or `eslint.config.mjs`:**

```javascript
{
  rules: {
    // Disallow console in production code, allow in tests
    'no-console': ['error', {
      allow: ['warn', 'error'], // Allow console.warn/error only
    }],

    // Custom rule: Flag console.log in handlers/hooks
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.object.name="console"][callee.property.name="log"]',
        message: 'console.log() removed in production. Use logger.info() or implement the API call.',
      },
    ],

    // Flag console without error handling context
    'no-restricted-properties': [
      'error',
      {
        object: 'console',
        property: 'log',
        message: 'Use logger.info() for structured logging or remove stub code.',
      },
    ],
  },
}
````

**Result:** TypeScript file with console.log fails type check before commit.

#### Strategy 3: Pre-Commit Hook

**Add to `.husky/pre-commit`:**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Detect console.log in staged files (not tests)
echo "Checking for console.log in production code..."
if git diff --cached --name-only | grep -E '\.(ts|tsx)$' | grep -v '\.test\.' | xargs grep -l 'console\.log' 2>/dev/null; then
  echo "ERROR: Found console.log() in production code. Use logger.info() instead."
  echo "Files with issues:"
  git diff --cached --name-only | grep -E '\.(ts|tsx)$' | grep -v '\.test\.' | xargs grep -n 'console\.log' 2>/dev/null
  exit 1
fi

exit 0
```

**Behavior:** Commit fails with error message listing files with console.log

#### Strategy 4: Test Requirements

**Minimum test coverage:**

```typescript
describe('Publishing handler', () => {
  it('should call API endpoint when publish button clicked', async () => {
    const apiClient = vi.mocked(useApiClient);
    const publishSpy = vi.fn();
    apiClient.publishDraft = publishSpy;

    render(<PublishButton />);
    const button = screen.getByRole('button', { name: /publish/i });

    await userEvent.click(button);

    // MUST assert API was called
    expect(publishSpy).toHaveBeenCalled();
  });

  it('should show error if API fails', async () => {
    const apiClient = vi.mocked(useApiClient);
    apiClient.publishDraft = vi.fn().mockRejectedValue(
      new Error('Network error')
    );

    render(<PublishButton />);
    const button = screen.getByRole('button', { name: /publish/i });

    await userEvent.click(button);

    // MUST assert error is displayed
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });
});
```

**Critical:** If test passes without API call, you have a stub detector gap.

#### Strategy 5: Definition of "Done"

Add to project Definition of Done checklist:

```markdown
# Handler/Hook Definition of Done

- [ ] Handler makes actual API call (verified in test)
- [ ] Error handling implemented (try/catch or .catch())
- [ ] User feedback provided (toast, error message, loading state)
- [ ] Logging uses logger.info/error, not console.log
- [ ] If UI-only feature (no API), document why in PR
- [ ] ESLint passes (no console.log detected)
```

---

## 2. Optional Prop Name Mismatch

### Problem

Component receives optional prop with a default value. Typo in prop name = prop silently ignored, default value used instead. Component "works" but with wrong data.

**Example:**

```typescript
// Component expects 'initialValue' (with capital V)
interface ButtonProps {
  label?: string;
  initialValue?: string; // defaults to empty string
}

function MyButton({ label = 'Click', initialValue = '' }: ButtonProps) {
  return <button>{label}</button>;
}

// Parent typos 'initValue' (forgot capital V)
export function App() {
  return <MyButton initValue="Hello" />; // ← SILENT FAIL
  // Result: initialValue is '', parent's "Hello" is ignored
}
```

**Impact:**

- Wrong data displayed without any error
- Hard to debug (no TS error, component renders fine)
- Developers blame parent code: "I passed it!"
- QA finds inconsistent behavior

### Root Cause

- TypeScript `interface Props { optional?: type }` doesn't enforce all properties are used
- No "unused property" warning even if you pass a typo
- Default values hide the mistake
- No exhaustive property checker

### Prevention Strategies

#### Strategy 1: TypeScript Strictness

**Option A: Require explicit prop type checking**

```typescript
// BAD: TypeScript doesn't catch typos in optional props
interface Props {
  initialValue?: string;
  label?: string;
}

function Component(props: Props) {
  return <div>{props.initialValue}</div>;
}

// Parent can typo: initValue instead of initialValue
<Component initValue="Hello" />; // No TS error!

// GOOD: Use exhaustive prop validation
import { Exact } from 'type-fest';

type PropsExact = Exact<{
  initialValue?: string;
  label?: string;
}>;

function Component(props: PropsExact) {
  return <div>{props.initialValue}</div>;
}

// Parent now gets error:
<Component initValue="Hello" />; // TS ERROR: "initValue not assignable"
```

**Option B: Export const for prop keys**

```typescript
// Define all valid prop names as const
export const BUTTON_PROPS = {
  LABEL: 'label',
  INITIAL_VALUE: 'initialValue',
  ON_CLICK: 'onClick',
} as const;

export interface ButtonProps {
  [BUTTON_PROPS.LABEL]?: string;
  [BUTTON_PROPS.INITIAL_VALUE]?: string;
  [BUTTON_PROPS.ON_CLICK]?: () => void;
}

// Parent must use const keys
<Button {...{ [BUTTON_PROPS.INITIAL_VALUE]: 'Hello' }} />
```

**Option C: Strict null checking**

```bash
# tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noExtraExtraProperties": true, // Not a real option, but use ESLint instead
  }
}
```

#### Strategy 2: ESLint Rules

**Add custom ESLint rule to detect unused props:**

```javascript
// .eslintrc.js
{
  rules: {
    // Warn about likely typos in component props
    'react/prop-types': ['error', {
      ignore: [],
      customValidators: [],
      skipUndeclared: false, // Don't skip - catch typos
    }],

    // Warn if passing props to components that don't use them
    '@typescript-eslint/no-extra-non-null-assertion': 'error',
  },
}
```

**Or use a strict prop checker plugin:**

```javascript
// Install: npm install --save-dev eslint-plugin-react-prop-types-required
{
  plugins: ['react-prop-types-required'],
  rules: {
    'react-prop-types-required/require-prop-types': 'error',
  },
}
```

#### Strategy 3: Code Review Checklist

**During PR Review:**

```markdown
# Optional Props Checklist

For all new components with optional props:

- [ ] Interface uses `Optional<T>` or `? :` consistently
- [ ] All optional props have defaults (or handled as undefined)
- [ ] No props passed with typos (review usage in tests/parent)
- [ ] If prop has default, verify it's actually used
- [ ] Check git diff: are all new props actually consumed in component body?
- [ ] Parent components don't accidentally typo prop names
```

**Review Comment Template:**

````markdown
### Possible Prop Mismatch

Line 15 (component definition):

```typescript
interface Props {
  initialValue?: string;
}
```
````

Line 34 (usage):

```typescript
<Input initValue="test" /> // ← Typo?
```

Should this be `initialValue`?

````

#### Strategy 4: Test Requirements

```typescript
describe('Component with optional props', () => {
  it('should use passed initialValue prop', () => {
    const { rerender } = render(
      <Input initialValue="First" />
    );

    // MUST assert the passed value is used
    expect(screen.getByDisplayValue('First')).toBeInTheDocument();

    // Test that prop change works
    rerender(<Input initialValue="Second" />);
    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('should use default if prop not provided', () => {
    render(<Input />);

    // Default should be visible
    expect(screen.getByDisplayValue('Default Value')).toBeInTheDocument();
  });

  it('should not use typo prop name', () => {
    // This test SHOULD fail if component accepts typo
    // @ts-expect-error - intentional typo
    render(<Input initValue="test" />);

    // Component should NOT use the typo prop
    expect(screen.queryByDisplayValue('test')).not.toBeInTheDocument();
  });
});
````

#### Strategy 5: Documentation

Add to component file:

```typescript
/**
 * Input Component
 *
 * @param initialValue - EXACT NAME: "initialValue" (camelCase with V)
 *   Common mistake: "initValue" (missing capital V)
 *   Default: empty string
 *
 * @example
 * // CORRECT:
 * <Input initialValue="hello" />
 *
 * // WRONG (will be silently ignored):
 * <Input initValue="hello" />
 */
```

#### Strategy 6: Pre-Commit Hook for Props

```bash
#!/usr/bin/env sh
# Detect common prop name typos
echo "Checking for common prop name typos..."

# Check for typos like initValue instead of initialValue
git diff --cached -U0 | grep -E '(initValue|initalValue|intialValue|intiValue)' && {
  echo "WARNING: Possible prop name typo detected (initValue, initalValue, intialValue)"
  echo "Did you mean 'initialValue'?"
  exit 1
}

exit 0
```

---

## 3. Executor Registry Validation Gap

### Problem

New write tool added to agent system but executor not registered. Server starts successfully but when tool is used, it silently fails with "no executor found" error. Feature never executes.

**Example:**

```typescript
// Tool added to customer chat tools
export const publishDraftTool = {
  id: 'publish_draft',
  execute: async (context, payload) => {
    // Returns success with proposal
    return { success: true, requiresApproval: false };
  },
};

// FORGOT to add executor registration in executors/index.ts
// Server still starts (no validation)
// User calls tool → proposal created → executor never found → nothing happens
```

**Impact:**

- Tool runs fine, creates proposal, but never executes
- No error messages (silent failure)
- Feature looks done until QA tests it
- Code review can't catch it (registration in different file)

### Root Cause

- Executor registration not validated at startup
- Tool definition and executor registration in separate files
- No checklist during code review
- No test for full tool → execute flow

### Prevention Strategies

#### Strategy 1: Startup Validation (Already Exists)

The codebase already has `validateExecutorRegistry()` in `/server/src/agent/proposals/executor-registry.ts`. Ensure it's called:

```typescript
// server/src/index.ts (at startup)
import { validateExecutorRegistry } from './agent/proposals/executor-registry';
import { registerAllExecutors } from './agent/executors';

// During server startup:
registerAllExecutors(prisma);
validateExecutorRegistry(); // MUST be called after registering

// If any required executor missing, server fails to start:
// ERROR: Missing executors for tools: publish_draft, discard_draft
```

**Verification:**

```bash
# Test that validation works
# Remove an executor registration and try to start
npm run dev:api
# Should see: FATAL: Missing executors for tools...
```

#### Strategy 2: Code Review Checklist

**When adding a new agent tool, verify:**

````markdown
# New Agent Tool Checklist

Before PR merge:

- [ ] **1. Tool is in REQUIRED_EXECUTOR_TOOLS list**
      Location: `server/src/agent/proposals/executor-registry.ts` lines 51-92

  If tool is a write operation, add to the list:

  ```typescript
  const REQUIRED_EXECUTOR_TOOLS = [
    ...existing...
    'publish_draft',  // ← ADD HERE
    ...
  ];
  ```
````

- [ ] **2. Executor is registered**
      Location: `server/src/agent/executors/index.ts`

  Verify function registerXxxExecutors is called in registerAllExecutors:

  ```typescript
  export function registerAllExecutors(prisma: PrismaClient) {
    registerStorefrontExecutors(prisma); // ← Must call for all executor groups
    registerOnboardingExecutors(prisma);
  }
  ```

- [ ] **3. Executor matches tool name exactly**
      Tool name: 'publish_draft'
      Executor registration: `registerProposalExecutor('publish_draft', executor)` ← EXACT MATCH

- [ ] **4. Trust tier is correct**
  - Read-only → T1 (auto-confirm)
  - Reversible change → T2 (soft-confirm)
  - Destructive change → T3 (explicit confirm)

- [ ] **5. Test includes full flow**
  - Tool executes correctly
  - Executor is called
  - State changes as expected

- [ ] **6. Executor validates inputs**
      All executor payloads validated with Zod before processing

````

#### Strategy 3: Automated Validation

**Pre-commit hook to validate executor coverage:**

```bash
#!/usr/bin/env sh
# hooks/pre-commit (part of tools validation)

echo "Checking executor registry coverage..."

# Find all tools added/modified
MODIFIED_TOOLS=$(git diff --cached --name-only | grep 'agent/tools' | head -1)

if [ -n "$MODIFIED_TOOLS" ]; then
  # Extract tool names from file
  TOOL_NAMES=$(grep -o "'[a-z_]*'" "$MODIFIED_TOOLS" | tr -d "'" | sort -u)

  # Check if each tool is in REQUIRED_EXECUTOR_TOOLS
  for TOOL in $TOOL_NAMES; do
    if ! grep -q "'$TOOL'" "server/src/agent/proposals/executor-registry.ts"; then
      echo "ERROR: Tool '$TOOL' not in REQUIRED_EXECUTOR_TOOLS"
      echo "Add it to server/src/agent/proposals/executor-registry.ts"
      exit 1
    fi
  done
fi

exit 0
````

#### Strategy 4: Test Requirements

**Minimum test coverage for executor registration:**

```typescript
// server/test/agent/executors/registry.test.ts
describe('Executor Registry', () => {
  it('should register all required executors at startup', () => {
    registerAllExecutors(mockPrisma);

    const requiredTools = getRequiredExecutorTools();

    for (const toolName of requiredTools) {
      const executor = getProposalExecutor(toolName);
      expect(executor).toBeDefined();
      expect(typeof executor).toBe('function');
    }
  });

  it('should throw if required executor is missing', () => {
    // Manually register only some
    registerProposalExecutor('publish_draft', mockExecutor);

    // validateExecutorRegistry should fail
    expect(() => validateExecutorRegistry()).toThrow(/Missing executors for tools/);
  });

  it('should have executor for every write tool', async () => {
    // For each tool in agent/tools/
    const toolNames = ['publish_draft', 'discard_draft', 'update_page_section'];

    registerAllExecutors(mockPrisma);

    for (const toolName of toolNames) {
      expect(getProposalExecutor(toolName)).toBeDefined();
    }
  });
});

// Integration test: tool → proposal → execution
describe('Tool execution flow', () => {
  it('should execute proposal after tool creates it', async () => {
    registerAllExecutors(mockPrisma);

    // 1. Tool creates proposal
    const toolResult = await publishDraftTool.execute(mockContext, {
      pages: {},
    });

    expect(toolResult.success).toBe(true);

    // 2. Executor exists and can be called
    const executor = getProposalExecutor('publish_draft');
    expect(executor).toBeDefined();

    // 3. Executor actually changes state
    const result = await executor!(tenantId, toolResult.payload);
    expect(result).toBeDefined();
  });
});
```

#### Strategy 5: Startup Log Verification

**Add to server startup checklist:**

When starting the server, verify this log appears:

```
[INFO] All required tool executors registered successfully count=27
```

If you see a FATAL error instead, fix before deploying:

```
[ERROR] FATAL: Missing executors for tools: publish_draft, discard_draft
```

#### Strategy 6: Quick Reference Card

Print and keep near workspace:

```
EXECUTOR REGISTRY CHECKLIST
============================

NEW WRITE TOOL? Follow steps 1-3:

1. ADD TOOL TO REQUIRED_EXECUTOR_TOOLS
   File: server/src/agent/proposals/executor-registry.ts
   List: REQUIRED_EXECUTOR_TOOLS array (line ~51)

2. IMPLEMENT EXECUTOR
   File: server/src/agent/executors/{domain}-executors.ts
   Function: registerProposalExecutor('tool_name', executor)

3. REGISTER IN registerAllExecutors()
   File: server/src/agent/executors/index.ts
   Call: register{Domain}Executors(prisma)

4. TEST FULL FLOW
   Tool → Proposal → Executor → State change

NOT SURE? Check existing tool:
- grep 'publish_draft' server/src/agent/
- Follow same pattern for new tool
```

---

## 4. React Timeout Memory Leak

### Problem

`setTimeout`/`setInterval` in React component not cleaned up when component unmounts. Results in:

- State updates on unmounted components (React warnings)
- Memory leaks in long-running sessions
- Orphaned timeouts firing at wrong times

**Example:**

```typescript
// BAD: No cleanup
function useDraftAutosave() {
  const [saveStatus, setSaveStatus] = useState('idle');

  async function saveDraft() {
    setSaveStatus('saving');

    // These timeouts NOT tracked
    setTimeout(() => {
      setSaveStatus('idle'); // Fires even if unmounted!
    }, 2000);

    setTimeout(() => {
      setSaveStatus('error'); // Race condition possible
    }, 5000);
  }

  return { saveDraft, saveStatus };
}

// Result: React warnings in console, memory leaks
```

### Root Cause

- setTimeout returns a timer ID
- Must clear it with clearTimeout
- React cleanup functions (`useEffect` return) must clear all timers
- Developers forget to use refs to track timers
- No eslint rule to detect this

### Prevention Strategies

#### Strategy 1: Standard Pattern for Timeouts in Hooks

Use this pattern for every timeout in React:

```typescript
// CORRECT: Track and cleanup all timeouts
function useDraftAutosave() {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  // Track ALL timeouts
  const statusResetRef = useRef<ReturnType<typeof setTimeout>>();
  const errorClearRef = useRef<ReturnType<typeof setTimeout>>();

  async function saveDraft(data: DraftData) {
    // Clear previous timers before setting new ones
    if (statusResetRef.current) clearTimeout(statusResetRef.current);
    if (errorClearRef.current) clearTimeout(errorClearRef.current);

    setSaveStatus('saving');

    try {
      await apiClient.updateDraft(data);

      // Set NEW timeout ONLY if needed
      statusResetRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      setSaveStatus('error');

      // Clear error after delay
      errorClearRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    }
  }

  // CLEANUP: Clear ALL timeouts on unmount
  useEffect(() => {
    return () => {
      if (statusResetRef.current) clearTimeout(statusResetRef.current);
      if (errorClearRef.current) clearTimeout(errorClearRef.current);
    };
  }, []);

  return { saveDraft, saveStatus };
}
```

**Key rules:**

1. Create ref for each timeout: `const timerRef = useRef<ReturnType<typeof setTimeout>>();`
2. Clear before setting new: `if (timerRef.current) clearTimeout(timerRef.current);`
3. Set new: `timerRef.current = setTimeout(...);`
4. Cleanup on unmount: Add useEffect return that clears all

#### Strategy 2: ESLint Rule for React Hooks

Install and enable:

```bash
npm install --save-dev eslint-plugin-react-hooks
```

**ESLint config:**

```javascript
{
  plugins: ['react-hooks'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
}
```

**This catches:**

- setTimeout outside useEffect (wrong usage)
- Missing dependencies in useEffect
- Timeout cleanup missing

#### Strategy 3: Code Review Checklist

**When reviewing hooks with timers:**

````markdown
# Timeout/Interval Cleanup Checklist

- [ ] Every setTimeout has a corresponding clearTimeout
- [ ] Timeouts tracked in useRef (not loose variables)
- [ ] useEffect cleanup function clears all timeouts
- [ ] No "Can't perform state update on unmounted" warnings
- [ ] Multiple rapid calls clear previous timeout first
- [ ] setInterval has matching clearInterval (or use timeout instead)

Pattern to require:

```typescript
const timerRef = useRef<ReturnType<typeof setTimeout>>();
useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, []);
```
````

````

#### Strategy 4: Test Requirements

```typescript
describe('useDraftAutosave', () => {
  it('should clear previous timeout before setting new one', async () => {
    const { result } = renderHook(() => useDraftAutosave());

    const { saveDraft } = result.current;

    // First call sets timeout
    saveDraft({ content: 'test 1' });
    const firstTimeoutId = result.current.statusResetRef.current;

    // Second call should clear first timeout
    saveDraft({ content: 'test 2' });
    const secondTimeoutId = result.current.statusResetRef.current;

    // They should be different (second replaced first)
    expect(secondTimeoutId).not.toBe(firstTimeoutId);
  });

  it('should cleanup all timeouts on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { result, unmount } = renderHook(() => useDraftAutosave());

    // Set up some timeouts
    result.current.saveDraft({ content: 'test' });

    // Unmount should clear them
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should not update state after unmount', async () => {
    const { result, unmount } = renderHook(() => useDraftAutosave());

    result.current.saveDraft({ content: 'test' });

    // Unmount immediately
    unmount();

    // Timeout tries to fire → should be noop, not error
    vi.advanceTimersByTime(2000);

    // No React warnings
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('unmounted')
    );
  });
});
````

#### Strategy 5: Pre-commit Hook

```bash
#!/usr/bin/env sh
# Detect untracked timeouts in React components

echo "Checking for untracked timeouts..."

TIMEOUT_FILES=$(git diff --cached --name-only | grep -E '\.(tsx?|jsx?)$')

for FILE in $TIMEOUT_FILES; do
  # Find setTimeout/setInterval without ref tracking
  if grep -q 'setTimeout\|setInterval' "$FILE" 2>/dev/null; then
    # Check if there's corresponding useRef + cleanup
    if ! grep -q 'useRef.*setTimeout\|useRef.*Timeout' "$FILE"; then
      # Might be untracked - warn
      echo "WARNING: Found setTimeout/setInterval in $FILE but no useRef for tracking"
      echo "Make sure timeout IDs are tracked in refs and cleaned up in useEffect"
    fi
  fi
done

exit 0
```

#### Strategy 6: Quick Reference

Print and keep visible:

```
REACT TIMEOUT CLEANUP CHECKLIST
================================

EVERY setTimeout/setInterval needs:

1. Create ref to track timer:
   const timerRef = useRef<ReturnType<typeof setTimeout>>();

2. Clear previous before setting new:
   if (timerRef.current) clearTimeout(timerRef.current);

3. Set new timer:
   timerRef.current = setTimeout(() => { ... }, ms);

4. Cleanup on unmount:
   useEffect(() => {
     return () => {
       if (timerRef.current) clearTimeout(timerRef.current);
     };
   }, []);

NEVER DO:
  setTimeout(() => setSomeState(...)); // Fires on unmount!
  let timer = setTimeout(...); // Loose variable, not cleaned up!
  useEffect(() => { setTimeout(...) }); // No cleanup!

PATTERNS:
  - Debounce: track timeout ref, clear on new input
  - Delayed reset: track timeout ref, clear in cleanup
  - Polling: use setInterval, clear in cleanup
```

---

## 5. Tailwind JIT Dynamic Class Names

### Problem

Tailwind CSS uses Just-In-Time (JIT) compilation - it scans source files for class names and generates CSS only for those found. Dynamic class names (template literals, string concat) are NOT found at build time, so CSS is never generated.

**Example:**

```typescript
// BAD: Dynamic class name
const colors = ['red', 'blue', 'green'];
const color = colors[index];

return <div className={`bg-${color}-500`}></div>;
// Result: No bg-red-500, bg-blue-500, bg-green-500 in CSS

// BAD: String concatenation
const padding = isLarge ? 'p-8' : 'p-4';
return <div className={`flex ${padding}`}></div>;
// Result: p-8 might not be in CSS

// GOOD: Use safelist or static classes
const paddingClass = isLarge ? 'padding-large' : 'padding-small';
return <div className={paddingClass}></div>;
// CSS file defines: .padding-large { @apply p-8; }
```

### Root Cause

- Tailwind JIT scans source files for `className="..."` strings
- Does NOT execute JavaScript or templates
- Dynamic classes not detected at build time
- CSS rule is never generated
- Styles work in dev (hot reload regenerates) but fail in production

### Prevention Strategies

#### Strategy 1: Avoid Dynamic Classes

**Use static classes in HTML:**

```typescript
// BAD: Dynamic
const margin = size === 'large' ? 'mx-8' : 'mx-4';
return <div className={margin}>...</div>;

// GOOD: Static
return (
  <div className={size === 'large' ? 'mx-8' : 'mx-4'}>
    ...
  </div>
);

// BETTER: Use CSS variable or data attribute
return (
  <div className="my-component" data-size={size}>
    ...
  </div>
);

// CSS:
.my-component[data-size="large"] { @apply mx-8; }
.my-component[data-size="small"] { @apply mx-4; }
```

#### Strategy 2: Use Safelist for Known Values

**tailwind.config.js:**

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Safelist: Include classes even if not found in source
  safelist: [
    // Include all responsive variants for certain classes
    {
      pattern: /^(bg|text|border)-(red|blue|green|yellow|gray)-(50|100|500|900)$/,
      variants: ['hover', 'focus', 'sm', 'md', 'lg'],
    },

    // Include specific padding classes
    {
      pattern: /^(p|px|py|m|mx|my)-(0|1|2|4|8|16)$/,
    },

    // Or just list them
    'bg-red-500',
    'bg-blue-500',
    'text-white',
  ],

  theme: {
    extend: {},
  },

  plugins: [],
};
```

#### Strategy 3: Use Inline Styles for Truly Dynamic Values

```typescript
// If value is TRULY dynamic (from API, user input, etc.)
// Use inline styles instead of classes

function DynamicColorBox({ colorHex }: { colorHex: string }) {
  // CORRECT: Use inline style for truly dynamic values
  return (
    <div style={{ backgroundColor: colorHex }}>
      Content
    </div>
  );
}

// NEVER:
return (
  <div className={`bg-[${colorHex}]`}>  // ← Won't work
    Content
  </div>
);
```

#### Strategy 4: Use CSS-in-JS for Complex Logic

```typescript
// Use Tailwind's arbitrary value syntax only for colors/sizes known at build time

// BAD:
const getPaddingClass = (size: string) => `p-${size}`; // ← Dynamic

// GOOD: Use CSS-in-JS for truly dynamic values
const getDynamicStyle = (value: number) => ({
  padding: `${value}px`,
});

function Component({ dynamicValue }: { dynamicValue: number }) {
  return (
    <div style={getDynamicStyle(dynamicValue)}>
      Content
    </div>
  );
}
```

#### Strategy 5: Code Review Checklist

**When reviewing component styling:**

```markdown
# Tailwind Dynamic Classes Checklist

- [ ] No template literals in className: `className={`p-${x}`}`
- [ ] No string concatenation: `className={padding + ' ' + margin}`
- [ ] No array.map/join in className attributes
- [ ] All conditional classes are static: `className={isLarge ? 'p-8' : 'p-4'}`
- [ ] Dynamic colors use inline style: `style={{ color: dynamicColor }}`
- [ ] No variables in className without safelist entry
- [ ] If dynamic, documented in tailwind.config.js safelist
```

#### Strategy 6: ESLint Rule

Add rule to detect suspicious patterns:

```javascript
// .eslintrc.js
{
  rules: {
    'no-restricted-syntax': [
      'warn',
      {
        selector: 'TemplateLiteral > ClassNameValue',
        message: 'Avoid template literals in className. Use static strings or inline styles.',
      },
    ],
  },
}
```

Or install a tailwind-specific plugin:

```bash
npm install --save-dev eslint-plugin-tailwindcss
```

```javascript
{
  plugins: ['tailwindcss'],
  rules: {
    'tailwindcss/classnames-order': 'warn',
    'tailwindcss/no-arbitrary-value': 'warn', // Warns on dynamic values
  },
}
```

#### Strategy 7: Test in Production Build

**Before shipping:**

```bash
# Build for production
npm run build

# Serve production build and verify styles
npm run start

# Inspect CSS file - should contain all classes used
# apps/web/.next/static/css/*.css
```

#### Strategy 8: Quick Reference

```
TAILWIND DYNAMIC CLASS PREVENTION
==================================

❌ NEVER:
  className={`p-${size}`}           // Dynamic template literal
  className={arr.join(' ')}         // Array join
  className={obj[key]}              // Object lookup
  `bg-${colorName}-500`             // Dynamic color

✅ DO:
  className={size === 'lg' ? 'p-8' : 'p-4'}  // Static alternatives
  style={{ padding: dynamicPx }}             // Inline for truly dynamic
  <div data-size={size} />                   // Data attributes
  safelist: ['p-1', 'p-2', 'p-4', 'p-8']   // List in config

✅ SAFELIST IF NEEDED:
  // tailwind.config.js
  safelist: [
    { pattern: /^p-/ },
    { pattern: /^bg-(red|blue)-(500|900)/ },
  ]
```

---

## 6. Incomplete Feature Shipping

### Problem

Feature looks done but isn't fully wired up. UI renders, components exist, but functionality isn't complete:

- Button renders but event handler doesn't call API
- Form validates but doesn't submit
- Draft system has UI but tools aren't registered
- Feature ships to QA incomplete, fails testing

**Example:**

```typescript
// Looks complete but:
export function PublishButton() {
  const [publishing, setPublishing] = useState(false);

  // Handler exists but...
  const handlePublish = async () => {
    setPublishing(true);

    // ← Missing: apiClient.publishDraft() call
    // ← Missing: error handling
    // ← Missing: success message

    setPublishing(false);
  };

  return (
    <button onClick={handlePublish} disabled={publishing}>
      {publishing ? 'Publishing...' : 'Publish'}
    </button>
  );
}

// PR passes code review (looks complete)
// Shipping ships to QA
// QA: "Button does nothing"
```

### Root Cause

- Vague "feature complete" definition
- No Definition of Done checklist
- Code review focuses on code quality, not completeness
- No integration tests verifying full flow
- Missing acceptance criteria in PR description

### Prevention Strategies

#### Strategy 1: Feature Completion Checklist

**Create `FEATURE_CHECKLIST.md` and require all items checked:**

```markdown
# Feature Completion Checklist

Use this for EVERY feature before marking PR as ready for review.

## 1. Functionality

- [ ] Feature works end-to-end locally
- [ ] All user actions have corresponding code (no stubs)
- [ ] All API calls are real (not mocked beyond mock mode)
- [ ] Error handling implemented for all failure paths
- [ ] Success/failure messages shown to user

## 2. Code Quality

- [ ] TypeScript strict mode (no `any` without justification)
- [ ] No console.log in production code
- [ ] No TODO/FIXME comments (document or delete)
- [ ] No commented-out code
- [ ] All props/parameters used (no unused vars)

## 3. State Management

- [ ] Loading states shown during async operations
- [ ] Error states shown with actionable messages
- [ ] Optimistic updates (if applicable)
- [ ] Cache invalidation after writes
- [ ] No memory leaks (cleanup timers/subscriptions)

## 4. Testing

- [ ] Unit tests written for business logic
- [ ] Integration tests for full flow
- [ ] Edge cases tested (empty states, errors, timeouts)
- [ ] At least 70% code coverage
- [ ] All tests pass locally

## 5. Agent Tools (if applicable)

- [ ] Tool registered in REQUIRED_EXECUTOR_TOOLS
- [ ] Executor implemented and registered
- [ ] Test covers tool → proposal → executor flow
- [ ] Tool validated with Zod schema
- [ ] Trust tier appropriate (T1/T2/T3)

## 6. Draft System (if applicable)

- [ ] Draft preview URL authenticated
- [ ] Publish tool exists and works
- [ ] Discard tool exists and works
- [ ] All visual changes go to draft (not live)
- [ ] Optimistic locking prevents conflicts

## 7. Database (if applicable)

- [ ] Tenant scoping on all queries
- [ ] Foreign keys defined
- [ ] Indexes created for perf-critical queries
- [ ] Migrations tested on clean DB
- [ ] Data model matches API contracts

## 8. Documentation

- [ ] Component/function has JSDoc comment
- [ ] Complex logic has inline comments
- [ ] API endpoint documented in contracts
- [ ] Breaking changes noted in CLAUDE.md

## 9. Accessibility (if UI)

- [ ] Keyboard navigation works
- [ ] Screen reader labels present
- [ ] Color contrast sufficient (AA standard)
- [ ] Focus management correct
- [ ] No layout shift (CLS < 0.1)

## 10. Performance

- [ ] No N+1 queries
- [ ] Images optimized (Next.js Image)
- [ ] Lazy loading for below-the-fold
- [ ] Bundle size checked (no unexpected increases)
- [ ] Debouncing on frequent inputs

## 11. Before Merging

- [ ] All checklist items checked
- [ ] PR description includes what was changed and why
- [ ] No merge commits (rebase only)
- [ ] Feature branch up to date with main
- [ ] Code review approved
```

#### Strategy 2: PR Template with Acceptance Criteria

**Create `.github/pull_request_template.md`:**

```markdown
## What

Brief description of feature.

## Why

Why is this change needed? What problem does it solve?

## Changes

- Item 1
- Item 2

## Testing

Describe testing done:

- Unit tests: X tests added
- Integration tests: Y tests added
- Manual testing: How to verify

## Checklist

- [ ] Feature is 100% complete (all acceptance criteria met)
- [ ] All required tests passing
- [ ] No console.log in production code
- [ ] TypeScript strict mode passes
- [ ] If agent feature, REQUIRED_EXECUTOR_TOOLS updated
- [ ] If draft system, publish/discard tools exist
- [ ] Accessibility checklist completed (if UI)

## Screenshots (if UI)

Attach before/after or demo GIF

---

**Acceptance Criteria (Copy from issue):**

- Criterion 1
- Criterion 2
- Criterion 3

**Verification Steps (Must all pass before merge):**

1. Step 1
2. Step 2
3. Step 3

---
```

#### Strategy 3: Definition of Done by Feature Type

Create different checklists for different feature types:

**For API Feature:**

```markdown
# API Feature Definition of Done

- [ ] API endpoint implemented (not stub)
- [ ] Request validation with Zod
- [ ] Response matches contract type
- [ ] Error cases handled (400, 401, 403, 500)
- [ ] Tenant scoping verified (all queries include tenantId)
- [ ] API documented in contracts package
- [ ] Integration test verifies full request/response flow
- [ ] Error messages are user-friendly (not stack traces)
```

**For Agent Tool Feature:**

```markdown
# Agent Tool Feature Definition of Done

- [ ] Tool ID added to REQUIRED_EXECUTOR_TOOLS
- [ ] Tool execute function returns correct proposal
- [ ] Executor function implemented
- [ ] Executor registered in registerAllExecutors()
- [ ] Zod schema validates payload
- [ ] Trust tier appropriate (T1/T2/T3)
- [ ] Test: Tool → Proposal → Executor → State change
- [ ] Tool documented in system prompt
```

**For UI Component Feature:**

```markdown
# UI Component Feature Definition of Done

- [ ] Component renders correctly
- [ ] All interactive elements functional
- [ ] API calls made (not console.log stubs)
- [ ] Error states shown with messages
- [ ] Loading states shown during async
- [ ] All props have types (no `any`)
- [ ] Component tested with Vitest
- [ ] Accessibility checklist passed
- [ ] Responsive design works on mobile
```

#### Strategy 4: Integration Tests for Full Features

```typescript
// server/test/integration/feature-complete.test.ts
describe('Publish Draft Feature - End-to-End', () => {
  it('should complete full workflow: edit → publish', async () => {
    // SETUP
    const { tenantId, apiClient } = await createTestTenantWithClient();

    // STEP 1: Initialize draft
    const draftResponse = await apiClient.getDraft(tenantId);
    expect(draftResponse.pages).toBeDefined();

    // STEP 2: Edit section (agent tool)
    const publishToolResult = await publishDraftTool.execute(
      createMockContext(tenantId),
      { pages: draftResponse.pages }
    );

    expect(publishToolResult.success).toBe(true);
    expect(publishToolResult.trustTier).toBe('T2');

    // STEP 3: Executor is registered
    const executor = getProposalExecutor('publish_draft');
    expect(executor).toBeDefined();

    // STEP 4: Execute proposal
    const result = await executor!(tenantId, publishToolResult.payload);
    expect(result).toBeDefined();

    // STEP 5: Verify state changed (draft published)
    const liveConfig = await apiClient.getLiveConfig(tenantId);
    expect(liveConfig.pages).toEqual(draftResponse.pages);

    // STEP 6: Draft is cleared
    const emptyDraft = await apiClient.getDraft(tenantId);
    expect(emptyDraft.pages).toEqual(DEFAULT_PAGES);
  });

  it('should show user feedback at each step', async () => {
    const { render } = renderWithClient(<PublishDraftUI />);

    // STEP 1: Button enabled
    const publishBtn = screen.getByRole('button', { name: /publish/i });
    expect(publishBtn).not.toBeDisabled();

    // STEP 2: Click shows loading
    await userEvent.click(publishBtn);
    expect(screen.getByText(/publishing/i)).toBeInTheDocument();
    expect(publishBtn).toBeDisabled();

    // STEP 3: Success message appears
    await waitFor(() => {
      expect(screen.getByText(/published successfully/i)).toBeInTheDocument();
    });
  });
});
```

#### Strategy 5: Code Review Checklist for Completeness

**Add to PR review process:**

```markdown
# Feature Completeness Review Checklist

Before approving ANY PR, verify:

## Functional Requirements

- [ ] Read acceptance criteria in PR description
- [ ] Verify EACH criterion is addressed in code
- [ ] No "will do in next PR" items (complete now)
- [ ] Call stack: UI → Hook → Service → API (no gaps)

## Integration Points

- [ ] Database: Queries exist with tenant scoping
- [ ] API: Endpoint returns data (not undefined)
- [ ] Frontend: Data rendered on page
- [ ] Agent Tools: If tool, check REQUIRED_EXECUTOR_TOOLS

## No Stubs

- [ ] No `console.log` instead of API calls
- [ ] No unimplemented functions (// TODO)
- [ ] No commented-out code
- [ ] No hardcoded test data

## Tests Verify Functionality

- [ ] Test: Does the feature actually work?
- [ ] Test: Do error cases work?
- [ ] Test: Does data flow end-to-end?

## If Unsure

- [ ] Build locally and test manually
- [ ] Check dev tools: Network tab shows API calls
- [ ] Database: Verify data was written
```

#### Strategy 6: Pre-Merge Verification Script

**Create `scripts/verify-feature-complete.ts`:**

```typescript
import { spawnSync } from 'child_process';

// Verify feature is complete before merge
async function verifyFeatureComplete() {
  const checks = [
    { name: 'TypeScript strict', cmd: 'npm run typecheck' },
    { name: 'Linting', cmd: 'npm run lint' },
    { name: 'Tests pass', cmd: 'npm test' },
    { name: 'No console.log', cmd: 'grep -r "console.log" src/ && exit 1 || true' },
    { name: 'Build succeeds', cmd: 'npm run build' },
  ];

  let failed = false;
  for (const check of checks) {
    console.log(`Checking: ${check.name}...`);
    const result = spawnSync('sh', ['-c', check.cmd], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    if (result.status !== 0) {
      console.error(`FAIL: ${check.name}`);
      failed = true;
    } else {
      console.log(`PASS: ${check.name}`);
    }
  }

  if (failed) {
    console.error('\n⚠️  Feature completeness checks failed');
    console.error('Fix issues above before merging');
    process.exit(1);
  }

  console.log('\n✅ Feature completeness verified');
  console.log('Ready to merge!');
}

verifyFeatureComplete().catch(console.error);
```

#### Strategy 7: Shipping Checklist

**Before shipping to production:**

```markdown
# Pre-Ship Checklist

- [ ] Feature 100% complete (all acceptance criteria met)
- [ ] All tests passing (npm test)
- [ ] Code review approved
- [ ] If agent feature: Server starts with executor validation passed
- [ ] If API feature: Postman test shows endpoint working
- [ ] If UI feature: Manual QA on staging
- [ ] No console.log warnings
- [ ] No React warnings (unmounted component, missing deps)
- [ ] Bundle size acceptable (< 50KB increase)
- [ ] Database migrations tested
- [ ] Rollback plan documented (if needed)

Sign-off:

- Developer: ******\_\_\_******
- Reviewer: ********\_********
- QA: **********\_\_\_\_**********
```

---

## Quick Reference: All 6 Patterns

### Pattern 1: Console.log Stub

- **Detection:** `grep console.log src/`
- **Fix:** Replace with real API call
- **Prevention:** ESLint rule + pre-commit hook

### Pattern 2: Prop Name Mismatch

- **Detection:** TypeScript with `strict: true`
- **Fix:** Use `Exact<T>` type or exact key const
- **Prevention:** Code review + test prop usage

### Pattern 3: Executor Registry Gap

- **Detection:** Server startup validation
- **Fix:** Add to REQUIRED_EXECUTOR_TOOLS + register executor
- **Prevention:** Startup validation + test full flow

### Pattern 4: Timeout Memory Leak

- **Detection:** React warnings in console
- **Fix:** Track timeout in useRef, cleanup in useEffect
- **Prevention:** ESLint react-hooks + pre-commit hook

### Pattern 5: Dynamic Tailwind Classes

- **Detection:** Styles missing in production build
- **Fix:** Use static classes or safelist dynamic values
- **Prevention:** Test production build + safelist config

### Pattern 6: Incomplete Feature Shipping

- **Detection:** Feature looks done but doesn't work
- **Fix:** Run acceptance criteria checklist
- **Prevention:** Definition of Done + integration tests

---

## Implementation Roadmap

### Week 1: Setup Automated Checks

```bash
# 1. Add ESLint rules
npm install --save-dev eslint-plugin-react-hooks

# 2. Update .eslintrc.js with rules from Strategy 2-4
# 3. Update eslint config in all packages
# 4. Run: npm run lint (should fail initially)
# 5. Fix all issues: npm run lint -- --fix
```

### Week 2: Update Pre-commit Hooks

```bash
# 1. Review scripts in strategies above
# 2. Add to .husky/pre-commit
# 3. Test: npx husky install && npx husky run pre-commit
# 4. Make sure checks are fast (<1 sec)
```

### Week 3: Update Documentation

```bash
# 1. Create FEATURE_CHECKLIST.md in project root
# 2. Update PR template (.github/pull_request_template.md)
# 3. Add to CLAUDE.md: "Six Critical Prevention Strategies" section
# 4. Link from PREVENTION_STRATEGIES_INDEX.md
```

### Week 4: Update Process

```bash
# 1. Train team on new checklists
# 2. Update code review guidelines
# 3. Require completion before merge
# 4. Track metrics: bugs vs new features ratio
```

---

## Related Documentation

- [Build Mode Implementation Prevention](./build-mode-implementation-prevention-MAIS-20260105.md) - Pattern 3 & 6 in detail
- [Chatbot Proposal Execution Flow](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md) - Pattern 3 in detail
- [Memory Leak TODO](../../../todos/625-resolved-p1-memory-leak-timeout.md) - Pattern 4 in detail
- [MAIS Critical Patterns](./mais-critical-patterns.md) - General patterns

---

**Last Updated:** 2026-01-05
**Status:** Ready for implementation
**Maintainer:** Auto-generated from code review findings
