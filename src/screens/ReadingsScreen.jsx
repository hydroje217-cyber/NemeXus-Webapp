import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CalendarDays, ChevronDown, ChevronUp, Eye, FileText, Filter, Grid2X2, List, Search, X } from 'lucide-react';
import { listReadings } from '../services/readings';
import { aggregateDailyRows } from '../utils/production';

const CHLORINATION = 'CHLORINATION';
const DEEPWELL = 'DEEPWELL';
const ALL_SITES = 'all';
const DEFAULT_LIMIT = '50';
const NO_LIMIT = 'all';
const PAGE_SIZE = 25;
const SITE_TYPE_OPTIONS = [
  { value: ALL_SITES, label: 'All sites' },
  { value: CHLORINATION, label: 'Chlorination' },
  { value: DEEPWELL, label: 'Deepwell' },
];
const LIMIT_OPTIONS = [
  { value: '1', label: '1' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '200', label: '200' },
  { value: NO_LIMIT, label: 'No limit' },
];

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCurrentMonthDateRange() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    fromDate: formatDateInputValue(startOfMonth),
    toDate: formatDateInputValue(endOfMonth),
  };
}

function formatShortDateTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeSlot(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLogTime(value) {
  return value.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAverageValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }

  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shiftDateValue(value, amount) {
  if (!value) {
    return value;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  parsed.setDate(parsed.getDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

function getQueryLimit(value) {
  if (value === NO_LIMIT) {
    return undefined;
  }

  return Math.min(200, Math.max(1, Number(value) || Number(DEFAULT_LIMIT)));
}

function downloadBlob(content, fileName, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildTableRows(columns, rows) {
  return [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => column.render(row))),
  ];
}

function buildCsvSection(title, columns, rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    title,
    columns.map((column) => escape(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escape(column.render(row))).join(',')),
  ].join('\n');
}

function sortRowsByDateDesc(rows) {
  return [...rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function getReadingSearchText(row) {
  return [
    row.sites?.name,
    row.status,
    row.remarks,
    getShiftMatchLabel(row),
    row.submitted_profile?.full_name,
    row.submitted_profile?.email,
    row.slot_datetime,
    row.reading_datetime,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getShiftMatchLabel(row) {
  const match = row?.shift_match;

  if (!match?.shift) {
    return row?.is_daily_summary ? 'Daily summary' : '-';
  }

  const operator = match.operator?.name || 'Waiting for first reading';
  const status = {
    covered: 'Covered by',
    detected: 'Detected',
    owner: 'Started by',
    pending_first_reading: 'Pending',
    outside_shift: 'Outside shift',
  }[match.status] || match.status;

  return `${match.shift.label} ${status} ${operator}`;
}

function getReadingDetailFields(row) {
  if (!row) {
    return [];
  }

  const sharedFields = [
    ['Site', row.sites?.name || '-'],
    ['Status', row.status || '-'],
    ['Slot', formatShortDateTime(row.slot_datetime)],
    ['Recorded at', formatShortDateTime(row.reading_datetime)],
    ['Recorded by', row.submitted_profile?.full_name || row.submitted_profile?.email || '-'],
    ['Shift match', getShiftMatchLabel(row)],
    ['Remarks', row.remarks || '-'],
  ];

  const typeFields =
    row.site_type === CHLORINATION
      ? [
          ['Pressure', row.pressure_psi ?? '-'],
          ['Residual chlorine', row.rc_ppm ?? '-'],
          ['Turbidity', row.turbidity_ntu ?? '-'],
          ['pH', row.ph ?? '-'],
          ['TDS', row.tds_ppm ?? '-'],
          ['Tank level', row.tank_level_liters ?? '-'],
          ['Flowrate', row.flowrate_m3hr ?? '-'],
          ['Totalizer', row.totalizer ?? '-'],
          ['Power kWh', row.chlorination_power_kwh ?? '-'],
          ['Chlorine used', row.chlorine_consumed ?? '-'],
          ['Peroxide', row.peroxide_consumption ?? '-'],
        ]
      : [
          ['Upstream pressure', row.upstream_pressure_psi ?? '-'],
          ['Downstream pressure', row.downstream_pressure_psi ?? '-'],
          ['Flowrate', row.flowrate_m3hr ?? '-'],
          ['Frequency', row.vfd_frequency_hz ?? '-'],
          ['Voltage L1', row.voltage_l1_v ?? '-'],
          ['Voltage L2', row.voltage_l2_v ?? '-'],
          ['Voltage L3', row.voltage_l3_v ?? '-'],
          ['Amperage', row.amperage_a ?? '-'],
          ['TDS', row.tds_ppm ?? '-'],
          ['Power kWh', row.power_kwh_shift ?? '-'],
        ];

  return [...sharedFields, ...typeFields];
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getExcelColumnName(index) {
  let value = index + 1;
  let name = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - remainder) / 26);
  }

  return name;
}

function buildWorksheetXml(rows) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const cellRef = `${getExcelColumnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

async function buildXlsxBlob(sheets) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheets
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('')}
</Types>`
  );
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );
  zip.folder('xl').file(
    'workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets
    .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')}</sheets>
</workbook>`
  );
  zip.folder('xl').folder('_rels').file(
    'workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join('')}
</Relationships>`
  );

  const worksheets = zip.folder('xl').folder('worksheets');
  sheets.forEach((sheet, index) => {
    worksheets.file(`sheet${index + 1}.xml`, buildWorksheetXml(sheet.rows));
  });

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function ExportMenu({ exporting, open, onToggle, onSelect, onClose }) {
  const menuRef = useRef(null);
  const options = [
    { key: 'csv', label: '.csv', icon: FileText },
    { key: 'xlsx', label: '.xlsx', icon: Grid2X2 },
    { key: 'pdf', label: '.pdf', icon: FileText },
  ];

  useEffect(() => {
    function closeOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('focusin', closeOutside);

    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [onClose]);

  return (
    <div className="readings-export-menu" ref={menuRef}>
      <button type="button" className="export-button" disabled={exporting} onClick={onToggle}>
        <FileText size={17} />
        {exporting ? 'Exporting...' : 'Export'}
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open ? (
        <div className="export-format-list">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button type="button" key={option.key} onClick={() => onSelect(option.key)}>
                <Icon size={16} />
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function ReadingsScreen() {
  const initialDateRange = getCurrentMonthDateRange();
  const [tableMode, setTableMode] = useState(ALL_SITES);
  const [fromDate, setFromDate] = useState(initialDateRange.fromDate);
  const [toDate, setToDate] = useState(initialDateRange.toDate);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReading, setSelectedReading] = useState(null);
  const [items, setItems] = useState([]);
  const [dailyAverageRows, setDailyAverageRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportOpen, setExportOpen] = useState(false);
  const [statusLogs, setStatusLogs] = useState([]);
  const loadRequestRef = useRef(0);

  const appendStatusLog = useCallback((level, text) => {
    setStatusLogs((currentLogs) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level,
        text,
        time: formatLogTime(new Date()),
      },
      ...currentLogs,
    ].slice(0, 6));
  }, []);

  const chlorinationColumns = useMemo(
    () => [
      { key: 'date', label: 'Date', render: (row) => formatShortDateTime(row.slot_datetime).slice(0, 10) },
      { key: 'time', label: 'Time', render: (row) => formatTimeSlot(row.slot_datetime) },
      { key: 'site', label: 'Site', render: (row) => row.sites?.name || '-' },
      { key: 'pressure', label: 'Pressure', render: (row) => row.pressure_psi ?? '-' },
      { key: 'rc', label: 'RC', render: (row) => row.rc_ppm ?? '-' },
      { key: 'turbidity', label: 'Turbidity', render: (row) => row.turbidity_ntu ?? '-' },
      { key: 'ph', label: 'pH', render: (row) => row.ph ?? '-' },
      { key: 'tds', label: 'TDS', render: (row) => row.tds_ppm ?? '-' },
      { key: 'tank', label: 'Tank Level', render: (row) => row.tank_level_liters ?? '-' },
      { key: 'flowrate', label: 'Flowrate', render: (row) => row.flowrate_m3hr ?? '-' },
      { key: 'totalizer', label: 'Totalizer', render: (row) => row.totalizer ?? '-' },
      { key: 'power', label: 'Power kWh', render: (row) => row.chlorination_power_kwh ?? '-' },
      { key: 'chlorine', label: 'Chlorine Used', render: (row) => row.chlorine_consumed ?? '-' },
      { key: 'peroxide', label: 'Peroxide', render: (row) => row.peroxide_consumption ?? '-' },
      { key: 'recordedAt', label: 'Recorded At', render: (row) => formatShortDateTime(row.reading_datetime) },
      { key: 'recordedBy', label: 'Recorded By', render: (row) => row.submitted_profile?.full_name || row.submitted_profile?.email || '-' },
      { key: 'shift', label: 'Shift', render: getShiftMatchLabel },
      { key: 'remarks', label: 'Remarks', render: (row) => row.remarks || row.status || '-' },
    ],
    []
  );

  const deepwellColumns = useMemo(
    () => [
      { key: 'date', label: 'Date', render: (row) => formatShortDateTime(row.slot_datetime).slice(0, 10) },
      { key: 'time', label: 'Time', render: (row) => formatTimeSlot(row.slot_datetime) },
      { key: 'site', label: 'Site', render: (row) => row.sites?.name || '-' },
      { key: 'upstream', label: 'Upstream', render: (row) => row.upstream_pressure_psi ?? '-' },
      { key: 'downstream', label: 'Downstream', render: (row) => row.downstream_pressure_psi ?? '-' },
      { key: 'flowrate', label: 'Flowrate', render: (row) => row.flowrate_m3hr ?? '-' },
      { key: 'frequency', label: 'Frequency', render: (row) => row.vfd_frequency_hz ?? '-' },
      { key: 'l1', label: 'Volt L1', render: (row) => row.voltage_l1_v ?? '-' },
      { key: 'l2', label: 'Volt L2', render: (row) => row.voltage_l2_v ?? '-' },
      { key: 'l3', label: 'Volt L3', render: (row) => row.voltage_l3_v ?? '-' },
      { key: 'amps', label: 'Amperage', render: (row) => row.amperage_a ?? '-' },
      { key: 'tds', label: 'TDS', render: (row) => row.tds_ppm ?? '-' },
      { key: 'power', label: 'Power kWh', render: (row) => row.power_kwh_shift ?? '-' },
      { key: 'recordedAt', label: 'Recorded At', render: (row) => formatShortDateTime(row.reading_datetime) },
      { key: 'recordedBy', label: 'Recorded By', render: (row) => row.submitted_profile?.full_name || row.submitted_profile?.email || '-' },
      { key: 'shift', label: 'Shift', render: getShiftMatchLabel },
      { key: 'remarks', label: 'Remarks', render: (row) => row.remarks || row.status || '-' },
    ],
    []
  );

  const chlorinationAverageFields = useMemo(
    () => [
      { key: 'pressure', field: 'pressure_psi', label: 'AVG PRESSURE (PSI)' },
      { key: 'rc', field: 'rc_ppm', label: 'AVG RESIDUAL CHLORINE (PPM)' },
      { key: 'turbidity', field: 'turbidity_ntu', label: 'AVG TURBIDITY (NTU)' },
      { key: 'ph', field: 'ph', label: 'AVG pH' },
      { key: 'tds', field: 'tds_ppm', label: 'AVG TDS (PPM)' },
      { key: 'tank', field: 'tank_level_liters', label: 'AVG TANK LEVEL (L)' },
      { key: 'flowrate', field: 'flowrate_m3hr', label: 'AVG FLOWRATE (M3/HR)' },
      { key: 'totalizer', field: 'totalizer', label: 'TOTALIZER', aggregate: 'previousDayDifference' },
      { key: 'power', field: 'chlorination_power_kwh', label: 'POWER CONSUMPTION (KWH)', aggregate: 'previousDayDifference' },
      { key: 'chlorine', field: 'chlorine_consumed', label: 'AVG CHLORINE USED (KG)' },
      { key: 'peroxide', field: 'peroxide_consumption', label: 'AVG PEROXIDE CONSUMPTION' },
    ],
    []
  );

  const deepwellAverageFields = useMemo(
    () => [
      { key: 'upstream', field: 'upstream_pressure_psi', label: 'AVG UPSTREAM PRESSURE (PSI)' },
      { key: 'downstream', field: 'downstream_pressure_psi', label: 'AVG DOWNSTREAM PRESSURE (PSI)' },
      { key: 'flowrate', field: 'flowrate_m3hr', label: 'AVG FLOWRATE (M3/HR)' },
      { key: 'frequency', field: 'vfd_frequency_hz', label: 'AVG VFD FREQUENCY (HZ)' },
      { key: 'l1', field: 'voltage_l1_v', label: 'AVG VOLTAGE L1 (V)' },
      { key: 'l2', field: 'voltage_l2_v', label: 'AVG VOLTAGE L2 (V)' },
      { key: 'l3', field: 'voltage_l3_v', label: 'AVG VOLTAGE L3 (V)' },
      { key: 'amps', field: 'amperage_a', label: 'AVG AMPERAGE (A)' },
      { key: 'tds', field: 'tds_ppm', label: 'AVG TDS (PPM)' },
      { key: 'power', field: 'power_kwh_shift', label: 'POWER CONSUMPTION (KWH)', aggregate: 'previousDayDifference' },
    ],
    []
  );

  const allSiteColumns = useMemo(
    () => [
      { key: 'date', label: 'Date', render: (row) => formatShortDateTime(row.slot_datetime).slice(0, 10) },
      { key: 'time', label: 'Time', render: (row) => formatTimeSlot(row.slot_datetime) },
      { key: 'type', label: 'Type', render: (row) => (row.site_type === CHLORINATION ? 'Chlorination' : 'Deepwell') },
      { key: 'site', label: 'Site', render: (row) => row.sites?.name || '-' },
      { key: 'flowrate', label: 'Flowrate', render: (row) => row.flowrate_m3hr ?? '-' },
      { key: 'tds', label: 'TDS', render: (row) => row.tds_ppm ?? '-' },
      { key: 'totalizer', label: 'Totalizer', render: (row) => row.totalizer ?? '-' },
      {
        key: 'power',
        label: 'Power kWh',
        render: (row) => row.site_type === CHLORINATION ? row.chlorination_power_kwh ?? '-' : row.power_kwh_shift ?? '-',
      },
      { key: 'status', label: 'Status', render: (row) => row.status || '-' },
      { key: 'recordedAt', label: 'Recorded At', render: (row) => formatShortDateTime(row.reading_datetime) },
      { key: 'recordedBy', label: 'Recorded By', render: (row) => row.submitted_profile?.full_name || row.submitted_profile?.email || '-' },
      { key: 'shift', label: 'Shift', render: getShiftMatchLabel },
      { key: 'remarks', label: 'Remarks', render: (row) => row.remarks || row.status || '-' },
    ],
    []
  );
  const activeColumns =
    tableMode === ALL_SITES ? allSiteColumns : tableMode === CHLORINATION ? chlorinationColumns : deepwellColumns;
  const averageFields = tableMode === ALL_SITES ? [] : tableMode === CHLORINATION ? chlorinationAverageFields : deepwellAverageFields;
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const status = item.status || '';

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (normalizedSearch && !getReadingSearchText(item).includes(normalizedSearch)) {
        return false;
      }

      return true;
    });
  }, [items, searchTerm, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const visibleItems = filteredItems.slice((currentSafePage - 1) * PAGE_SIZE, currentSafePage * PAGE_SIZE);
  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.status).filter(Boolean))).sort(),
    [items]
  );
  const visibleDailyAverageRows = useMemo(() => sortRowsByDateDesc(dailyAverageRows), [dailyAverageRows]);
  const dailyAverageColumns = useMemo(
    () => [
      { key: 'date', label: 'DATE', render: (row) => row.date },
      ...averageFields.map((field) => ({
        key: field.key,
        label: field.label,
        render: (row) => formatAverageValue(row[field.key]),
      })),
    ],
    [averageFields]
  );

  async function loadHistory(nextFilters = {}) {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoading(true);

    const effectiveTableMode = nextFilters.tableMode ?? tableMode;
    const effectiveFromDate = nextFilters.fromDate ?? fromDate;
    const effectiveToDate = nextFilters.toDate ?? toDate;
    const effectiveLimit = nextFilters.limit ?? limit;
    const queryLimit = getQueryLimit(effectiveLimit);
    const effectiveSiteLabel = SITE_TYPE_OPTIONS.find((option) => option.value === effectiveTableMode)?.label || 'All sites';

    appendStatusLog(
      'loading',
      `Loading ${queryLimit ? `up to ${queryLimit} ` : 'all '}${effectiveSiteLabel.toLowerCase()} readings from ${effectiveFromDate || 'the first record'} to ${effectiveToDate || 'today'}.`
    );

    if (effectiveFromDate && effectiveToDate && effectiveFromDate > effectiveToDate) {
      if (loadRequestRef.current === requestId) {
        setItems([]);
        setDailyAverageRows([]);
        appendStatusLog('warning', 'The from date must be on or before the to date.');
        setLoading(false);
      }
      return;
    }

    try {
      const filters = {
        siteType: effectiveTableMode,
        fromDate: effectiveFromDate.trim() || undefined,
        toDate: effectiveToDate.trim() || undefined,
      };
      const averagingFilters = {
        ...filters,
        fromDate:
          effectiveTableMode === CHLORINATION && filters.fromDate
            ? shiftDateValue(filters.fromDate, -1)
            : filters.fromDate,
      };
      const fields =
        effectiveTableMode === ALL_SITES ? [] : effectiveTableMode === CHLORINATION ? chlorinationAverageFields : deepwellAverageFields;

      const [nextItems, averagingItems] = await Promise.all([
        listReadings({ ...filters, limit: queryLimit }),
        fields.length ? listReadings({ ...averagingFilters }) : Promise.resolve([]),
      ]);
      const averageRows = fields.length
        ? aggregateDailyRows(averagingItems, fields, {
            visibleFromDate: filters.fromDate,
            visibleToDate: filters.toDate,
          })
        : [];

      if (loadRequestRef.current !== requestId) {
        return;
      }

      setItems(nextItems);
      setDailyAverageRows(averageRows);
      setCurrentPage(1);
      appendStatusLog(
        'success',
        fields.length
          ? `Showing ${nextItems.length} ${effectiveTableMode.toLowerCase()} record(s) and ${averageRows.length} daily average row(s).`
          : `Showing ${nextItems.length} reading record(s).`
      );
    } catch (error) {
      if (loadRequestRef.current === requestId) {
        setItems([]);
        setDailyAverageRows([]);
        appendStatusLog('error', error.message || 'Failed to load readings.');
      }
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadHistory();
    }, 250);

    return () => window.clearTimeout(loadTimer);
  }, [fromDate, toDate, limit, tableMode]);

  useEffect(() => {
    setCurrentPage(1);
    if (items.length || searchTerm || statusFilter !== 'all') {
      appendStatusLog('info', `Filters active: ${filteredItems.length} of ${items.length} record(s) visible.`);
    }
  }, [appendStatusLog, filteredItems.length, items.length, searchTerm, tableMode, statusFilter]);

  async function handleExport(nextFormat = exportFormat) {
    if (!items.length && !dailyAverageRows.length) {
      appendStatusLog('warning', `Load some readings first before exporting to ${nextFormat.toUpperCase()}.`);
      return;
    }

    if (!filteredItems.length) {
      appendStatusLog('warning', `No records match the current filters for ${nextFormat.toUpperCase()} export.`);
      return;
    }

    setExporting(true);
    setExportOpen(false);
    appendStatusLog('loading', `Exporting ${filteredItems.length} reading record(s) as ${nextFormat.toUpperCase()}.`);

    try {
      const fileBase = `nemexus-${tableMode === ALL_SITES ? 'all-sites' : tableMode.toLowerCase()}-readings-${new Date().toISOString().slice(0, 10)}`;
      const exportSections = [
        ...(visibleDailyAverageRows.length ? [{ name: 'Daily Averages', rows: buildTableRows(dailyAverageColumns, visibleDailyAverageRows) }] : []),
        { name: 'Detailed Readings', rows: buildTableRows(activeColumns, filteredItems) },
      ];

      if (nextFormat === 'xlsx') {
        const blob = await buildXlsxBlob(exportSections);
        downloadBlob(blob, `${fileBase}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else if (nextFormat === 'pdf') {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
          import('jspdf'),
          import('jspdf-autotable'),
        ]);
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text('NemeXus Reading History', 14, 14);
        autoTable(doc, {
          head: [activeColumns.map((column) => column.label)],
          body: filteredItems.map((row) => activeColumns.map((column) => column.render(row))),
          startY: 22,
          styles: { fontSize: 6 },
          headStyles: { fillColor: [17, 35, 59] },
        });
        doc.save(`${fileBase}.pdf`);
      } else {
        const sections = exportSections.map((section) =>
          buildCsvSection(
            section.name,
            section.name === 'Daily Averages' ? dailyAverageColumns : activeColumns,
            section.name === 'Daily Averages' ? visibleDailyAverageRows : filteredItems
          )
        );
        downloadBlob(`\uFEFF${sections.join('\n\n')}`, `${fileBase}.csv`, 'text/csv;charset=utf-8;');
      }

      appendStatusLog('success', `Exported ${tableMode === ALL_SITES ? 'all sites' : tableMode.toLowerCase()} readings as ${nextFormat.toUpperCase()}.`);
    } catch (error) {
      appendStatusLog('error', error.message || 'Failed to export readings.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="readings-page">
      <section className="readings-filter-card">
        <header className="readings-filter-header">
          <div>
            <span className="readings-filter-icon">
              <Filter size={10} />
            </span>
            <h3>Office filters</h3>
          </div>
        </header>

        <div className="readings-form-grid">
          <label className="readings-field date-field">
            <span>From date</span>
            <div className="input-with-icon">
              <CalendarDays size={17} />
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
          </label>

          <label className="readings-field date-field">
            <span>To date</span>
            <div className="input-with-icon">
              <CalendarDays size={17} />
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </div>
          </label>

          <label className="readings-field limit-field">
            <span>Limit</span>
            <div className="select-with-icon">
              <List size={17} />
              <select value={limit} onChange={(event) => setLimit(event.target.value)}>
                {LIMIT_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </label>

          <label className="readings-field">
            <span>Site</span>
            <select value={tableMode} onChange={(event) => setTableMode(event.target.value)}>
              {SITE_TYPE_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="readings-field">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>

          <div className="readings-search-row">
            <label className="readings-field full">
              <span>Search</span>
              <div className="input-with-icon">
                <Search size={17} />
                <input
                  type="search"
                  value={searchTerm}
                  placeholder="Site, operator, status, remarks"
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </label>

          </div>

          <div className="readings-actions full">
            <ExportMenu
              exporting={exporting}
              open={exportOpen}
              onToggle={() => setExportOpen((current) => !current)}
              onClose={() => setExportOpen(false)}
              onSelect={(nextFormat) => {
                setExportFormat(nextFormat);
                handleExport(nextFormat);
              }}
            />
          </div>
        </div>
      </section>

      {statusLogs.length ? (
        <section className="readings-status-log" aria-label="Active status logs">
          <header>
            <span>
              <Activity size={16} />
              Active status logs
            </span>
            <button type="button" onClick={() => setStatusLogs([])}>
              Clear
            </button>
          </header>
          <div className="readings-status-log-list">
            {statusLogs.map((log) => (
              <p className={`readings-status-entry ${log.level}`} key={log.id}>
                <time>{log.time}</time>
                <span>{log.text}</span>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <h3>{SITE_TYPE_OPTIONS.find((option) => option.value === tableMode)?.label || 'All sites'} records</h3>
          <span>{filteredItems.length} of {items.length} record(s)</span>
        </div>
        <div className="table-wrap readings-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Details</th>
                {activeColumns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.length ? (
                visibleItems.map((row) => (
                  <tr key={`${row.site_type}-${row.id}`}>
                    <td>
                      <button
                        type="button"
                        className="table-icon-button"
                        aria-label="View reading details"
                        onClick={() => {
                          setSelectedReading(row);
                          appendStatusLog('info', `Opened details for ${row.sites?.name || 'reading'} recorded ${formatShortDateTime(row.reading_datetime)}.`);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                    {activeColumns.map((column) => (
                      <td key={column.key}>{column.render(row)}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={activeColumns.length + 1}>No readings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="readings-pagination">
          <span>Page {currentSafePage} of {totalPages}</span>
          <div>
            <button type="button" disabled={currentSafePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
              Previous
            </button>
            <button type="button" disabled={currentSafePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedReading ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedReading(null)}>
          <section className="reading-detail-dialog" role="dialog" aria-modal="true" aria-label="Reading details" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="dialog-close-button" aria-label="Close details" onClick={() => setSelectedReading(null)}>
              <X size={18} />
            </button>
            <div>
              <p className="eyebrow">{selectedReading.site_type === CHLORINATION ? 'Chlorination' : 'Deepwell'}</p>
              <h3>{selectedReading.sites?.name || 'Reading details'}</h3>
            </div>
            <div className="reading-detail-grid">
              {getReadingDetailFields(selectedReading).map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
