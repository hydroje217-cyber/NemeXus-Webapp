import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDailyProductionYears,
  buildMonthlyChemicalUsageYears,
  buildMonthlyPowerConsumptionYears,
  buildMonthlyProductionYears,
} from './production.js';

function reading(date, values = {}) {
  return {
    slot_datetime: `${date}T08:00:00.000Z`,
    site_id: 'site-a',
    ...values,
  };
}

describe('yearly production analytics', () => {
  it('stops monthly production at the latest reading month for the selected year', () => {
    const years = buildMonthlyProductionYears(
      [
        reading('', { totalizer: 999 }),
        reading('2026-01-01', { totalizer: 100 }),
        reading('2026-01-02', { totalizer: 125 }),
        reading('2026-05-01', { totalizer: 200 }),
        reading('2026-05-02', { totalizer: 260 }),
      ],
      { now: new Date(2026, 4, 13) }
    );

    const year2026 = years.find((yearData) => yearData.year === 2026);

    assert.equal(years.some((yearData) => yearData.year === 0), false);
    assert.deepEqual(year2026.rows.map((row) => row.key), ['2026-05', '2026-04', '2026-03', '2026-02', '2026-01']);
    assert.equal(year2026.rows.some((row) => row.key === '2026-06'), false);
  });

  it('stops daily production month choices at the latest reading month', () => {
    const years = buildDailyProductionYears(
      [
        reading('2026-01-01', { totalizer: 100 }),
        reading('2026-01-02', { totalizer: 125 }),
        reading('2026-05-01', { totalizer: 200 }),
        reading('2026-05-02', { totalizer: 260 }),
      ],
      { now: new Date(2026, 4, 13) }
    );

    const year2026 = years.find((yearData) => yearData.year === 2026);

    assert.deepEqual(year2026.months.map((month) => month.key), [
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
    ]);
  });

  it('stops monthly power consumption at the latest chlorination or deepwell reading month', () => {
    const years = buildMonthlyPowerConsumptionYears(
      {
        chlorinationReadings: [reading('2026-03-10', { chlorination_power_kwh: 12 })],
        deepwellReadings: [reading('2026-05-04', { power_kwh_shift: 20 })],
      },
      { now: new Date(2026, 4, 13) }
    );

    const year2026 = years.find((yearData) => yearData.year === 2026);

    assert.deepEqual(year2026.rows.map((row) => row.key), ['2026-05', '2026-04', '2026-03', '2026-02', '2026-01']);
    assert.equal(year2026.totalPower, 32);
  });

  it('stops monthly chemical usage at the latest chlorination reading month', () => {
    const years = buildMonthlyChemicalUsageYears(
      [
        reading('2026-02-03', { chlorine_consumed: 5, peroxide_consumption: 2 }),
        reading('2026-05-04', { chlorine_consumed: 7, peroxide_consumption: 3 }),
      ],
      { now: new Date(2026, 4, 13) }
    );

    const year2026 = years.find((yearData) => yearData.year === 2026);

    assert.deepEqual(year2026.rows.map((row) => row.key), ['2026-05', '2026-04', '2026-03', '2026-02', '2026-01']);
    assert.equal(year2026.rows.some((row) => row.key === '2026-06'), false);
    assert.equal(year2026.totalChlorine, 12);
    assert.equal(year2026.totalPeroxide, 5);
  });
});
