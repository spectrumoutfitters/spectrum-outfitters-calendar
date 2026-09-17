/** Client gate for POST /notifications/quick type=need_assistance. */

export function canSendNeedAssistance(urgency) {
  return Boolean(urgency);
}

export function needAssistanceError(urgency) {
  if (!urgency) return 'Please select an urgency level';
  return null;
}

export function buildNeedAssistancePayload(urgency) {
  return {
    type: 'need_assistance',
    urgency,
  };
}

/** Alert copy: only exact `immediate` is urgent; any other truthy value is convenience. */
export function formatNeedAssistanceUrgency(urgency) {
  return urgency === 'immediate' ? 'Immediate' : 'At First Convenience';
}
