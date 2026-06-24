import { supabase } from '../lib/supabase';
import {
  buildDailyPowerConsumption,
  buildDailyProduction,
  buildDailyProductionMonths,
  buildDailyProductionYears,
  buildMonthlyChemicalUsage,
  buildMonthlyChemicalUsageYears,
  buildMonthlyPowerConsumption,
  buildMonthlyPowerConsumptionYears,
  buildMonthlyProduction,
  buildMonthlyProductionYears,
} from '../utils/production';
import { enrichReadingsWithInferredShiftOwnership } from '../utils/shifts';

export const GENERAL_MANAGER_ROLE = 'general_manager';
export const ADMIN_ROLES = new Set(['admin', GENERAL_MANAGER_ROLE]);
const OFFICE_ROLES = new Set(['manager', 'supervisor', 'admin', GENERAL_MANAGER_ROLE]);

const DAILY_SUMMARY_SELECT =
  'id, site_id, summary_date, source, source_file, production_m3, power_kwh, chlorine_kg, avg_flowrate_m3hr, avg_pressure_psi, avg_rc_ppm, avg_turbidity_ntu, avg_ph, avg_tds_ppm, peroxide_liters, operating_hours, scheduled_downtime_hours, unscheduled_downtime_hours, avg_upstream_pressure_psi, avg_downstream_pressure_psi, avg_vfd_frequency_hz, avg_voltage_l1_v, avg_voltage_l2_v, avg_voltage_l3_v, avg_amperage_a, created_at, updated_at, site:sites!inner(id, name, type)';
const CHLORINATION_READING_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, totalizer, chlorination_power_kwh, chlorine_consumed, peroxide_consumption, site:sites(id, name, type), submitted_profile:profiles(id, email, full_name)';
const DEEPWELL_READING_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, site:sites(id, name, type), submitted_profile:profiles(id, email, full_name)';
const CHLORINATION_READING_FALLBACK_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, pressure_psi, rc_ppm, turbidity_ntu, ph, tds_ppm, tank_level_liters, flowrate_m3hr, totalizer, chlorination_power_kwh, chlorine_consumed, peroxide_consumption, site:sites(id, name, type)';
const DEEPWELL_READING_FALLBACK_SELECT =
  'id, site_id, slot_datetime, reading_datetime, created_at, updated_at, status, remarks, upstream_pressure_psi, downstream_pressure_psi, flowrate_m3hr, vfd_frequency_hz, voltage_l1_v, voltage_l2_v, voltage_l3_v, amperage_a, tds_ppm, power_kwh_shift, site:sites(id, name, type)';
const PROFILE_SELECT = 'id, email, full_name, role, is_active, is_approved, approved_at, created_at, last_seen_at';
const LOGIN_LOG_SELECT =
  'id, user_id, email, role, browser, device, user_agent, created_at, profile:profiles(full_name, email)';
const LOGIN_LOG_FALLBACK_SELECT = 'id, user_id, email, role, browser, device, user_agent, created_at';
const LEGACY_LOGIN_LOG_SELECT = 'id, profile_id, email, full_name, role, logged_in_at, user_agent';
const MONTHLY_BILLED_VOLUME_SELECT = 'id, month_key, billed_volume_m3, created_at, updated_at';
const ANALYTICS_YEAR_COUNT = 2;
const SUPABASE_PAGE_SIZE = 1000;

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function startOfPreviousNightIso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const baseDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 1, 23).toISOString();
}

function startOfTomorrowIso(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const baseDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1).toISOString();
}

function normalizeReading(row, siteType) {
  return {
    ...row,
    site_type: siteType,
  };
}

function summaryDateToIso(summaryDate) {
  return summaryDate ? `${summaryDate}T00:00:00.000Z` : null;
}

