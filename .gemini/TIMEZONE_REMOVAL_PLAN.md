# Timezone Removal Plan

## Objective
Remove all timestamp displays and timezone complexity from the application, keeping only date displays.

## Current State
- Timezone utilities exist in `frontend/src/utils/timezone.ts` and `frontend/src/hooks/useTimezone.ts`
- Multiple components use `useTimezone` hook for date/time formatting
- Backend sends datetime strings, frontend converts them

## Proposed Changes

### Phase 1: Frontend Date Display (SAFE - No Breaking Changes)
Replace all `formatDisplay()` calls with simple `toLocaleDateString()`:
- `StaffDashboard.tsx` - RFQ deadlines, request dates
- `RequesterDashboard.tsx` - Request dates  
- `SupplierDashboard.tsx` - RFQ deadlines
- `HODDashboard.tsx` - Request dates
- `RFQTable.tsx` - Deadline column

### Phase 2: Remove Timezone Conversion for Date Inputs (CAREFUL)
The current issue: `toUtc()` appends `:00` which causes `T17:00:00:00`

**Solution**: Don't use `toUtc()` - send date strings directly to backend
- When user selects date `2025-11-29`, append `T17:00:00` and send as-is
- Backend already handles this correctly

### Phase 3: Clean Up (LAST)
After confirming everything works:
- Remove `useTimezone` imports
- Keep timezone files (don't delete) for potential future use

## Risk Assessment
- **LOW RISK**: Changing display from `toLocaleString()` to `toLocaleDateString()`
- **MEDIUM RISK**: Removing `toUtc()` calls (need to test thoroughly)
- **HIGH RISK**: Deleting timezone files (could break something unexpected)

## Recommendation
1. Start with Phase 1 only (display changes)
2. Test thoroughly
3. Then proceed to Phase 2 if needed
4. Skip Phase 3 (keep files, just don't use them)
