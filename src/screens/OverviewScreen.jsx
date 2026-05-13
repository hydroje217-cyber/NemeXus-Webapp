import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, Bell, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock, Droplets, FlaskConical, Grid3X3, History, Hourglass, Minus, Plus, RotateCcw, ShieldCheck, Users, X, Zap } from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MIN_CHART_ZOOM = 0.75;
const MAX_CHART_ZOOM = 2;
const CHART_ZOOM_STEP = 0.25;
const DAILY_PRODUCTION_DEFAULT_DAYS = 7;

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

function clampZoom(value) {
  return Math.min(MAX_CHART_ZOOM, Math.max(MIN_CHART_ZOOM, Number(value.toFixed(2))));
}

function ZoomControls({ zoomLevel, onZoomIn, onZoomOut, onReset }) {
  const zoomPercent = Math.round(zoomLevel * 100);
  const canZoomOut = zoomLevel > MIN_CHART_ZOOM;
  const canZoomIn = zoomLevel < MAX_CHART_ZOOM;

  return (
    <div className="chart-toolbar" aria-label="Chart zoom controls">
      <span>Zoom</span>
      <div>
        <button type="button" aria-label="Zoom out" disabled={!canZoomOut} onClick={onZoomOut}>
          <Minus size={15} />
        </button>
        <button type="button" aria-label="Reset zoom" disabled={zoomLevel === 1} onClick={onReset}>
          <RotateCcw size={14} />
          {zoomPercent}%
        </button>
        <button type="button" aria-label="Zoom in" disabled={!canZoomIn} onClick={onZoomIn}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

function ChartPanel({
  busy = false,
  title,
  titleControl,
  icon: Icon,
  summaryLabel,
  summaryValue,
  summaryHint,
  summaryItems,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onReset,
  panelRef,
  children,
}) {
  return (
    <section className={busy ? 'analytics-panel is-refreshing' : 'analytics-panel'} ref={panelRef} aria-busy={busy}>
      {busy ? <span className="panel-refresh-indicator" aria-hidden="true" /> : null}
      <header className="analytics-heading">
        <div className="analytics-title-group">
          {titleControl || (
            <>
              <span className="section-icon">
                <Icon size={16} />
              </span>
              <h3>{title}</h3>
            </>
          )}
        </div>
        <ZoomControls zoomLevel={zoomLevel} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onReset={onReset} />
      </header>
      <div className={summaryItems?.length ? 'summary-pill-grid' : undefined}>
        {(summaryItems?.length ? summaryItems : [{ label: summaryLabel, value: summaryValue, hint: summaryHint, icon: Icon }]).map((item) => {
          const SummaryIcon = item.icon || Icon;
          return (
            <div className="summary-pill" key={item.label}>
              <span className="summary-icon">
                <SummaryIcon size={18} />
              </span>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                {item.hint ? <small>{item.hint}</small> : null}
              </div>
            </div>
          );
        })}
      </div>
      {children}
    </section>
  );
}

function getChartWidth(rowCount, zoomLevel, daily = false) {
  const effectiveRowCount = daily ? Math.max(rowCount, DAILY_PRODUCTION_DEFAULT_DAYS) : rowCount;
  const baseColumnWidth = daily ? 86 : 78;
  const baseMinimumWidth = 600;
  const scaledWidth = Math.round(effectiveRowCount * baseColumnWidth * zoomLevel);

  if (daily) {
    return Math.max(360, scaledWidth);
  }

  return Math.max(baseMinimumWidth, scaledWidth);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function getStoredNumber(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const parsed = Number(window.localStorage.getItem(key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function setStoredNumber(key, value) {
  if (typeof window === 'undefined' || !Number.isFinite(value)) {
    return;
  }

  window.localStorage.setItem(key, String(value));
}

function YearDropdown({ classPrefix, isOpen, onToggle, onSelect, pickerRef, selectedYear, years }) {
  return (
    <div className={`${classPrefix}-year-picker`} ref={pickerRef}>
      <span>Year</span>
      <button
        type="button"
        className={`${classPrefix}-year-button`}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <CalendarDays size={17} />
        <strong>{selectedYear}</strong>
        <ChevronDown size={17} />
      </button>
      {isOpen ? (
        <div className={`${classPrefix}-year-menu`}>
          {years.map((year) => {
            const isSelected = selectedYear === year;

            return (
              <button
                type="button"
                key={year}
                className={isSelected ? 'active' : undefined}
                onClick={() => onSelect(year)}
              >
                <span>{year}</span>
                {isSelected ? <CheckCircle2 size={16} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function formatDailyLabel(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function padDailyRows(rows, valueKey) {
  const paddedRows = [...(rows ?? [])];

  if (paddedRows.length >= DAILY_PRODUCTION_DEFAULT_DAYS) {
    return paddedRows;
  }

  const oldestRow = paddedRows[paddedRows.length - 1];
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const oldestDate = new Date(`${oldestRow?.date || oldestRow?.key || fallbackDate}T00:00:00`);

  if (Number.isNaN(oldestDate.getTime())) {
    return paddedRows;
  }

  while (paddedRows.length < DAILY_PRODUCTION_DEFAULT_DAYS) {
    oldestDate.setDate(oldestDate.getDate() - 1);
    const dateKey = oldestDate.toISOString().slice(0, 10);
    paddedRows.push({
      key: dateKey,
      date: dateKey,
      label: formatDailyLabel(oldestDate),
      [valueKey]: 0,
    });
  }

  return paddedRows;
}

function formatAxisNumber(value) {
  return formatNumber(value, 0);
}

function TooltipContent({ active, label, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;
  if (row?.stackItems?.length) {
    return (
      <div className="chart-tooltip">
        <strong>{label}</strong>
        {[...row.stackItems].reverse().map((item) => (
          <span key={item.name} style={{ '--tooltip-color': item.fill }}>
            {item.name}: {formatNumber(item.value)}
          </span>
        ))}
      </div>
    );
  }

  const orderedPayload = [...payload].reverse();

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {orderedPayload.map((item) => (
        <span key={item.dataKey} style={{ '--tooltip-color': item.color }}>
          {item.name}: {formatNumber(item.value)}
        </span>
      ))}
    </div>
  );
}

function ChartValueLabel({ x, y, width, value }) {
  if (!value || value <= 0) {
    return null;
  }

  return (
    <text x={x + width / 2} y={y - 8} textAnchor="middle" className="recharts-total-label">
      {formatNumber(value)}
    </text>
  );
}

function StackSegmentLabel({ x, y, width, height, value, fill, payload, segment }) {
  if (!value || value <= 0 || height < 32 || width < 24) {
    return null;
  }

  const segmentFill = segment ? payload?.[`${segment}Fill`] : fill;
  const isLightFill = segmentFill === '#f59e0b' || segmentFill === '#e7a321';

  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + 4}
      textAnchor="middle"
      className={isLightFill ? 'recharts-stack-label dark' : 'recharts-stack-label'}
    >
      {formatNumber(value)}
    </text>
  );
}

function createOrderedStackRow(row, items, totalKey) {
  const orderedItems = items
    .map((item) => ({
      ...item,
      value: Number(row[item.key]) || 0,
    }))
    .sort((first, second) => second.value - first.value);
  const bottom = orderedItems[0];
  const top = orderedItems[1];
  const totalValue = Number(row[totalKey]) || orderedItems.reduce((sum, item) => sum + item.value, 0);

  return {
    ...row,
    bottomValue: bottom?.value ?? 0,
    bottomName: bottom?.name ?? '',
    bottomFill: bottom?.fill ?? '#1398aa',
    topValue: top?.value ?? 0,
    topName: top?.name ?? '',
    topFill: top?.fill ?? '#1398aa',
    [totalKey]: totalValue,
    stackItems: orderedItems,
  };
}

function stackSegmentRadius(row, segment) {
  const hasBottom = row.bottomValue > 0;
  const hasTop = row.topValue > 0;

  if (!hasBottom || !hasTop) {
    return [7, 7, 7, 7];
  }

  return segment === 'bottom' ? [0, 0, 7, 7] : [7, 7, 0, 0];
}

function SimpleBarChart({ rows, valueKey, emptyMessage, zoomLevel, daily = false }) {
  const visibleRows = daily ? padDailyRows(rows, valueKey) : (rows ?? []);
  const chartRows = visibleRows.map((row) => ({
    label: row.label,
    value: Number(row[valueKey]) || 0,
  }));
  const hasData = visibleRows.some((row) => Number(row[valueKey]) > 0);
  const chartWidth = getChartWidth(chartRows.length, zoomLevel, daily);
  const chartHeight = daily ? 330 : 290;

  return (
    <>
      <div className="chart-frame" role="img" aria-label={emptyMessage}>
        <div className="chart-scroll">
          <div className={daily ? 'chart-canvas daily-chart-canvas' : 'chart-canvas'} style={{ width: chartWidth, height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartRows} margin={{ top: 26, right: 18, left: 12, bottom: 10 }}>
                <CartesianGrid stroke="#d9e4e8" strokeDasharray="6 10" vertical={false} />
                <XAxis dataKey="label" axisLine={{ stroke: '#9fb3bd' }} tickLine={false} tick={{ fill: '#4b5d66', fontSize: 11, fontWeight: 800 }} />
                <YAxis
                  axisLine={{ stroke: '#9fb3bd' }}
                  tickLine={false}
                  tick={{ fill: '#60727c', fontSize: 11, fontWeight: 800 }}
                  tickFormatter={formatAxisNumber}
                  width={64}
                />
                <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(17, 106, 117, 0.08)' }} />
                <Bar dataKey="value" name="Production" fill="#1398aa" radius={[7, 7, 0, 0]} barSize={36}>
                  <LabelList dataKey="value" content={<ChartValueLabel />} />
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="chart-legend">
        <span><i className="legend-swatch production" />Production</span>
      </div>
      {!hasData ? <p className="chart-empty">{emptyMessage}</p> : null}
    </>
  );
}

function StackedPowerChart({ rows, zoomLevel, daily = false, emptyMessage = 'Monthly power consumption will appear after power values are saved.' }) {
  const visibleRows = rows ?? [];
  const chartRows = visibleRows.map((row) =>
    createOrderedStackRow(
      {
        label: row.label,
        chlorinationPower: Number(row.chlorinationPower) || 0,
        deepwellPower: Number(row.deepwellPower) || 0,
        totalPower: Number(row.totalPower) || 0,
      },
      [
        { key: 'chlorinationPower', name: 'Chlorination', fill: '#149a8d' },
        { key: 'deepwellPower', name: 'Deepwell', fill: '#f59e0b' },
      ],
      'totalPower'
    )
  );
  const hasData = visibleRows.some((row) => Number(row.totalPower) > 0);
  const chartWidth = getChartWidth(chartRows.length, zoomLevel, daily);
  const chartHeight = daily ? 330 : 290;

  return (
    <>
      <div className="chart-frame" role="img" aria-label={daily ? 'Daily power consumption' : 'Monthly power consumption'}>
        <div className="chart-scroll">
          <div className="chart-canvas" style={{ width: chartWidth, height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartRows} margin={{ top: 30, right: 18, left: 12, bottom: 10 }}>
                <CartesianGrid stroke="#d9e4e8" strokeDasharray="6 10" vertical={false} />
                <XAxis dataKey="label" axisLine={{ stroke: '#9fb3bd' }} tickLine={false} tick={{ fill: '#4b5d66', fontSize: 11, fontWeight: 800 }} />
                <YAxis
                  axisLine={{ stroke: '#9fb3bd' }}
                  tickLine={false}
                  tick={{ fill: '#60727c', fontSize: 11, fontWeight: 800 }}
                  tickFormatter={formatAxisNumber}
                  width={64}
                />
                <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(17, 106, 117, 0.08)' }} />
                <Legend wrapperStyle={{ display: 'none' }} />
                <Bar dataKey="bottomValue" name="Bottom" stackId="power" radius={[0, 0, 7, 7]} barSize={daily ? 22 : 36}>
                  {chartRows.map((row) => (
                    <Cell key={`${row.label}-power-bottom`} fill={row.bottomFill} radius={stackSegmentRadius(row, 'bottom')} />
                  ))}
                  <LabelList dataKey="bottomValue" content={<StackSegmentLabel segment="bottom" />} />
                </Bar>
                <Bar dataKey="topValue" name="Top" stackId="power" radius={[7, 7, 0, 0]} barSize={daily ? 22 : 36}>
                  {chartRows.map((row) => (
                    <Cell key={`${row.label}-power-top`} fill={row.topFill} radius={stackSegmentRadius(row, 'top')} />
                  ))}
                  <LabelList dataKey="topValue" content={<StackSegmentLabel segment="top" />} />
                  <LabelList dataKey="totalPower" content={<ChartValueLabel />} />
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="chart-legend">
        <span><i className="legend-swatch chlorination" />Chlorination</span>
        <span><i className="legend-swatch deepwell" />Deepwell</span>
      </div>
      {!hasData ? <p className="chart-empty">{emptyMessage}</p> : null}
    </>
  );
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getReadingTime(reading) {
  const parsed = new Date(reading?.reading_datetime || reading?.slot_datetime || reading?.created_at || '');
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isReadingInDateRange(reading, range) {
  if (range === 'all') {
    return true;
  }

  const time = getReadingTime(reading);
  if (!time) {
    return false;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (range === 'today') {
    return time >= todayStart;
  }

  if (range === '24h') {
    return time >= now.getTime() - 24 * 60 * 60 * 1000;
  }

  if (range === '7d') {
    return time >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
  }

  return true;
}

function StackedChemicalChart({ rows, zoomLevel, emptyMessage = 'Monthly chemical usage will appear after chlorine and peroxide values are saved.' }) {
  const visibleRows = rows ?? [];
  const chartRows = visibleRows.map((row) =>
    createOrderedStackRow(
      {
        label: row.label,
        chlorineUsage: Number(row.chlorineUsage) || 0,
        peroxideUsage: Number(row.peroxideUsage) || 0,
        totalUsage: Number(row.totalUsage) || 0,
      },
      [
        { key: 'chlorineUsage', name: 'Chlorine', fill: '#0f8f7c' },
        { key: 'peroxideUsage', name: 'Peroxide', fill: '#e7a321' },
      ],
      'totalUsage'
    )
  );
  const hasData = visibleRows.some((row) => Number(row.totalUsage) > 0);
  const chartWidth = getChartWidth(chartRows.length, zoomLevel);
  const chartHeight = 290;

  return (
    <>
      <div className="chart-frame" role="img" aria-label="Monthly chemical usage">
        <div className="chart-scroll">
          <div className="chart-canvas" style={{ width: chartWidth, height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={chartRows} margin={{ top: 30, right: 18, left: 12, bottom: 10 }}>
                <CartesianGrid stroke="#d9e4e8" strokeDasharray="6 10" vertical={false} />
                <XAxis dataKey="label" axisLine={{ stroke: '#9fb3bd' }} tickLine={false} tick={{ fill: '#4b5d66', fontSize: 11, fontWeight: 800 }} />
                <YAxis
                  axisLine={{ stroke: '#9fb3bd' }}
                  tickLine={false}
                  tick={{ fill: '#60727c', fontSize: 11, fontWeight: 800 }}
                  tickFormatter={formatAxisNumber}
                  width={64}
                />
                <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(17, 106, 117, 0.08)' }} />
                <Legend wrapperStyle={{ display: 'none' }} />
                <Bar dataKey="bottomValue" name="Bottom" stackId="chemical" radius={[0, 0, 7, 7]} barSize={36}>
                  {chartRows.map((row) => (
                    <Cell key={`${row.label}-chemical-bottom`} fill={row.bottomFill} radius={stackSegmentRadius(row, 'bottom')} />
                  ))}
                  <LabelList dataKey="bottomValue" content={<StackSegmentLabel segment="bottom" />} />
                </Bar>
                <Bar dataKey="topValue" name="Top" stackId="chemical" radius={[7, 7, 0, 0]} barSize={36}>
                  {chartRows.map((row) => (
                    <Cell key={`${row.label}-chemical-top`} fill={row.topFill} radius={stackSegmentRadius(row, 'top')} />
                  ))}
                  <LabelList dataKey="topValue" content={<StackSegmentLabel segment="top" />} />
                  <LabelList dataKey="totalUsage" content={<ChartValueLabel />} />
                </Bar>
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="chart-legend">
        <span><i className="legend-swatch chemical-chlorine" />Chlorine</span>
        <span><i className="legend-swatch chemical-peroxide" />Peroxide</span>
      </div>
      {!hasData ? <p className="chart-empty">{emptyMessage}</p> : null}
    </>
  );
}

function formatShortDate(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function getOperatorStatus(operator) {
  if (!operator.is_active) {
    return 'Inactive';
  }

  return operator.is_approved ? 'Approved' : 'Pending';
}

function getCurrentShift(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 7 && hour < 15) {
    return 'SHIFT A (7AM - 3PM)';
  }

  if (hour >= 15 && hour < 23) {
    return 'SHIFT B (3PM - 11PM)';
  }

  return 'SHIFT C (11PM - 7AM)';
}

function getCurrentShiftWindow(date = new Date()) {
  const start = new Date(date);
  const end = new Date(date);
  const hour = date.getHours();

  if (hour >= 7 && hour < 15) {
    start.setHours(7, 0, 0, 0);
    end.setHours(15, 0, 0, 0);
  } else if (hour >= 15 && hour < 23) {
    start.setHours(15, 0, 0, 0);
    end.setHours(23, 0, 0, 0);
  } else if (hour >= 23) {
    start.setHours(23, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(7, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 1);
    start.setHours(23, 0, 0, 0);
    end.setHours(7, 0, 0, 0);
  }

  return { start: start.getTime(), end: end.getTime() };
}

function getSiteName(reading) {
  return reading?.site?.name || reading?.sites?.name || (reading?.site_type === 'DEEPWELL' ? 'Deepwell site' : 'Chlorination site');
}

function addRangeAlert(alerts, reading, field, label, min, max, unit = '') {
  const value = Number(reading?.[field]);

  if (!Number.isFinite(value) || (value >= min && value <= max)) {
    return;
  }

  alerts.push({
    key: `${reading.site_type}-${reading.id}-${field}`,
    severity: value < min ? 'warning' : 'critical',
    title: `${label} outside target`,
    detail: `${getSiteName(reading)} reported ${value}${unit ? ` ${unit}` : ''}; target is ${min}-${max}${unit ? ` ${unit}` : ''}.`,
  });
}

export function buildOperationAlerts(dashboard) {
  const alerts = [];
  const readings = dashboard?.recentReadings ?? [];
  const now = Date.now();
  const newestReadingTime = readings.reduce((latest, reading) => Math.max(latest, getReadingTime(reading)), 0);
  const { start, end } = getCurrentShiftWindow(new Date());
  const currentShiftReadings = readings.filter((reading) => {
    const time = getReadingTime(reading);
    return time >= start && time < end;
  });

  if (newestReadingTime && now - newestReadingTime > 8 * 60 * 60 * 1000) {
    alerts.push({
      key: 'stale-readings',
      severity: 'critical',
      title: 'No recent readings',
      detail: `Latest reading was ${formatDateTime(newestReadingTime)}.`,
    });
  }

  ['CHLORINATION', 'DEEPWELL'].forEach((siteType) => {
    if (!currentShiftReadings.some((reading) => reading.site_type === siteType)) {
      alerts.push({
        key: `missing-${siteType}`,
        severity: 'warning',
        title: `${siteType === 'CHLORINATION' ? 'Chlorination' : 'Deepwell'} shift reading missing`,
        detail: `No ${siteType.toLowerCase()} reading has been received for ${getCurrentShift()}.`,
      });
    }
  });

  readings.slice(0, 20).forEach((reading) => {
    if (reading.site_type === 'CHLORINATION') {
      addRangeAlert(alerts, reading, 'ph', 'pH', 6.5, 8.5);
      addRangeAlert(alerts, reading, 'rc_ppm', 'Residual chlorine', 0.2, 2, 'ppm');
      addRangeAlert(alerts, reading, 'turbidity_ntu', 'Turbidity', 0, 5, 'NTU');
      addRangeAlert(alerts, reading, 'pressure_psi', 'Pressure', 15, 100, 'psi');
    }

    if (reading.site_type === 'DEEPWELL') {
      addRangeAlert(alerts, reading, 'tds_ppm', 'TDS', 0, 500, 'ppm');
      addRangeAlert(alerts, reading, 'upstream_pressure_psi', 'Upstream pressure', 15, 120, 'psi');
      addRangeAlert(alerts, reading, 'downstream_pressure_psi', 'Downstream pressure', 15, 120, 'psi');
    }
  });

  if (dashboard?.pendingApprovals?.length) {
    alerts.push({
      key: 'pending-approvals',
      severity: 'info',
      title: 'Operator approvals waiting',
      detail: `${dashboard.pendingApprovals.length} operator account(s) need admin review.`,
    });
  }

  return alerts.slice(0, 8);
}

function PendingApprovalNotice({ dashboard, onOpenApprovals }) {
  const [dismissed, setDismissed] = useState(false);
  const pendingCount = dashboard?.pendingApprovals?.length ?? 0;

  useEffect(() => {
    if (!pendingCount) {
      setDismissed(false);
    }
  }, [pendingCount]);

  if (!pendingCount || dismissed) {
    return null;
  }

  return (
    <section className="pending-approval-notice">
      <div>
        <span className="pending-approval-icon">
          <Bell size={18} />
        </span>
        <div>
          <h3>Pending approvals <strong>{pendingCount}</strong></h3>
          <p>{pendingCount} operator account(s) need your review.</p>
          <button type="button" onClick={onOpenApprovals}>
            Open approvals
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <button type="button" className="pending-dismiss-button" aria-label="Dismiss pending approvals" onClick={() => setDismissed(true)}>
        <X size={18} />
      </button>
    </section>
  );
}

function LiveSummaryPanel({ dashboard, panelRef }) {
  const stats = dashboard?.stats ?? {};
  const summaryItems = [
    { label: 'Operators', value: stats.totalOperators ?? 0, icon: Users },
    { label: 'Approved', value: stats.approvedOperators ?? 0, icon: CheckCircle2 },
    { label: 'Pending', value: stats.pendingOperators ?? 0, icon: Clock },
    { label: 'Sites', value: stats.totalSites ?? 0, icon: Building2 },
    { label: 'Readings today', value: stats.todayReadings ?? 0, icon: History },
  ];

  return (
    <section className="live-summary-panel" ref={panelRef}>
      <header className="operation-alerts-heading">
        <span className="section-icon">
          <Zap size={16} />
        </span>
        <div>
          <h3>Live summary</h3>
          <p>Registrations, approvals, sites, and reading activity.</p>
        </div>
      </header>
      <div className="live-summary-grid">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className="live-summary-card" key={item.label}>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
              <span className="live-summary-icon">
                <Icon size={17} />
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function OperationAlertsPanel({ dashboard, panelRef }) {
  const alerts = buildOperationAlerts(dashboard);
  const hasAlerts = alerts.length > 0;

  return (
    <section
      className={hasAlerts ? 'operation-alerts-panel has-alerts' : 'operation-alerts-panel'}
      ref={panelRef}
    >
      <header className="operation-alerts-heading">
        <span className="section-icon">
          {hasAlerts ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
        </span>
        <div>
          <h3>Operations alerts</h3>
          <p>{hasAlerts ? `${alerts.length} item(s) need attention` : 'No active operating alerts from recent readings.'}</p>
        </div>
      </header>

      <div className={alerts.length >= 3 ? 'operation-alert-scroll has-peek' : 'operation-alert-scroll'}>
        {hasAlerts ? (
          <div className="operation-alert-grid">
            {alerts.map((alert) => (
              <article className={`operation-alert-card ${alert.severity}`} key={alert.key}>
                <div className="operation-alert-card-head">
                  <strong>{alert.title}</strong>
                  <span className={`alert-severity-badge ${alert.severity}`}>{alert.severity}</span>
                </div>
                <p>{alert.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="chart-empty">No active operating alerts.</p>
        )}
      </div>
    </section>
  );
}

function OverviewTopPanels({ activeSection, dashboard, isAdmin, onOpenApprovals, operationsRef, summaryRef }) {
  return (
    <>
      <PendingApprovalNotice dashboard={dashboard} onOpenApprovals={onOpenApprovals} />
      <div className={isAdmin ? `overview-top-grid active-${activeSection}` : `overview-top-grid summary-hidden active-${activeSection}`}>
        {isAdmin ? <LiveSummaryPanel dashboard={dashboard} panelRef={summaryRef} /> : null}
        <OperationAlertsPanel dashboard={dashboard} panelRef={operationsRef} />
      </div>
    </>
  );
}

function getReadingTimestamp(reading) {
  return reading?.slot_datetime || reading?.reading_datetime || reading?.created_at || '';
}

function getReadingOperatorName(reading) {
  return (
    reading?.submitted_profile?.full_name ||
    reading?.submitted_profile?.email ||
    reading?.shift_match?.operator?.name ||
    ''
  );
}

function getCurrentShiftOperator(readings, now = new Date()) {
  const { shift, start, end } = getShiftWindow('current', now);
  const firstReading = (readings ?? [])
    .filter((reading) => {
      const operatorName = getReadingOperatorName(reading);
      const timestamp = new Date(getReadingTimestamp(reading));

      return operatorName && !Number.isNaN(timestamp.getTime()) && timestamp >= start && timestamp < end;
    })
    .sort((first, second) => new Date(getReadingTimestamp(first)).getTime() - new Date(getReadingTimestamp(second)).getTime())[0];

  return {
    shift,
    operatorName: getReadingOperatorName(firstReading),
  };
}

function isCurrentShiftOperator(operator, currentShiftOperator) {
  if (!currentShiftOperator.operatorName) {
    return false;
  }

  const operatorName = operator.full_name || operator.email || '';
  return operatorName.toLowerCase() === currentShiftOperator.operatorName.toLowerCase();
}

function OperatorsPanel({ operators, readings, panelRef }) {
  const [currentShift, setCurrentShift] = useState(() => getCurrentShift());
  const currentShiftOperator = getCurrentShiftOperator(readings);
  const operatorRows = (operators ?? [])
    .filter((operator) => operator.role === 'operator')
    .sort((first, second) => {
      const firstIsCurrentShift = isCurrentShiftOperator(first, currentShiftOperator);
      const secondIsCurrentShift = isCurrentShiftOperator(second, currentShiftOperator);

      if (firstIsCurrentShift !== secondIsCurrentShift) {
        return firstIsCurrentShift ? -1 : 1;
      }

      const firstName = first.full_name || first.email || '';
      const secondName = second.full_name || second.email || '';
      return firstName.localeCompare(secondName);
    });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentShift(getCurrentShift());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="operator-list-panel" ref={panelRef}>
      <header className="recent-readings-heading operator-heading">
        <div>
          <span className="section-icon">
            <Users size={16} />
          </span>
          <div>
            <h3>Operators</h3>
            <p>{operatorRows.length} operator account(s)</p>
          </div>
        </div>
        <div className="operator-shift-summary">
          <strong className="operator-current-shift">
            {currentShiftOperator.operatorName ? `${currentShiftOperator.operatorName}'s shift` : 'Waiting for first reading'}
          </strong>
          <strong className="operator-shift-badge">{currentShift}</strong>
        </div>
      </header>

      {!operatorRows.length ? (
        <p className="chart-empty">No operator accounts found.</p>
      ) : (
        <div className="operator-card-scroll">
          <div className="operator-card-grid">
            {operatorRows.map((operator) => {
              const status = getOperatorStatus(operator);
              const isShiftOperator = isCurrentShiftOperator(operator, currentShiftOperator);
              return (
                <article className={isShiftOperator ? 'operator-card current-shift-operator' : 'operator-card'} key={operator.id}>
                  <div className="recent-reading-topline">
                    <div>
                      <h4>{operator.full_name || operator.email || 'Operator'}</h4>
                      <span>{isShiftOperator ? 'Current shift operator' : 'Operator'}</span>
                    </div>
                  </div>

                  <div className="recent-reading-meta">
                    <div>
                      <span>Email</span>
                      <strong>{operator.email || '-'}</strong>
                    </div>
                    <div>
                      <span>Created</span>
                      <strong>{formatShortDate(operator.created_at)}</strong>
                    </div>
                  </div>

                  <p>Role: {operator.role || 'operator'}</p>
                  <p>Status: {status}</p>
                  <p>Approved: {operator.approved_at ? formatDateTime(operator.approved_at) : 'Not approved yet'}</p>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function RecentReadingCard({ reading }) {
  const isDeepwell = reading.site_type === 'DEEPWELL';
  const submittedBy = reading.submitted_profile?.full_name || reading.submitted_profile?.email || '-';
  const metricLabel = isDeepwell ? 'Power kWh' : 'Totalizer';
  const metricValue = isDeepwell ? (reading.power_kwh_shift ?? '-') : (reading.totalizer ?? '-');

  return (
    <article className={isDeepwell ? 'recent-reading-card deepwell' : 'recent-reading-card chlorination'}>
      <div className="recent-reading-topline">
        <div>
          <h4>{reading.site?.name || reading.sites?.name || (isDeepwell ? 'Deepwell reading' : 'Chlorination reading')}</h4>
          <span>{isDeepwell ? 'Deepwell' : 'Chlorination'}</span>
        </div>
        <strong>{reading.status || 'submitted'}</strong>
      </div>
      <div className="recent-reading-meta">
        <div>
          <span>Operator</span>
          <strong>{submittedBy}</strong>
        </div>
        <div>
          <span>Slot</span>
          <strong>{formatDateTime(reading.slot_datetime || reading.reading_datetime)}</strong>
        </div>
      </div>
      <p>Submitted: {formatDateTime(reading.reading_datetime || reading.created_at)}</p>
      <p>{metricLabel}: {metricValue}</p>
    </article>
  );
}

function formatCheckpointTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSlotStartTime(value) {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  parsed.setMinutes(parsed.getMinutes() < 30 ? 0 : 30, 0, 0);
  return parsed.getTime();
}

function getShiftWindow(shiftKey, now = new Date()) {
  const currentHour = now.getHours();
  if (shiftKey === 'elapsed') {
    const start = new Date(now);
    const end = new Date(getSlotStartTime(now) + 30 * 60 * 1000);

    if (currentHour < 7) {
      start.setDate(start.getDate() - 1);
    }

    start.setHours(7, 0, 0, 0);
    return { shift: 'elapsed', start, end };
  }

  const resolvedShift =
    shiftKey === 'current'
      ? currentHour >= 7 && currentHour < 15
        ? 'A'
        : currentHour >= 15 && currentHour < 23
          ? 'B'
          : 'C'
      : shiftKey;
  const start = new Date(now);
  const end = new Date(now);

  if (resolvedShift === 'A') {
    start.setHours(7, 0, 0, 0);
    end.setHours(15, 0, 0, 0);
  } else if (resolvedShift === 'B') {
    start.setHours(15, 0, 0, 0);
    end.setHours(23, 0, 0, 0);
  } else {
    if (currentHour < 7) {
      start.setDate(start.getDate() - 1);
    }

    start.setHours(23, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 1);
    end.setHours(7, 0, 0, 0);
  }

  return { shift: resolvedShift, start, end };
}

function buildCheckpointSites(readings, siteType) {
  const siteMap = new Map();

  (readings ?? []).forEach((reading) => {
    if (siteType !== 'all' && reading.site_type !== siteType) {
      return;
    }

    const id = `${reading.site_type}:${reading.site?.name || reading.sites?.name || reading.site_id || 'main'}`;
    siteMap.set(id, {
      id,
      siteType: reading.site_type,
      name: reading.site?.name || reading.sites?.name || (reading.site_type === 'DEEPWELL' ? 'Main Deepwell' : 'Main Chlorination'),
    });
  });

  if (!siteMap.size) {
    if (siteType === 'all' || siteType === 'CHLORINATION') {
      siteMap.set('CHLORINATION:main', { id: 'CHLORINATION:main', siteType: 'CHLORINATION', name: 'Main Chlorination' });
    }

    if (siteType === 'all' || siteType === 'DEEPWELL') {
      siteMap.set('DEEPWELL:main', { id: 'DEEPWELL:main', siteType: 'DEEPWELL', name: 'Main Deepwell' });
    }
  }

  return Array.from(siteMap.values()).sort((first, second) => first.siteType.localeCompare(second.siteType));
}

function buildCheckpointData(readings, { now, siteType, shift }) {
  const { start, end } = getShiftWindow(shift, now);
  const currentSlotStart = getSlotStartTime(now);
  const sites = buildCheckpointSites(readings, siteType);
  const matchingReadings = (readings ?? []).filter((reading) => siteType === 'all' || reading.site_type === siteType);
  const readingsBySlot = new Map();

  matchingReadings.forEach((reading) => {
    const slotTime = getSlotStartTime(reading.slot_datetime || reading.reading_datetime || reading.created_at);
    const siteName = reading.site?.name || reading.sites?.name || (reading.site_type === 'DEEPWELL' ? 'Main Deepwell' : 'Main Chlorination');
    const key = `${slotTime}:${reading.site_type}:${siteName}`;
    const current = readingsBySlot.get(key);

    if (!current || getReadingTime(reading) > getReadingTime(current)) {
      readingsBySlot.set(key, reading);
    }
  });

  const rows = [];
  const stats = { complete: 0, missing: 0, upcoming: 0 };

  for (let time = start.getTime(); time < end.getTime(); time += 30 * 60 * 1000) {
    const slotStart = new Date(time);
    const slotEnd = new Date(time + 29 * 60 * 1000);
    const isFuture = time > currentSlotStart;

    if (isFuture) {
      stats.upcoming += sites.length;
      continue;
    }

    const items = sites.map((site) => {
      const reading = readingsBySlot.get(`${time}:${site.siteType}:${site.name}`);
      const operator = getReadingOperatorName(reading) || 'Operator';

      return {
        key: site.id,
        name: site.name,
        complete: Boolean(reading),
        operator,
      };
    });
    const completeCount = items.filter((item) => item.complete).length;
    const missingCount = items.length - completeCount;

    stats.complete += completeCount;
    stats.missing += missingCount;

    rows.push({
      key: String(time),
      label: formatCheckpointTime(slotStart),
      rangeLabel: `${formatCheckpointTime(slotStart)}-${formatCheckpointTime(slotEnd)}`,
      status: time === currentSlotStart && missingCount ? 'due' : missingCount ? 'missing' : 'complete',
      badge: time === currentSlotStart && missingCount ? 'Due now' : missingCount ? 'Missing' : 'Complete',
      items,
    });
  }

  return {
    stats,
    rows: rows.reverse(),
  };
}

function RecentReadingsPanel({ readings }) {
  const [typeFilter, setTypeFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('current');
  const checkpointData = buildCheckpointData(readings ?? [], {
    now: new Date(),
    siteType: typeFilter,
    shift: shiftFilter,
  });
  const typeOptions = [
    { key: 'all', label: 'All', icon: Grid3X3 },
    { key: 'CHLORINATION', label: 'Chlorination', icon: Droplets },
    { key: 'DEEPWELL', label: 'Deepwell', icon: Zap },
  ];
  const shiftOptions = [
    { key: 'current', label: 'Current shift' },
    { key: 'elapsed', label: 'All elapsed' },
    { key: 'A', label: 'A-Shift' },
    { key: 'B', label: 'B-Shift' },
    { key: 'C', label: 'C-Shift' },
  ];

  return (
    <section className="recent-readings-panel">
      <header className="recent-readings-heading">
        <span className="section-icon">
          <CheckCircle2 size={16} />
        </span>
        <div>
          <h3>30-minute checkpoints</h3>
          <p>Current slot appears first. Future slots are counted in upcoming, not shown below.</p>
        </div>
      </header>

      <div className="recent-reading-filters">
        <div>
          <span>Site type</span>
          <div className="recent-chip-row">
            {typeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  key={option.key}
                  className={typeFilter === option.key ? 'active' : ''}
                  onClick={() => setTypeFilter(option.key)}
                >
                  <Icon size={15} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span>Shift</span>
          <div className="recent-chip-row checkpoint-shift-row">
            {shiftOptions.map((option) => (
              <button
                type="button"
                key={option.key}
                className={shiftFilter === option.key ? 'active' : ''}
                onClick={() => setShiftFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="checkpoint-stat-grid">
        <div>
          <strong>{checkpointData.stats.complete}</strong>
          <span>Complete</span>
        </div>
        <div>
          <strong>{checkpointData.stats.missing}</strong>
          <span>Missing</span>
        </div>
        <div>
          <strong>{checkpointData.stats.upcoming}</strong>
          <span>Upcoming</span>
        </div>
      </div>

      {checkpointData.rows.length ? (
        <div className="checkpoint-scroll">
          <div className="checkpoint-timeline">
            {checkpointData.rows.map((slot) => (
              <article className={`checkpoint-slot ${slot.status}`} key={slot.key}>
                <div className="checkpoint-marker" aria-hidden="true">
                  {slot.status === 'complete' ? <CheckCircle2 size={17} /> : slot.status === 'due' ? <Clock size={17} /> : <AlertTriangle size={17} />}
                </div>
                <div className="checkpoint-slot-body">
                  <div className="checkpoint-slot-head">
                    <div>
                      <h4>{slot.label}</h4>
                      <p>{slot.rangeLabel}</p>
                    </div>
                    <strong>{slot.badge}</strong>
                  </div>
                  <div className="checkpoint-site-grid">
                    {slot.items.map((item) => (
                      <div className={`checkpoint-site-card ${item.complete ? 'complete' : slot.status === 'due' ? 'due' : 'missing'}`} key={item.key}>
                        <span>{item.complete ? <CheckCircle2 size={15} /> : slot.status === 'due' ? <Clock size={15} /> : <AlertTriangle size={15} />}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <p>{item.complete ? `Done by ${item.operator}` : slot.status === 'due' ? 'Due now' : 'Missing'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="chart-empty">No elapsed checkpoints found for this filter.</p>
      )}
    </section>
  );
}

export default function OverviewScreen({
  dashboard,
  isAdmin,
  refreshing = false,
  activeSection = 'production',
  scrollRequest = 0,
  onOpenApprovals,
  onVisibleSectionsChange,
}) {
  const [powerZoom, setPowerZoom] = useState(1);
  const [chemicalZoom, setChemicalZoom] = useState(1);
  const [monthlyProductionZoom, setMonthlyProductionZoom] = useState(1);
  const [selectedMonthlyProductionYear, setSelectedMonthlyProductionYear] = useState(() =>
    getStoredNumber('nemexus-monthly-production-year', getCurrentYear())
  );
  const [monthlyProductionYearMenuOpen, setMonthlyProductionYearMenuOpen] = useState(false);
  const [selectedPowerConsumptionYear, setSelectedPowerConsumptionYear] = useState(() =>
    getStoredNumber('nemexus-power-consumption-year', getCurrentYear())
  );
  const [powerYearMenuOpen, setPowerYearMenuOpen] = useState(false);
  const [selectedChemicalUsageYear, setSelectedChemicalUsageYear] = useState(() =>
    getStoredNumber('nemexus-chemical-usage-year', getCurrentYear())
  );
  const [chemicalYearMenuOpen, setChemicalYearMenuOpen] = useState(false);
  const [dailyProductionZoom, setDailyProductionZoom] = useState(1);
  const [dailyProductionMonthMenuOpen, setDailyProductionMonthMenuOpen] = useState(false);
  const [selectedDailyProductionYear, setSelectedDailyProductionYear] = useState(() =>
    getStoredNumber('nemexus-daily-production-year', getCurrentYear())
  );
  const [selectedDailyProductionMonthKey, setSelectedDailyProductionMonthKey] = useState(getCurrentMonthKey);
  const summaryRef = useRef(null);
  const operationsRef = useRef(null);
  const productionRef = useRef(null);
  const powerRef = useRef(null);
  const chemicalRef = useRef(null);
  const activityRef = useRef(null);
  const monthlyProductionYearPickerRef = useRef(null);
  const dailyProductionMonthPickerRef = useRef(null);
  const powerYearPickerRef = useRef(null);
  const chemicalYearPickerRef = useRef(null);
  const monthlyProduction = dashboard?.monthlyProduction ?? { totalProduction: 0, averageProduction: 0, rows: [] };
  const monthlyProductionYears = dashboard?.monthlyProductionYears ?? [{ year: selectedMonthlyProductionYear, ...monthlyProduction }];
  const selectedMonthlyProduction =
    monthlyProductionYears.find((yearData) => yearData.year === selectedMonthlyProductionYear) || monthlyProductionYears[0] || monthlyProduction;
  const dailyProduction = dashboard?.dailyProduction ?? { monthLabel: '', totalProduction: 0, rows: [] };
  const dailyProductionMonths = dashboard?.dailyProductionMonths ?? [];
  const dailyProductionYears = dashboard?.dailyProductionYears ?? [{ year: selectedDailyProductionYear, months: dailyProductionMonths }];
  const selectedDailyProductionYearData =
    dailyProductionYears.find((yearData) => yearData.year === selectedDailyProductionYear) || dailyProductionYears[0];
  const selectedYearMonths = selectedDailyProductionYearData?.months ?? dailyProductionMonths;
  const selectedDailyProduction =
    selectedYearMonths.find((month) => month.key === selectedDailyProductionMonthKey) || selectedYearMonths[0] || dailyProduction;
  const monthlyPowerConsumption = dashboard?.monthlyPowerConsumption ?? { totalPower: 0, rows: [] };
  const monthlyPowerConsumptionYears =
    dashboard?.monthlyPowerConsumptionYears ?? [{ year: selectedPowerConsumptionYear, ...monthlyPowerConsumption }];
  const selectedPowerConsumption =
    monthlyPowerConsumptionYears.find((yearData) => yearData.year === selectedPowerConsumptionYear) ||
    monthlyPowerConsumptionYears[0] ||
    monthlyPowerConsumption;
  const monthlyChemicalUsage = dashboard?.monthlyChemicalUsage ?? { totalChlorine: 0, totalPeroxide: 0, rows: [] };
  const monthlyChemicalUsageYears =
    dashboard?.monthlyChemicalUsageYears ?? [{ year: selectedChemicalUsageYear, ...monthlyChemicalUsage }];
  const selectedChemicalUsage =
    monthlyChemicalUsageYears.find((yearData) => yearData.year === selectedChemicalUsageYear) ||
    monthlyChemicalUsageYears[0] ||
    monthlyChemicalUsage;
  const activeDailyRows = selectedDailyProduction.rows.filter((row) => Number(row.production) > 0);
  const sectionRefs = {
    summary: summaryRef,
    operations: operationsRef,
    production: productionRef,
    power: powerRef,
    chemical: chemicalRef,
    activity: activityRef,
  };
  const zoomProps = (zoomLevel, setZoomLevel) => ({
    zoomLevel,
    onZoomIn: () => setZoomLevel((current) => clampZoom(current + CHART_ZOOM_STEP)),
    onZoomOut: () => setZoomLevel((current) => clampZoom(current - CHART_ZOOM_STEP)),
    onReset: () => setZoomLevel(1),
  });

  useEffect(() => {
    const target = sectionRefs[activeSection]?.current;

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollRequest]);

  useEffect(() => {
    function closeDropdownsOutside(event) {
      const dropdowns = [
        { ref: monthlyProductionYearPickerRef, close: setMonthlyProductionYearMenuOpen },
        { ref: dailyProductionMonthPickerRef, close: setDailyProductionMonthMenuOpen },
        { ref: powerYearPickerRef, close: setPowerYearMenuOpen },
        { ref: chemicalYearPickerRef, close: setChemicalYearMenuOpen },
      ];

      dropdowns.forEach(({ ref, close }) => {
        if (ref.current && !ref.current.contains(event.target)) {
          close(false);
        }
      });
    }

    document.addEventListener('mousedown', closeDropdownsOutside);
    document.addEventListener('focusin', closeDropdownsOutside);

    return () => {
      document.removeEventListener('mousedown', closeDropdownsOutside);
      document.removeEventListener('focusin', closeDropdownsOutside);
    };
  }, []);

  useEffect(() => {
    if (selectedMonthlyProduction.year && selectedMonthlyProduction.year !== selectedMonthlyProductionYear) {
      setSelectedMonthlyProductionYear(selectedMonthlyProduction.year);
    }
  }, [selectedMonthlyProduction.year, selectedMonthlyProductionYear]);

  useEffect(() => {
    if (selectedPowerConsumption.year && selectedPowerConsumption.year !== selectedPowerConsumptionYear) {
      setSelectedPowerConsumptionYear(selectedPowerConsumption.year);
    }
  }, [selectedPowerConsumption.year, selectedPowerConsumptionYear]);

  useEffect(() => {
    if (selectedChemicalUsage.year && selectedChemicalUsage.year !== selectedChemicalUsageYear) {
      setSelectedChemicalUsageYear(selectedChemicalUsage.year);
    }
  }, [selectedChemicalUsage.year, selectedChemicalUsageYear]);

  useEffect(() => {
    if (selectedDailyProductionYearData?.year && selectedDailyProductionYearData.year !== selectedDailyProductionYear) {
      setSelectedDailyProductionYear(selectedDailyProductionYearData.year);
    }
  }, [selectedDailyProductionYearData?.year, selectedDailyProductionYear]);

  useEffect(() => {
    if (
      selectedYearMonths.length &&
      !selectedYearMonths.some((month) => month.key === selectedDailyProductionMonthKey)
    ) {
      setSelectedDailyProductionMonthKey(selectedYearMonths[0].key);
    }
  }, [selectedDailyProductionMonthKey, selectedYearMonths]);

  useEffect(() => {
    setStoredNumber('nemexus-monthly-production-year', selectedMonthlyProduction.year || selectedMonthlyProductionYear);
  }, [selectedMonthlyProduction.year, selectedMonthlyProductionYear]);

  useEffect(() => {
    setStoredNumber('nemexus-power-consumption-year', selectedPowerConsumption.year || selectedPowerConsumptionYear);
  }, [selectedPowerConsumption.year, selectedPowerConsumptionYear]);

  useEffect(() => {
    setStoredNumber('nemexus-chemical-usage-year', selectedChemicalUsage.year || selectedChemicalUsageYear);
  }, [selectedChemicalUsage.year, selectedChemicalUsageYear]);

  useEffect(() => {
    setStoredNumber('nemexus-daily-production-year', selectedDailyProductionYearData?.year || selectedDailyProductionYear);
  }, [selectedDailyProductionYearData?.year, selectedDailyProductionYear]);

  useEffect(() => {
    if (!onVisibleSectionsChange || typeof window === 'undefined') {
      return undefined;
    }

    let animationFrame = 0;

    function updateVisibleSections() {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const anchorY = Math.min(180, viewportHeight * 0.3);
      const nextSections = [];

      Object.entries(sectionRefs).forEach(([sectionKey, sectionRef]) => {
        const element = sectionRef.current;

        if (!element) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const crossesAnchor = rect.top <= anchorY && rect.bottom >= anchorY;
        const isNearAnchor = Math.abs(rect.top - anchorY) < 48 && rect.top < viewportHeight * 0.75;

        if (crossesAnchor || isNearAnchor) {
          nextSections.push(sectionKey);
        }
      });

      onVisibleSectionsChange(nextSections.length ? nextSections : [activeSection]);
    }

    function scheduleVisibleSectionUpdate() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateVisibleSections);
    }

    scheduleVisibleSectionUpdate();
    window.addEventListener('scroll', scheduleVisibleSectionUpdate, { passive: true });
    window.addEventListener('resize', scheduleVisibleSectionUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', scheduleVisibleSectionUpdate);
      window.removeEventListener('resize', scheduleVisibleSectionUpdate);
    };
  }, [activeSection, onVisibleSectionsChange]);

  return (
    <>
      <OverviewTopPanels
        activeSection={activeSection}
        dashboard={dashboard}
        isAdmin={isAdmin}
        onOpenApprovals={onOpenApprovals}
        operationsRef={operationsRef}
        summaryRef={summaryRef}
      />
      <section className="chart-grid">
        <ChartPanel
          title="Monthly Production"
          icon={BarChart3}
          summaryLabel="Total Production"
          summaryValue={formatNumber(selectedMonthlyProduction.totalProduction)}
          summaryHint={`${selectedMonthlyProduction.year || selectedMonthlyProductionYear} months`}
          panelRef={productionRef}
          busy={refreshing}
          titleControl={
            <div className="monthly-production-heading">
              <span className="section-icon">
                <BarChart3 size={16} />
              </span>
              <h3>Monthly Production</h3>
              <YearDropdown
                classPrefix="monthly-production"
                isOpen={monthlyProductionYearMenuOpen}
                onToggle={() => setMonthlyProductionYearMenuOpen((isOpen) => !isOpen)}
                onSelect={(year) => {
                  setSelectedMonthlyProductionYear(year);
                  setMonthlyProductionYearMenuOpen(false);
                }}
                pickerRef={monthlyProductionYearPickerRef}
                selectedYear={selectedMonthlyProduction.year || selectedMonthlyProductionYear}
                years={monthlyProductionYears.map((yearData) => yearData.year)}
              />
            </div>
          }
          {...zoomProps(monthlyProductionZoom, setMonthlyProductionZoom)}
        >
          <SimpleBarChart
            rows={selectedMonthlyProduction.rows}
            valueKey="production"
            emptyMessage={`No monthly production saved for ${selectedMonthlyProduction.year || selectedMonthlyProductionYear}.`}
            zoomLevel={monthlyProductionZoom}
          />
        </ChartPanel>

        <ChartPanel
          title={`${selectedDailyProduction.monthLabel || 'Current Month'} Production`}
          titleControl={
            <div className="production-month-picker" ref={dailyProductionMonthPickerRef}>
              <button
                type="button"
                className="chart-title-dropdown"
                aria-expanded={dailyProductionMonthMenuOpen}
                onClick={() => setDailyProductionMonthMenuOpen((current) => !current)}
              >
                <CalendarDays size={20} />
                <span>{`${selectedDailyProduction.monthLabel || 'Current Month'} Production`}</span>
                <ChevronDown size={18} />
              </button>
              {dailyProductionMonthMenuOpen ? (
                <div className="production-month-menu">
                  <div className="production-month-menu-head">
                    <div className="production-month-menu-header">Select production month</div>
                    <label className="production-year-select">
                      <span>Year</span>
                      <select
                        value={selectedDailyProductionYear}
                        onChange={(event) => {
                          const nextYear = Number(event.target.value);
                          const monthSuffix = selectedDailyProductionMonthKey.slice(4) || getCurrentMonthKey().slice(4);

                          setSelectedDailyProductionYear(nextYear);
                          setSelectedDailyProductionMonthKey(`${nextYear}${monthSuffix}`);
                        }}
                      >
                        {dailyProductionYears.map((yearData) => (
                          <option key={yearData.year} value={yearData.year}>
                            {yearData.year}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {selectedYearMonths.map((month) => (
                    <button
                      type="button"
                      key={month.key}
                      className={selectedDailyProductionMonthKey === month.key ? 'active' : undefined}
                      onClick={() => {
                        setSelectedDailyProductionMonthKey(month.key);
                        setDailyProductionMonthMenuOpen(false);
                      }}
                    >
                      <span className="production-month-name">
                        {selectedDailyProductionMonthKey === month.key ? <CheckCircle2 size={18} /> : null}
                        <span>{month.monthLabel}</span>
                      </span>
                      <span className="production-month-value">
                        <strong>{formatNumber(month.totalProduction)}</strong>
                        {Number(month.totalProduction) <= 0 ? <em>No data</em> : null}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          }
          icon={CalendarDays}
          summaryLabel="Current Month"
          summaryValue={formatNumber(selectedDailyProduction.totalProduction)}
          summaryHint={`${activeDailyRows.length} active day(s)`}
          busy={refreshing}
          {...zoomProps(dailyProductionZoom, setDailyProductionZoom)}
        >
          <SimpleBarChart
            rows={selectedDailyProduction.rows}
            valueKey="production"
            emptyMessage="Daily production will appear after totalizer values are saved for this month."
            zoomLevel={dailyProductionZoom}
            daily
          />
        </ChartPanel>

        <ChartPanel
          title="Monthly Power Consumption"
          icon={Zap}
          summaryLabel="Total Power"
          summaryValue={formatNumber(selectedPowerConsumption.totalPower)}
          summaryHint={`${selectedPowerConsumption.year || selectedPowerConsumptionYear} months`}
          panelRef={powerRef}
          busy={refreshing}
          titleControl={
            <div className="power-consumption-heading">
              <span className="section-icon">
                <Zap size={16} />
              </span>
              <h3>Monthly Power Consumption</h3>
              <YearDropdown
                classPrefix="power"
                isOpen={powerYearMenuOpen}
                onToggle={() => setPowerYearMenuOpen((isOpen) => !isOpen)}
                onSelect={(year) => {
                  setSelectedPowerConsumptionYear(year);
                  setPowerYearMenuOpen(false);
                }}
                pickerRef={powerYearPickerRef}
                selectedYear={selectedPowerConsumption.year || selectedPowerConsumptionYear}
                years={monthlyPowerConsumptionYears.map((yearData) => yearData.year)}
              />
            </div>
          }
          {...zoomProps(powerZoom, setPowerZoom)}
        >
          <StackedPowerChart
            rows={selectedPowerConsumption.rows}
            zoomLevel={powerZoom}
            emptyMessage={`No power consumption saved for ${selectedPowerConsumption.year || selectedPowerConsumptionYear}.`}
          />
        </ChartPanel>

        <ChartPanel
          title="Monthly Chemical Usage"
          icon={FlaskConical}
          panelRef={chemicalRef}
          busy={refreshing}
          titleControl={
            <div className="chemical-usage-heading">
              <span className="section-icon">
                <FlaskConical size={16} />
              </span>
              <h3>Monthly Chemical Usage</h3>
              <YearDropdown
                classPrefix="chemical"
                isOpen={chemicalYearMenuOpen}
                onToggle={() => setChemicalYearMenuOpen((isOpen) => !isOpen)}
                onSelect={(year) => {
                  setSelectedChemicalUsageYear(year);
                  setChemicalYearMenuOpen(false);
                }}
                pickerRef={chemicalYearPickerRef}
                selectedYear={selectedChemicalUsage.year || selectedChemicalUsageYear}
                years={monthlyChemicalUsageYears.map((yearData) => yearData.year)}
              />
            </div>
          }
          summaryItems={[
            {
              label: 'Total Chlorine',
              value: formatNumber(selectedChemicalUsage.totalChlorine),
              hint: `${selectedChemicalUsage.year || selectedChemicalUsageYear} months`,
              icon: Droplets,
            },
            {
              label: 'Total Peroxide',
              value: formatNumber(selectedChemicalUsage.totalPeroxide),
              hint: `${selectedChemicalUsage.year || selectedChemicalUsageYear} months`,
              icon: FlaskConical,
            },
          ]}
          {...zoomProps(chemicalZoom, setChemicalZoom)}
        >
          <StackedChemicalChart
            rows={selectedChemicalUsage.rows}
            zoomLevel={chemicalZoom}
            emptyMessage={`No chemical usage saved for ${selectedChemicalUsage.year || selectedChemicalUsageYear}.`}
          />
        </ChartPanel>
        <OperatorsPanel operators={dashboard?.operators ?? []} readings={dashboard?.recentReadings ?? []} panelRef={activityRef} />
        <RecentReadingsPanel readings={dashboard?.recentReadings ?? []} />
      </section>
    </>
  );
}