function normalizeDailySummary(row) {
  const siteType = row.site?.type || 'CHLORINATION';
  const readingDate = summaryDateToIso(row.summary_date) || row.created_at;

  return normalizeReading(
    {
      ...row,
      is_daily_summary: true,
      reading_datetime: readingDate,
      slot_datetime: readingDate,
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
  const site = row.site || row.sites || null;

  return normalizeReading(
    {
      ...row,
      site,
      sites: site,
      status: row.status || 'submitted',
      submitted_profile: row.submitted_profile || null,
    },
    siteType
  );
}

async function queryRawReadings({
  table,
  select,
  fallbackSelect,
  siteType,
  fromIso,
  toIso,
  filterColumn = 'slot_datetime',
  ascending = false,
  limit,
}) {
  const query = (selectClause) => {
    let nextQuery = supabase
      .from(table)
      .select(selectClause)
      .gte(filterColumn, fromIso)
      .order(filterColumn, { ascending });

    if (toIso) {
      nextQuery = nextQuery.lt(filterColumn, toIso);
    }

    if (typeof limit === 'number' && Number.isFinite(limit)) {
      nextQuery = nextQuery.limit(limit);
    }

    return nextQuery;
  };
  let result = await query(select);

  if (result.error && fallbackSelect) {
    result = await query(fallbackSelect);
  }

  if (result.error) {
    return [];
  }

  return (result.data ?? []).map((row) => normalizeRawReading(row, siteType));
}

async function fetchPagedRows(queryFactory) {
  const rows = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const result = await queryFactory().range(from, to);

    if (result.error) {
      return result;
    }

    const pageRows = result.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }
}

async function queryPagedRawReadings({
  table,
  select,
  fallbackSelect,
  siteType,
  fromIso,
  toIso,
  filterColumn = 'slot_datetime',
  ascending = false,
}) {
  const query = (selectClause) => {
    let nextQuery = supabase
      .from(table)
      .select(selectClause)
      .gte(filterColumn, fromIso)
      .order(filterColumn, { ascending });

    if (toIso) {
      nextQuery = nextQuery.lt(filterColumn, toIso);
    }

    return nextQuery;
  };
  let result = await fetchPagedRows(() => query(select));

  if (result.error && fallbackSelect) {
    result = await fetchPagedRows(() => query(fallbackSelect));
  }

  if (result.error) {
    return result;
  }

  return {
    data: (result.data ?? []).map((row) => normalizeRawReading(row, siteType)),
    error: null,
  };
}

async function loadRawReadings({ fromIso, toIso, filterColumn, ascending, limit }) {
  const [chlorinationReadings, deepwellReadings] = await Promise.all([
    queryRawReadings({
      table: 'chlorination_readings',
      select: CHLORINATION_READING_SELECT,
      fallbackSelect: CHLORINATION_READING_FALLBACK_SELECT,
      siteType: 'CHLORINATION',
      fromIso,
      toIso,
      filterColumn,
      ascending,
      limit,
    }),
    queryRawReadings({
      table: 'deepwell_readings',
      select: DEEPWELL_READING_SELECT,
      fallbackSelect: DEEPWELL_READING_FALLBACK_SELECT,
      siteType: 'DEEPWELL',
      fromIso,
      toIso,
      filterColumn,
      ascending,
      limit,
    }),
  ]);

  return [...chlorinationReadings, ...deepwellReadings].sort(sortByCreatedAtDesc);
}

async function loadPagedRawReadings({ fromIso, toIso, filterColumn, ascending }) {
  const [chlorinationResult, deepwellResult] = await Promise.all([
    queryPagedRawReadings({
      table: 'chlorination_readings',
      select: CHLORINATION_READING_SELECT,
      fallbackSelect: CHLORINATION_READING_FALLBACK_SELECT,
      siteType: 'CHLORINATION',
      fromIso,
      toIso,
      filterColumn,
      ascending,
    }),
    queryPagedRawReadings({
      table: 'deepwell_readings',
      select: DEEPWELL_READING_SELECT,
      fallbackSelect: DEEPWELL_READING_FALLBACK_SELECT,
      siteType: 'DEEPWELL',
      fromIso,
      toIso,
      filterColumn,
      ascending,
    }),
  ]);

  if (chlorinationResult.error) {
    return chlorinationResult;
  }

  if (deepwellResult.error) {
    return deepwellResult;
  }

  return {
    data: [...(chlorinationResult.data ?? []), ...(deepwellResult.data ?? [])].sort(sortByCreatedAtDesc),
    error: null,
  };
}

async function loadRecentRawReadings({ fromIso, limit }) {
  return (await loadRawReadings({ fromIso, limit })).slice(0, limit * 2);
}

function getAnalyticsSourceRange({ now = new Date(), yearCount = ANALYTICS_YEAR_COUNT } = {}) {
  const startYear = now.getFullYear() - yearCount + 1;
  const yearStart = new Date(startYear, 0, 1);
  const previousDayStart = new Date(startYear, 0, 0);
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31);

  return {
    readingFromIso: previousDayStart.toISOString(),
    readingToIso: nextYearStart.toISOString(),
    summaryFromDate: `${yearStart.getFullYear()}-01-01`,
    summaryToDate: `${yearEnd.getFullYear()}-12-31`,
  };
}

