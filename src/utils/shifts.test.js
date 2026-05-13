import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectShiftForTimestamp,
  enrichReadingsWithInferredShiftOwnership,
  getShiftAssignmentDate,
  inferShiftOwnership,
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

  it('uses the first submitted reading as the inferred shift operator', () => {
    const readings = [
      {
        site_id: 'site-1',
        slot_datetime: '2026-05-13T07:30:00',
        submitted_profile: { id: 'maria', full_name: 'Maria' },
      },
      {
        site_id: 'site-1',
        slot_datetime: '2026-05-13T07:00:00',
        submitted_profile: { id: 'john', full_name: 'John' },
      },
    ];
    const ownership = inferShiftOwnership(readings);
    const owner = Array.from(ownership.values())[0];

    assert.equal(owner.operator.name, 'John');
  });

  it('adds inferred shift owner labels to readings', () => {
    const [reading] = enrichReadingsWithInferredShiftOwnership([
      {
        site_id: 'site-1',
        slot_datetime: '2026-05-13T07:00:00',
        submitted_profile: { id: 'john', full_name: 'John' },
      },
    ]);

    assert.equal(reading.shift_match.shift.key, 'A');
    assert.equal(reading.shift_match.status, 'owner');
    assert.equal(reading.shift_match.operator.name, 'John');
  });
});
