# Comprehensive Plan - Student Digital Locker

## Information Gathered

### Project Architecture
- **Vite + Firebase** project with dual codebase structure
- Two nearly-identical implementations exist:
  1. **Module-based** (`src/` directory): Modern ES modules with `import/export`
  2. **Legacy IIFE-based** (`assets/js/` directory): Old non-module scripts using `(function(){...})()` and `window.*` globals

### Key Finding: Duplicate Code Problem
Both `src/` and `assets/js/` directories contain implementations of the same features:
| Feature | `src/` version | `assets/js/` version |
|---------|---------------|----------------------|
| App utilities | `src/app.js` | `assets/js/app.js` (IIFE) |
| Dashboard | `src/dashboard.js` | `assets/js/dashboard.js` (IIFE) |
| Login | `src/login.js` | `assets/js/login.js` (IIFE) |
| Layout | `src/layout.js` | `assets/js/layout.js` (IIFE) |
| Firebase init | `src/firebase-init.js` | `assets/js/firebase-init.js` (wrapper) |
| Firebase services | `src/firebase/services/*` | `assets/js/firebase-services.js` (massive file) |

### Root Cause of Login/Dashboard Mixing (TASK 1)
`src/main.js`:
- Imports `src/app.js`, `src/firebase-init.js`, `src/login.js`, `src/validation.js`, `src/layout.js`, `src/dashboard.js`
- **Calls `refreshDashboard()` globally** - runs on ALL pages including login pages
- **Attaches login/register event handlers** globally via `window.handleLogin` and `window.handleRegister`
- The `assets/js/app.js` (loaded as non-module from `index.html`) also defines `window.authService`, `window.userService`, etc.
- When `src/main.js` runs, `import * as authService from './services/authService.js'` then overwrites `window.authService` with the module version

The `assets/js/app.js` is an IIFE that defines `window.authService`, `window.userService`, etc. and also has the login/register form handlers. But the HTML no longer loads it directly (they only load `/src/main.js` as module). However, `assets/js/app.js` could be dead code now since all HTML files were migrated to load `/src/main.js`.

Wait - checking `assets/js/firebase-init.js` - this file imports from `../../src/firebase/index.js` which means it IS a module. But `assets/js/firebase-init.js` is imported by `assets/js/firebase-services.js` which is also a module. So these are module files but in the `assets/js/` directory.

Looking at `assets/js/firebase-services.js`:
- It's a massive (1000+ lines) self-contained Firebase service module
- It sets `window.firebaseServices` and dispatches 'firebase-ready'
- This is the MAIN runtime Firebase service layer that all pages use
- It's NOT imported in `src/main.js` - so how does it get loaded?

Actually wait - the HTML files don't reference `assets/js/firebase-services.js` at all anymore, only `/src/main.js`. So how does `window.firebaseServices` get populated? 

Looking at `assets/js/firebase-init.js` - it doesn't set `window.firebaseServices`, only `window.firebaseAuth`, `window.firebaseDb`. The `assets/js/firebase-services.js` sets `window.firebaseServices`. But if it's not loaded, then `hasLiveFirebase()` returns false and the app uses LOCAL storage fallbacks.

So the application is currently running in "offline/local" mode without Firebase services actually being loaded! This means auth, document storage, etc. all use local storage fallbacks.

### Issue: `src/main.js` runs globally on all pages
Calling `refreshDashboard()` from `src/main.js` means dashboard code runs on login pages:
- `src/dashboard.js` tries to query DOM elements that don't exist on login pages
- The login handlers in `src/main.js` add event listeners to forms that may not exist

### Missing Upload Documents Link
`src/services/documentService.js` has `uploadDocument` and `getStats` functions.

---

## Plan

### Step 1: Fix `src/main.js` - Separate Login from Dashboard
- Remove global `refreshDashboard()` call from `src/main.js`
- Remove global `handleLogin`, `handleRegister` assignment (these are page-specific)
- Make it page-aware: only run dashboard code on dashboard pages, login code on login pages

### Step 2: Remove "Upload File" button from Student Dashboard
- Edit `student-dashboard.html` - remove the "Upload Document" button/link from welcome-actions

### Step 3: UI Improvements
- Update CSS files with better responsive design, spacing, animations
- Fix layout alignment issues
- Improve color scheme consistency

### Step 4: Fix Department/Year Based Access
- Already well-implemented in `assets/js/firebase-services.js` and `src/services/studentService.js`
- Ensure `search-student.html` properly enforces teacher scope
- Add proper error handling

### Step 5: Code Cleanup & Debugging
- Remove dead code in `assets/js/` (app.js, dashboard.js, login.js, layout.js) since they're not loaded from HTML anymore
- Fix import paths
- Fix broken references
- Remove duplicate constants definitions

### Step 6: Build & Verify
- Run `npm install && npm run build`
- Fix any build errors
- Verify no console errors

---

## Files to be Edited

1. `src/main.js` - Remove global dashboard call, make page-aware
2. `student-dashboard.html` - Remove Upload Document button
3. `assets/css/style.css` - UI improvements
4. `assets/css/login.css` - UI improvements
5. `assets/css/dashboard.css` - UI improvements
6. `assets/css/responsive.css` - UI improvements
7. `assets/css/theme.css` - UI improvements
8. `index.html` - Clean up login/dashboard mix
9. `src/page-specific/teacher-dashboard.js` - Minor fixes
10. `search-student.html` - Ensure teacher department/year enforcement

## Followup Steps
- Run `npm install && npm run build`
- Fix any build errors
- Final validation

