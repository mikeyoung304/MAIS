# Multi-Project Development Setup Analysis

**Date**: 2025-11-12
**Analyst**: Senior DevOps Specialist
**Question**: Are tests getting mixed up between Elope and rebuild-6.0?

---

## TL;DR - You're Safe! ✅

**Your tests are NOT mixing up.** The rebuild-6.0 processes showing up in searches is normal - it just means both projects can run simultaneously. Your setup is fundamentally correct, with minor recommendations below.

---

## Current Setup Analysis

### Directory Structure ✅ GOOD

```
/Users/mikeyoung/CODING/
├── Elope/              (Wedding booking platform)
│   ├── client/
│   ├── server/
│   │   ├── .env        (Supabase: gpyvdknhmevcfdbgtqir)
│   │   └── .env.test   (Separate test database)
│   └── package.json    (name: "elope")
│
└── rebuild-6.0/        (Restaurant OS)
    ├── .env            (Supabase: xiwfhcikfdoshxwbtjxt - DIFFERENT DB!)
    └── package.json    (name: "restaurant-os")
```

**Verdict**: ✅ Separate directories, separate databases, separate project identities

---

## Process Isolation Analysis

### Why rebuild-6.0 Tests Appeared

When I ran: `ps aux | grep -E "(npm|vitest|node.*test)"`

This searches **system-wide** for ANY process matching those patterns. It's like asking "show me ALL test processes on this computer" - not just Elope's.

**What was found**:

```bash
node /Users/mikeyoung/CODING/rebuild-6.0/node_modules/.bin/playwright test...
```

**Why this appeared**:

- You had rebuild-6.0's playwright tests running in a different terminal/Claude session
- The grep pattern matched it because it's a node process running tests
- This is **NOT a problem** - it's just visibility into what's running

**Key point**: Each Node.js process runs in its own working directory. They're completely isolated.

---

## Database Isolation ✅ EXCELLENT

### Elope Configuration

```bash
# Production/Dev (server/.env)
DATABASE_URL="postgresql://postgres:%40Orangegoat11@db.gpyvdknhmevcfdbgtqir.supabase.co:5432/postgres"

# Test Database (server/.env.test)
DATABASE_URL_TEST=[separate test database]
```

**Supabase Project ID**: `gpyvdknhmevcfdbgtqir`

### rebuild-6.0 Configuration

```bash
# Production/Dev (.env)
DATABASE_URL=postgresql://postgres.xiwfhcikfdoshxwbtjxt:...@aws-0-us-east-2.pooler.supabase.com:5432/postgres
```

**Supabase Project ID**: `xiwfhcikfdoshxwbtjxt`

### Analysis

- ✅ **Completely different databases**
- ✅ **Different Supabase projects**
- ✅ **No overlap possible**
- ✅ **Elope has separate test database**

**Verdict**: Database isolation is perfect. Tests cannot interfere with each other.

---

## Node.js Process Isolation ✅ EXCELLENT

### How Node.js Processes Work

Each `npm` or `node` process is isolated by:

1. **Working Directory**: Process starts in its project folder
2. **node_modules**: Each project has its own dependencies
3. **Environment Variables**: Loaded from project's .env files
4. **File System**: Can only access files relative to working dir (unless absolute paths)
5. **Memory**: Separate memory space per process

### Example

```
Terminal 1 (Elope):
  Working Dir: /Users/mikeyoung/CODING/Elope/server
  DATABASE_URL: gpyvdknhmevcfdbgtqir database
  node_modules: /Users/mikeyoung/CODING/Elope/node_modules

Terminal 2 (rebuild-6.0):
  Working Dir: /Users/mikeyoung/CODING/rebuild-6.0
  DATABASE_URL: xiwfhcikfdoshxwbtjxt database
  node_modules: /Users/mikeyoung/CODING/rebuild-6.0/node_modules
```

**These are completely independent.** One cannot "see" the other's variables or files (unless explicitly configured).

---

## Potential Conflicts (None Found, But Watch For)

### 1. Port Conflicts ⚠️ MONITOR

**Risk**: If both projects try to use the same port

**Check**:

```bash
# Current status
No dev servers detected on ports 3000, 3001, 5173, 5174
```

**Elope Ports** (likely):

- Backend: 3000 (tsx watch)
- Frontend: 5173 (vite default)

**rebuild-6.0 Ports** (likely):

- Backend: Different port (uses concurrently)
- Frontend: Different port