function sortByCreatedAtDesc(a, b) {
  return (
    new Date(b.slot_datetime || b.reading_datetime || b.created_at || 0).getTime() -
    new Date(a.slot_datetime || a.reading_datetime || a.created_at || 0).getTime()
  );
}

function getReadingDateKey(row) {
  return String(row?.slot_datetime || row?.reading_datetime || row?.created_at || '').slice(0, 10);
}

function mergeSummaryAndRawRows(summaryRows, rawRows) {
  const summaryKeys = new Set(
    summaryRows.map((row) => `${row.site_id || row.site?.id || row.sites?.id || ''}:${getReadingDateKey(row)}`).filter((key) => !key.endsWith(':'))
  );
  const rawRowsWithoutSummaryDays = rawRows.filter((row) => {
    const key = `${row.site_id || row.site?.id || row.sites?.id || ''}:${getReadingDateKey(row)}`;
    return !summaryKeys.has(key);
  });

  return [...summaryRows, ...rawRowsWithoutSummaryDays].sort(sortByCreatedAtDesc);
}

function parseReadingNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function averageReadingValue(rows, field) {
  const values = rows.map((row) => parseReadingNumber(row[field])).filter((value) => value !== null);

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumReadingValue(rows, field) {
  return rows
    .map((row) => parseReadingNumber(row[field]))
    .filter((value) => value !== null)
    .reduce((sum, value) => sum + value, 0);
}

function latestReadingValue(rows, field) {
  const latest = [...rows]
    .map((row) => ({
      value: parseReadingNumber(row[field]),
      time: new Date(row.slot_datetime || row.reading_datetime || row.created_at || 0).getTime(),
    }))
    .filter((row) => row.value !== null)
    .sort((first, second) => first.time - second.time)
    .at(-1);

  return latest?.value ?? null;
}

function positiveDifference(currentValue, previousValue) {
  if (currentValue === null || previousValue === null || currentValue < previousValue) {
    return null;
  }

  return currentValue - previousValue;
}

function createRawDailySummaryRows(rawRows) {
  const rowsBySiteAndDate = rawRows.reduce((map, row) => {
    const siteId = row.site_id || row.site?.id || row.sites?.id;
    const date = getReadingDateKey(row);

    if (!siteId || !date) {
      return map;
    }

    const key = `${row.site_type}:${siteId}:${date}`;
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
    return map;
  }, new Map());
  const previousValuesBySite = new Map();

  return Array.from(rowsBySiteAndDate.entries())
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([key, rows]) => {
      const [siteType, siteId, date] = key.split(':');
      const firstRow = rows[0];
      const site = firstRow.site || firstRow.sites || null;
      const previousValues = previousValuesBySite.get(`${siteType}:${siteId}`) || {};

      if (siteType === 'CHLORINATION') {
        const latestTotalizer = latestReadingValue(rows, 'totalizer');
        const latestPower = latestReadingValue(rows, 'chlorination_power_kwh');
        const summaryRow = normalizeReading(
          {
            id: `raw-summary:${key}`,
            site_id: siteId,
            site,
            sites: site,
            is_daily_summary: true,
            reading_datetime: `${date}T00:00:00.000Z`,
            slot_datetime: `${date}T00:00:00.000Z`,
            status: 'mobile readings',
            source: 'mobile readings',
            totalizer: positiveDifference(latestTotalizer, previousValues.totalizer),
            chlorination_power_kwh: positiveDifference(latestPower, previousValues.power),
            chlorine_consumed: sumReadingValue(rows, 'chlorine_consumed'),
            peroxide_consumption: sumReadingValue(rows, 'peroxide_consumption'),
            pressure_psi: averageReadingValue(rows, 'pressure_psi'),
            rc_ppm: averageReadingValue(rows, 'rc_ppm'),
            turbidity_ntu: averageReadingValue(rows, 'turbidity_ntu'),
            ph: averageReadingValue(rows, 'ph'),
            tds_ppm: averageReadingValue(rows, 'tds_ppm'),
            flowrate_m3hr: averageReadingValue(rows, 'flowrate_m3hr'),
            submitted_profile: null,
          },
          siteType
        );

        previousValuesBySite.set(`${siteType}:${siteId}`, {
          totalizer: latestTotalizer ?? previousValues.totalizer ?? null,
          power: latestPower ?? previousValues.power ?? null,
        });

        return summaryRow;
      }

      return normalizeReading(
        {
          id: `raw-summary:${key}`,
          site_id: siteId,
          site,
          sites: site,
          is_daily_summary: true,
          reading_datetime: `${date}T00:00:00.000Z`,
          slot_datetime: `${date}T00:00:00.000Z`,
          status: 'mobile readings',
          source: 'mobile readings',
          upstream_pressure_psi: averageReadingValue(rows, 'upstream_pressure_psi'),
          downstream_pressure_psi: averageReadingValue(rows, 'downstream_pressure_psi'),
          flowrate_m3hr: averageReadingValue(rows, 'flowrate_m3hr'),
          vfd_frequency_hz: averageReadingValue(rows, 'vfd_frequency_hz'),
          voltage_l1_v: averageReadingValue(rows, 'voltage_l1_v'),
          voltage_l2_v: averageReadingValue(rows, 'voltage_l2_v'),
          voltage_l3_v: averageReadingValue(rows, 'voltage_l3_v'),
          amperage_a: averageReadingValue(rows, 'amperage_a'),
          tds_ppm: averageReadingValue(rows, 'tds_ppm'),
          power_kwh_shift: sumReadingValue(rows, 'power_kwh_shift'),
          submitted_profile: null,
        },
        siteType
      );
    });
}

