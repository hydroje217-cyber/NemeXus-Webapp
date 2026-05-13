import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectShiftForTimestamp,
  getShiftAssignmentDate,
  matchReadingToShift,
} from './shifts.js';

describe('shift detection', () => {
  it('detects shift windows from reading time', () => {
    assert.equal(detectShiftForTimestamp('2026-05-13T07:00:00')?.key, 'A');
    assert.equal(detectShiftForTimestamp('2026-05-13T14:59:00')?.key, 'A');
    assert.equal(detectShiftForTimestamp('2026-05-13T15:00:00')?.key, 'B');
    assert.equal(detectShiftForTimestamp('2026-05-13T23:30:00')?.key, 'C');
    assert.equal(detectShiftForTimestamp('2026-05-14T06:59:00')?.key, 'C');
  });

  it('assigns after-midnight Shift C readings to the previous assignment date', () => {
    assert.equal(getShiftAssignmentDate('2026-05-14T02:00:00', 'C'), '2026-05-13');
    assert.equal(getShiftAssignmentDate('2026-05-13T23:30:00', 'C'), '2026-05-13');
  });

  it('marks submitted readings as matched or mismatched against assignments', () => {
    const assignment = {
      assignment_date: '2026-05-13',
      shift_key: 'A',
      site_id: 'site-1',
      profile_id: 'john',
    };

    assert.equal(
      matchReadingToShift(
        {
          site_id: 'site-1',
          slot_datetime: '2026-05-13T07:00:00',
          submitted_profile: { id: 'john' },
        },
        [assignment]
      ).status,
      'matched'
    );

    assert.equal(
      matchReadingToShift(
        {
          site_id: 'site-1',
          slot_datetime: '2026-05-13T07:00:00',
          submitted_profile: { id: 'maria' },
        },
        [assignment]
      ).status,
      'mismatch'
    );
  });
});
