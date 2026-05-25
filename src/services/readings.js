import { supabase } from '../lib/supabase';
import { enrichReadingsWithInferredShiftOwnership } from '../utils/shifts';

const DAILY_SUMMARY_SELECT =
  'id, site_id, summary_date, source, source_file, production_m3, power_kwh, chlorine_kg, avg_flowrate_m3hr, avg_pressure_psi, avg_rc_ppm, avg_turbidity_ntu, avg_ph, avg_tds_ppm, peroxide_liters, operating_hours, scheduled_downtime_hours, unscheduled_downtime_hours, avg_upstream_pressure_psi, avg_downstream_pressure_psi, avg_vfd_frequency_hz, avg_voltage_l1_v, avg_voltage_l2_v, avg_voltage_l3_v, avg_amperage_a, created_at, updated_at, sites!inner(id, name, type)';
const CHLORINATION_READING_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, totalizer, chlorination_power_kwh, chlorine_consumed, peroxide_consumption, sites(id, name, type), submitted_profile:profiles(id, email, full_name)';
const DEEPWELL_READING_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, sites(id, name, type), submitted_profile:profiles(id, email, full_name)';
const CHLORINATION_READING_FALLBACK_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, totalizer, chlorination_power_kwh, chlorine_consumed, peroxide_consumption, sites(id, name, type)';
const DEEPWELL_READING_FALLBACK_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, sites(id, name, type)';

function summaryDateToIso(summaryDate) {
  return summaryDate ? `${summaryDate}T00:00:00.000Z` : null;
}

function normalizeReading(row, siteType) {
  return {
    ...row,
    site_type: siteType,
  };
}

function normalizeDailySummary(row, siteType) {
  const readingDate = summaryDateToIso(row.summary_date) || row.created_at;

  return normalizeReading(
    {
      ...row,
      is_daily_summary: true,
      reading_datetime: readingDate,
      slot_datetime: readingDate,
      remarks: row.source_file || row.source || '',
      status: row.source || 'daily summary',
      totalizer: row.production_m3,
      pressure_psi: row.avg_pressure_psi,
      rc_ppm: row.avg_rc_ppm,
      turbidity_ntu: row.avg_turbidity_ntu,
      ph: row.avg_ph,
      tds_ppm: row.avg_tds_ppm,
      flowrate_m3hr: row.avg_flowrate_m3hr,
      chlorine_consumed: row.chlorine_kg,
      peroxide_consumption: row.peroxide_liters,
      chlorination_power_kwh: row.power_kwh,
      upstream_pressure_psi: row.avg_upstream_pressure_psi,
      downstream_pressure_psi: row.avg_downstream_pressure_psi,
      vfd_frequency_hz: row.avg_vfd_frequency_hz,
      voltage_l1_v: row.avg_voltage_l1_v,
      voltage_l2_v: row.avg_voltage_l2_v,
      voltage_l3_v: row.avg_voltage_l3_v,
      amperage_a: row.avg_amperage_a,
      power_kwh_shift: row.power_kwh,
      submitted_profile: null,
    },
    siteType
  );
}

function normalizeRawReading(row, siteType) {
  const site = row.sites || row.site || null;

  return normalizeReading(
    {
      ...row,
      sites: site,
      status: row.status || 'submitted',
      submitted_profile: row.submitted_profile || null,
    },
    siteType
  );
}

function getReadingDateKey(row) {
  return String(row?.slot_datetime || row?.reading_datetime || row?.created_at || '').slice(0, 10);
}

function getSourcePriority(row) {
  return row?.is_daily_summary ? 1 : 0;
}

function sortByReadingDateDesc(first, second) {
  return (
    String(second.slot_datetime || second.reading_datetime || second.created_at || '').localeCompare(
      String(first.slot_datetime || first.reading_datetime || first.created_at || '')
    ) || getSourcePriority(second) - getSourcePriority(first)
  );
}

