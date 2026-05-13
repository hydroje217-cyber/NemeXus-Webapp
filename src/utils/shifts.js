export const SHIFT_RULES = [
  { key: 'A', label: 'Shift A', start: '07:00', end: '15:00' },
  { key: 'B', label: 'Shift B', start: '15:00', end: '23:00' },
  { key: 'C', label: 'Shift C', start: '23:00', end: '07:00' },
];

function minutesFromTime(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

function dateKeyFromLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getShiftRule(shiftKey) {
  return SHIFT_RULES.find((shift) => shift.key === shiftKey) || null;
}

export function detectShiftForTimestamp(value) {
  const date = new Date(value || '');

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  return SHIFT_RULES.find((shift) => {
    const startMinutes = minutesFromTime(shift.start);
    const endMinutes = minutesFromTime(shift.end);

    if (startMinutes === null || endMinutes === null) {
      return false;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }) || null;
}

export function getShiftAssignmentDate(value, shiftKey) {
  const date = new Date(value || '');
  const shift = getShiftRule(shiftKey) || detectShiftForTimestamp(value);

  if (Number.isNaN(date.getTime()) || !shift) {
    return '';
  }

  const startMinutes = minutesFromTime(shift.start);
  const endMinutes = minutesFromTime(shift.end);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const assignmentDate = new Date(date);

  if (startMinutes > endMinutes && currentMinutes < endMinutes) {
    assignmentDate.setDate(assignmentDate.getDate() - 1);
  }

  return dateKeyFromLocalDate(assignmentDate);
}

export function formatShiftWindow(shiftKey) {
  const shift = getShiftRule(shiftKey);
  return shift ? `${shift.start}-${shift.end}` : '';
}

function readingTimestamp(reading) {
  return reading?.slot_datetime || reading?.reading_datetime || reading?.created_at || '';
}

function readingSubmitterId(reading) {
  return (
    reading?.submitted_profile?.id ||
    reading?.submitted_profile_id ||
    reading?.profile_id ||
    reading?.user_id ||
    ''
  );
}

function normalizeId(value) {
  return value === null || value === undefined ? '' : String(value);
}

export function matchReadingToShift(reading, assignments = []) {
  const timestamp = readingTimestamp(reading);
  const shift = detectShiftForTimestamp(timestamp);

  if (!shift) {
    return {
      status: 'outside_shift',
      shift: null,
      assignment: null,
    };
  }

  const assignmentDate = getShiftAssignmentDate(timestamp, shift.key);
  const readingSiteId = normalizeId(reading?.site_id || reading?.sites?.id || reading?.site?.id);
  const submitterId = normalizeId(readingSubmitterId(reading));
  const assignment =
    assignments.find(
      (item) =>
        item.assignment_date === assignmentDate &&
        item.shift_key === shift.key &&
        (!readingSiteId || !item.site_id || normalizeId(item.site_id) === readingSiteId)
    ) || null;

  if (!assignment) {
    return {
      status: 'unassigned',
      shift,
      assignmentDate,
      assignment: null,
    };
  }

  if (!submitterId) {
    return {
      status: 'assigned',
      shift,
      assignmentDate,
      assignment,
    };
  }

  return {
    status: normalizeId(assignment.profile_id) === submitterId ? 'matched' : 'mismatch',
    shift,
    assignmentDate,
    assignment,
  };
}

export function enrichReadingsWithShiftMatches(readings = [], assignments = []) {
  return readings.map((reading) => {
    if (reading?.is_daily_summary) {
      return reading;
    }

    const match = matchReadingToShift(reading, assignments);

    return {
      ...reading,
      shift_match: match,
    };
  });
}
