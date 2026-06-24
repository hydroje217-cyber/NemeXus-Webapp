import { useEffect, useRef, useState } from 'react';
import { Calculator, CalendarDays, ChevronDown, Download, FileText, Save, Zap } from 'lucide-react';
import { exportSummaryReportPptx } from '../utils/summaryPptxExport';
import { buildCycleMonthlyProductionYearData } from '../utils/reportCycles';

const REPORT_INPUT_STORAGE_KEY = 'nemexus-summary-report-inputs';
const MONTH_SHORT_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_SHORT_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SUMMARY_EXPORT_PAGE_NUMBERS = Array.from({ length: 13 }, (_item, index) => index + 1);
const REFERENCE_SUMMARY_REPORT_INPUTS = {
  '2025-12': {
    billedVolume: 5895.89,
    nrw: 1052.41,
    totalPower: 4832.96,
    leyecoConsumption: 5777.00,
    effectiveRate: 11.80,
    electricBill: 68164.36,
  },
  '2026-01': {
    billedVolume: 7615.38,
    nrw: 2057.00,
    totalPower: 6863.55,
    leyecoConsumption: 6310.00,
    effectiveRate: 14.09,
    electricBill: 88899.61,
  },
  '2026-02': {
    billedVolume: 6658.00,
    nrw: 930.31,
    totalPower: 5162.30,
    leyecoConsumption: 4037.00,
    effectiveRate: 11.19,
    electricBill: 45181.15,
  },
  '2026-03': {
    billedVolume: 4837.16,
    nrw: 1477.01,
    totalPower: 4414.60,
    leyecoConsumption: 4338.00,
    effectiveRate: 13.13,
    electricBill: 56951.04,
  },
  '2026-04': {
    billedVolume: 6629.99,
    nrw: 2270.81,
    totalPower: 5996.70,
    leyecoConsumption: 5491.00,
    effectiveRate: 11.77,
    electricBill: 64643.84,
    intakeBill: 63412.42,
    chlorinationBill: 1231.42,
    operatingHours: 550.5,
    powerCostProduction: 8542.20,
    secOverride: 0.64,
    motorLoadOverride: 9.80,
    deepwellPower: 5394.90,
    chlorinationPower: 72.11,
    dateLabel: 'April 21, 2026',
  },
  '2026-05': {
    totalPower: 7671.40,
    leyecoConsumption: 7657.00,
    effectiveRate: 10.21,
    electricBill: 78151.73,
    intakeBill: 76584.08,
    chlorinationBill: 1567.65,
    operatingHours: 608,
    powerCostProduction: 9813.07,
    secOverride: 0.78,
    motorLoadOverride: 12.35,
    deepwellPower: 7508.80,
    chlorinationPower: 145.39,
    dateLabel: 'May 21, 2026',
  },
};

function mergeSummaryReportInputs(baseInputs = {}, overrideInputs = {}) {
  const monthKeys = new Set([
    ...Object.keys(baseInputs || {}),
    ...Object.keys(overrideInputs || {}),
  ]);

  return [...monthKeys].reduce((mergedInputs, monthKey) => {
    const overrideRow = Object.entries(overrideInputs?.[monthKey] ?? {}).reduce((row, [field, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        row[field] = value;
      }

      return row;
    }, {});

    mergedInputs[monthKey] = {
      ...(baseInputs?.[monthKey] ?? {}),
      ...overrideRow,
    };
    return mergedInputs;
  }, {});
}

