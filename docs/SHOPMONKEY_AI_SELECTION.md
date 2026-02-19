# ShopMonkey AI-Powered Item Selection

## Overview

When importing from ShopMonkey, the system now uses AI to parse and enhance work items, then shows a selection modal where you can choose which items to add to your task list.

## Features

### ✨ AI-Enhanced Parsing
- Uses AI to extract and understand work items from ShopMonkey orders
- Provides better descriptions and categorization
- Merges AI-extracted items with ShopMonkey API data

### 🎯 Selection Modal
- View all work items before importing
- Select/deselect individual items
- "Select All" / "Deselect All" option
- See which items are AI-enhanced (marked with "AI" badge)
- View vehicle information (year, make, model, VIN, mileage, customer)

### 📋 Smart Import
- Only selected items are added to your task
- Vehicle info automatically fills in task description
- ShopMonkey order number and ID are saved for tracking

## How It Works

### 1. Import from ShopMonkey
1. Click "Import from ShopMonkey" in the task creation form
2. Search and select a repair order
3. System parses the order using AI + ShopMonkey API

### 2. Selection Modal
1. Modal shows all extracted work items
2. Items are pre-selected by default
3. Check/uncheck items you want to import
4. See vehicle information at the top
5. AI-enhanced items are marked with a badge

### 3. Confirm Import
1. Click "Import X Items" button
2. Selected items are added as subtasks
3. Vehicle info fills in task description
4. ShopMonkey order info is saved

## UI Components

### Selection Modal Features
- **Header**: Shows vehicle info and order number
- **Vehicle Info Bar**: Year, Make, Model, VIN, Mileage, Customer
- **Selection Controls**: Select All checkbox and count
- **Items List**: Checkboxes for each work item
- **AI Badge**: Shows which items were AI-enhanced
- **Footer**: Cancel and Import buttons

## Technical Details

### Backend Changes
**File:** `backend/routes/shopmonkey.js`

- Enhanced `/api/shopmonkey/orders/:id/parse` endpoint
- Uses `extractWorkItemsWithAI()` for AI parsing
- Merges AI items with ShopMonkey API items
- Adds `selected` and `source` flags to each item

### Frontend Changes
**Files:**
- `frontend/src/components/Tasks/CreateTaskForm.jsx` - Updated import handler
- `frontend/src/components/Tasks/ShopMonkeyItemSelector.jsx` - New selection modal

### Data Structure
```javascript
{
  workItems: [
    {
      title: "Item name",
      order: 1,
      selected: true,  // Default selected
      source: "ai" | "shopmonkey"  // Source of extraction
    }
  ],
  vehicleInfo: {
    year: "2020",
    make: "Ford",
    model: "F-150",
    vin: "...",
    mileage: "...",
    customerName: "..."
  },
  order: {
    id: "...",
    number: "1058",
    status: "..."
  }
}
```

## Benefits

1. **Better Accuracy**: AI understands context better than regex
2. **User Control**: Choose exactly what to import
3. **Time Saving**: Pre-selected items, quick selection
4. **Transparency**: See which items are AI-enhanced
5. **Flexibility**: Import only what you need

## AI Fallback

If AI is unavailable:
- Falls back to ShopMonkey API extraction only
- Selection modal still works
- All items marked as "shopmonkey" source

## Future Enhancements

- Group items by category (Parts, Labor, Services)
- Search/filter items in modal
- Bulk selection by category
- Save selection preferences

