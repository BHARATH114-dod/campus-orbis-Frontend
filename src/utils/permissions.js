/**
 * Mirrors server.js's canManageContent(user, row): the author can always
 * manage their own post; a College Admin can manage anything in their
 * college; an HOD can manage anything targeted at their own department.
 * Used for both Events and Notes — neither comes back from the API with a
 * `can_manage` flag the way Clubs do, so this is computed client-side.
 */
export function canManageContent(user, row) {
  if (!user || !row) return false;
  if (row.author_username === user.username) return true;
  if (user.role === 'college_admin') return true;
  if (user.role === 'hod' && row.target_department === user.department) return true;
  return false;
}

// Kept as an alias for Module 3 call sites — same function, clearer name now that it's shared.
export const canManageEvent = canManageContent;