function applyReadingFilters(query, { fromDate, toDate, limit }) {
  let nextQuery = query.order('summary_date', { ascending: false });

  if (typeof limit === 'number' && Number.isFinite(limit)) {
    nextQuery = nextQuery.limit(limit);
  }

  if (fromDate) {
    nextQuery = nextQuery.gte('summary_date', fromDate);
  }

  if (toDate) {
    nextQuery = nextQuery.lte('summary_date', toDate);
  }

  return nextQuery;
}

function applyRawReadingFilters(query, { fromDate, toDate, limit }) {
  let nextQuery = query.order('slot_datetime', { ascending: false });

  if (typeof limit === 'number' && Number.isFinite(limit)) {
    nextQuery = nextQuery.limit(limit);
  }

  if (fromDate) {
    nextQuery = nextQuery.gte('slot_datetime', `${fromDate}T00:00:00.000Z`);
  }

  if (toDate) {
    const nextDay = new Date(`${toDate}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextQuery = nextQuery.lt('slot_datetime', nextDay.toISOString());
  }

  return nextQuery;
}

async function queryRawReadings({ table, select, fallbackSelect, siteType, fromDate, toDate, limit }) {
  const query = (selectClause) =>
    applyRawReadingFilters(supabase.from(table).select(selectClause), {
      fromDate,
      toDate,
      limit,
    });
  let result = await query(select);

  if (result.error && fallbackSelect) {
    result = await query(fallbackSelect);
  }

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map((row) => normalizeRawReading(row, siteType));
}

function mergeSummaryAndRawReadings(summaryRows, rawRows, limit) {
  const summaryKeys = new Set(
    summaryRows.map((row) => `${row.site_id || row.sites?.id || ''}:${getReadingDateKey(row)}`).filter((key) => !key.endsWith(':'))
  );
  const rawRowsWithoutSummaryDays = rawRows.filter((row) => {
    const key = `${row.site_id || row.sites?.id || ''}:${getReadingDateKey(row)}`;
    return !summaryKeys.has(key);
  });
  const mergedReadings = [...summaryRows, ...rawRowsWithoutSummaryDays].sort(sortByReadingDateDesc);

  return typeof limit === 'number' && Number.isFinite(limit) ? mergedReadings.slice(0, limit) : mergedReadings;
}

export async function listReadings({ siteType, fromDate, toDate, limit }) {
  if (!siteType || siteType === 'all') {
    const [chlorinationReadings, deepwellReadings] = await Promise.all([
      listReadings({ siteType: 'CHLORINATION', fromDate, toDate, limit }),
      listReadings({ siteType: 'DEEPWELL', fromDate, toDate, limit }),
    ]);

    const mergedReadings = [...chlorinationReadings, ...deepwellReadings].sort(sortByReadingDateDesc);

    return typeof limit === 'number' && Number.isFinite(limit) ? mergedReadings.slice(0, limit) : mergedReadings;
  }

  if (siteType === 'CHLORINATION' || siteType === 'DEEPWELL') {
    const [summaryResult, rawReadings] = await Promise.all([
      applyReadingFilters(supabase.from('daily_site_summaries').select(DAILY_SUMMARY_SELECT).eq('sites.type', siteType), {
        fromDate,
        toDate,
        limit,
      }),
      queryRawReadings({
        table: siteType === 'CHLORINATION' ? 'chlorination_readings' : 'deepwell_readings',
        select: siteType === 'CHLORINATION' ? CHLORINATION_READING_SELECT : DEEPWELL_READING_SELECT,
        fallbackSelect:
          siteType === 'CHLORINATION' ? CHLORINATION_READING_FALLBACK_SELECT : DEEPWELL_READING_FALLBACK_SELECT,
        siteType,
        fromDate,
        toDate,
        limit,
      }),
    ]);

    if (summaryResult.error) {
      throw summaryResult.error;
    }

    const summaryRows = (summaryResult.data ?? []).map((row) => normalizeDailySummary(row, siteType));
    return enrichReadingsWithInferredShiftOwnership(mergeSummaryAndRawReadings(summaryRows, rawReadings, limit));
  }

  return [];
}