function throwIfError(result, message) {
  if (result.error) {
    throw new Error(result.error.message || message);
  }
}

function isMissingColumnError(error) {
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    /column .* does not exist/i.test(error?.message || '') ||
    /could not find .* column/i.test(error?.message || '')
  );
}

function getBrowserFromUserAgent(userAgent = '') {
  if (!userAgent) {
    return '';
  }

  if (userAgent.includes('Edg/')) {
    return 'Microsoft Edge';
  }

  if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
    return 'Opera';
  }

  if (userAgent.includes('Firefox/')) {
    return 'Firefox';
  }

  if (userAgent.includes('Chrome/') || userAgent.includes('CriOS/')) {
    return 'Chrome';
  }

  if (userAgent.includes('Safari/')) {
    return 'Safari';
  }

  return 'Browser';
}

function getDeviceFromUserAgent(userAgent = '') {
  if (!userAgent) {
    return '';
  }

  if (/iPad/i.test(userAgent)) {
    return 'iPad';
  }

  if (/iPhone/i.test(userAgent)) {
    return 'iPhone';
  }

  if (/Android/i.test(userAgent)) {
    return /Mobile/i.test(userAgent) ? 'Android phone' : 'Android tablet';
  }

  if (/Windows/i.test(userAgent)) {
    return 'Windows desktop';
  }

  if (/Macintosh|Mac OS/i.test(userAgent)) {
    return 'Mac desktop';
  }

  if (/Linux/i.test(userAgent)) {
    return 'Linux desktop';
  }

  return 'Device';
}

