import api from './api';

/**
 * GET /api/student/fees — the student's own complete fee picture, sourced
 * from the exact same record AO Office edits (item 7/8): any change AO
 * makes shows up here on next load, with no separate student-side copy.
 * Response: { fees: { fee_items: [{ id, fee_type, total_amount,
 *   paid_amount, pending_amount, status }], total_amount, paid_amount,
 *   pending_amount, status }, academic }
 */
export function fetchMyFees() {
  return api.get('/student/fees').then((res) => res.data);
}
