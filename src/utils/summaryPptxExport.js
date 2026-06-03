const COLORS = {
  ink: '102236',
  black: '111111',
  muted: '60727C',
  teal: '0F766E',
  templateBlue: '4285F4',
  templateYellow: 'FDD966',
  templatePurple: '9900FF',
  templateGray: 'C9C9C9',
  templatePink: 'D6A0BD',
  templateTeal: '0B5D73',
  templateNavy: '0E2841',
  templateNavy2: '14283A',
  templatePanel: 'F9F9F7',
  blue: '2563EB',
  green: '16A34A',
  amber: 'F59E0B',
  deep: '11233B',
  panel: 'F8FBFC',
  border: 'D3DDE3',
  white: 'FFFFFF',
};

const DEFAULT_BILLED_VOLUME_ROWS = {
  '2025-12': { billedVolume: 5895.89, nrw: 1052.41 },
  '2026-01': { billedVolume: 7615.38, nrw: 2057.00 },
  '2026-02': { billedVolume: 6658.00, nrw: 930.31 },
  '2026-03': { billedVolume: 4837.16, nrw: 1477.01 },
  '2026-04': { billedVolume: 6629.99, nrw: 2270.81 },
};

const DEFAULT_ELECTRIC_BILL_ROWS = {
  '2025-12': { leyecoConsumption: 5777.00, effectiveRate: 11.80, electricBill: 68164.36 },
  '2026-01': { leyecoConsumption: 6310.00, effectiveRate: 14.09, electricBill: 88899.61 },
  '2026-02': { leyecoConsumption: 4037.00, effectiveRate: 11.19, electricBill: 45181.15 },
  '2026-03': { leyecoConsumption: 4338.00, effectiveRate: 13.13, electricBill: 56951.04 },
  '2026-04': { leyecoConsumption: 5491.00, effectiveRate: 11.77, electricBill: 64643.84 },
  '2026-05': { leyecoConsumption: 7657.00, effectiveRate: 10.21, electricBill: 78151.73 },
};

const DEFAULT_POWER_COST_ROWS = {
  '2026-04': {
    intakeBill: 63412.42,
    chlorinationBill: 1231.42,
    operatingHours: 550.5,
    production: 8542.2,
    sec: 0.64,
    intakeKwh: 5393,
    chlorinationKwh: 98,
    motorLoad: 9.80,
    dateLabel: 'April 21, 2026',
  },
  '2026-05': {
    intakeBill: 76584.08,
    chlorinationBill: 1567.65,
    operatingHours: 608,
    production: 9813.07,
    sec: 0.78,
    intakeKwh: 7511,
    chlorinationKwh: 146,
    motorLoad: 12.35,
    dateLabel: 'May 21, 2026',
  },
};

const TEXT_SHADOW = {
  type: 'outer',
  color: '000000',
  opacity: 0.22,
  blur: 1,
  angle: 45,
  offset: 1,
};

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

