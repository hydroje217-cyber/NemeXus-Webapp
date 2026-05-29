import { supabase } from '../lib/supabase';
import { enrichReadingsWithInferredShiftOwnership } from '../utils/shifts';

const CHLORINATION_READING_SELECT =
  'id, site_id, submitted_by, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, totalizer, chlorination_power_kwh, chlorine_consumed, peroxide_consumption, sites(id, name, type), submitted_profile:profiles!chlorination_readings_submitted_by_fkey(id, email, full_name)';
const DEEPWELL_READING_SELECT =
  'id, site_id, submitted_by, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, sites(id, name, type), submitted_profile:profiles!deepwell_readings_submitted_by_fkey(id, email, full_name)';
const CHLORINATION_READING_FALLBACK_SELECT =
  'id, site_id, submitted_by, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, totalizer, chlorination_power_kwh, chlorine_consumed, peroxide_consumption, sites(id, name, type), submitted_profile:profiles(id, email, full_name)';
const DEEPWELL_READING_FALLBACK_SELECT =
  'id, site_id, submitted_by, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, sites(id, name, type), submitted_profile:profiles(id, email, full_name)';
const DAILY_SITE_SUMMARY_SELECT =
  'id, site_id, summary_date, source, source_file, production_m3, power_kwh, chlorine_kg, avg_flowrate_m3hr, avg_pressure_psi, avg_rc_ppm, avg_turbidity_ntu, avg_ph, avg_tds_ppm, peroxide_liters, operating_hours, scheduled_downtime_hours, unscheduled_downtime_hours, avg_upstream_pressure_psi, avg_downstream_pressure_psi, avg_vfd_frequency_hz, avg_voltage_l1_v, avg_voltage_l2_v, avg_voltage_l3_v, avg_amperage_a, site:sites(id, name, type)';
const SUPABASE_PAGE_SIZE = 1000;

function normalizeReading(row, siteType) {
  return {
    ...row,
    site_type: siteType,
  };
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

function getReadingTime(row) {
  return new Date(row?.reading_datetime || 0).getTime() || 0;
}

function sortByReadingDateDesc(first, second) {
  return getReadingTime(second) - getReadingTime(first);
}

function applyRawReadingFilters(query, { siteId, fromDate, toDate, limit }) {
  let nextQuery = query.order('reading_datetime', { ascending: false });

  if (typeof limit === 'number' && Number.isFinite(limit)) {
    nextQuery = nextQuery.limit(limit);
  }

  if (fromDate) {
    const start = new Date(`${fromDate}T00:00:00`);
    nextQuery = nextQuery.gte('reading_datetime', start.toISOString());
  }

  if (toDate) {
    const end = new Date(`${toDate}T00:00:00`);
    end.setDate(end.getDate() + 1);
    nextQuery = nextQuery.lt('reading_datetime', end.toISOString());
  }

  return nextQuery;
}

function applyDailySummaryFilters(query, { siteId, fromDate, toDate, limit }) {
  let nextQuery = query.order('summary_date', { ascending: false });

  if (typeof limit === 'number' && Number.isFinite(limit)) {
    nextQuery = nextQuery.limit(limit);
  }

  if (siteId) {
    nextQuery = nextQuery.eq('site_id', siteId);
  }

  if (fromDate) {
    nextQuery = nextQuery.gte('summary_date', fromDate);
  }

  if (toDate) {
    nextQuery = nextQuery.lte('summary_date', toDate);
  }

  return nextQuery;
}

async function fetchRows(queryFactory, limit) {
  if (typeof limit === 'number' && Number.isFinite(limit)) {
    const result = await queryFactory();

    if (result.error) {
      throw result.error;
    }

    return result.data ?? [];
  }

  const rows = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const result = await queryFactory().range(from, to);

    if (result.error) {
      throw result.error;
    }

    const pageRows = result.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      return rows;
    }
  }
}

async function queryRawReadings({ table, select, fallbackSelect, siteType, siteId, fromDate, toDate, limit }) {
  const query = (selectClause) =>
    applyRawReadingFilters(supabase.from(table).select(selectClause), {
      siteId,
      fromDate,
      toDate,
      limit,
    });

  try {
    return (await fetchRows(() => query(select), limit)).map((row) => normalizeRawReading(row, siteType));
  } catch (error) {
    if (!fallbackSelect) {
      throw error;
    }
  }

  return (await fetchRows(() => query(fallbackSelect), limit)).map((row) => normalizeRawReading(row, siteType));
}