function normalizeLoginLog(row = {}) {
  const userAgent = row.user_agent || '';

  return {
    ...row,
    email: row.email || row.profile?.email || '',
    full_name: row.full_name || row.profile?.full_name || '',
    browser: row.browser || getBrowserFromUserAgent(userAgent),
    device: row.device || getDeviceFromUserAgent(userAgent),
    logged_in_at: row.logged_in_at || row.created_at,
  };
}

async function fetchLoginLogs() {
  const fullResult = await supabase
    .from('account_login_logs')
    .select(LOGIN_LOG_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!fullResult.error) {
    return fullResult;
  }

  if (!isMissingColumnError(fullResult.error)) {
    return fullResult;
  }

  const fallbackResult = await supabase
    .from('account_login_logs')
    .select(LOGIN_LOG_FALLBACK_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!fallbackResult.error || !isMissingColumnError(fallbackResult.error)) {
    return fallbackResult;
  }

  return supabase
    .from('account_login_logs')
    .select(LEGACY_LOGIN_LOG_SELECT)
    .order('logged_in_at', { ascending: false })
    .limit(100);
}

async function fetchMonthlyBilledVolumes() {
  const result = await supabase
    .from('monthly_billed_volumes')
    .select(MONTHLY_BILLED_VOLUME_SELECT)
    .order('month_key', { ascending: true });

  if (result.error) {
    return [];
  }

  return result.data ?? [];
}

export function normalizeRole(role) {
  if (role === 'general manager') {
    return GENERAL_MANAGER_ROLE;
  }

  if (role === 'test operator') {
    return 'test_operator';
  }

  return role;
}

export function formatRoleLabel(role) {
  return normalizeRole(role)?.replace('_', ' ') || '';
}

export function normalizeProfile(row) {
  return row ? { ...row, role: normalizeRole(row.role) } : row;
}

export function isOfficeRole(role) {
  return OFFICE_ROLES.has(normalizeRole(role));
}

export function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

export function isGeneralManagerRole(role) {
  return normalizeRole(role) === GENERAL_MANAGER_ROLE;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to load your profile.');
  }

  return normalizeProfile(data);
}

export async function updateProfileEmail(profileId, email) {
  const { error } = await supabase
    .from('profiles')
    .update({ email })
    .eq('id', profileId);

  if (error) {
    throw new Error(error.message || 'Failed to update profile email.');
  }
}

