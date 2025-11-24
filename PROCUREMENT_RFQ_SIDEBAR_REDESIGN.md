# Procurement Dashboard RFQ Tab Redesign

## Overview
Redesigned the RFQ tab in the Procurement Dashboard with a modern sidebar layout, making it easier to navigate and manage RFQs and their quotations.

## Problem Solved
The previous design was confusing with:
- RFQ list and details stacked vertically
- Hard to navigate between different RFQs
- Details section appeared disconnected
- Had to scroll extensively to compare RFQs

## New Design Features

### Sidebar Layout
Implemented a two-column grid layout similar to Finance and Supplier dashboards:
- **Left Sidebar (340px)**: RFQ list
- **Right Panel (flexible)**: Selected RFQ details

### Left Sidebar - RFQ List

#### Header
- Shows total RFQ count and open RFQs count
- Clean, informative summary

#### RFQ Cards
Each RFQ displays:
- **Title**: Bold, prominent
- **Status Badge**: Color-coded (green for open, slate for closed, indigo for awarded)
- **Description**: Truncated to 2 lines with line-clamp
- **Category**: Small badge
- **Deadline**: Date format
- **Budget**: If available (for procurement staff)

#### Interactive Features
- **Hover State**: Border color change, background lightens
- **Selected State**: Primary color border, light primary background
- **Click**: Loads RFQ details in right panel
- **Scrollable**: Max height 720px with overflow

#### Empty State
When no RFQs exist:
- Icon placeholder
- Helpful message
- Call-to-action text

### Right Panel - RFQ Details

#### When No RFQ Selected
- Empty state with icon
- Clear instruction: "Select an RFQ"
- Guidance text

#### RFQ Header Card
- **Large Title**: 20px, bold
- **Status Badge**: Same color coding as sidebar
- **Description**: Full text visible
- **Info Grid**: 4 columns
  - Category
  - Budget (conditional - only if available)
  - Deadline
  - Quotation count

#### Quotations Card
- **Header**: Title with submission count badge
- **Quotation Items**: Each shows:
  - Supplier name (prominent)
  - Quote amount (large, primary color)
  - Notes (if provided, truncated to 2 lines)
  - Submission date
  - Status badge (color-coded)
  - Approve button (if applicable)

#### Empty State for Quotations
- Centered message
- Helpful context text

## Visual Improvements

### Color Coding
- **Open RFQs**: Green (`bg-green-100 text-green-800`)
- **Closed RFQs**: Slate (`bg-slate-200 text-slate-600`)
- **Awarded RFQs**: Indigo (`bg-indigo-100 text-indigo-700`)
- **Approved Quotations**: Green (`bg-green-100 text-green-700`)
- **Rejected Quotations**: Red (`bg-red-100 text-red-700`)
- **Submitted Quotations**: Yellow (`bg-yellow-100 text-yellow-700`)

### Typography
- **Section Headers**: 18px, semibold
- **RFQ Titles**: 14px, semibold (sidebar), 20px bold (detail)
- **Body Text**: 14px regular
- **Helper Text**: 12px, slate-500
- **Labels**: 12px uppercase, slate-400

### Spacing & Layout
- **Card Padding**: 24px (p-6)
- **Grid Gap**: 24px (gap-6)
- **Internal Spacing**: 16px (space-y-4)
- **Border Radius**: 16px (rounded-2xl)
- **Shadows**: Subtle (shadow-sm)

## Responsive Design
- **Large screens (lg+)**: Two-column layout with 340px sidebar
- **Medium screens**: Stacked layout (sidebar on top)
- **Mobile**: Full width, vertical stack

## User Experience Benefits

1. **Better Navigation**: Quick scanning of all RFQs in sidebar
2. **Context Preservation**: Selected RFQ stays visible while browsing list
3. **Faster Comparison**: Can easily switch between RFQs
4. **Clear Hierarchy**: Visual separation between list and details
5. **Status Visibility**: Color-coded badges at a glance
6. **Reduced Scrolling**: Side-by-side layout minimizes vertical scroll
7. **Professional Look**: Modern card-based design with consistent styling

## Technical Details

### State Management
- Uses existing `selectedRfqId` for tracking selection
- Uses existing `loadRfqDetails()` function for loading
- No new state variables needed

### Grid Layout
```tsx
<section className="mt-10 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
```

### Conditional Budget Display
Budget only shows when `rfq.budget !== undefined` (respects supplier privacy)

### Quotation Approval
- Approve button only shows for procurement staff (`canApprove`)
- Only visible for non-approved quotations
- Click stops propagation to prevent opening details modal

## Files Modified
- `frontend/src/pages/StaffDashboard.tsx`

## Compatibility
- Works with existing RFQ data structure
- Compatible with existing quotation approval flow
- Maintains all existing functionality
- No breaking changes

## Future Enhancements
Potential improvements:
- Filter/search RFQs in sidebar
- Sort options (by date, status, budget)
- Quick actions in RFQ cards (edit, close, award)
- Quotation comparison view
- Export quotations to Excel
- Bulk actions on multiple RFQs
