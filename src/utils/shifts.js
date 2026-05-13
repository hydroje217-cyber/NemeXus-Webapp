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

function normalizeId(value) {
  return value === null || value === undefined ? '' : String(value);
}

function readingSiteKey(reading) {
  return normalizeId(
    reading?.site_id ||
      reading?.sites?.id ||
      reading?.site?.id ||
      `${reading?.site_type || ''}:${reading?.site?.name || reading?.sites?.name || 'main'}`
  );
}

function readingOperator(reading) {
  const profile = reading?.submitted_profile;

  if (!profile?.id && !profile?.full_name && !profile?.email) {
    return null;
  }

  return {
    id: profile.id || '',
    name: profile.full_name || profile.email || 'Operator',
    email: profile.email || '',
  };
}

function readingTimeMs(reading) {
  const parsed = new Date(readingTimestamp(reading));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function shiftOwnershipKey({ assignmentDate, shiftKey, siteKey }) {
  return `${assignmentDate}:${shiftKey}:${siteKey || 'site'}`;
}

export function getReadingShiftInfo(reading) {
  const timestamp = readingTimestamp(reading);
  const shift = detectShiftForTimestamp(timestamp);

  if (!shift) {
    return {
      status: 'outside_shift',
      shift: null,
      operator: null,
    };
  }

  const assignmentDate = getShiftAssignmentDate(timestamp, shift.key);

  return {
    status: 'detected',
    shift,
    assignmentDate,
    siteKey: readingSiteKey(reading),
    operator: null,
  };
}

export function inferShiftOwnership(readings = []) {
  const ownersByShift = new Map();

  readings.forEach((reading) => {
    const operator = readingOperator(reading);

    if (!operator) {
      return;
    }

    const shiftInfo = getReadingShiftInfo(reading);

    if (!shiftInfo.shift) {
      return;
    }

    const key = shiftOwnershipKey({
      assignmentDate: shiftInfo.assignmentDate,
      shiftKey: shiftInfo.shift.key,
      siteKey: shiftInfo.siteKey,
    });
    const currentOwner = ownersByShift.get(key);

    if (!currentOwner || readingTimeMs(reading) < currentOwner.firstReadingAt) {
      ownersByShift.set(key, {
        ...shiftInfo,
        operator,
        firstReadingAt: readingTimeMs(reading),
      });
    }
  });

  return ownersByShift;
}

export function enrichReadingsWithInferredShiftOwnership(readings = []) {
  const ownersByShift = inferShiftOwnership(readings);

  return readings.map((reading) => {
    const shiftInfo = getReadingShiftInfo(reading);

    if (!shiftInfo.shift) {
      return {
        ...reading,
        shift_match: shiftInfo,
      };
    }

    const owner = ownersByShift.get(
      shiftOwnershipKey({
        assignmentDate: shiftInfo.assignmentDate,
        shiftKey: shiftInfo.shift.key,
        siteKey: shiftInfo.siteKey,
      })
    );

    const submitter = readingOperator(reading);
    return {
      ...reading,
      shift_match: {
        ...shiftInfo,
        status: owner ? (submitter?.id && owner.operator.id === submitter.id ? 'owner' : 'covered') : 'pending_first_reading',
        operator: owner?.operator || null,
        firstReadingAt: owner?.firstReadingAt || null,
      },
    };
  });
}
