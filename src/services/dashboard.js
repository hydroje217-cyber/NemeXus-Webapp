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
  startOfYearlyAnalyticsSourceIso,
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

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
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

async function queryRawReadings({ table, select, fallbackSelect, siteType, fromIso, limit }) {
  const query = (selectClause) =>
    supabase
      .from(table)
      .select(selectClause)
      .gte('slot_datetime', fromIso)
      .order('slot_datetime', { ascending: false })
      .limit(limit);
  let result = await query(select);

  if (result.error && fallbackSelect) {
    result = await query(fallbackSelect);
  }

  if (result.error) {
    return [];
  }

  return (result.data ?? []).map((row) => normalizeRawReading(row, siteType));
}

async function loadRecentRawReadings({ fromIso, limit }) {
  const [chlorinationReadings, deepwellReadings] = await Promise.all([
    queryRawReadings({
      table: 'chlorination_readings',
      select: CHLORINATION_READING_SELECT,
      fallbackSelect: CHLORINATION_READING_FALLBACK_SELECT,
      siteType: 'CHLORINATION',
      fromIso,
      limit,
    }),
    queryRawReadings({
      table: 'deepwell_readings',
      select: DEEPWELL_READING_SELECT,
      fallbackSelect: DEEPWELL_READING_FALLBACK_SELECT,
      siteType: 'DEEPWELL',
      fromIso,
      limit,
    }),
  ]);

  return [...chlorinationReadings, ...deepwellReadings].sort(sortByCreatedAtDesc).slice(0, limit * 2);
}

function sortByCreatedAtDesc(a, b) {
  return (
    new Date(b.slot_datetime || b.reading_datetime || b.created_at || 0).getTime() -
    new Date(a.slot_datetime || a.reading_datetime || a.created_at || 0).getTime()
  );
}

function throwIfError(result, message) {
  if (result.error) {
    throw new Error(result.error.message || message);
  }
}

export function normalizeRole(role) {
  return role === 'general manager' ? GENERAL_MANAGER_ROLE : role;
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

  const [
    pendingApprovals,
    totalOperators,
    approvedOperators,
    sitesCount,
    todaySummaries,
    recentSummaries,
    recentRawReadings,
    profiles,
    loginLogs,
    operators,
    monthlySummaries,
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
    supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .order('created_at', { ascending: false }),
    supabase
      .from('account_login_logs')
      .select('id, profile_id, email, full_name, role, logged_in_at, user_agent')
      .order('logged_in_at', { ascending: false })
      .limit(100),
    supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('role', 'operator')
      .order('full_name', { ascending: true, nullsFirst: false })
      .order('email', { ascending: true, nullsFirst: false }),
    supabase
      .from('daily_site_summaries')
      .select(DAILY_SUMMARY_SELECT)
      .gte('summary_date', startOfYearlyAnalyticsSourceIso().slice(0, 10))
      .order('summary_date', { ascending: true }),
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

  const recentSummaryRows = (recentSummaries.data ?? [])
    .map(normalizeDailySummary)
    .sort(sortByCreatedAtDesc)
    .slice(0, limit);
  const recentReadings = enrichReadingsWithInferredShiftOwnership(
    recentRawReadings.length ? recentRawReadings : recentSummaryRows
  );
  const monthlyRows = (monthlySummaries.data ?? []).map(normalizeDailySummary);
  const monthlyChlorination = monthlyRows.filter((row) => row.site_type === 'CHLORINATION');
  const monthlyDeepwell = monthlyRows.filter((row) => row.site_type === 'DEEPWELL');

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
    profiles: (profiles.data ?? []).map(normalizeProfile),
    loginLogs: (loginLogs.data ?? []).map(normalizeProfile),
    operators: (operators.data ?? []).map(normalizeProfile),
    monthlyProduction: buildMonthlyProduction(monthlyChlorination),
    monthlyProductionYears: buildMonthlyProductionYears(monthlyChlorination),
    dailyProduction: buildDailyProduction(monthlyChlorination),
    dailyProductionMonths: buildDailyProductionMonths(monthlyChlorination),
    dailyProductionYears: buildDailyProductionYears(monthlyChlorination),
    monthlyChemicalUsage: buildMonthlyChemicalUsage(monthlyChlorination),
    monthlyChemicalUsageYears: buildMonthlyChemicalUsageYears(monthlyChlorination),
    monthlyPowerConsumption: buildMonthlyPowerConsumption({
      chlorinationReadings: monthlyChlorination,
      deepwellReadings: monthlyDeepwell,
    }),
    monthlyPowerConsumptionYears: buildMonthlyPowerConsumptionYears({
      chlorinationReadings: monthlyChlorination,
      deepwellReadings: monthlyDeepwell,
    }),
    dailyPowerConsumption: buildDailyPowerConsumption({
      chlorinationReadings: monthlyChlorination,
      deepwellReadings: monthlyDeepwell,
    }),
  };
}

export async function recordAccountLogin({ userAgent } = {}) {
  const { error } = await supabase.rpc('record_account_login', {
    login_user_agent: userAgent || null,
  });

  if (error) {
    throw new Error(error.message || 'Failed to record login.');
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
