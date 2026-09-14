/**
 * Public customer-status page labels / progress steps.
 * Distinct from backend customer-status generate/public payload (#102)
 * and dispatch board status/progress (#74): these are the customer-facing
 * labels (todo → Received, review → Ready for Pickup).
 */

export const CUSTOMER_STATUS_CONFIG = {
  todo:        { label: 'Received',          color: 'bg-blue-100 text-blue-800 border-blue-300',   icon: '🔵' },
  in_progress: { label: 'In Progress',       color: 'bg-amber-100 text-amber-800 border-amber-300', icon: '🔧' },
  review:      { label: 'Ready for Pickup',  color: 'bg-green-100 text-green-800 border-green-300', icon: '✅' },
  completed:   { label: 'Completed',         color: 'bg-gray-100 text-gray-700 border-gray-300',    icon: '🏁' },
};

export const CUSTOMER_STATUS_STEPS = ['todo', 'in_progress', 'review', 'completed'];

export function getCustomerStatusDisplay(status) {
  return CUSTOMER_STATUS_CONFIG[status] || CUSTOMER_STATUS_CONFIG.todo;
}

export function getCustomerStatusStepIndex(status) {
  return CUSTOMER_STATUS_STEPS.indexOf(status);
}
