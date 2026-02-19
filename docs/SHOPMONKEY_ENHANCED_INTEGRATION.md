# Enhanced ShopMonkey Integration

This document describes the enhanced ShopMonkey integration features that provide bidirectional synchronization between Spectrum Outfitters Calendar and ShopMonkey.

## New Features

### 1. **Task-ShopMonkey Order Linking**
- When you import a repair order from ShopMonkey to create a task, the system now stores the ShopMonkey order ID with the task
- This creates a permanent link between tasks and ShopMonkey orders
- Tasks can be identified as coming from ShopMonkey and linked back to the original order

### 2. **Automatic Status Synchronization**
- When a task is marked as "completed", the system automatically syncs this status to ShopMonkey
- The repair order is moved to a "completed" or "ready for pickup" workflow status in ShopMonkey
- A note is added to the ShopMonkey order indicating the task was completed
- Sync happens automatically when:
  - Task status is changed to "completed" via the status update endpoint
  - Task is updated via PUT endpoint and status changes to "completed"
  - Task is approved by admin (which marks it as completed)

### 3. **ShopMonkey Order Display in Tasks**
- Tasks linked to ShopMonkey orders now display:
  - ShopMonkey order number (e.g., "RO #12345")
  - A direct link to view the order in ShopMonkey
- This appears in the task detail modal with a purple badge

### 4. **Manual Sync Endpoint**
- New endpoint: `POST /api/shopmonkey/tasks/:taskId/sync`
- Allows manually syncing a completed task to ShopMonkey
- Useful if automatic sync fails or you need to re-sync
- Requires admin authentication

### 5. **Webhook Support**
- New endpoint: `POST /api/shopmonkey/webhook`
- Receives real-time updates from ShopMonkey when orders change
- Currently logs events (can be extended to auto-update tasks)
- Supports events:
  - `order.created` - New order created
  - `order.updated` - Order updated
  - `order.status_changed` - Order status changed

## Database Changes

A migration has been run to add the following columns to the `tasks` table:
- `shopmonkey_order_id` (TEXT) - Stores the ShopMonkey order ID
- `shopmonkey_order_number` (TEXT) - Stores the order number for easier searching

## API Endpoints

### New Endpoints

#### `POST /api/shopmonkey/tasks/:taskId/sync`
Manually sync a completed task to ShopMonkey.

**Request:**
```json
{
  "note": "Optional custom note to add to ShopMonkey order"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task synced to ShopMonkey successfully",
  "syncResult": {
    "success": true,
    "message": "Repair order moved to completed status",
    "workflowStatus": "Ready for Pickup"
  }
}
```

#### `POST /api/shopmonkey/webhook`
Webhook endpoint for receiving ShopMonkey updates.

**Request Body:**
```json
{
  "event": "order.status_changed",
  "data": {
    "id": "order_id",
    "status": "completed"
  }
}
```

### Updated Endpoints

#### `POST /api/tasks`
Now accepts `shopmonkey_order_id` and `shopmonkey_order_number` fields when creating tasks.

**Request Body:**
```json
{
  "title": "Repair Order #12345",
  "description": "2020 Ford F-150",
  "shopmonkey_order_id": "abc123",
  "shopmonkey_order_number": "12345",
  // ... other task fields
}
```

## Usage

### Creating Tasks from ShopMonkey

1. Go to Tasks → Create New Task
2. Click "📋 Import from ShopMonkey"
3. Search and select a repair order
4. Click "Import"
5. The task is created with:
   - All work items as checklist items
   - Vehicle information in description
   - ShopMonkey order ID stored (for future sync)

### Viewing ShopMonkey Link

1. Open any task that was imported from ShopMonkey
2. Look for the purple "ShopMonkey Order" section
3. Click "View in ShopMonkey" to open the order in ShopMonkey

### Automatic Sync

When you complete a task:
1. Mark task as "completed" (via status change or admin approval)
2. System automatically:
   - Finds the linked ShopMonkey order
   - Moves it to a "completed" workflow status
   - Adds a note about the completion
3. No manual action required!

### Manual Sync

If automatic sync fails or you need to re-sync:
1. Ensure the task is marked as "completed"
2. Call the sync endpoint: `POST /api/shopmonkey/tasks/:taskId/sync`
3. Or use the API directly with your admin token

## Configuration

### Setting Up Webhooks (Optional)

To receive real-time updates from ShopMonkey:

1. Get your webhook URL: `https://your-domain.com/api/shopmonkey/webhook`
2. In ShopMonkey, go to Settings → Integrations → Webhooks
3. Add a new webhook with your URL
4. Select events to monitor:
   - Order Created
   - Order Updated
   - Order Status Changed

### Workflow Status Mapping

The system automatically finds a "completed" workflow status in ShopMonkey by searching for statuses with names containing:
- "complete"
- "ready"
- "done"
- "finished"
- "pickup"

If no matching status is found, a note is still added to the order.

## Error Handling

- ShopMonkey sync failures are **non-blocking** - they won't prevent task completion
- Errors are logged to the console for debugging
- You can manually retry sync using the manual sync endpoint
- If API key is not configured, sync attempts are skipped gracefully

## Troubleshooting

### Sync Not Working

1. **Check API Key**: Ensure `SHOPMONKEY_API_KEY` is set in `backend/.env`
2. **Check Task Status**: Task must be "completed" to sync
3. **Check Order ID**: Task must have `shopmonkey_order_id` set
4. **Check Logs**: Look for error messages in backend console
5. **Manual Sync**: Try the manual sync endpoint to test

### Webhook Not Receiving Updates

1. **Check URL**: Ensure webhook URL is publicly accessible
2. **Check ShopMonkey Settings**: Verify webhook is configured in ShopMonkey
3. **Check Logs**: Look for webhook events in backend console
4. **Test Endpoint**: Send a test POST request to `/api/shopmonkey/webhook`

### Order Not Moving to Completed Status

1. **Check Workflow Statuses**: Verify ShopMonkey has a "completed" status
2. **Check API Permissions**: Ensure API key has permission to update orders
3. **Check Logs**: Look for specific error messages
4. **Manual Test**: Try updating an order directly via ShopMonkey API

## Future Enhancements

Potential future improvements:
- Sync task comments to ShopMonkey notes
- Sync time tracking to ShopMonkey labor entries
- Auto-create tasks when new orders arrive (via webhook)
- Two-way sync (ShopMonkey changes update tasks)
- Sync subtask completion to ShopMonkey line items
- Display ShopMonkey order status in task list

## Technical Details

### Sync Function
Located in `backend/utils/shopmonkey.js`:
- `syncTaskCompletionToShopMonkey()` - Main sync function
- `updateRepairOrder()` - Updates order in ShopMonkey
- `updateRepairOrderWorkflowStatus()` - Moves order to different status
- `addRepairOrderNote()` - Adds notes to orders

### Database Schema
```sql
ALTER TABLE tasks ADD COLUMN shopmonkey_order_id TEXT;
ALTER TABLE tasks ADD COLUMN shopmonkey_order_number TEXT;
CREATE INDEX idx_tasks_shopmonkey_order_id ON tasks(shopmonkey_order_id);
```

### Frontend Changes
- `CreateTaskForm.jsx` - Stores ShopMonkey order ID when importing
- `TaskModal.jsx` - Displays ShopMonkey order info and link

## Support

For issues or questions:
1. Check the logs in the backend console
2. Verify API key configuration
3. Test API connection: `GET /api/shopmonkey/test`
4. Review ShopMonkey API documentation: https://shopmonkey.dev/

