# Fix Vite Firebase Deployment - Task List

## Steps

✅ Step 1: Fix `src/firebase-init.js` - Removed mock firebaseServices, now properly sets up Firebase via Vite
✅ Step 2: Update `personal-documents.html` - Replaced assets/js scripts with /src/main.js
✅ Step 3: Update `online-certificates.html` - Same
✅ Step 4: Update `offline-certificates.html` - Same
✅ Step 5: Update `academic-certificates.html` - Same
✅ Step 6: Update `view-document.html` - Same
✅ Step 7: Update `profile.html` - Same
✅ Step 8: Update `teacher-profile.html` - Same
✅ Step 9: Update `add-student.html` - Same
✅ Step 10: Update `search-student.html` - Same
✅ Step 11: Run `npm run build` - ✅ SUCCESS (0 errors)
✅ Step 12: Verify dist/ output - All 15 HTML pages + firebase chunk (564KB) + per-page JS chunks generated