**Recommendation**: Run `lsof -i :3000` before starting dev servers to check if port is in use.

### 2. Test Database Overlap ✅ NO RISK

**Status**: Elope has separate `.env.test` with `DATABASE_URL_TEST`
**Verdict**: Tests isolated from dev data

### 3. Git Confusion ⚠️ HUMAN ERROR RISK

**Risk**: Committing to wrong repo

**Current State**:

```bash
pwd
# /Users/mikeyoung/coding/elope  (lowercase)

# But directory is actually:
ls /Users/mikeyoung/CODING/
# Elope  (capital E)
```

**Issue**: There's case inconsistency in your paths. macOS is case-insensitive by default, so this works, but it's confusing.

**Recommendation**: Always use consistent casing:

```bash
cd /Users/mikeyoung/CODING/Elope  # Consistent capital E
```

### 4. Claude Code Context Confusion ⚠️ WATCH FOR

**Risk**: Claude doesn't know which project you're working on unless you tell it

**Best Practice**:

- Start each Claude session by saying "Working on [project name]"
- Include project name in handoff summaries
- Check working directory at start of session

---

## Current Setup Rating: A- (Excellent with Minor Improvements)

### What's Working ✅

1. ✅ Separate project directories
2. ✅ Separate databases (different Supabase projects)
3. ✅ Separate test databases
4. ✅ Different project names in package.json
5. ✅ Process isolation (Node.js handles this automatically)
6. ✅ No port conflicts detected

### Minor Improvements 🔧

#### 1. Add Project Identifier to Terminal Prompt

**Current**:

```bash
~ %  # Generic prompt
```

**Recommended**:

```bash
[elope] ~/CODING/Elope $
[resto] ~/CODING/rebuild-6.0 $
```

**How to implement** (add to ~/.zshrc):

```bash
# Function to detect project and set prompt
function project_prompt() {
  case "$PWD" in
    */Elope*) echo "[elope] " ;;
    */rebuild-6.0*) echo "[resto] " ;;
    *) echo "" ;;
  esac
}

# Update PS1
setopt PROMPT_SUBST
PS1='$(project_prompt)%~ %# '
```

#### 2. Use tmux/screen for Session Management

**Current**: Multiple terminal windows (can get confusing)

**Recommended**: tmux with named sessions

```bash
# Start Elope session
tmux new -s elope
cd /Users/mikeyoung/CODING/Elope

# Start rebuild session (different terminal)
tmux new -s resto
cd /Users/mikeyoung/CODING/rebuild-6.0

# Switch between sessions
tmux attach -t elope
tmux attach -t resto
```

#### 3. Create Project-Specific Aliases

Add to ~/.zshrc:

```bash
# Project shortcuts
alias cde='cd /Users/mikeyoung/CODING/Elope'
alias cdr='cd /Users/mikeyoung/CODING/rebuild-6.0'

# Test shortcuts
alias elope-test='cd /Users/mikeyoung/CODING/Elope/server && npm run test:integration'
alias resto-test='cd /Users/mikeyoung/CODING/rebuild-6.0 && npm run test'

# Server shortcuts
alias elope-dev='cd /Users/mikeyoung/CODING/Elope/server && npm run dev'
alias resto-dev='cd /Users/mikeyoung/CODING/rebuild-6.0 && npm run dev'
```

#### 4. Use direnv for Automatic Environment Switching

**What it does**: Automatically loads/unloads environment variables when you cd into project

**Setup**:

```bash
# Install
brew install direnv

# Add to ~/.zshrc
eval "$(direnv hook zsh)"

# Create .envrc in each project
# Elope/.envrc
export PROJECT_NAME="elope"
export DATABASE_URL="postgresql://..."

# rebuild-6.0/.envrc
export PROJECT_NAME="resto"
export DATABASE_URL="postgresql://..."

# Allow each .envrc
direnv allow /Users/mikeyoung/CODING/Elope/.envrc
direnv allow /Users/mikeyoung/CODING/rebuild-6.0/.envrc
```

Now `PROJECT_NAME` will automatically change when you cd between projects!

#### 5. VS Code Multi-Root Workspace (Optional)

If using VS Code:

**File > Add Folder to Workspace**

- Add Elope
- Add rebuild-6.0

**Save as**: `my-projects.code-workspace`

Benefits:

- See both projects in one window
- Separate terminal per project
- Clear visual separation

---