export function loadSummaryReportInputs() {
  if (typeof window === 'undefined') {
    return REFERENCE_SUMMARY_REPORT_INPUTS;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(REPORT_INPUT_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object'
      ? mergeSummaryReportInputs(REFERENCE_SUMMARY_REPORT_INPUTS, parsed)
      : REFERENCE_SUMMARY_REPORT_INPUTS;
  } catch (_error) {
    return REFERENCE_SUMMARY_REPORT_INPUTS;
  }
}

export function saveSummaryReportInputs(inputs) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(REPORT_INPUT_STORAGE_KEY, JSON.stringify(inputs || {}));
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function getMonthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function getCurrentDateKey() {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
}

function getCurrentMonthKey() {
  return getCurrentDateKey().slice(0, 7);
}

function getDatePartsFromKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

function getDateKeyFromParts(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthKeyFromParts(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey || '-';
  }

  return `${MONTH_SHORT_LABELS[month - 1]} ${year}`;
}

function getDateLabelFromKey(dateKey) {
  const parts = getDatePartsFromKey(dateKey);

  if (!parts) {
    return dateKey || '-';
  }

  return `${MONTH_SHORT_LABELS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

function getDateKeyFromMonth(monthKey, day = 1) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getLastDateKeyFromMonth(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return '';
  }

  return getDateKeyFromMonth(monthKey, new Date(year, month, 0).getDate());
}

function getPreviousMonthKey(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return '';
  }

  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getCompactMonthYearLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey || '-';
  }

  return `${MONTH_SHORT_LABELS[month - 1]}-${String(year).slice(-2)}`;
}

function buildMonthYearLabels(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey || '-';
  }

  return `${MONTH_SHORT_LABELS[month - 1]} ${year}`;
}

function getYearOptions(dashboard) {
  const years = new Set([
    ...Object.keys(REFERENCE_SUMMARY_REPORT_INPUTS).map((monthKey) => Number(String(monthKey).slice(0, 4))),
    ...((dashboard?.monthlyProductionYears ?? []).map((yearData) => Number(yearData.year))),
    ...((dashboard?.monthlyPowerConsumptionYears ?? []).map((yearData) => Number(yearData.year))),
  ].filter(Number.isFinite));

  if (!years.size) {
    years.add(getCurrentYear());
  }

  return [...years].sort((first, second) => second - first);
}

function getNumericValue(value) {
  return value === '' || value === null || value === undefined ? '' : String(value);
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, decimals = 2) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `PHP ${formatNumber(parsed)}` : '-';
}

function getFieldStatus(row, fields) {
  return fields.every((field) => Number(row?.[field]) > 0) ? 'added' : 'missing';
}

function getLatestInputMonth(reportInputs = {}, fields = [], fallbackMonthKey) {
  return Object.entries(reportInputs || {})
    .filter(([_monthKey, row]) => fields.every((field) => Number(row?.[field]) > 0))
    .map(([monthKey]) => monthKey)
    .sort()
    .pop() || fallbackMonthKey;
}

function getDefaultDailyExportRange(date = new Date()) {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const isNextCycle = date.getDate() >= 28;
  const startDate = new Date(year, monthIndex + (isNextCycle ? 0 : -1), 28);
  const endDate = new Date(year, monthIndex + (isNextCycle ? 1 : 0), 27);

  return {
    startDate: getDateKeyFromParts(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate()),
    endDate: getDateKeyFromParts(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate()),
  };
}

function getDefaultGraphRangeMonthKeys(date = new Date()) {
  const year = date.getFullYear();

  return {
    startMonthKey: `${year - 1}-12`,
    endMonthKey: `${year}-12`,
  };
}

function getDefaultPowerCostRangeMonthKeys(date = new Date()) {
  const currentMonthKey = getMonthKeyFromParts(date.getFullYear(), date.getMonth() + 1);

  return {
    startMonthKey: getPreviousMonthKey(currentMonthKey),
    endMonthKey: currentMonthKey,
  };
}

function getMonthlyProduction(dashboard, monthKey) {
  const year = Number(String(monthKey || '').slice(0, 4));
  const yearData = (dashboard?.monthlyProductionYears ?? []).find((item) => Number(item.year) === year);
  const row = yearData?.rows?.find((item) => item.key === monthKey);

  return parseNumber(row?.production);
}

function getMonthlyPower(dashboard, monthKey) {
  const year = Number(String(monthKey || '').slice(0, 4));
  const yearData = (dashboard?.monthlyPowerConsumptionYears ?? []).find((item) => Number(item.year) === year);
  const row = yearData?.rows?.find((item) => item.key === monthKey);

  return {
    chlorinationPower: parseNumber(row?.chlorinationPower),
    intakePower: parseNumber(row?.deepwellPower),
    totalPower: parseNumber(row?.totalPower) || parseNumber(row?.chlorinationPower) + parseNumber(row?.deepwellPower),
  };
}

function getYearDataForMonth(collection, monthKey) {
  const year = Number(String(monthKey || '').slice(0, 4));
  return (collection ?? []).find((yearData) => Number(yearData?.year) === year) || (collection ?? [])[0] || {};
}

function getTrendRangeData(yearData, startMonthKey, endMonthKey, totalKeys, yearDataCollection = []) {
  const reportYear = Number(yearData?.year ?? String(endMonthKey || '').slice(0, 4));
  const previousDecemberKey = Number.isFinite(reportYear) ? `${reportYear - 1}-12` : '';
  const previousYearData = yearDataCollection.find((item) => Number(item?.year) === reportYear - 1);
  const previousDecemberRow = previousYearData?.rows?.find((item) => item.key === previousDecemberKey);
  const rows = [
    ...(previousDecemberRow ? [previousDecemberRow] : []),
    ...(yearData?.rows ?? []),
  ];
  const safeStartMonthKey = startMonthKey || previousDecemberKey;
  const safeEndMonthKey = endMonthKey || rows[rows.length - 1]?.key || safeStartMonthKey;
  const activeRow = rows
    .filter((item) => String(item.key || '').localeCompare(safeEndMonthKey) <= 0)
    .sort((first, second) => String(first.key || '').localeCompare(String(second.key || '')))
    .pop();
  const trendRows = rows.filter((item) => {
    const key = String(item.key || '');
    return key.localeCompare(safeStartMonthKey) >= 0 && key.localeCompare(safeEndMonthKey) <= 0;
  });

  return {
    ...(yearData ?? {}),
    rows: trendRows.length ? trendRows : activeRow ? [activeRow] : [],
    ...totalKeys.reduce((totals, { source, target }) => {
      totals[target] = activeRow ? Number(activeRow[source] ?? 0) : 0;
      return totals;
    }, {}),
  };
}

function getDailyProductionData(dashboard, monthKey) {
  const dailyProductionYears = dashboard?.dailyProductionYears ?? [];
  const dailyMonth = dailyProductionYears
    .flatMap((yearData) => yearData.months ?? [])
    .find((month) => month.key === monthKey);
  const fallbackMonth = dailyMonth || dashboard?.dailyProduction || {};
  const startDate = getDateKeyFromMonth(monthKey);
  const endDate = getLastDateKeyFromMonth(monthKey);
  const rows = dailyProductionYears
    .flatMap((yearData) => yearData.months ?? [])
    .flatMap((month) => month.rows ?? [])
    .filter((row) => {
      const rowDate = row.date || row.key;
      return rowDate && String(rowDate).localeCompare(startDate) >= 0 && String(rowDate).localeCompare(endDate) <= 0;
    })
    .sort((first, second) => String(first.key || first.date || '').localeCompare(String(second.key || second.date || '')));

  return {
    ...fallbackMonth,
    key: monthKey,
    monthLabel: getMonthLabel(monthKey),
    totalProduction: rows.length
      ? rows.reduce((total, row) => total + Number(row.production ?? 0), 0)
      : Number(fallbackMonth.totalProduction ?? 0),
    rows: rows.length ? rows : fallbackMonth.rows ?? [],
  };
}

function getDailyProductionRangeData(dashboard, startDate, endDate, fallbackMonthKey) {
  const dailyProductionYears = dashboard?.dailyProductionYears ?? [];
  const fallbackMonth = dailyProductionYears
    .flatMap((yearData) => yearData.months ?? [])
    .find((month) => month.key === String(fallbackMonthKey || '').slice(0, 7)) || dashboard?.dailyProduction || {};
  const safeStartDate = startDate && endDate && startDate.localeCompare(endDate) <= 0 ? startDate : endDate || startDate;
  const safeEndDate = endDate && safeStartDate && endDate.localeCompare(safeStartDate) >= 0 ? endDate : safeStartDate;
  const rows = dailyProductionYears
    .flatMap((yearData) => yearData.months ?? [])
    .flatMap((month) => month.rows ?? [])
    .filter((row) => {
      const rowDate = row.date || row.key;
      return rowDate && String(rowDate).localeCompare(safeStartDate) >= 0 && String(rowDate).localeCompare(safeEndDate) <= 0;
    })
    .sort((first, second) => String(first.key || first.date || '').localeCompare(String(second.key || second.date || '')));
  const rangeLabel = safeStartDate === safeEndDate
    ? getDateLabelFromKey(safeStartDate)
    : `${getDateLabelFromKey(safeStartDate)} - ${getDateLabelFromKey(safeEndDate)}`;

  return {
    ...fallbackMonth,
    key: safeStartDate === safeEndDate ? safeStartDate : `${safeStartDate}_${safeEndDate}`,
    monthLabel: rangeLabel,
    totalProduction: rows.length
      ? rows.reduce((total, row) => total + Number(row.production ?? 0), 0)
      : Number(fallbackMonth.totalProduction ?? 0),
    rows: rows.length ? rows : fallbackMonth.rows ?? [],
  };
}

function buildBilledVolumeInputs(reportInputs = {}) {
  return Object.entries(reportInputs).reduce((volumes, [monthKey, row]) => {
    if (Number(row?.billedVolume) > 0) {
      volumes[monthKey] = row.billedVolume;
    }

    return volumes;
  }, {});
}

function buildExportMonthOptions(dashboard) {
  const optionMap = new Map();
  [
    ...((dashboard?.dailyProductionYears ?? []).flatMap((yearData) => yearData.months ?? [])),
    ...((dashboard?.monthlyProductionYears ?? []).flatMap((yearData) => yearData.rows ?? [])),
    ...((dashboard?.monthlyPowerConsumptionYears ?? []).flatMap((yearData) => yearData.rows ?? [])),
    ...((dashboard?.monthlyChemicalUsageYears ?? []).flatMap((yearData) => yearData.rows ?? [])),
  ].forEach((month) => {
    if (!month?.key) {
      return;
    }

    optionMap.set(month.key, {
      key: month.key,
      monthLabel: month.monthLabel || month.label?.replace('\n', ' ') || buildMonthYearLabels(month.key),
    });
  });

  const currentYear = getCurrentYear();
  const optionYears = Array.from(
    new Set([
      currentYear,
      ...Array.from(optionMap.keys()).map((key) => Number(String(key).slice(0, 4))).filter(Number.isFinite),
    ])
  );
  const paddedYears = new Set([...optionYears, currentYear - 1]);
  paddedYears.forEach((year) => {
    Array.from({ length: 12 }, (_item, monthIndex) => {
      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      if (!optionMap.has(key)) {
        optionMap.set(key, {
          key,
          monthLabel: buildMonthYearLabels(key),
        });
      }
    });
  });

  return [...optionMap.values()].sort((first, second) => String(first.key).localeCompare(String(second.key)));
}

function getDailyDateKeys(dashboard) {
  return (dashboard?.dailyProductionYears ?? [])
    .flatMap((yearData) => yearData.months ?? [])
    .flatMap((month) => month.rows ?? [])
    .map((row) => row.date || row.key)
    .filter(Boolean)
    .sort();
}

function isDateWithinLimits(dateKey, limits) {
  return Boolean(
    getDatePartsFromKey(dateKey) &&
    (!limits.min || dateKey >= limits.min) &&
    (!limits.max || dateKey <= limits.max)
  );
}

function normalizeSelectedExportPages(pages = SUMMARY_EXPORT_PAGE_NUMBERS) {
  const selected = new Set(
    (pages || [])
      .map((page) => Number(page))
      .filter((page) => SUMMARY_EXPORT_PAGE_NUMBERS.includes(page))
  );

  return SUMMARY_EXPORT_PAGE_NUMBERS.filter((page) => selected.has(page));
}

function ExportMonthPicker({ activePickerId, label, monthOptions = [], pickerId, setActivePickerId, value, onChange }) {
  const selectedMonthKey = value || monthOptions[monthOptions.length - 1]?.key || getCurrentMonthKey();
  const selectedYear = Number(String(selectedMonthKey).slice(0, 4)) || getCurrentYear();
  const [viewYear, setViewYear] = useState(selectedYear);
  const isOpen = activePickerId === pickerId;
  const availableYears = [...new Set(monthOptions.map((month) => Number(String(month.key).slice(0, 4))).filter(Number.isFinite))].sort((first, second) => first - second);
  const currentYearIndex = availableYears.indexOf(viewYear);
  const previousYear = currentYearIndex > 0 ? availableYears[currentYearIndex - 1] : null;
  const nextYear = currentYearIndex >= 0 && currentYearIndex < availableYears.length - 1 ? availableYears[currentYearIndex + 1] : null;
  const availableMonthKeys = new Set(monthOptions.map((month) => month.key));
  const monthRows = MONTH_SHORT_LABELS.map((_label, monthIndex) => getMonthKeyFromParts(viewYear, monthIndex + 1));

  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  return (
    <div className="summary-export-field summary-month-picker">
      <span>{label}</span>
      <button
        type="button"
        className="summary-picker-trigger summary-month-trigger"
        aria-label={label}
        aria-expanded={isOpen}
        title={buildMonthYearLabels(selectedMonthKey)}
        onClick={() => setActivePickerId(isOpen ? null : pickerId)}
      >
        <strong>{buildMonthYearLabels(selectedMonthKey)}</strong>
        <ChevronDown size={15} />
      </button>
      {isOpen ? (
        <div className="summary-month-panel">
          <div className="summary-month-head">
            <button type="button" disabled={!previousYear} aria-label="Previous year" onClick={() => previousYear && setViewYear(previousYear)}>
              <ChevronDown size={16} />
            </button>
            <strong>{viewYear}</strong>
            <button type="button" disabled={!nextYear} aria-label="Next year" onClick={() => nextYear && setViewYear(nextYear)}>
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="summary-month-grid">
            {monthRows.map((monthKey) => (
              <button
                type="button"
                className={monthKey === selectedMonthKey ? 'active' : undefined}
                disabled={!availableMonthKeys.has(monthKey)}
                key={monthKey}
                onClick={() => {
                  onChange(monthKey);
                  setActivePickerId(null);
                }}
              >
                {MONTH_SHORT_LABELS[Number(monthKey.slice(5, 7)) - 1]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExportPagesPicker({ activePickerId, pages = [], pickerId, setActivePickerId, onChange }) {
  const selectedPages = normalizeSelectedExportPages(pages);
  const selectedPageSet = new Set(selectedPages);
  const isOpen = activePickerId === pickerId;
  const label = selectedPages.length === SUMMARY_EXPORT_PAGE_NUMBERS.length
    ? 'All pages'
    : `${selectedPages.length} pages`;

  function togglePage(pageNumber) {
    const nextPages = selectedPageSet.has(pageNumber)
      ? selectedPages.filter((page) => page !== pageNumber)
      : [...selectedPages, pageNumber].sort((first, second) => first - second);

    onChange(nextPages.length ? nextPages : selectedPages);
  }

  return (
    <div className="summary-export-pages-picker">
      <button
        type="button"
        className="summary-picker-trigger summary-pages-trigger"
        aria-label="Pages to export"
        aria-expanded={isOpen}
        title="Pages to export"
        onClick={() => setActivePickerId(isOpen ? null : pickerId)}
      >
        <strong>{label}</strong>
        <ChevronDown size={15} />
      </button>
      {isOpen ? (
        <div className="summary-month-panel summary-pages-panel">
          <div className="summary-pages-grid">
            {SUMMARY_EXPORT_PAGE_NUMBERS.map((pageNumber) => (
              <button
                type="button"
                className={selectedPageSet.has(pageNumber) ? 'active' : undefined}
                key={pageNumber}
                onClick={() => togglePage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExportDatePicker({ activePickerId, label, pickerId, setActivePickerId, value, min, max, onChange }) {
  const selectedDateKey = value || max || getCurrentDateKey();
  const selectedParts = getDatePartsFromKey(selectedDateKey) || getDatePartsFromKey(getCurrentDateKey());
  const [viewMonthKey, setViewMonthKey] = useState(getMonthKeyFromParts(selectedParts.year, selectedParts.month));
  const viewParts = getDatePartsFromKey(`${viewMonthKey}-01`) || selectedParts;
  const isOpen = activePickerId === pickerId;
  const minMonthKey = min ? min.slice(0, 7) : '';
  const maxMonthKey = max ? max.slice(0, 7) : '';
  const daysInMonth = new Date(viewParts.year, viewParts.month, 0).getDate();
  const firstWeekday = new Date(viewParts.year, viewParts.month - 1, 1).getDay();
  const dayCells = [
    ...Array.from({ length: firstWeekday }, (_, index) => ({ key: `blank-${index}` })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = getDateKeyFromParts(viewParts.year, viewParts.month, day);

      return {
        day,
        disabled: (min && dateKey < min) || (max && dateKey > max),
        key: dateKey,
      };
    }),
  ];

  useEffect(() => {
    setViewMonthKey(getMonthKeyFromParts(selectedParts.year, selectedParts.month));
  }, [selectedParts.year, selectedParts.month]);

  function shiftViewMonth(offset) {
    setViewMonthKey((currentMonthKey) => {
      const parts = getDatePartsFromKey(`${currentMonthKey}-01`) || selectedParts;
      const nextDate = new Date(parts.year, parts.month - 1 + offset, 1);

      return getMonthKeyFromParts(nextDate.getFullYear(), nextDate.getMonth() + 1);
    });
  }

  return (
    <div className="summary-export-field summary-date-picker">
      <span>{label}</span>
      <button
        type="button"
        className="summary-picker-trigger summary-date-trigger"
        aria-label={label}
        aria-expanded={isOpen}
        title={getDateLabelFromKey(selectedDateKey)}
        onClick={() => setActivePickerId(isOpen ? null : pickerId)}
      >
        <strong>{getDateLabelFromKey(selectedDateKey)}</strong>
        <CalendarDays size={15} />
      </button>
      {isOpen ? (
        <div className="summary-month-panel summary-date-panel">
          <div className="summary-month-head summary-date-head">
            <button type="button" disabled={minMonthKey && viewMonthKey <= minMonthKey} aria-label="Previous month" onClick={() => shiftViewMonth(-1)}>
              <ChevronDown size={16} />
            </button>
            <strong>{buildMonthYearLabels(viewMonthKey)}</strong>
            <button type="button" disabled={maxMonthKey && viewMonthKey >= maxMonthKey} aria-label="Next month" onClick={() => shiftViewMonth(1)}>
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="summary-date-weekdays">
            {WEEKDAY_SHORT_LABELS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="summary-date-grid">
            {dayCells.map((cell) => cell.day ? (
              <button
                type="button"
                className={cell.key === selectedDateKey ? 'active' : undefined}
                disabled={cell.disabled}
                key={cell.key}
                onClick={() => {
                  onChange(cell.key);
                  setActivePickerId(null);
                }}
              >
                {cell.day}
              </button>
            ) : (
              <span aria-hidden="true" key={cell.key} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryMonthPicker({ id, isOpen, onOpenChange, onSelect, reportInputs, requiredFields, selectedMonthKey, yearOptions }) {
  const pickerRef = useRef(null);
  const selectedYear = Number(String(selectedMonthKey || '').slice(0, 4)) || getCurrentYear();
  const [viewYear, setViewYear] = useState(selectedYear);
  const sortedYears = [...yearOptions].sort((first, second) => first - second);
  const currentYearIndex = sortedYears.indexOf(viewYear);
  const previousYear = currentYearIndex > 0 ? sortedYears[currentYearIndex - 1] : null;
  const nextYear = currentYearIndex >= 0 && currentYearIndex < sortedYears.length - 1 ? sortedYears[currentYearIndex + 1] : null;
  const monthRows = MONTH_SHORT_LABELS.map((_label, monthIndex) => getMonthKey(viewYear, monthIndex));

  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onOpenChange('');
      }
    }

    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('focusin', closeOutside);

    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="summary-report-field summary-report-month-field" ref={pickerRef}>
      <span>Month-Year</span>
      <button
        type="button"
        className="summary-report-month-trigger"
        aria-expanded={isOpen}
        onClick={() => onOpenChange(isOpen ? '' : id)}
      >
        <strong>{getCompactMonthYearLabel(selectedMonthKey)}</strong>
        <ChevronDown size={16} />
      </button>
      {isOpen ? (
        <div className="summary-report-month-panel">
          <div className="summary-report-month-head">
            <button type="button" aria-label="Previous year" disabled={!previousYear} onClick={() => previousYear && setViewYear(previousYear)}>
              <ChevronDown size={16} />
            </button>
            <strong>{viewYear}</strong>
            <button type="button" aria-label="Next year" disabled={!nextYear} onClick={() => nextYear && setViewYear(nextYear)}>
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="summary-report-month-grid">
            {monthRows.map((monthKey) => {
              const status = getFieldStatus(reportInputs?.[monthKey] ?? {}, requiredFields);

              return (
                <button
                  type="button"
                  className={monthKey === selectedMonthKey ? `active ${status}` : status}
                  key={monthKey}
                  onClick={() => {
                    onSelect(monthKey);
                    onOpenChange('');
                  }}
                >
                  <strong>{MONTH_SHORT_LABELS[Number(monthKey.slice(5, 7)) - 1]}</strong>
                  <span>{status === 'added' ? 'Added' : 'Missing'}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = '0.00', step = '0.01', type = 'number' }) {
  return (
    <label className="summary-report-field">
      <span>{label}</span>
      <input
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? step : undefined}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={getNumericValue(value)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ResultCard({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function SummaryReportScreen({ dashboard, reportInputs, onReportInputsChange }) {
  const effectiveReportInputs = mergeSummaryReportInputs(REFERENCE_SUMMARY_REPORT_INPUTS, reportInputs);
  const yearOptions = getYearOptions(dashboard);
  const initialYear = yearOptions[0] || getCurrentYear();
  const fallbackMonthKey = getMonthKey(initialYear, new Date().getMonth());
  const exportMonthOptions = buildExportMonthOptions(dashboard);
  const exportDailyDateKeys = getDailyDateKeys(dashboard);
  const defaultDailyRange = getDefaultDailyExportRange();
  const defaultGraphRange = getDefaultGraphRangeMonthKeys();
  const defaultPowerCostRange = getDefaultPowerCostRangeMonthKeys();
  const exportDateLimits = {
    min: [
      exportDailyDateKeys[0],
      defaultDailyRange.startDate,
    ].filter(Boolean).sort()[0] || getCurrentDateKey(),
    max: [
      exportDailyDateKeys[exportDailyDateKeys.length - 1],
      defaultDailyRange.endDate,
      getCurrentDateKey(),
    ].filter(Boolean).sort().pop() || getCurrentDateKey(),
  };
  const [selectedMonths, setSelectedMonths] = useState(() => ({
    billed: getLatestInputMonth(effectiveReportInputs, ['billedVolume'], fallbackMonthKey),
    electric: getLatestInputMonth(effectiveReportInputs, ['totalPower', 'leyecoConsumption', 'effectiveRate'], fallbackMonthKey),
    powerCost: getLatestInputMonth(effectiveReportInputs, ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower'], fallbackMonthKey),
  }));
  const [openPickerId, setOpenPickerId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [activeExportPickerId, setActiveExportPickerId] = useState(null);
  const [exportOptions, setExportOptions] = useState(() => ({
    dailyStartDate: defaultDailyRange.startDate,
    dailyEndDate: defaultDailyRange.endDate,
    graphStartMonthKey: defaultGraphRange.startMonthKey,
    graphEndMonthKey: defaultGraphRange.endMonthKey,
    powerCostStartMonthKey: defaultPowerCostRange.startMonthKey,
    powerCostEndMonthKey: defaultPowerCostRange.endMonthKey,
    selectedPages: SUMMARY_EXPORT_PAGE_NUMBERS,
  }));
  const exportMenuRef = useRef(null);

  const requestedDailyStartDate = isDateWithinLimits(exportOptions.dailyStartDate, exportDateLimits)
    ? exportOptions.dailyStartDate
    : defaultDailyRange.startDate;
  const requestedDailyEndDate = isDateWithinLimits(exportOptions.dailyEndDate, exportDateLimits)
    ? exportOptions.dailyEndDate
    : defaultDailyRange.endDate;
  const exportDailyStartDate = requestedDailyStartDate.localeCompare(requestedDailyEndDate) <= 0
    ? requestedDailyStartDate
    : requestedDailyEndDate;
  const exportDailyEndDate = requestedDailyEndDate.localeCompare(exportDailyStartDate) >= 0
    ? requestedDailyEndDate
    : exportDailyStartDate;
  const exportGraphStartMonthKey = exportMonthOptions.some((month) => month.key === exportOptions.graphStartMonthKey)
    ? exportOptions.graphStartMonthKey
    : defaultGraphRange.startMonthKey;
  const requestedGraphEndMonthKey = exportMonthOptions.some((month) => month.key === exportOptions.graphEndMonthKey)
    ? exportOptions.graphEndMonthKey
    : defaultGraphRange.endMonthKey;
  const exportGraphEndMonthKey = requestedGraphEndMonthKey.localeCompare(exportGraphStartMonthKey) >= 0
    ? requestedGraphEndMonthKey
    : exportGraphStartMonthKey;
  const exportPowerCostStartMonthKey = exportMonthOptions.some((month) => month.key === exportOptions.powerCostStartMonthKey)
    ? exportOptions.powerCostStartMonthKey
    : defaultPowerCostRange.startMonthKey;
  const requestedPowerCostEndMonthKey = exportMonthOptions.some((month) => month.key === exportOptions.powerCostEndMonthKey)
    ? exportOptions.powerCostEndMonthKey
    : defaultPowerCostRange.endMonthKey;
  const exportPowerCostEndMonthKey = requestedPowerCostEndMonthKey.localeCompare(exportPowerCostStartMonthKey) >= 0
    ? requestedPowerCostEndMonthKey
    : exportPowerCostStartMonthKey;

  useEffect(() => {
    function closeExportMenu(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', closeExportMenu);
    document.addEventListener('focusin', closeExportMenu);

    return () => {
      document.removeEventListener('mousedown', closeExportMenu);
      document.removeEventListener('focusin', closeExportMenu);
    };
  }, []);

  useEffect(() => {
    if (!exportMenuOpen) {
      setActiveExportPickerId(null);
    }
  }, [exportMenuOpen]);

  useEffect(() => {
    if (
      exportOptions.dailyStartDate !== exportDailyStartDate ||
      exportOptions.dailyEndDate !== exportDailyEndDate ||
      exportOptions.graphStartMonthKey !== exportGraphStartMonthKey ||
      exportOptions.graphEndMonthKey !== exportGraphEndMonthKey ||
      exportOptions.powerCostStartMonthKey !== exportPowerCostStartMonthKey ||
      exportOptions.powerCostEndMonthKey !== exportPowerCostEndMonthKey
    ) {
      setExportOptions((currentOptions) => ({
        ...currentOptions,
        dailyStartDate: exportDailyStartDate,
        dailyEndDate: exportDailyEndDate,
        graphStartMonthKey: exportGraphStartMonthKey,
        graphEndMonthKey: exportGraphEndMonthKey,
        powerCostStartMonthKey: exportPowerCostStartMonthKey,
        powerCostEndMonthKey: exportPowerCostEndMonthKey,
      }));
    }
  }, [
    exportDailyEndDate,
    exportDailyStartDate,
    exportGraphEndMonthKey,
    exportGraphStartMonthKey,
    exportPowerCostEndMonthKey,
    exportPowerCostStartMonthKey,
    exportOptions.dailyEndDate,
    exportOptions.dailyStartDate,
    exportOptions.graphEndMonthKey,
    exportOptions.graphStartMonthKey,
    exportOptions.powerCostEndMonthKey,
    exportOptions.powerCostStartMonthKey,
  ]);

  function updateMonthInput(monthKey, field, value) {
    onReportInputsChange({
      ...effectiveReportInputs,
      [monthKey]: {
        ...(effectiveReportInputs?.[monthKey] ?? {}),
        [field]: value,
      },
    });
  }

  function handleSave() {
    saveSummaryReportInputs(effectiveReportInputs);
  }

  async function handleExport() {
    handleSave();
    setExporting(true);

    try {
      const reportMonthKey = String(exportDailyStartDate || exportGraphEndMonthKey || getCurrentMonthKey()).slice(0, 7);
      const reportYear = Number(String(exportGraphEndMonthKey).slice(0, 4)) || getCurrentYear();
      const monthlyProductionYears = dashboard?.monthlyProductionYears ?? [];
      const monthlyPowerConsumptionYears = dashboard?.monthlyPowerConsumptionYears ?? [];
      const monthlyChemicalUsageYears = dashboard?.monthlyChemicalUsageYears ?? [];
      const cycleMonthlyProductionYears = monthlyProductionYears.map((yearData) =>
        buildCycleMonthlyProductionYearData(dashboard, yearData, exportDailyStartDate, exportDailyEndDate)
      );
      const productionYearData = getYearDataForMonth(cycleMonthlyProductionYears, exportGraphEndMonthKey);
      const powerYearData = getYearDataForMonth(monthlyPowerConsumptionYears, exportGraphEndMonthKey);
      const chemicalYearData = getYearDataForMonth(monthlyChemicalUsageYears, exportGraphEndMonthKey);

      await exportSummaryReportPptx({
        selectedMonthlyProduction: getTrendRangeData(productionYearData, exportGraphStartMonthKey, exportGraphEndMonthKey, [
          { source: 'production', target: 'totalProduction' },
          { source: 'production', target: 'averageProduction' },
        ], cycleMonthlyProductionYears),
        selectedBilledVolumes: buildBilledVolumeInputs(effectiveReportInputs),
        selectedDailyProduction: getDailyProductionRangeData(dashboard, exportDailyStartDate, exportDailyEndDate, reportMonthKey),
        selectedPowerConsumption: getTrendRangeData(powerYearData, exportGraphStartMonthKey, exportGraphEndMonthKey, [{ source: 'totalPower', target: 'totalPower' }], monthlyPowerConsumptionYears),
        selectedChemicalUsage: getTrendRangeData(chemicalYearData, exportGraphStartMonthKey, exportGraphEndMonthKey, [
          { source: 'chlorineUsage', target: 'totalChlorine' },
          { source: 'peroxideUsage', target: 'totalPeroxide' },
        ], monthlyChemicalUsageYears),
        context: {
          reportScope: 'monthly',
          reportPeriodLabel: exportDailyStartDate === exportDailyEndDate
            ? getDateLabelFromKey(exportDailyStartDate)
            : `${getDateLabelFromKey(exportDailyStartDate)} - ${getDateLabelFromKey(exportDailyEndDate)}`,
          dailyStartDate: exportDailyStartDate,
          dailyEndDate: exportDailyEndDate,
          graphStartMonthKey: exportGraphStartMonthKey,
          graphEndMonthKey: exportGraphEndMonthKey,
          powerCostStartMonthKey: exportPowerCostStartMonthKey,
          powerCostEndMonthKey: exportPowerCostEndMonthKey,
          selectedPages: normalizeSelectedExportPages(exportOptions.selectedPages),
          reportInputs: effectiveReportInputs,
          productionYear: reportYear,
          powerYear: reportYear,
          chemicalYear: reportYear,
        },
      });
      setExportMenuOpen(false);
    } catch (error) {
      window.alert(error?.message || 'Failed to export summary report.');
    } finally {
      setExporting(false);
    }
  }

  const billedRow = effectiveReportInputs?.[selectedMonths.billed] ?? {};
  const billedVolume = parseNumber(billedRow.billedVolume);
  const referenceNrw = parseNumber(billedRow.nrw);
  const billedProduction = getMonthlyProduction(dashboard, selectedMonths.billed) || (billedVolume + referenceNrw);
  const nrw = referenceNrw || Math.max(billedProduction - billedVolume, 0);
  const nrwPercent = billedProduction > 0 ? (nrw / billedProduction) * 100 : NaN;

  const electricRow = effectiveReportInputs?.[selectedMonths.electric] ?? {};
  const plantPowerKwh = parseNumber(electricRow.totalPower);
  const leyecoConsumption = parseNumber(electricRow.leyecoConsumption);
  const effectiveRate = parseNumber(electricRow.effectiveRate);
  const calculatedElectricBill = leyecoConsumption > 0 && effectiveRate > 0
    ? leyecoConsumption * effectiveRate
    : parseNumber(electricRow.electricBill);

  const powerCostRow = effectiveReportInputs?.[selectedMonths.powerCost] ?? {};
  const powerProduction = parseNumber(powerCostRow.powerCostProduction) || getMonthlyProduction(dashboard, selectedMonths.powerCost);
  const monthlyPower = getMonthlyPower(dashboard, selectedMonths.powerCost);
  const intakeBill = parseNumber(powerCostRow.intakeBill);
  const chlorinationBill = parseNumber(powerCostRow.chlorinationBill);
  const operatingHours = parseNumber(powerCostRow.operatingHours);
  const intakePower = parseNumber(powerCostRow.deepwellPower) || monthlyPower.intakePower;
  const chlorinationPower = parseNumber(powerCostRow.chlorinationPower) || monthlyPower.chlorinationPower;
  const sec = parseNumber(powerCostRow.secOverride) || (powerProduction > 0 ? (intakePower + chlorinationPower) / powerProduction : NaN);
  const motorLoad = parseNumber(powerCostRow.motorLoadOverride) || (operatingHours > 0 ? intakePower / operatingHours : NaN);

  return (
    <section className="summary-report-page">
      <header className="summary-report-header">
        <div>
          <span className="section-icon">
            <FileText size={16} />
          </span>
          <div>
            <h3>Summary report inputs</h3>
            <p>Prepare missing monthly values before exporting the final performance review.</p>
          </div>
        </div>
        <div className="summary-export-menu" ref={exportMenuRef}>
          <button
            type="button"
            className="summary-export-button"
            disabled={exporting}
            onClick={() => setExportMenuOpen((isOpen) => !isOpen)}
            title="Export summary report to PowerPoint"
            aria-expanded={exportMenuOpen}
          >
            <Download size={16} />
            <span>{exporting ? 'Exporting...' : 'Export'}</span>
            <ChevronDown size={15} />
          </button>
          {exportMenuOpen ? (
            <div className="summary-export-panel">
              <div className="summary-export-group">
                <strong>Page 4</strong>
                <div className="summary-export-range-row">
                  <ExportDatePicker
                    activePickerId={activeExportPickerId}
                    label="Daily date from"
                    pickerId="summary-daily-start"
                    setActivePickerId={setActiveExportPickerId}
                    value={exportDailyStartDate}
                    min={exportDateLimits.min}
                    max={exportDateLimits.max}
                    onChange={(dailyStartDate) => setExportOptions((currentOptions) => ({ ...currentOptions, dailyStartDate }))}
                  />
                  <ExportDatePicker
                    activePickerId={activeExportPickerId}
                    label="Daily date to"
                    pickerId="summary-daily-end"
                    setActivePickerId={setActiveExportPickerId}
                    value={exportDailyEndDate}
                    min={exportDateLimits.min}
                    max={exportDateLimits.max}
                    onChange={(dailyEndDate) => setExportOptions((currentOptions) => ({ ...currentOptions, dailyEndDate }))}
                  />
                </div>
              </div>
              <div className="summary-export-group">
                <strong>Page 2, 3, 5 - 9</strong>
                <div className="summary-export-range-row">
                  <ExportMonthPicker
                    activePickerId={activeExportPickerId}
                    label="Monthly graphs from"
                    monthOptions={exportMonthOptions}
                    pickerId="summary-graph-start"
                    setActivePickerId={setActiveExportPickerId}
                    value={exportGraphStartMonthKey}
                    onChange={(graphStartMonthKey) => setExportOptions((currentOptions) => ({ ...currentOptions, graphStartMonthKey }))}
                  />
                  <ExportMonthPicker
                    activePickerId={activeExportPickerId}
                    label="Monthly graphs to"
                    monthOptions={exportMonthOptions}
                    pickerId="summary-graph-end"
                    setActivePickerId={setActiveExportPickerId}
                    value={exportGraphEndMonthKey}
                    onChange={(graphEndMonthKey) => setExportOptions((currentOptions) => ({ ...currentOptions, graphEndMonthKey }))}
                  />
                </div>
              </div>
              <div className="summary-export-group">
                <strong>Pages 10 - 13</strong>
                <div className="summary-export-range-row">
                  <ExportMonthPicker
                    activePickerId={activeExportPickerId}
                    label="From"
                    monthOptions={exportMonthOptions}
                    pickerId="summary-power-cost-start"
                    setActivePickerId={setActiveExportPickerId}
                    value={exportPowerCostStartMonthKey}
                    onChange={(powerCostStartMonthKey) => setExportOptions((currentOptions) => ({ ...currentOptions, powerCostStartMonthKey }))}
                  />
                  <ExportMonthPicker
                    activePickerId={activeExportPickerId}
                    label="To"
                    monthOptions={exportMonthOptions}
                    pickerId="summary-power-cost-end"
                    setActivePickerId={setActiveExportPickerId}
                    value={exportPowerCostEndMonthKey}
                    onChange={(powerCostEndMonthKey) => setExportOptions((currentOptions) => ({ ...currentOptions, powerCostEndMonthKey }))}
                  />
                </div>
              </div>
              <div className="summary-export-actions">
                <ExportPagesPicker
                  activePickerId={activeExportPickerId}
                  pages={exportOptions.selectedPages}
                  pickerId="summary-export-pages"
                  setActivePickerId={setActiveExportPickerId}
                  onChange={(selectedPages) => setExportOptions((currentOptions) => ({ ...currentOptions, selectedPages }))}
                />
                <div className="summary-export-action-buttons">
                  <button type="button" className="summary-export-cancel" onClick={() => setExportMenuOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="summary-export-confirm" disabled={exporting} onClick={handleExport}>
                    <Download size={15} />
                    PPTX
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="summary-report-form-grid">
        <section className="summary-report-form-card">
          <header>
            <div>
              <span className="section-icon">
                <Calculator size={16} />
              </span>
              <div>
                <h4>Page 3 - Billed Volume vs NRW</h4>
                <p>{getMonthLabel(selectedMonths.billed)}</p>
              </div>
            </div>
            <span className={`summary-report-status ${getFieldStatus(billedRow, ['billedVolume'])}`}>
              {getFieldStatus(billedRow, ['billedVolume']) === 'added' ? 'Added' : 'Missing'}
            </span>
          </header>
          <div className="summary-report-entry-row billed">
            <SummaryMonthPicker
              id="billed"
              isOpen={openPickerId === 'billed'}
              onOpenChange={setOpenPickerId}
              onSelect={(monthKey) => setSelectedMonths((current) => ({ ...current, billed: monthKey }))}
              reportInputs={effectiveReportInputs}
              requiredFields={['billedVolume']}
              selectedMonthKey={selectedMonths.billed}
              yearOptions={yearOptions}
            />
            <InputField label="Billed Volume m3" value={billedRow.billedVolume} onChange={(value) => updateMonthInput(selectedMonths.billed, 'billedVolume', value)} />
            <button type="button" className="summary-report-save-button" onClick={handleSave}>
              <Save size={15} />
              Save
            </button>
          </div>
          <div className="summary-report-results">
            <ResultCard label="Production" value={formatNumber(billedProduction)} />
            <ResultCard label="NRW" value={formatNumber(nrw)} />
            <ResultCard label="NRW %" value={Number.isFinite(nrwPercent) ? `${formatNumber(nrwPercent)}%` : '-'} />
          </div>
          <p className="summary-report-card-status">{getFieldStatus(billedRow, ['billedVolume']) === 'added' ? `Billed volume added for ${getMonthLabel(selectedMonths.billed)}.` : 'No billed volume saved for this month.'}</p>
        </section>

        <section className="summary-report-form-card">
          <header>
            <div>
              <span className="section-icon">
                <Zap size={16} />
              </span>
              <div>
                <h4>Page 7 - Electric Bill</h4>
                <p>{getMonthLabel(selectedMonths.electric)}</p>
              </div>
            </div>
            <span className={`summary-report-status ${getFieldStatus(electricRow, ['totalPower', 'leyecoConsumption', 'effectiveRate'])}`}>
              {getFieldStatus(electricRow, ['totalPower', 'leyecoConsumption', 'effectiveRate']) === 'added' ? 'Added' : 'Missing'}
            </span>
          </header>
          <div className="summary-report-entry-row electric">
            <SummaryMonthPicker
              id="electric"
              isOpen={openPickerId === 'electric'}
              onOpenChange={setOpenPickerId}
              onSelect={(monthKey) => setSelectedMonths((current) => ({ ...current, electric: monthKey }))}
              reportInputs={effectiveReportInputs}
              requiredFields={['totalPower', 'leyecoConsumption', 'effectiveRate']}
              selectedMonthKey={selectedMonths.electric}
              yearOptions={yearOptions}
            />
            <InputField label="Plant kWh" value={electricRow.totalPower} onChange={(value) => updateMonthInput(selectedMonths.electric, 'totalPower', value)} />
            <InputField label="LEYECO kWh" value={electricRow.leyecoConsumption} onChange={(value) => updateMonthInput(selectedMonths.electric, 'leyecoConsumption', value)} />
            <InputField label="Rate / kWh" value={electricRow.effectiveRate} onChange={(value) => updateMonthInput(selectedMonths.electric, 'effectiveRate', value)} />
            <InputField label="Electric Bill" value={calculatedElectricBill || electricRow.electricBill} onChange={(value) => updateMonthInput(selectedMonths.electric, 'electricBill', value)} />
            <button type="button" className="summary-report-save-button" onClick={handleSave}>
              <Save size={15} />
              Save
            </button>
          </div>
          <div className="summary-report-results electric">
            <ResultCard label="Plant kWh" value={formatNumber(plantPowerKwh)} />
            <ResultCard label="LEYECO kWh" value={formatNumber(leyecoConsumption)} />
            <ResultCard label="Rate / kWh" value={effectiveRate > 0 ? formatCurrency(effectiveRate) : '-'} />
            <ResultCard label="Electric Bill" value={formatCurrency(calculatedElectricBill)} />
          </div>
          <p className="summary-report-card-status">{getFieldStatus(electricRow, ['totalPower', 'leyecoConsumption', 'effectiveRate']) === 'added' ? `Electric bill inputs added for ${getMonthLabel(selectedMonths.electric)}.` : 'No electric bill inputs saved for this month.'}</p>
        </section>

        <section className="summary-report-form-card wide">
          <header>
            <div>
              <span className="section-icon">
                <Zap size={16} />
              </span>
              <div>
                <h4>Pages 10-13 - Power Cost / SEC</h4>
                <p>{getMonthLabel(selectedMonths.powerCost)}</p>
              </div>
            </div>
            <span className={`summary-report-status ${getFieldStatus(powerCostRow, ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower'])}`}>
              {getFieldStatus(powerCostRow, ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower']) === 'added' ? 'Added' : 'Missing'}
            </span>
          </header>
          <div className="summary-report-entry-row power-cost">
            <SummaryMonthPicker
              id="powerCost"
              isOpen={openPickerId === 'powerCost'}
              onOpenChange={setOpenPickerId}
              onSelect={(monthKey) => setSelectedMonths((current) => ({ ...current, powerCost: monthKey }))}
              reportInputs={effectiveReportInputs}
              requiredFields={['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower']}
              selectedMonthKey={selectedMonths.powerCost}
              yearOptions={yearOptions}
            />
            <InputField label="Intake Bill" value={powerCostRow.intakeBill} onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'intakeBill', value)} />
            <InputField label="Chlorination Bill" value={powerCostRow.chlorinationBill} onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'chlorinationBill', value)} />
            <InputField label="Operating Hours" value={powerCostRow.operatingHours} step="0.1" onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'operatingHours', value)} />
            <InputField label="Reading Date Label" type="text" placeholder={`${getMonthLabel(selectedMonths.powerCost)} reading`} value={powerCostRow.dateLabel || ''} onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'dateLabel', value)} />
            <button type="button" className="summary-report-save-button" onClick={handleSave}>
              <Save size={15} />
              Save
            </button>
          </div>
          <div className="summary-report-entry-row power-cost-extra">
            <InputField label="Production m3" value={powerCostRow.powerCostProduction} onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'powerCostProduction', value)} />
            <InputField label="Intake kWh" value={powerCostRow.deepwellPower} onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'deepwellPower', value)} />
            <InputField label="Chlorination kWh" value={powerCostRow.chlorinationPower} onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'chlorinationPower', value)} />
            <InputField label="SEC" value={powerCostRow.secOverride} step="0.01" onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'secOverride', value)} />
            <InputField label="Motor Load" value={powerCostRow.motorLoadOverride} step="0.01" onChange={(value) => updateMonthInput(selectedMonths.powerCost, 'motorLoadOverride', value)} />
          </div>
          <div className="summary-report-results power-cost">
            <ResultCard label="Intake Bill" value={formatCurrency(intakeBill)} />
            <ResultCard label="Chlorination Bill" value={formatCurrency(chlorinationBill)} />
            <ResultCard label="Intake kWh" value={formatNumber(intakePower)} />
            <ResultCard label="Chlorination kWh" value={formatNumber(chlorinationPower)} />
            <ResultCard label="SEC" value={Number.isFinite(sec) ? `${formatNumber(sec, 2)} kWh/m3` : '-'} />
            <ResultCard label="Motor Load" value={Number.isFinite(motorLoad) ? formatNumber(motorLoad, 2) : '-'} />
          </div>
          <p className="summary-report-card-status">{getFieldStatus(powerCostRow, ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower']) === 'added' ? `Power cost inputs added for ${getMonthLabel(selectedMonths.powerCost)}.` : 'No power cost inputs saved for this month.'}</p>
        </section>
      </div>
    </section>
  );
}
