import { supabase } from '../lib/supabase';
import { enrichReadingsWithShiftMatches } from '../utils/shifts';

const SHIFT_ASSIGNMENT_SELECT =
  'id, assignment_date, shift_key, site_id, profile_id, status, notes, created_at, updated_at, site:sites(id, name, type), profile:profiles(id, email, full_name, role)';

function isMissingShiftTableError(error) {
  return error?.code === '42P01' || /shift_assignments/i.test(error?.message || '');
}

export function normalizeShiftAssignment(row) {
  return {
    ...row,
    site: row.site || null,
    profile: row.profile || null,
  };
}

export async function listSites() {
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, type')
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Failed to load sites.');
  }

  return data ?? [];
}

export async function listShiftAssignments({ fromDate, toDate } = {}) {
  let query = supabase
    .from('shift_assignments')
    .select(SHIFT_ASSIGNMENT_SELECT)
    .order('assignment_date', { ascending: true })
    .order('shift_key', { ascending: true });

  if (fromDate) {
    query = query.gte('assignment_date', fromDate);
  }

  if (toDate) {
    query = query.lte('assignment_date', toDate);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingShiftTableError(error)) {
      return { assignments: [], setupRequired: true };
    }

    throw new Error(error.message || 'Failed to load shift assignments.');
  }

  return {
    assignments: (data ?? []).map(normalizeShiftAssignment),
    setupRequired: false,
  };
}

export async function saveShiftAssignment(assignment) {
  const payload = {
    assignment_date: assignment.assignment_date,
    shift_key: assignment.shift_key,
    site_id: assignment.site_id,
    profile_id: assignment.profile_id,
    status: assignment.status || 'scheduled',
    notes: assignment.notes || null,
  };

  const { data, error } = await supabase
    .from('shift_assignments')
    .upsert(payload, { onConflict: 'assignment_date,site_id,shift_key' })
    .select(SHIFT_ASSIGNMENT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save shift assignment.');
  }

  return normalizeShiftAssignment(data);
}

export async function deleteShiftAssignment(assignmentId) {
  const { error } = await supabase.from('shift_assignments').delete().eq('id', assignmentId);

  if (error) {
    throw new Error(error.message || 'Failed to delete shift assignment.');
  }
}

export async function loadShiftAssignmentsForReadings(readings = []) {
  const dates = readings
    .map((reading) => String(reading?.slot_datetime || reading?.reading_datetime || reading?.created_at || '').slice(0, 10))
    .filter(Boolean)
    .sort();

  if (!dates.length) {
    return [];
  }

  const fromDate = dates[0];
  const toDate = dates[dates.length - 1];
  const { assignments } = await listShiftAssignments({ fromDate, toDate });
  return assignments;
}

export async function enrichReadingsWithShiftAssignments(readings = []) {
  const assignments = await loadShiftAssignmentsForReadings(readings);
  return enrichReadingsWithShiftMatches(readings, assignments);
}