export async function getDashboardSnapshot({ limit = 50 } = {}) {
  const todayIso = startOfTodayIso();
  const checkpointFromIso = new Date(new Date(todayIso).getTime() - 24 * 60 * 60 * 1000).toISOString();
  const slotQueryStartIso = startOfPreviousNightIso();
  const tomorrowIso = startOfTomorrowIso();
  const analyticsRange = getAnalyticsSourceRange();

  const [
    pendingApprovals,
    totalOperators,
    approvedOperators,
    sitesCount,
    todaySummaries,
    recentSummaries,
    recentRawReadings,
    todaySlotReadings,
    profiles,
    loginLogs,
    operators,
    monthlySummaries,
    monthlyBilledVolumes,
    analyticsRawReadings,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, is_approved, created_at, last_seen_at')
      .eq('role', 'operator')
      .eq('is_active', true)
      .eq('is_approved', false)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'operator'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'operator')
      .eq('is_active', true)
      .eq('is_approved', true),
    supabase.from('sites').select('id', { count: 'exact', head: true }),
    supabase
      .from('daily_site_summaries')
      .select('id', { count: 'exact', head: true })
      .gte('summary_date', todayIso.slice(0, 10)),
    supabase
      .from('daily_site_summaries')
      .select(DAILY_SUMMARY_SELECT)
      .order('summary_date', { ascending: false })
      .limit(limit),
    loadRecentRawReadings({ fromIso: checkpointFromIso, limit: 250 }),
    loadRawReadings({
      fromIso: slotQueryStartIso,
      toIso: tomorrowIso,
      filterColumn: 'slot_datetime',
      ascending: true,
    }),
    supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .order('created_at', { ascending: false }),
    fetchLoginLogs(),
    supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('role', 'operator')
      .order('full_name', { ascending: true, nullsFirst: false })
      .order('email', { ascending: true, nullsFirst: false }),
    supabase
      .from('daily_site_summaries')
      .select(DAILY_SUMMARY_SELECT)
      .gte('summary_date', analyticsRange.summaryFromDate)
      .lte('summary_date', analyticsRange.summaryToDate)
      .order('summary_date', { ascending: true }),
    fetchMonthlyBilledVolumes(),
    loadPagedRawReadings({
      fromIso: analyticsRange.readingFromIso,
      toIso: analyticsRange.readingToIso,
      filterColumn: 'reading_datetime',
      ascending: true,
    }),
  ]);

  throwIfError(pendingApprovals, 'Failed to load pending approvals.');
  throwIfError(totalOperators, 'Failed to count operators.');
  throwIfError(approvedOperators, 'Failed to count approved operators.');
  throwIfError(sitesCount, 'Failed to count sites.');
  throwIfError(todaySummaries, 'Failed to count daily site summaries.');
  throwIfError(recentSummaries, 'Failed to load recent daily site summaries.');
  throwIfError(profiles, 'Failed to load accounts.');
  throwIfError(loginLogs, 'Failed to load login logs.');
  throwIfError(operators, 'Failed to load operators.');
  throwIfError(monthlySummaries, 'Failed to load monthly daily site summaries.');
  throwIfError(analyticsRawReadings, 'Failed to load analytics readings.');

  const recentSummaryRows = (recentSummaries.data ?? [])
    .map(normalizeDailySummary)
    .sort(sortByCreatedAtDesc)
    .slice(0, limit);
  const recentReadings = enrichReadingsWithInferredShiftOwnership(
    recentRawReadings.length ? recentRawReadings : recentSummaryRows
  );
  const dailySummaries = monthlySummaries.data ?? [];
  const analyticsRows = analyticsRawReadings.data ?? [];
  const monthlyChlorination = analyticsRows.filter((row) => row.site_type === 'CHLORINATION');
  const monthlyDeepwell = analyticsRows.filter((row) => row.site_type === 'DEEPWELL');

  return {
    stats: {
      totalOperators: totalOperators.count ?? 0,
      approvedOperators: approvedOperators.count ?? 0,
      pendingOperators: pendingApprovals.data?.length ?? 0,
      totalSites: sitesCount.count ?? 0,
      todayReadings: todaySummaries.count ?? 0,
    },
    pendingApprovals: (pendingApprovals.data ?? []).map(normalizeProfile),
    recentReadings,
    todaySlotReadings,
    profiles: (profiles.data ?? []).map(normalizeProfile),
    loginLogs: (loginLogs.data ?? []).map(normalizeLoginLog),
    operators: (operators.data ?? []).map(normalizeProfile),
    monthlyProduction: buildMonthlyProduction(monthlyChlorination, { dailySummaries }),
    monthlyProductionYears: buildMonthlyProductionYears(monthlyChlorination, { dailySummaries }),
    monthlyBilledVolumes,
    dailyProduction: buildDailyProduction(monthlyChlorination, { dailySummaries }),
    dailyProductionMonths: buildDailyProductionMonths(monthlyChlorination, { dailySummaries }),
    dailyProductionYears: buildDailyProductionYears(monthlyChlorination, { dailySummaries }),
    monthlyChemicalUsage: buildMonthlyChemicalUsage(monthlyChlorination, { dailySummaries }),
    monthlyChemicalUsageYears: buildMonthlyChemicalUsageYears(monthlyChlorination, { dailySummaries }),
    monthlyPowerConsumption: buildMonthlyPowerConsumption({
      chlorinationReadings: monthlyChlorination,
      deepwellReadings: monthlyDeepwell,
    }, { dailySummaries }),
    monthlyPowerConsumptionYears: buildMonthlyPowerConsumptionYears({
      chlorinationReadings: monthlyChlorination,
      deepwellReadings: monthlyDeepwell,
    }, { dailySummaries }),
    dailyPowerConsumption: buildDailyPowerConsumption({
      chlorinationReadings: monthlyChlorination,
      deepwellReadings: monthlyDeepwell,
    }, { dailySummaries }),
  };
}