function formatCurrency(value, decimals = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return `PHP ${parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatKwh(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return `${formatNumber(parsed)} kWh`;
}

function formatPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return `${parsed >= 0 ? '+' : ''}${formatNumber(parsed, 1)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function safeText(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chartValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function makeFileDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function makeFileSafe(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function addTemplateBackground(slide) {
  slide.background = { color: COLORS.templateNavy2 };
  slide.addShape('rect', { x: 0, y: 0, w: 9.92, h: 7.5, fill: { color: COLORS.templateTeal }, line: { color: COLORS.templateTeal } });
  slide.addShape('rect', { x: 2.48, y: 0, w: 7.44, h: 7.5, fill: { color: COLORS.templateNavy, transparency: 12 }, line: { color: COLORS.templateNavy, transparency: 100 } });
  slide.addShape('rect', { x: 9.92, y: 2.04, w: 3.41, h: 5.46, fill: { color: COLORS.templateTeal }, line: { color: COLORS.templateTeal } });
  slide.addShape('rect', { x: 0, y: 3.56, w: 13.333, h: 3.94, fill: { color: COLORS.deep, transparency: 26 }, line: { color: COLORS.deep, transparency: 100 } });
}

function addWhitePanel(slide, x, y, w, h, options = {}) {
  slide.addShape(options.rounded ? 'roundRect' : 'rect', {
    x,
    y,
    w,
    h,
    fill: { color: COLORS.templatePanel },
    line: { color: COLORS.templatePanel },
  });
}

function addHeader(slide, title, subtitle) {
  slide.addText(title, {
    x: 1.28,
    y: 0.58,
    w: 10.8,
    h: 0.55,
    fontFace: 'Aptos Display',
    fontSize: 34,
    bold: true,
    italic: true,
    color: COLORS.white,
    fit: 'shrink',
    shadow: TEXT_SHADOW,
  });

  if (subtitle) {
    slide.addText(subtitle, { x: 9.52, y: 0.74, w: 2.9, h: 0.22, fontSize: 7.5, italic: true, align: 'right', color: 'D7EEF5', fit: 'shrink', shadow: TEXT_SHADOW });
  }
}

function addFooter(slide, pageNumber) {
  slide.addText('NemeXus', { x: 0.44, y: 7.16, w: 1.4, h: 0.16, fontSize: 7.5, bold: true, color: 'D7EEF5' });
  slide.addText(String(pageNumber), { x: 12.45, y: 7.16, w: 0.45, h: 0.16, fontSize: 7.5, align: 'right', color: 'D7EEF5' });
}

function addTitleSlide(pptx, reportDate, context) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addText('NEMEXUS', { x: 3.8, y: 2.28, w: 5.9, h: 0.38, align: 'center', fontFace: 'Aptos Display', fontSize: 23, bold: true, color: COLORS.black });
  slide.addText('PERFORMANCE REVIEW', { x: 3.35, y: 2.72, w: 6.8, h: 0.38, align: 'center', fontFace: 'Aptos Display', fontSize: 23, bold: true, color: COLORS.black });
  slide.addText(context.reportPeriodLabel || 'SUMMARY REPORT', {
    x: 4.78,
    y: 3.25,
    w: 3.9,
    h: 0.18,
    align: 'center',
    fontFace: 'Aptos',
    fontSize: 7.8,
    bold: true,
    color: COLORS.black,
  });
  slide.addText(
    `Generated ${formatDateTime(reportDate)}`,
    { x: 4.72, y: 3.52, w: 4.05, h: 0.18, align: 'center', fontSize: 7.2, color: COLORS.black }
  );
}

function addTable(slide, columns, rows, options = {}) {
  const tableRows = [
    columns.map((column) => ({ text: column.label, options: { bold: true, color: COLORS.white, fill: { color: COLORS.deep } } })),
    ...rows.map((row) => columns.map((column) => safeText(column.value(row)))),
  ];

  slide.addTable(tableRows, {
    x: options.x ?? 0.52,
    y: options.y ?? 1.25,
    w: options.w ?? 12.25,
    h: options.h ?? 5.75,
    border: { type: 'solid', color: COLORS.border, pt: 0.6 },
    fontSize: options.fontSize ?? 8,
    color: COLORS.ink,
  });
}

function sortRowsForChart(rows) {
  return [...(rows ?? [])].sort((first, second) => String(first.key || first.date || first.label || '').localeCompare(String(second.key || second.date || second.label || '')));
}

function formatMonthLabel(date, full = false) {
  return date.toLocaleString('en-US', {
    month: full ? 'long' : 'short',
    year: 'numeric',
  });
}

function getMonthLabelPartsFromKey(key) {
  const [year, month] = String(key || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return {
      month: safeText(key),
      year: '',
    };
  }

  return {
    month: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
    year: String(year),
  };
}

function buildMonthYearLabels(rows) {
  return [
    rows.map((row) => getMonthLabelPartsFromKey(row.key).month),
    rows.map((row) => getMonthLabelPartsFromKey(row.key).year),
  ];
}

function buildFullYearRows(rows, year) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.key, row]));
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

  return Array.from({ length: 12 }, (_item, monthIndex) => {
    const date = new Date(safeYear, monthIndex, 1);
    const key = `${safeYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    const row = rowsByKey.get(key);

    return {
      key,
      label: row?.label || formatMonthLabel(date),
      production: safeNumber(row?.production),
      readingCount: row?.readingCount ?? '',
    };
  });
}

function buildTemplateYearRows(rows, year, valueKeys = [], options = {}) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.key, row]));
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const startMonthKey = String(options.startMonthKey || '');
  const endMonthKey = String(options.endMonthKey || '');
  const allMonths = [
    new Date(safeYear - 1, 11, 1),
    ...Array.from({ length: 12 }, (_item, monthIndex) => new Date(safeYear, monthIndex, 1)),
  ];
  const months = startMonthKey || endMonthKey
    ? allMonths.filter((date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return (!startMonthKey || key.localeCompare(startMonthKey) >= 0) && (!endMonthKey || key.localeCompare(endMonthKey) <= 0);
      })
    : allMonths;

  return months.map((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const row = rowsByKey.get(key);
    const output = {
      ...(row ?? {}),
      key,
      label: row?.label || formatMonthLabel(date, true).replace(' ', '\n'),
      readingCount: row?.readingCount ?? '',
    };

    valueKeys.forEach((valueKey) => {
      if (valueKey === 'totalPower') {
        output.totalPower = safeNumber(row?.totalPower) || safeNumber(row?.chlorinationPower) + safeNumber(row?.deepwellPower);
        return;
      }

      output[valueKey] = safeNumber(row?.[valueKey]);
    });

    return output;
  });
}

function addChart(slide, chartType, data, options = {}) {
  const chartRows = data.filter((series) => series.values.some((value) => value > 0));
  const panelX = options.panelX ?? options.x ?? 1.24;
  const panelY = options.panelY ?? options.y ?? 1.26;
  const panelW = options.panelW ?? options.w ?? 10.88;
  const panelH = options.panelH ?? options.h ?? 4.9;

  if (!chartRows.length || !chartRows[0]?.labels?.length) {
    addWhitePanel(slide, panelX, panelY, panelW, panelH, { rounded: options.roundedPanel });
    slide.addShape('rect', {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      fill: { color: COLORS.templatePanel },
      line: { color: COLORS.border, pt: 0.8 },
    });
    slide.addText('No chart data available for this selection.', {
      x: panelX + 0.24,
      y: panelY + panelH / 2 - 0.12,
      w: panelW - 0.48,
      h: 0.25,
      fontSize: 12,
      bold: true,
      align: 'center',
      color: COLORS.muted,
    });
    return;
  }

  addWhitePanel(slide, panelX, panelY, panelW, panelH, { rounded: options.roundedPanel });
  slide.addChart(chartType, chartRows, {
    x: options.x ?? 1.24,
    y: options.y ?? 1.26,
    w: options.w ?? 10.88,
    h: options.h ?? 4.9,
    chartColors: options.chartColors ?? [COLORS.teal, COLORS.blue, COLORS.green, COLORS.amber],
    chartArea: options.chartArea ?? { fill: { color: COLORS.templatePanel }, border: { color: COLORS.templatePanel, pt: 0.6 } },
    plotArea: options.plotArea ?? { fill: { color: COLORS.white, transparency: 5 }, border: { color: 'E7EEF2', pt: 0.4 } },
    showLegend: chartRows.length > 1,
    legendPos: 'b',
    legendFontSize: 7,
    catAxisLabelFontSize: options.catAxisLabelFontSize ?? 7,
    catAxisLabelColor: options.catAxisLabelColor ?? COLORS.black,
    catAxisLabelFontItalic: options.catAxisLabelFontItalic ?? true,
    catAxisLabelRotate: options.catAxisLabelRotate ?? 0,
    valAxisLabelFontSize: options.valAxisLabelFontSize ?? 7,
    valAxisLabelColor: options.valAxisLabelColor ?? COLORS.black,
    valAxisLabelFontItalic: options.valAxisLabelFontItalic ?? true,
    valAxisMinVal: options.valAxisMinVal ?? 0,
    valAxisMaxVal: options.valAxisMaxVal,
    valAxisMajorUnit: options.valAxisMajorUnit,
    valGridLine: options.valGridLine ?? { color: COLORS.black, size: 0.5, style: 'solid' },
    showValue: options.showValue ?? false,
    dataLabelFontSize: options.dataLabelFontSize ?? 6.5,
    dataLabelFontBold: options.dataLabelFontBold ?? true,
    dataLabelFontItalic: options.dataLabelFontItalic ?? true,
    dataLabelColor: options.dataLabelColor ?? COLORS.black,
    dataLabelPosition: options.dataLabelPosition ?? 'ctr',
    valLabelFormatCode: options.valLabelFormatCode ?? '#,##0.00',
    dataLabelFormatCode: options.dataLabelFormatCode ?? '#,##0.00',
    barDir: 'col',
    barGrouping: options.barGrouping ?? 'clustered',
    barGapWidthPct: options.barGapWidthPct ?? 80,
    lineSize: 2.2,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 5,
    lineSmooth: false,
    title: options.title,
    showTitle: Boolean(options.title),
    titleFontSize: options.titleFontSize ?? 13,
    italic: options.titleItalic ?? true,
    titleColor: options.titleColor ?? COLORS.black,
    valAxisTitle: options.valAxisTitle,
    valAxisTitleFontSize: options.valAxisTitleFontSize ?? 9,
    valAxisTitleColor: COLORS.black,
    valAxisTitleFontFace: 'Aptos',
    altText: options.altText,
  });
}

function addChartOnlySlide(pptx, title, subtitle, chartType, chartData, pageNumber, options = {}) {
  const slide = pptx.addSlide();
  addTemplateBackground(slide);
  addHeader(slide, title, subtitle);
  const panelX = options.x ?? 0.68;
  const panelY = options.y ?? 1.38;
  const panelW = options.w ?? 12.0;
  const panelH = options.h ?? 5.42;
  const axisGutter = options.leftAxisTitle ? 1.08 : 0.48;
  const topGutter = options.topGutter ?? 0.48;
  const rightGutter = options.rightGutter ?? 0.44;
  const bottomGutter = options.bottomGutter ?? 0.72;
  const chartX = options.chartX ?? panelX + axisGutter;
  const chartY = options.chartY ?? panelY + topGutter;
  const chartW = options.chartW ?? panelW - axisGutter - rightGutter;
  const chartH = options.chartH ?? panelH - topGutter - bottomGutter;
  addChart(slide, chartType, chartData, {
    x: chartX,
    y: chartY,
    w: chartW,
    h: chartH,
    panelX,
    panelY,
    panelW,
    panelH,
    roundedPanel: true,
    ...options.chartOptions,
  });
  if (options.leftAxisTitle) {
    slide.addText(options.leftAxisTitle, {
      x: options.leftAxisTitleX ?? panelX - 0.42,
      y: options.leftAxisTitleY ?? panelY + 2.2,
      w: 2.3,
      h: 0.34,
      rotate: 270,
      fontFace: 'Aptos',
      fontSize: options.axisFontSize ?? 14,
      italic: true,
      color: COLORS.black,
      align: 'center',
      fit: 'shrink',
      shadow: TEXT_SHADOW,
    });
  }
}

function addChartSectionSlide(pptx, title, subtitle, chartType, chartData, columns, rows, pageNumber, options = {}) {
  addChartOnlySlide(pptx, title, subtitle, chartType, chartData, pageNumber, options);
}

function buildMonthlyProductionChart(rows) {
  const chartRows = sortRowsForChart(rows);
  const labels = buildMonthYearLabels(chartRows);

  return [
    {
      name: 'Production m3',
      labels,
      values: chartRows.map((row) => chartValue(row.production)),
    },
  ];
}

function buildBilledVolumeRows(productionRows = [], billedVolumes = {}) {
  return sortRowsForChart(productionRows).map((productionRow) => {
    const defaultRow = DEFAULT_BILLED_VOLUME_ROWS[productionRow.key];
    const savedBilledVolume = billedVolumes?.[productionRow.key];
    const billedVolume = safeNumber(savedBilledVolume ?? defaultRow?.billedVolume);
    const defaultTotalVolume = safeNumber(defaultRow?.billedVolume) + safeNumber(defaultRow?.nrw);
    const production = safeNumber(productionRow.production) || defaultTotalVolume;
    const nrw = billedVolume > 0 && production > 0
      ? Math.max(production - billedVolume, 0)
      : safeNumber(defaultRow?.nrw);

    const labelParts = getMonthLabelPartsFromKey(productionRow.key);

    return {
      key: productionRow.key,
      label: labelParts.month,
      yearLabel: labelParts.year,
      billedVolume,
      nrw,
      production,
    };
  });
}

function buildBilledVolumeChart(rows) {
  const chartRows = sortRowsForChart(rows);
  const labels = [
    chartRows.map((row) => safeText(row.label)),
    chartRows.map((row) => safeText(row.yearLabel)),
  ];

  return [
    {
      name: 'Billed Volume',
      labels,
      values: chartRows.map((row) => chartValue(row.billedVolume)),
    },
    {
      name: 'NRW',
      labels,
      values: chartRows.map((row) => chartValue(row.nrw)),
    },
  ];
}

function buildDailyProductionChart(rows) {
  const chartRows = sortRowsForChart(rows).slice(-31);
  return [
    {
      name: 'Production m3',
      labels: chartRows.map((row) => safeText(row.label || row.date)),
      values: chartRows.map((row) => chartValue(row.production)),
    },
  ];
}

function buildPowerChart(rows) {
  const chartRows = sortRowsForChart(rows);
  const labels = buildMonthYearLabels(chartRows);

  return [
    {
      name: 'Power kWh',
      labels,
      values: chartRows.map((row) => chartValue(safeNumber(row.totalPower) || safeNumber(row.chlorinationPower) + safeNumber(row.deepwellPower))),
    },
  ];
}

function buildMonthlyMap(rows) {
  return new Map((rows ?? []).map((row) => [row.key || row.label, row]));
}

function buildPowerUnitUsageRows(productionRows = [], powerRows = []) {
  const powerByMonth = buildMonthlyMap(powerRows);

  return sortRowsForChart(productionRows).map((productionRow) => {
    const powerRow = powerByMonth.get(productionRow.key || productionRow.label);
    const production = safeNumber(productionRow.production);
    const power = safeNumber(powerRow?.totalPower);

    return {
      key: productionRow.key,
      label: productionRow.label,
      unitUsage: production > 0 ? power / production : 0,
      production,
      power,
    };
  });
}

function getMonthDateFromKey(key) {
  const [year, month] = String(key || '').split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) ? new Date(year, month - 1, 1) : new Date();
}

function getPreviousMonthKey(key) {
  const date = getMonthDateFromKey(key);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildElectricBillRows(powerRows = [], year) {
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const powerByMonth = buildMonthlyMap(powerRows);
  const monthKeys = [
    `${safeYear - 1}-12`,
    ...Array.from({ length: 12 }, (_item, monthIndex) => `${safeYear}-${String(monthIndex + 1).padStart(2, '0')}`),
  ];

  return monthKeys.map((key) => {
    const powerRow = powerByMonth.get(key);
    const defaultRow = DEFAULT_ELECTRIC_BILL_ROWS[key] ?? {};
    const combinedConsumption = safeNumber(powerRow?.totalPower) || safeNumber(powerRow?.chlorinationPower) + safeNumber(powerRow?.deepwellPower);
    const leyecoConsumption = safeNumber(defaultRow.leyecoConsumption) || combinedConsumption;
    const effectiveRate = safeNumber(defaultRow.effectiveRate);
    const electricBill = safeNumber(defaultRow.electricBill) || (leyecoConsumption > 0 && effectiveRate > 0 ? leyecoConsumption * effectiveRate : 0);

    return {
      key,
      month: formatMonthLabel(getMonthDateFromKey(key), true),
      combinedConsumption,
      leyecoConsumption,
      effectiveRate,
      electricBill,
    };
  });
}

function buildPowerCostRows(electricBillRows = [], productionRows = [], powerRows = [], endMonthKey = '') {
  const productionByMonth = buildMonthlyMap(productionRows);
  const powerByMonth = buildMonthlyMap(powerRows);
  const defaultKeys = Object.keys(DEFAULT_POWER_COST_ROWS).sort();
  const lastDefaultKey = defaultKeys[defaultKeys.length - 1] || '';
  const comparisonEndKey = electricBillRows.some((row) => row.key === endMonthKey) ? endMonthKey : lastDefaultKey;
  const comparisonKeys = [getPreviousMonthKey(comparisonEndKey), comparisonEndKey].filter(Boolean);

  return comparisonKeys.map((key) => {
    const defaultRow = DEFAULT_POWER_COST_ROWS[key] ?? {};
    const electricRow = electricBillRows.find((row) => row.key === key) ?? {};
    const productionRow = productionByMonth.get(key);
    const powerRow = powerByMonth.get(key);
    const production = safeNumber(productionRow?.production) || safeNumber(defaultRow.production);
    const chlorinationKwh = safeNumber(powerRow?.chlorinationPower) || safeNumber(defaultRow.chlorinationKwh);
    const intakeKwh = safeNumber(powerRow?.deepwellPower) || safeNumber(defaultRow.intakeKwh);
    const operatingHours = safeNumber(defaultRow.operatingHours);
    const intakeBill = safeNumber(defaultRow.intakeBill) || safeNumber(electricRow.electricBill);
    const chlorinationBill = safeNumber(defaultRow.chlorinationBill);
    const sec = production > 0
      ? (intakeKwh + chlorinationKwh) / production
      : safeNumber(defaultRow.sec);
    const motorLoad = operatingHours > 0 ? intakeKwh / operatingHours : safeNumber(defaultRow.motorLoad);

    return {
      key,
      label: getMonthLabelPartsFromKey(key).month,
      shortLabel: getMonthDateFromKey(key).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      dateLabel: defaultRow.dateLabel || formatMonthLabel(getMonthDateFromKey(key), true),
      intakeBill,
      chlorinationBill,
      operatingHours,
      production,
      sec,
      intakeKwh,
      chlorinationKwh,
      motorLoad,
    };
  });
}

function addPlainSlideTitle(slide, title, subtitle = '') {
  slide.addText(title, {
    x: 0.72,
    y: 0.34,
    w: 11.9,
    h: 0.44,
    fontFace: 'Aptos Display',
    fontSize: 26,
    bold: true,
    color: COLORS.black,
    fit: 'shrink',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.74,
      y: 0.84,
      w: 11.4,
      h: 0.24,
      fontSize: 10,
      color: COLORS.muted,
      fit: 'shrink',
    });
  }
}

function addGridCell(slide, text, x, y, w, h, options = {}) {
  slide.addShape('rect', {
    x,
    y,
    w,
    h,
    fill: { color: options.fill ?? COLORS.white },
    line: { color: options.line ?? COLORS.white, pt: options.linePt ?? 0.45 },
  });
  slide.addText(safeText(text), {
    x: x + (options.padX ?? 0.04),
    y: y + (options.padY ?? 0.04),
    w: w - (options.padX ?? 0.04) * 2,
    h: h - (options.padY ?? 0.04) * 2,
    fontFace: 'Aptos',
    fontSize: options.fontSize ?? 8.5,
    bold: options.bold ?? false,
    color: options.color ?? COLORS.black,
    align: options.align ?? 'center',
    valign: 'mid',
    fit: 'shrink',
  });
}

function addElectricBillSlide(pptx, rows) {
  const slide = pptx.addSlide();
  addTemplateBackground(slide);
  addHeader(slide, 'ELECTRIC BILL', '');
  const rowsWithBill = rows.filter((row) => row.electricBill > 0);
  const totalBilling = rowsWithBill.reduce((total, row) => total + row.electricBill, 0);
  const averageRate = rowsWithBill.length
    ? rowsWithBill.reduce((total, row) => total + row.effectiveRate, 0) / rowsWithBill.length
    : 0;
  const x = 1.38;
  const y = 1.48;
  const widths = [1.4, 2.55, 2.35, 2.2, 2.12];
  const headerH = 0.62;
  const rowH = 0.285;
  const summaryH = 0.34;
  const headers = [
    'Month',
    'Chlorination & Intake House\nPower Consumption (kWh)',
    'LEYECO III based Total\nConsumption (kWh)',
    'Effective Rate per kWh (PHP)',
    'Electric Bill (PHP)',
  ];

  let cursorX = x;
  headers.forEach((header, index) => {
    addGridCell(slide, header, cursorX, y, widths[index], headerH, { fill: '356B52', color: COLORS.white, bold: true, fontSize: 8.4 });
    cursorX += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const rowY = y + headerH + rowIndex * rowH;
    const fill = rowIndex % 2 ? 'F1F4F4' : COLORS.white;
    const values = [
      row.month,
      row.combinedConsumption ? formatNumber(row.combinedConsumption) : '',
      row.leyecoConsumption ? formatNumber(row.leyecoConsumption) : '',
      row.effectiveRate ? formatCurrency(row.effectiveRate) : '',
      row.electricBill ? formatCurrency(row.electricBill) : '',
    ];
    cursorX = x;
    values.forEach((value, index) => {
      addGridCell(slide, value, cursorX, rowY, widths[index], rowH, { fill, line: 'EDF1F1', fontSize: 8.0, align: index === 0 ? 'center' : 'right' });
      cursorX += widths[index];
    });
  });

  const summaryY = y + headerH + rows.length * rowH + 0.18;
  cursorX = x + widths[0] + widths[1] + widths[2];
  addGridCell(slide, averageRate ? formatCurrency(averageRate) : '', cursorX, summaryY, widths[3], summaryH, { fill: COLORS.white, line: COLORS.black, bold: true, align: 'right', fontSize: 8.2 });
  addGridCell(slide, totalBilling ? formatCurrency(totalBilling) : '', cursorX + widths[3], summaryY, widths[4], summaryH, { fill: COLORS.white, line: COLORS.black, bold: true, align: 'right', fontSize: 8.2 });
  addGridCell(slide, 'Average Rate per kWh', cursorX, summaryY + summaryH, widths[3], summaryH, { fill: COLORS.white, line: COLORS.white, fontSize: 8.2 });
  addGridCell(slide, 'Total Billing', cursorX + widths[3], summaryY + summaryH, widths[4], summaryH, { fill: COLORS.white, line: COLORS.white, fontSize: 8.2 });
}

function addPowerCostTable(slide, rows, x, y, w, h, compact = false) {
  const widths = [0.16, 0.16, 0.17, 0.15, 0.15, 0.17].map((factor) => w * factor);
  const headerH = h * 0.48;
  const rowH = (h - headerH) / Math.max(rows.length, 1);
  const headers = ['Month', 'Intake Bill (PHP)', 'Chlorination Bill (PHP)', 'Operating Hours', 'Production m3', 'Specific Energy\nConsumption\n(kWh/m3)'];
  let cursorX = x;
  headers.forEach((header, index) => {
    addGridCell(slide, header, cursorX, y, widths[index], headerH, { fill: COLORS.templateTeal, color: COLORS.white, bold: true, fontSize: compact ? 8.0 : 10.0 });
    cursorX += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const values = [
      compact ? row.dateLabel : row.label,
      formatCurrency(row.intakeBill),
      formatCurrency(row.chlorinationBill),
      `${formatNumber(row.operatingHours, row.operatingHours % 1 ? 1 : 0)} hrs`,
      `${formatNumber(row.production)} m3`,
      `${formatNumber(row.sec, 2)} kWh/m3`,
    ];
    const fill = rowIndex % 2 ? 'E8ECEF' : 'CED4DA';
    const rowY = y + headerH + rowIndex * rowH;
    cursorX = x;
    values.forEach((value, index) => {
      addGridCell(slide, value, cursorX, rowY, widths[index], rowH, { fill, line: COLORS.white, bold: rowIndex === rows.length - 1, fontSize: compact ? 8.0 : 10.0 });
      cursorX += widths[index];
    });
  });
}

function buildFinancialChart(rows) {
  return [
    {
      name: 'Intake Bill',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.intakeBill)),
    },
    {
      name: 'Chlorination Bill',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.chlorinationBill)),
    },
  ];
}

function buildProductionSecChart(rows) {
  return [
    {
      name: 'Production m3',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.production)),
    },
    {
      name: 'Operating Hours',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.operatingHours * 15)),
    },
    {
      name: 'SEC x 10000',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.sec * 10000)),
    },
  ];
}

function addPowerCostAnalysisSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  addPlainSlideTitle(slide, 'POWER COST ANALYSIS:', 'EFFICIENCY LOSS AT INTAKE');
  addPowerCostTable(slide, rows, 0.62, 1.46, 12.0, 2.72, false);
}

function getCostChangeSummary(rows) {
  const previous = rows[0] ?? {};
  const latest = rows[rows.length - 1] ?? {};
  const intakeIncrease = safeNumber(latest.intakeBill) - safeNumber(previous.intakeBill);
  const chlorinationIncrease = safeNumber(latest.chlorinationBill) - safeNumber(previous.chlorinationBill);
  const totalIncrease = intakeIncrease + chlorinationIncrease;
  const intakeShare = totalIncrease ? (intakeIncrease / totalIncrease) * 100 : 0;

  return {
    previous,
    latest,
    intakeIncrease,
    chlorinationIncrease,
    intakeShare,
    productionChange: safeNumber(previous.production) ? ((safeNumber(latest.production) - safeNumber(previous.production)) / safeNumber(previous.production)) * 100 : 0,
    secChange: safeNumber(previous.sec) ? ((safeNumber(latest.sec) - safeNumber(previous.sec)) / safeNumber(previous.sec)) * 100 : 0,
    motorLoadChange: safeNumber(previous.motorLoad) ? ((safeNumber(latest.motorLoad) - safeNumber(previous.motorLoad)) / safeNumber(previous.motorLoad)) * 100 : 0,
  };
}

function addFinancialPanelSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: '2D2D2D' };
  slide.addText('FINANCIAL PANEL', { x: 3.65, y: 0.24, w: 5.8, h: 0.45, fontSize: 26, bold: true, color: COLORS.white, align: 'center', shadow: TEXT_SHADOW });
  addChart(slide, 'bar', buildFinancialChart(rows), {
    x: 1.15,
    y: 1.08,
    w: 10.6,
    h: 4.12,
    panelX: 0.78,
    panelY: 0.94,
    panelW: 11.85,
    panelH: 4.42,
    chartColors: ['43D45B', '65C9F0'],
    chartArea: { fill: { color: '2D2D2D' }, border: { color: '2D2D2D', pt: 0.6 } },
    plotArea: { fill: { color: '3A3A3A', transparency: 10 }, border: { color: '3A3A3A', pt: 0.4 } },
    showLegend: true,
    valLabelFormatCode: '#,##0.00',
    dataLabelFormatCode: '#,##0.00',
    showValue: true,
    dataLabelPosition: 'outEnd',
    dataLabelFontSize: 10,
    dataLabelColor: COLORS.white,
    catAxisLabelColor: COLORS.white,
    valAxisLabelColor: COLORS.white,
    valGridLine: { color: 'B8B8B8', size: 0.35, style: 'solid' },
    title: '',
    altText: 'Intake and chlorination bill comparison',
  });

  const summary = getCostChangeSummary(rows);
  slide.addShape('rect', { x: 0, y: 5.55, w: 13.333, h: 1.95, fill: { color: COLORS.white }, line: { color: COLORS.white } });
  slide.addText([
    { text: 'Intake Facility: ', options: { bold: true } },
    { text: `Accounted for ${formatNumber(summary.intakeShare, 0)}% of the cost increase (Spiked by ${formatCurrency(summary.intakeIncrease)}).` },
  ], { x: 2.15, y: 5.95, w: 10.2, h: 0.28, fontSize: 12.2, color: COLORS.black, fit: 'shrink' });
  slide.addText([
    { text: 'Chlorination House: ', options: { bold: true } },
    { text: `Remained stable and nominal, increasing by only ${formatCurrency(summary.chlorinationIncrease)}.` },
  ], { x: 2.15, y: 6.55, w: 10.2, h: 0.28, fontSize: 12.2, color: COLORS.black, fit: 'shrink' });
}

function addSecExplanationSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  addPowerCostTable(slide, rows, 0, 0, 8.9, 2.06, true);
  addChart(slide, 'bar', buildProductionSecChart(rows), {
    x: 1.15,
    y: 2.82,
    w: 5.7,
    h: 3.04,
    panelX: 0,
    panelY: 2.16,
    panelW: 8.35,
    panelH: 4.56,
    chartColors: ['13AEE5', '2E963E', 'F4EA00'],
    chartArea: { fill: { color: '3A3A3A' }, border: { color: '3A3A3A', pt: 0.6 } },
    plotArea: { fill: { color: '4A4A4A', transparency: 8 }, border: { color: '4A4A4A', pt: 0.4 } },
    catAxisLabelColor: COLORS.white,
    valAxisLabelColor: '31C7F8',
    valGridLine: { color: '777777', size: 0.35, style: 'solid' },
    showLegend: true,
    showValue: true,
    dataLabelFontSize: 8.2,
    dataLabelColor: COLORS.white,
    title: 'OPERATION PERFORMANCE VISUALIZATION',
    titleFontSize: 14,
    titleColor: COLORS.white,
    altText: 'Production, operating hours, and SEC comparison',
  });

  slide.addText('The SEC value tells you exactly how\nmany kilowatts of electricity your\nplant burns to process one cubic\nmeter (m) of water.', {
    x: 9.15,
    y: 0.8,
    w: 3.0,
    h: 0.92,
    fontSize: 12.5,
    color: COLORS.black,
    fit: 'shrink',
  });

  const previous = rows[0] ?? {};
  const latest = rows[rows.length - 1] ?? {};
  [
    { row: previous, y: 3.18 },
    { row: latest, y: 5.3 },
  ].forEach(({ row, y }) => {
    slide.addText(`LEYECO READING (${row.dateLabel})`, { x: 9.0, y, w: 3.2, h: 0.18, fontSize: 10.5, bold: true, italic: true, color: COLORS.black, align: 'center', fit: 'shrink' });
    slide.addText(`INTAKE READING: ${formatKwh(row.intakeKwh)}\nCHLORINATION READING: ${formatKwh(row.chlorinationKwh)}`, { x: 8.95, y: y + 0.24, w: 3.55, h: 0.38, fontSize: 10.4, bold: true, italic: true, color: COLORS.black, fit: 'shrink' });
    slide.addShape('rect', { x: 8.75, y: y + 0.72, w: 4.52, h: 0.62, fill: { color: COLORS.white }, line: { color: COLORS.black, pt: 1 } });
    slide.addText(`SEC = (${formatNumber(row.intakeKwh, 0)} kWh + ${formatNumber(row.chlorinationKwh, 0)} kWh) / ${formatNumber(row.production)} m3 = ${formatNumber(row.sec, 2)} kWh/m3`, {
      x: 8.84,
      y: y + 0.87,
      w: 4.34,
      h: 0.2,
      fontSize: 9.6,
      bold: true,
      italic: true,
      color: COLORS.black,
      fit: 'shrink',
    });
  });
}

function addSecFindingsSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  addPowerCostTable(slide, rows, 0, 0, 8.9, 2.06, true);
  addChart(slide, 'bar', buildProductionSecChart(rows), {
    x: 1.15,
    y: 2.78,
    w: 5.8,
    h: 3.18,
    panelX: 0,
    panelY: 2.16,
    panelW: 8.82,
    panelH: 4.72,
    chartColors: ['13AEE5', '2E963E', 'F4EA00'],
    chartArea: { fill: { color: '3A3A3A' }, border: { color: '3A3A3A', pt: 0.6 } },
    plotArea: { fill: { color: '4A4A4A', transparency: 8 }, border: { color: '4A4A4A', pt: 0.4 } },
    catAxisLabelColor: COLORS.white,
    valAxisLabelColor: '31C7F8',
    valGridLine: { color: '777777', size: 0.35, style: 'solid' },
    showLegend: true,
    showValue: true,
    dataLabelFontSize: 8.2,
    dataLabelColor: COLORS.white,
    title: 'OPERATION PERFORMANCE VISUALIZATION',
    titleFontSize: 14,
    titleColor: COLORS.white,
    altText: 'Production, operating hours, and SEC comparison with findings',
  });

  const summary = getCostChangeSummary(rows);
  const previous = summary.previous;
  const latest = summary.latest;
  const bullets = [
    `Water production volume increased by ${formatPercent(summary.productionChange)} (${formatNumber(latest.production)} m3).`,
    `Specific Energy Consumption (SEC) spiked by ${formatPercent(summary.secChange)}, jumping from (${formatNumber(previous.sec, 2)} kWh/m3) to (${formatNumber(latest.sec, 2)} kWh/m3).`,
    `Average hourly motor load jumped from (${formatNumber(previous.motorLoad, 2)} kW) to (${formatNumber(latest.motorLoad, 2)} kW) (${formatPercent(summary.motorLoadChange)}), proving the intake pumps are drawing significantly more current to operate just to move 1 cubic meter.`,
  ];

  bullets.forEach((text, index) => {
    slide.addText(`-  ${text}`, {
      x: 8.95,
      y: 1.15 + index * 1.52,
      w: 4.0,
      h: index === 2 ? 0.78 : 0.58,
      fontSize: 13,
      color: index === 2 ? 'FF0000' : COLORS.black,
      fit: 'shrink',
      breakLine: false,
    });
  });
}

function buildChemicalUnitUsageRows(productionRows = [], chemicalRows = [], chemicalKey) {
  const chemicalByMonth = buildMonthlyMap(chemicalRows);

  return sortRowsForChart(productionRows).map((productionRow) => {
    const chemicalRow = chemicalByMonth.get(productionRow.key || productionRow.label);
    const production = safeNumber(productionRow.production);
    const chemical = safeNumber(chemicalRow?.[chemicalKey]);

    return {
      key: productionRow.key,
      label: productionRow.label,
      unitUsage: production > 0 ? chemical / production : 0,
      production,
      chemical,
    };
  });
}

function buildUnitUsageChart(rows, name) {
  const chartRows = sortRowsForChart(rows);
  const labels = buildMonthYearLabels(chartRows);

  return [
    {
      name,
      labels,
      values: chartRows.map((row) => chartValue(row.unitUsage)),
    },
  ];
}

export async function exportSummaryReportPptx({
  selectedMonthlyProduction,
  selectedBilledVolumes,
  selectedDailyProduction,
  selectedPowerConsumption,
  selectedChemicalUsage,
  context,
}) {
  const { default: pptxgen } = await import('pptxgenjs');
  const reportDate = new Date();
  const pptx = new pptxgen();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'NemeXus';
  pptx.company = 'NemeXus';
  pptx.subject = 'NemeXus dashboard summary report';
  pptx.title = 'NemeXus Summary Report';
  pptx.lang = 'en-US';
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
    lang: 'en-US',
  };

  const pageContext = {
    reportPeriodLabel: context?.reportPeriodLabel || '',
    productionYear: context?.productionYear || '-',
    dailyProductionLabel: selectedDailyProduction?.monthLabel || '-',
    powerYear: context?.powerYear || '-',
    chemicalYear: context?.chemicalYear || '-',
    graphStartMonthKey: context?.graphStartMonthKey || '',
    graphEndMonthKey: context?.graphEndMonthKey || '',
  };
  const productionRows = selectedMonthlyProduction?.rows ?? [];
  const powerRows = selectedPowerConsumption?.rows ?? [];
  const chemicalRows = selectedChemicalUsage?.rows ?? [];
  const graphRange = {
    startMonthKey: pageContext.graphStartMonthKey,
    endMonthKey: pageContext.graphEndMonthKey,
  };
  const templateProductionRows = buildTemplateYearRows(productionRows, pageContext.productionYear, ['production'], graphRange);
  const templatePowerRows = buildTemplateYearRows(powerRows, pageContext.powerYear, ['chlorinationPower', 'deepwellPower', 'totalPower'], graphRange);
  const templateChemicalRows = buildTemplateYearRows(chemicalRows, pageContext.chemicalYear, ['chlorineUsage', 'peroxideUsage'], graphRange);
  const billedVolumeRows = buildBilledVolumeRows(templateProductionRows, selectedBilledVolumes);
  const powerUnitUsageRows = buildPowerUnitUsageRows(templateProductionRows, templatePowerRows);
  const electricBillRows = buildElectricBillRows(powerRows, pageContext.powerYear);
  const powerCostRows = buildPowerCostRows(electricBillRows, productionRows, powerRows, pageContext.graphEndMonthKey);
  const chlorineUnitUsageRows = buildChemicalUnitUsageRows(templateProductionRows, templateChemicalRows, 'chlorineUsage');
  const peroxideUnitUsageRows = buildChemicalUnitUsageRows(templateProductionRows, templateChemicalRows, 'peroxideUsage');

  addTitleSlide(pptx, reportDate, pageContext);

  let pageNumber = 2;

  addChartOnlySlide(
    pptx,
    'PRODUCTION - Monthly',
    '',
    'bar',
    buildMonthlyProductionChart(templateProductionRows),
    pageNumber,
    {
      chartOptions: {
        chartColors: [COLORS.templateBlue],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 11,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: 'Monthly Production',
        titleFontSize: 20,
        altText: 'Monthly production bar chart',
      },
      leftAxisTitle: 'Production Volume (m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.548,
      chartW: 10.96,
      chartH: 4.989,
      leftAxisTitleX: -0.114,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartOnlySlide(
    pptx,
    'Billed Volume',
    '',
    'bar',
    buildBilledVolumeChart(billedVolumeRows),
    pageNumber,
    {
      chartOptions: {
        chartColors: ['4285F4', 'F44336'],
        barGrouping: 'stacked',
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 11,
        valAxisLabelFontSize: 7,
        valAxisMaxVal: 10000,
        valAxisMajorUnit: 2500,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        title: 'Billed Volume vs NRW',
        titleFontSize: 20,
        altText: 'Billed volume and NRW stacked bar chart',
      },
      leftAxisTitle: 'Water Volume (m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.538,
      chartW: 10.96,
      chartH: 5.262,
      leftAxisTitleX: -0.098,
      leftAxisTitleY: 3.62,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'PRODUCTION - Daily',
    '',
    'bar',
    buildDailyProductionChart(selectedDailyProduction?.rows ?? []),
    [
      { label: 'Date', value: (row) => row.date || row.label },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
    ],
    selectedDailyProduction?.rows ?? [],
    pageNumber,
    {
      maxRows: 8,
      chartRowCount: Math.min(selectedDailyProduction?.rows?.length ?? 0, 31),
      chartOptions: {
        chartColors: [COLORS.templateBlue],
        catAxisLabelRotate: 45,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 7,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: `${pageContext.dailyProductionLabel} Production`,
        titleFontSize: 13,
        altText: 'Daily production bar chart',
      },
      leftAxisTitle: 'Production (m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.86,
      chartW: 10.96,
      chartH: 4.731,
      leftAxisTitleX: -0.16,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'POWER CONSUMPTION',
    '',
    'bar',
    buildPowerChart(templatePowerRows),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Chlorination kWh', value: (row) => formatNumber(row.chlorinationPower) },
      { label: 'Deepwell kWh', value: (row) => formatNumber(row.deepwellPower) },
      { label: 'Total kWh', value: (row) => formatNumber(row.totalPower) },
    ],
    templatePowerRows,
    pageNumber,
    {
      chartRowCount: selectedPowerConsumption?.rows?.length ?? 0,
      chartOptions: {
        chartColors: [COLORS.templateYellow],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: 'Monthly Power Consumption',
        titleFontSize: 20,
        altText: 'Monthly power consumption stacked bar chart',
      },
      leftAxisTitle: 'Power (kWh)',
      axisFontSize: 12,
      chartX: 1.167,
      chartY: 1.483,
      chartW: 11.073,
      chartH: 5.317,
      leftAxisTitleX: -0.227,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'POWER UNIT USAGE',
    '',
    'bar',
    buildUnitUsageChart(powerUnitUsageRows, 'kWh per m3'),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Power kWh', value: (row) => formatNumber(row.power) },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
      { label: 'kWh/m3', value: (row) => formatNumber(row.unitUsage) },
    ],
    powerUnitUsageRows,
    pageNumber,
    {
      chartRowCount: powerUnitUsageRows.length,
      chartOptions: {
        chartColors: [COLORS.templatePurple],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: 'Power Unit Usage',
        titleFontSize: 20,
        altText: 'Power unit usage bar chart',
      },
      leftAxisTitle: 'Unit usage (kWh/m3)',
      axisFontSize: 12,
      chartX: 1.142,
      chartY: 1.517,
      chartW: 11.098,
      chartH: 5.183,
    }
  );
  pageNumber += 1;

  addElectricBillSlide(pptx, electricBillRows);
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'Unit Usage - Calcium Hypochlorite',
    '',
    'bar',
    buildUnitUsageChart(chlorineUnitUsageRows, 'kg per m3'),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Chlorine kg', value: (row) => formatNumber(row.chemical) },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
      { label: 'kg/m3', value: (row) => formatNumber(row.unitUsage) },
    ],
    chlorineUnitUsageRows,
    pageNumber,
    {
      chartRowCount: chlorineUnitUsageRows.length,
      chartOptions: {
        chartColors: [COLORS.templateGray],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        dataLabelFormatCode: '#,##0.0000',
        valLabelFormatCode: '#,##0.0000',
        title: 'Chlorine Unit Usages',
        titleFontSize: 13,
        altText: 'Calcium hypochlorite unit usage bar chart',
      },
      leftAxisTitle: 'Unit Usage (PHP/m3)',
      axisFontSize: 12,
      chartX: 1.167,
      chartY: 1.492,
      chartW: 11.073,
      chartH: 5.183,
      leftAxisTitleX: -0.227,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'Unit Usage - Hydrogen Peroxide',
    '',
    'bar',
    buildUnitUsageChart(peroxideUnitUsageRows, 'L per m3'),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Peroxide L', value: (row) => formatNumber(row.chemical) },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
      { label: 'L/m3', value: (row) => formatNumber(row.unitUsage) },
    ],
    peroxideUnitUsageRows,
    pageNumber,
    {
      chartRowCount: peroxideUnitUsageRows.length,
      chartOptions: {
        chartColors: [COLORS.templatePink],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 11,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 11,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        dataLabelFormatCode: '#,##0.0000',
        valLabelFormatCode: '#,##0.0000',
        title: 'Hydrogen Peroxide Unit Usages',
        titleFontSize: 20,
        altText: 'Hydrogen peroxide unit usage bar chart',
      },
      leftAxisTitle: 'Unit Usage (PHP/m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.492,
      chartW: 10.96,
      chartH: 5.158,
      leftAxisTitleX: -0.1,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addPowerCostAnalysisSlide(pptx, powerCostRows);
  pageNumber += 1;

  addFinancialPanelSlide(pptx, powerCostRows);
  pageNumber += 1;

  addSecExplanationSlide(pptx, powerCostRows);
  pageNumber += 1;

  addSecFindingsSlide(pptx, powerCostRows);

  const periodSlug = makeFileSafe(pageContext.reportPeriodLabel);
  await pptx.writeFile({ fileName: `nemexus-summary-report-${periodSlug ? `${periodSlug}-` : ''}${makeFileDate(reportDate)}.pptx` });
}