async function fetchAllReadingsForType({ siteType, siteId, fromDate, toDate }) {
  return queryRawReadings({
    table: siteType === 'CHLORINATION' ? 'chlorination_readings' : 'deepwell_readings',
    select: siteType === 'CHLORINATION' ? CHLORINATION_READING_SELECT : DEEPWELL_READING_SELECT,
    fallbackSelect:
      siteType === 'CHLORINATION' ? CHLORINATION_READING_FALLBACK_SELECT : DEEPWELL_READING_FALLBACK_SELECT,
    siteType,
    siteId,
    fromDate,
    toDate,
  });
}

async function fetchAllDailySiteSummaries({ siteId, siteType, fromDate, toDate }) {
  const rows = await fetchRows(
    () =>
      applyDailySummaryFilters(supabase.from('daily_site_summaries').select(DAILY_SITE_SUMMARY_SELECT), {
        siteId,
        fromDate,
        toDate,
      }),
    undefined
  );
  const normalizedSiteType = String(siteType || '').toUpperCase();

  return rows
    .filter((row) => {
      if (!normalizedSiteType) {
        return true;
      }

      return String(row?.site?.type || '').toUpperCase() === normalizedSiteType;
    })
    .map((row) => ({
      ...row,
      site_type: row?.site?.type,
    }));
}

export async function listReadings({ siteId, siteType, fromDate, toDate, limit, includeAll = false }) {
  if (includeAll && (siteType === 'CHLORINATION' || siteType === 'DEEPWELL')) {
    return enrichReadingsWithInferredShiftOwnership(await fetchAllReadingsForType({ siteType, siteId, fromDate, toDate }));
  }

  if (includeAll) {
    const rows = await Promise.all([
      fetchAllReadingsForType({ siteType: 'CHLORINATION', siteId, fromDate, toDate }),
      fetchAllReadingsForType({ siteType: 'DEEPWELL', siteId, fromDate, toDate }),
    ]);

    return enrichReadingsWithInferredShiftOwnership(rows.flat().sort(sortByReadingDateDesc));
  }

  if (!siteType || siteType === 'all') {
    const [chlorinationReadings, deepwellReadings] = await Promise.all([
      listReadings({ siteId, siteType: 'CHLORINATION', fromDate, toDate, limit }),
      listReadings({ siteId, siteType: 'DEEPWELL', fromDate, toDate, limit }),
    ]);

    const mergedReadings = [...chlorinationReadings, ...deepwellReadings].sort(sortByReadingDateDesc);

    return typeof limit === 'number' && Number.isFinite(limit) ? mergedReadings.slice(0, limit) : mergedReadings;
  }

  if (siteType === 'CHLORINATION' || siteType === 'DEEPWELL') {
    const rawReadings = await queryRawReadings({
      table: siteType === 'CHLORINATION' ? 'chlorination_readings' : 'deepwell_readings',
      select: siteType === 'CHLORINATION' ? CHLORINATION_READING_SELECT : DEEPWELL_READING_SELECT,
      fallbackSelect:
        siteType === 'CHLORINATION' ? CHLORINATION_READING_FALLBACK_SELECT : DEEPWELL_READING_FALLBACK_SELECT,
      siteType,
      siteId,
      fromDate,
      toDate,
      limit,
    });

    return enrichReadingsWithInferredShiftOwnership(rawReadings);
  }

  return [];
}

export async function listDailySiteSummaries({ siteId, siteType, fromDate, toDate, limit, includeAll = false } = {}) {
  if (includeAll) {
    return fetchAllDailySiteSummaries({ siteId, siteType, fromDate, toDate });
  }

  const { data, error } = await applyDailySummaryFilters(
    supabase.from('daily_site_summaries').select(DAILY_SITE_SUMMARY_SELECT),
    { siteId, fromDate, toDate, limit }
  );

  if (error) {
    throw error;
  }

  const normalizedSiteType = String(siteType || '').toUpperCase();

  return (data ?? [])
    .filter((row) => {
      if (!normalizedSiteType || normalizedSiteType === 'ALL') {
        return true;
      }

      return String(row?.site?.type || '').toUpperCase() === normalizedSiteType;
    })
    .map((row) => ({
      ...row,
      site_type: row?.site?.type,
    }));
}
  if (siteId) {
    nextQuery = nextQuery.eq('site_id', siteId);
  }