export async function saveMonthlyBilledVolume({ monthKey, billedVolumeM3 }) {
  const parsedVolume = Number(billedVolumeM3);

  if (!monthKey || !/^\d{4}-\d{2}$/.test(String(monthKey))) {
    throw new Error('Choose a valid billed volume month.');
  }

  if (!Number.isFinite(parsedVolume) || parsedVolume < 0) {
    throw new Error('Enter a valid billed volume.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (userError || !userId) {
    throw new Error(userError?.message || 'You must be signed in to save billed volume.');
  }

  const { data, error } = await supabase
    .from('monthly_billed_volumes')
    .upsert(
      {
        month_key: monthKey,
        billed_volume_m3: parsedVolume,
        created_by: userId,
        updated_by: userId,
      },
      { onConflict: 'month_key' }
    )
    .select(MONTHLY_BILLED_VOLUME_SELECT)
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save billed volume.');
  }

  return data;
}

export async function recordAccountLogin({ userAgent } = {}) {
  const { error: rpcError } = await supabase.rpc('record_account_login', {
    login_user_agent: userAgent || null,
  });

  if (!rpcError) {
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    throw new Error(userError?.message || rpcError.message || 'Failed to record login.');
  }

  const profile = await getProfile(userData.user.id);
  const normalizedUserAgent = userAgent || '';
  const loginLog = {
    user_id: userData.user.id,
    email: profile?.email || userData.user.email,
    role: profile?.role || 'operator',
    browser: getBrowserFromUserAgent(normalizedUserAgent),
    device: getDeviceFromUserAgent(normalizedUserAgent),
    user_agent: normalizedUserAgent,
  };
  const attempts = [
    loginLog,
    (({ browser: _browser, device: _device, ...rest }) => rest)(loginLog),
    {
      email: loginLog.email,
      role: loginLog.role,
      user_agent: loginLog.user_agent,
    },
    {
      profile_id: loginLog.user_id,
      email: loginLog.email,
      full_name: profile?.full_name || null,
      role: loginLog.role,
      user_agent: loginLog.user_agent,
    },
  ];
  let lastError = rpcError;

  for (const payload of attempts) {
    const { error } = await supabase.from('account_login_logs').insert(payload);

    if (!error) {
      return;
    }

    lastError = error;

    if (!isMissingColumnError(error)) {
      break;
    }
  }

  if (lastError) {
    throw new Error(lastError.message || 'Failed to record login.');
  }
}

export async function updateAccountPresence({ userAgent } = {}) {
  const { error } = await supabase.rpc('update_account_presence', {
    presence_user_agent: userAgent || null,
  });

  if (error) {
    throw new Error(error.message || 'Failed to update active status.');
  }
}

export async function approveOperatorProfile(profileId) {
  const { error } = await supabase.rpc('approve_operator_account', {
    target_profile_id: profileId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to approve operator.');
  }
}

export async function assignProfileRole(profileId, nextRole) {
  const { error } = await supabase.rpc('assign_profile_role', {
    target_profile_id: profileId,
    next_role: nextRole,
  });

  if (error) {
    throw new Error(error.message || 'Failed to update role.');
  }
}

export async function resetProfilePassword(profileId, password) {
  const { data, error } = await supabase.functions.invoke('reset-profile-password', {
    body: {
      profileId,
      password,
    },
  });

  if (error) {
    let message = error.message;

    if (error.context?.json) {
      try {
        const errorBody = await error.context.json();
        message = errorBody?.error || message;
      } catch {
        message = error.message;
      }
    }

    throw new Error(message || 'Failed to reset account password.');
  }

  if (data?.error) {
    throw new Error(data.error);
  }
}

export async function deleteProfileAccount(profileId) {
  const { error } = await supabase.rpc('delete_profile_account', {
    target_profile_id: profileId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to delete account.');
  }
}
