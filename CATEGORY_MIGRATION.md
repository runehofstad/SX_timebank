# Work Category Migration Guide

## Overview
This document describes the changes made to the work categories in the timebank system and provides instructions for migrating existing data.

## Category Changes

### Old Categories → New Categories
- `backend_development` → `backend`
- `frontend_development` → `frontend`
- `ios_development` → `ios_native`
- `android_development` → `android_native`
- `flutter_development` → `flutter`
- `react_native_development` → `react_native`
- `testing` → `qa`

### New Categories Added
- `ai_development` - Building AI models and systems
- `ai` - AI integration and implementation
- `devops` - Infrastructure, CI/CD, deployment
- `workshop` - Training sessions, workshops

### Unchanged Categories
- `project_management`
- `ui_ux_design`
- `meeting`
- `video_production`
- `other`

## Migration Instructions

### Automatic Migration (Recommended)
1. Ensure you have the Firebase Admin credentials set up
2. Run the migration script:
   ```bash
   npx tsx scripts/migrate-categories.ts
   ```

### Manual Migration
If you prefer to update categories manually:
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find the `timeEntries` collection
4. Update each entry's `category` field according to the mapping above

## Code Changes
The following files have been updated:
- `/types/index.ts` - Updated `WorkCategory` type definition
- `/utils/timebank.ts` - Updated `workCategories` array
- `/app/projects/[id]/page.tsx` - Updated category descriptions

## Important Notes
- The migration is backward compatible - old category values will be automatically mapped to new ones
- New time entries will use the new category values
- The UI will display the new category labels