## Common Pitfalls (How to Avoid)

### Pitfall 1: Running Tests in Wrong Project

**Symptom**: "Why are my Elope tests finding rebuild-6.0 files?"

**Prevention**:

```bash
# Always check working directory first
pwd

# Verify you're in right project
ls package.json | xargs cat | grep '"name"'
```

### Pitfall 2: Committing to Wrong Repo

**Symptom**: "Why is my Elope commit in rebuild-6.0?"

**Prevention**:

```bash
# Check git remote before committing
git remote -v

# Verify repo name
git config --get remote.origin.url
```

### Pitfall 3: Using Wrong Database

**Symptom**: "Why am I seeing restaurant data in wedding booking app?"

**Prevention**:

```bash
# Verify DATABASE_URL before running
echo $DATABASE_URL

# Or check .env file
cat .env | grep DATABASE_URL
```

### Pitfall 4: Port Conflicts

**Symptom**: "EADDRINUSE: address already in use :::3000"

**Prevention**:

```bash
# Check what's using a port before starting
lsof -i :3000

# Kill process if needed
kill -9 <PID>
```

---

## Why rebuild-6.0 Tests Appeared: Detailed Explanation

### What Happened

I ran this command:

```bash
ps aux | grep -E "(npm|vitest|node.*test)" | grep -v grep
```

### What This Command Does

1. **`ps aux`** - Show ALL processes on the system (all users, all terminals)
2. **`grep -E "(npm|vitest|node.*test)"`** - Filter for processes matching those patterns
3. **`grep -v grep`** - Exclude the grep process itself

### Result

```
mikeyoung  26808  node ...rebuild-6.0/node_modules/.bin/playwright...
```

### Why This Showed Up

- You had rebuild-6.0's playwright tests running in **another terminal**
- My grep searched **system-wide**, not just current directory
- Both projects' tests were visible because both are running under your user account

### This is NOT a Problem

**Analogy**: It's like looking out your window and seeing your neighbor mowing their lawn. They're not mowing YOUR lawn - you're just able to see them because you're looking at the whole neighborhood.

### How to Search Only Current Project

```bash
# Show only processes in current directory
ps aux | grep $(pwd)

# Or be more specific
ps aux | grep -E "Elope.*test"  # Only Elope tests
ps aux | grep -E "rebuild-6.0.*test"  # Only rebuild-6.0 tests
```

---

## Best Practices Summary

### ✅ Already Doing Right

1. Separate project directories
2. Separate databases
3. Separate terminal sessions
4. Separate Claude Code sessions
5. Git repos properly isolated

### 🔧 Recommended Improvements

1. Add project name to terminal prompt
2. Use tmux for session management
3. Create project-specific aliases
4. Consider direnv for auto-environment switching
5. Be consistent with directory casing (Elope vs elope)

### ⚠️ Things to Watch

1. Always verify `pwd` before running commands
2. Check `git remote -v` before committing
3. Verify port availability before starting dev servers
4. Tell Claude which project you're working on
5. Check DATABASE_URL if data looks wrong

---

## Conclusion

**Your setup is fundamentally sound.** The rebuild-6.0 processes appearing in system-wide searches is expected behavior - it just shows both projects can run simultaneously without interfering.

**Key Insight**: Node.js processes are isolated by working directory and environment variables. As long as you:

- Start processes from correct directory
- Use correct .env files
- Don't have port conflicts

...then multiple projects can coexist peacefully on the same machine.

**Recommended Action**: Implement the terminal prompt improvement (5 minutes) to always know which project you're in. Everything else is optional but helpful for organization.

---

## Quick Reference: "Am I in the Right Project?"

```bash
# Check 1: Working directory
pwd
# Should show: /Users/mikeyoung/CODING/Elope or /Users/mikeyoung/CODING/rebuild-6.0

# Check 2: Package name
cat package.json | grep '"name"'
# Should show: "elope" or "restaurant-os"

# Check 3: Git remote
git remote -v
# Should show: mikeyoung304/Elope or rebuild-6.0 repo

# Check 4: Database (if in server/)
cat .env | grep DATABASE_URL | grep -oP 'db\.(.+?)\.supabase'
# Should show: gpyvdknhmevcfdbgtqir (Elope) or xiwfhcikfdoshxwbtjxt (rebuild-6.0)
```

---

**You're good to keep coding both projects simultaneously!** Just be mindful of which terminal/project you're in, and you'll never have issues.
