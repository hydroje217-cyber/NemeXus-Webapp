import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  History,
  Loader2,
  LogOut,
  Menu,
  Moon,
  MoreVertical,
  Pencil,
  RefreshCw,
  Sun,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import AccountsScreen from './AccountsScreen';
import ApprovalsScreen from './ApprovalsScreen';
import LoginLogsScreen from './LoginLogsScreen';
import OverviewScreen, { buildOperationAlerts } from './OverviewScreen';
import ReadingsScreen from './ReadingsScreen';
import SummaryReportScreen, { loadSummaryReportInputs } from './SummaryReportScreen';
import { formatRoleLabel } from '../services/dashboard';
import {
  loadNotificationDismissedKeys,
  loadNotificationReadKeys,
  saveNotificationDismissedKeys,
  saveNotificationReadKeys,
  saveNotificationUnreadCount,
} from '../utils/notificationState';

function titleize(value) {
  if (value === 'login-logs') {
    return 'Logs';
  }

  if (!value) {
    return 'Dashboard';
  }

  return value
    .split('-')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

function formatLastUpdated(value) {
  if (!value) {
    return 'Waiting for data';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently updated';
  }

  return `Updated ${parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function getInitials(name, email = '') {
  const source = (name || email || 'User').trim();
  const words = source
    .replace(/@.*/, '')
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return 'U';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getFirstName(name, email = '') {
  const source = (name || email || 'User').trim().replace(/@.*/, '');
  return source.split(/\s+/).filter(Boolean)[0] || 'User';
}

function formatLoginTime(value) {
  if (!value) {
    return 'recently';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'recently';
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function formatRelativeTime(value) {
  if (!value) {
    return 'just now';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'just now';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getNotificationTimestamp(alert) {
  return alert?.timestamp || alert?.created_at || null;
}

function getNotificationSortTime(alert) {
  const timestamp = getNotificationTimestamp(alert);
  const parsed = timestamp ? new Date(timestamp) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
}

function formatReadingDetailValue(value, unit = '') {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  return unit ? `${value} ${unit}` : String(value);
}

function formatReadingSlotLabel(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return `${String(parsed.getHours()).padStart(2, '0')}${String(parsed.getMinutes()).padStart(2, '0')}H`;
}

function getReadingSiteName(reading) {
  return reading?.site?.name || reading?.sites?.name || (reading?.site_type === 'DEEPWELL' ? 'Deepwell reading' : 'Chlorination reading');
}

function getReadingOperatorName(reading) {
  return reading?.submitted_profile?.full_name || reading?.submitted_profile?.email || '-';
}

function getReadingDetailFields(reading) {
  if (!reading) {
    return [];
  }

  const readingType = String(reading.site_type || reading.site?.type || '').toLowerCase();
  const fields = readingType === 'deepwell' ? DEEPWELL_READING_FIELDS : CHLORINATION_READING_FIELDS;
  return fields
    .filter(({ key }) => reading[key] !== null && reading[key] !== undefined && reading[key] !== '')
    .map((field) => [
      field.key,
      field.label,
      formatReadingDetailValue(reading[field.key], field.unit),
    ]);
}

function buildLoginNotification(profile, session, isOnline) {
  if (!session?.user) {
    return null;
  }

  const userName = profile?.full_name || session.user.user_metadata?.full_name || session.user.email || profile?.email || 'User';
  const loginTime = session.user.last_sign_in_at || session.created_at;
  const onlineStatus = isOnline ? 'currently online' : 'currently offline';

  return {
    key: `login-${session.user.id || 'current-user'}`,
    severity: 'info',
    title: 'User logged in',
    detail: `${userName} logged in at ${formatLoginTime(loginTime)} and is ${onlineStatus}.`,
    timestamp: loginTime,
  };
}

function buildLoginLogNotifications(loginLogs = []) {
  return loginLogs.slice(0, 10).map((log) => {
    const loginTime = log.logged_in_at || log.created_at;
    const userName = log.full_name || log.email || 'User';
    const roleLabel = formatRoleLabel(log.role) || 'user';

    return {
      key: `login-log-${log.id || `${log.email || userName}-${loginTime || ''}`}`,
      severity: 'info',
      title: userName,
      detail: `${roleLabel} logged in at ${formatLoginTime(loginTime)}.`,
      timestamp: loginTime,
      targetView: 'login-logs',
      loginLogId: log.id,
    };
  });
}

function getTabs(isAdmin) {
  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'readings', label: 'Readings', icon: Droplets },
    { key: 'summary-report', label: 'Summary Report', icon: FileText },
  ];

  if (isAdmin) {
    tabs.push({ key: 'approvals', label: 'Approvals', icon: CheckCircle2 });
    tabs.push({ key: 'accounts', label: 'Accounts', icon: Users });
    tabs.push({ key: 'login-logs', label: 'Logs', icon: History });
  }

  return tabs;
}

const DASHBOARD_SECTION_GROUPS = [
  {
    label: 'Overview',
    sections: [
      { key: 'summary', label: 'Live Summary', icon: Zap },
    ],
  },
  {
    label: 'Analytics',
    sections: [
      { key: 'production', label: 'Production', icon: BarChart3 },
      { key: 'power', label: 'Power', icon: Zap },
      { key: 'chemical', label: 'Chemical', icon: FlaskConical },
    ],
  },
  {
    label: 'Activity',
    sections: [
      { key: 'activity', label: 'Operators & Recent', icon: History },
    ],
  },
];

const NOTIFICATION_SEVERITY_LABELS = {
  all: 'All',
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};
const ACTIVE_PRESENCE_WINDOW_MS = 2 * 60 * 1000;
const MAX_FLOATING_ACTIVE_USERS = 5;

const CHLORINATION_READING_FIELDS = [
  { key: 'totalizer', label: 'Totalizer' },
  { key: 'pressure_psi', label: 'Pressure', unit: 'psi' },
  { key: 'rc_ppm', label: 'RC', unit: 'ppm' },
  { key: 'turbidity_ntu', label: 'Turbidity', unit: 'NTU' },
  { key: 'ph', label: 'pH' },
  { key: 'tds_ppm', label: 'TDS', unit: 'ppm' },
  { key: 'tank_level_liters', label: 'Tank level', unit: 'liters' },
  { key: 'flowrate_m3hr', label: 'Flowrate', unit: 'm3/hr' },
  { key: 'chlorine_consumed', label: 'Chlorine used', unit: 'kg' },
  { key: 'peroxide_consumption', label: 'Peroxide used' },
  { key: 'chlorination_power_kwh', label: 'Power used', unit: 'kWh' },
];

const DEEPWELL_READING_FIELDS = [
  { key: 'upstream_pressure_psi', label: 'Upstream pressure', unit: 'psi' },
  { key: 'downstream_pressure_psi', label: 'Downstream pressure', unit: 'psi' },
  { key: 'flowrate_m3hr', label: 'Flowrate', unit: 'm3/hr' },
  { key: 'vfd_frequency_hz', label: 'VFD frequency', unit: 'Hz' },
  { key: 'voltage_l1_v', label: 'Voltage L1', unit: 'V' },
  { key: 'voltage_l2_v', label: 'Voltage L2', unit: 'V' },
  { key: 'voltage_l3_v', label: 'Voltage L3', unit: 'V' },
  { key: 'amperage_a', label: 'Amperage', unit: 'A' },
  { key: 'tds_ppm', label: 'TDS', unit: 'ppm' },
  { key: 'power_kwh_shift', label: 'Shift power', unit: 'kWh' },
];

export default function DashboardScreen({
  activeView,
  dashboard,
  isAdmin,
  isGeneralManager,
  lastUpdatedAt,
  loading,
  message,
  profile,
  refreshing,
  session,
  themeMode,
  workingId,
  onApprove,
  onNavigate,
  onRefresh,
  onRoleChange,
  onPasswordReset,
  onDeleteAccount,
  onUpdateAccount,
  onSignOut,
  onThemeToggle,
}) {
  const tabs = getTabs(isAdmin);
  const recentReadings = dashboard?.recentReadings ?? [];
  const rawOperationAlerts = buildOperationAlerts(dashboard);
  const [isCurrentUserOnline, setIsCurrentUserOnline] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.navigator.onLine;
  });
  const [readNotificationKeys, setReadNotificationKeys] = useState(() => new Set());
  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useState({});
  const loginNotification = buildLoginNotification(profile, session, isCurrentUserOnline);
  const loginLogNotifications = isAdmin ? buildLoginLogNotifications(dashboard?.loginLogs ?? []) : [];
  const allNotifications = loginLogNotifications.length
    ? [...loginLogNotifications, ...rawOperationAlerts]
    : loginNotification
      ? [loginNotification, ...rawOperationAlerts]
      : rawOperationAlerts;
  const notifications = allNotifications
    .filter((alert) => !dismissedNotificationKeys[alert.key])
    .sort((firstAlert, secondAlert) => getNotificationSortTime(secondAlert) - getNotificationSortTime(firstAlert));
  const notificationCount = notifications.filter((alert) => !readNotificationKeys.has(alert.key)).length;
  const operationAlertCount = rawOperationAlerts.filter(
    (alert) => !dismissedNotificationKeys[alert.key] && !readNotificationKeys.has(alert.key)
  ).length;
  const [dashboardSection, setDashboardSection] = useState('summary');
  const [visibleDashboardSections, setVisibleDashboardSections] = useState(['summary']);
  const [dashboardScrollRequest, setDashboardScrollRequest] = useState(0);
  const [summaryReportInputs, setSummaryReportInputs] = useState(loadSummaryReportInputs);
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [accountEmail, setAccountEmail] = useState(profile?.email || session?.user?.email || '');
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [notificationSeverityFilter, setNotificationSeverityFilter] = useState('all');
  const [openNotificationMenuKey, setOpenNotificationMenuKey] = useState('');
  const [selectedNotificationAlert, setSelectedNotificationAlert] = useState(null);
  const [selectedLoginLogId, setSelectedLoginLogId] = useState('');
  const [selectedActiveAccountId, setSelectedActiveAccountId] = useState('');
  const [loginLogsFilter, setLoginLogsFilter] = useState('login');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [openSubnav, setOpenSubnav] = useState('dashboard');
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const brandMenuRef = useRef(null);
  const desktopNotificationMenuRef = useRef(null);
  const mobileNotificationMenuRef = useRef(null);
  const isDarkMode = themeMode === 'dark';
  const presenceAccounts = (() => {
    const accounts = dashboard?.profiles ?? [];

    if (!profile?.id || accounts.some((account) => account.id === profile.id)) {
      return accounts;
    }

    return [...accounts, profile];
  })();
  const activeFloatingUsers = presenceAccounts
    .filter((account) => account?.is_active !== false)
    .map((account) => {
      const lastSeenTime = new Date(account.last_seen_at || 0).getTime();
      const isCurrentProfile = account.id && account.id === profile?.id;
      const isActiveNow =
        (Number.isFinite(lastSeenTime) && presenceNow - lastSeenTime <= ACTIVE_PRESENCE_WINDOW_MS) ||
        (isCurrentProfile && isCurrentUserOnline);

      return {
        ...account,
        firstName: getFirstName(account.full_name, account.email),
        initials: getInitials(account.full_name, account.email),
        isActiveNow,
        lastSeenTime: Number.isFinite(lastSeenTime) ? lastSeenTime : 0,
      };
    })
    .filter((account) => account.isActiveNow)
    .sort((first, second) => second.lastSeenTime - first.lastSeenTime)
    .slice(0, MAX_FLOATING_ACTIVE_USERS);
  const shouldShowFloatingPresence =
    activeView === 'dashboard' || (activeView === 'login-logs' && loginLogsFilter === 'active');

  useEffect(() => {
    setReadNotificationKeys(new Set(Object.keys(loadNotificationReadKeys(profile))));
    setDismissedNotificationKeys(loadNotificationDismissedKeys(profile));
  }, [profile?.id, profile?.email]);

  useEffect(() => {
    saveNotificationUnreadCount(profile, notificationCount);
  }, [profile?.id, profile?.email, notificationCount]);

  useEffect(() => {
    if (!isEditAccountOpen) {
      setAccountEmail(profile?.email || session?.user?.email || '');
      setAccountPassword('');
      setShowAccountPassword(false);
      setAccountMessage('');
    }
  }, [isEditAccountOpen, profile?.email, session?.user?.email]);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!brandMenuRef.current?.contains(event.target)) {
        setIsBrandMenuOpen(false);
      }

      if (
        !desktopNotificationMenuRef.current?.contains(event.target) &&
        !mobileNotificationMenuRef.current?.contains(event.target)
      ) {
        setIsNotificationPanelOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  useEffect(() => {
    function handleScroll() {
      setShowScrollTop(window.scrollY > 520);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => setPresenceNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    function syncOnlineStatus() {
      setIsCurrentUserOnline(window.navigator.onLine);
    }

    syncOnlineStatus();
    window.addEventListener('online', syncOnlineStatus);
    window.addEventListener('offline', syncOnlineStatus);

    return () => {
      window.removeEventListener('online', syncOnlineStatus);
      window.removeEventListener('offline', syncOnlineStatus);
    };
  }, []);

  function renderActiveView() {
    if (activeView === 'readings') {
      return (
        <ReadingsScreen readings={recentReadings} />
      );
    }

    if (activeView === 'summary-report') {
      return (
        <SummaryReportScreen
          dashboard={dashboard}
          reportInputs={summaryReportInputs}
          onReportInputsChange={setSummaryReportInputs}
        />
      );
    }

    if (activeView === 'approvals' && isAdmin) {
      return (
        <ApprovalsScreen
          approvals={dashboard?.pendingApprovals ?? []}
          workingId={workingId}
          onApprove={onApprove}
        />
      );
    }

    if (activeView === 'accounts' && isAdmin) {
      return (
        <AccountsScreen
          accounts={dashboard?.profiles ?? []}
          currentProfileId={profile?.id}
          workingId={workingId}
          isGeneralManager={isGeneralManager}
          onRoleChange={onRoleChange}
          onPasswordReset={onPasswordReset}
          onDeleteAccount={onDeleteAccount}
        />
      );
    }

    if (activeView === 'login-logs' && isAdmin) {
      return (
        <LoginLogsScreen
          accounts={dashboard?.profiles ?? []}
          highlightedActiveAccountId={selectedActiveAccountId}
          highlightedLoginLogId={selectedLoginLogId}
          logs={dashboard?.loginLogs ?? []}
          onLogFilterChange={setLoginLogsFilter}
        />
      );
    }

    return (
      <OverviewScreen
        dashboard={dashboard}
        summaryReportInputs={summaryReportInputs}
        refreshing={refreshing}
        activeSection={dashboardSection}
        scrollRequest={dashboardScrollRequest}
        onRefresh={onRefresh}
        onVisibleSectionsChange={setVisibleDashboardSections}
        onOpenApprovals={() => {
          onNavigate('approvals');
          setOpenSubnav('');
          setIsSidebarOpen(false);
        }}
      />
    );
  }

  function handleDashboardSectionSelect(sectionKey) {
    setDashboardSection(sectionKey);
    setVisibleDashboardSections([sectionKey]);
    setDashboardScrollRequest((requestId) => requestId + 1);
    onNavigate('dashboard');
    setIsSidebarOpen(false);
    setIsBrandMenuOpen(false);
  }

  function handleNotificationSelect() {
    setIsNotificationPanelOpen((isOpen) => !isOpen);
    setOpenNotificationMenuKey('');
    setIsBrandMenuOpen(false);
  }

  function handleAlertPillSelect() {
    setNotificationSeverityFilter('all');
    setIsNotificationPanelOpen(true);
    setOpenNotificationMenuKey('');
    setIsBrandMenuOpen(false);
  }

  function handleMarkActiveNotificationsRead(alertsToRead) {
    if (!alertsToRead.length) {
      return;
    }

    setReadNotificationKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys);
      alertsToRead.forEach((alert) => nextKeys.add(alert.key));
      saveNotificationReadKeys(profile, Object.fromEntries(Array.from(nextKeys).map((key) => [key, true])));
      return nextKeys;
    });
  }

  function handleNotificationOpen(alert) {
    if (!alert?.reading && !alert?.targetView) {
      return;
    }

    handleMarkActiveNotificationsRead([alert]);
    setOpenNotificationMenuKey('');

    if (alert.targetView === 'login-logs' && isAdmin) {
      setSelectedLoginLogId(alert.loginLogId || '');
      setSelectedActiveAccountId('');
      onNavigate('login-logs');
      setIsNotificationPanelOpen(false);
      setSelectedNotificationAlert(null);
      return;
    }

    setSelectedNotificationAlert(alert);
  }

  function handleFloatingPresenceOpen(account) {
    if (!account?.id || !isAdmin) {
      return;
    }

    setSelectedActiveAccountId(account.id);
    setSelectedLoginLogId('');
    onNavigate('login-logs');
  }

  function handleDismissNotification(alert) {
    if (!alert?.key) {
      return;
    }

    const nextDismissedKeys = {
      ...dismissedNotificationKeys,
      [alert.key]: true,
    };
    setDismissedNotificationKeys(nextDismissedKeys);
    saveNotificationDismissedKeys(profile, nextDismissedKeys);
    handleMarkActiveNotificationsRead([alert]);
    setOpenNotificationMenuKey('');
  }

  function normalizeEmail(value) {
    const trimmed = value.trim();
    return trimmed && !trimmed.includes('@') ? `${trimmed}@gmail.com` : trimmed;
  }

  function handleEditAccountOpen() {
    setAccountEmail(profile?.email || session?.user?.email || '');
    setAccountPassword('');
    setAccountMessage('');
    setIsBrandMenuOpen(false);
    setIsEditAccountOpen(true);
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(accountEmail);
    const nextPassword = accountPassword.trim();

    setAccountEmail(normalizedEmail);
    setAccountBusy(true);
    setAccountMessage('');

    try {
      const successMessage = await onUpdateAccount({
        email: normalizedEmail,
        password: nextPassword,
      });
      setAccountPassword('');
      setAccountMessage(successMessage || 'Account updated.');
    } catch (error) {
      setAccountMessage(error.message || 'Failed to update account.');
    } finally {
      setAccountBusy(false);
    }
  }

  function renderNotificationPanel() {
    const severityTabs = Object.entries(NOTIFICATION_SEVERITY_LABELS).map(([key, label]) => ({
      key,
      label,
      count:
        key === 'all'
          ? notifications.length
          : notifications.filter((alert) => alert.severity === key).length,
    }));
    const filteredAlerts =
      notificationSeverityFilter === 'all'
        ? notifications
        : notifications.filter((alert) => alert.severity === notificationSeverityFilter);
    const activeSeverityLabel =
      notificationSeverityFilter === 'all'
        ? 'notifications'
        : `${NOTIFICATION_SEVERITY_LABELS[notificationSeverityFilter].toLowerCase()} alerts`;

    return (
      <div className="notification-panel" role="menu" aria-label="Notifications">
        <div className="notification-panel-head">
          <div>
            <strong>Notifications</strong>
            <span>{notificationCount ? `${notificationCount} unread` : 'No unread notifications'}</span>
          </div>
          <button
            type="button"
            className="notification-mark-read-button"
            disabled={!filteredAlerts.length}
            onClick={() => handleMarkActiveNotificationsRead(filteredAlerts)}
          >
            Mark all as read
          </button>
        </div>
        <div className="notification-severity-tabs" role="tablist" aria-label="Alert seriousness">
          {severityTabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={notificationSeverityFilter === tab.key}
              className={notificationSeverityFilter === tab.key ? 'active' : ''}
              key={tab.key}
              onClick={() => setNotificationSeverityFilter(tab.key)}
            >
              <span>{tab.label}</span>
              <strong>{tab.count}</strong>
            </button>
          ))}
        </div>
        <div className="notification-list">
          {filteredAlerts.length ? (
            filteredAlerts.map((alert) => {
              const isClickableNotification = Boolean(alert.reading || alert.targetView);

              return (
                <article
                  className={`notification-item ${alert.severity} ${isClickableNotification ? 'clickable' : ''} ${readNotificationKeys.has(alert.key) ? 'read' : 'unread'}`}
                  key={alert.key}
                  role={isClickableNotification ? 'button' : undefined}
                  tabIndex={isClickableNotification ? 0 : undefined}
                  onClick={() => handleNotificationOpen(alert)}
                  onKeyDown={(event) => {
                    if (isClickableNotification && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      handleNotificationOpen(alert);
                    }
                  }}
                >
                  {!readNotificationKeys.has(alert.key) ? <span className="notification-unread-dot" aria-hidden="true" /> : null}
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.severity}</span>
                  </div>
                  <p>{alert.detail}</p>
                  <time className="notification-timestamp" dateTime={getNotificationTimestamp(alert) || undefined}>
                    {formatRelativeTime(getNotificationTimestamp(alert))}
                  </time>
                  <div className="notification-item-menu-wrap">
                    <button
                      type="button"
                      className="notification-kebab-button"
                      aria-label={`More options for ${alert.title}`}
                      aria-expanded={openNotificationMenuKey === alert.key}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenNotificationMenuKey((currentKey) => (currentKey === alert.key ? '' : alert.key));
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openNotificationMenuKey === alert.key ? (
                      <div className="notification-item-menu">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDismissNotification(alert);
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="notification-empty">No {activeSeverityLabel} right now.</p>
          )}
        </div>
      </div>
    );
  }

  function handleTabSelect(tabKey) {
    const hasSubnav = tabKey === 'dashboard';

    if (hasSubnav && activeView === tabKey) {
      setOpenSubnav((currentSubnav) => (currentSubnav === tabKey ? '' : tabKey));
      return;
    }

    if (tabKey === 'dashboard') {
      setDashboardSection('summary');
      setVisibleDashboardSections(['summary']);
      setDashboardScrollRequest((requestId) => requestId + 1);
    }

    onNavigate(tabKey);
    setOpenSubnav(hasSubnav ? tabKey : '');
    setIsBrandMenuOpen(false);

    if (!hasSubnav) {
      setIsSidebarOpen(false);
    }
  }

  function handleScrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className={`app-shell ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <button
        className="sidebar-toggle-button"
        type="button"
        aria-label={isSidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isSidebarOpen}
        onClick={() => setIsSidebarOpen((isOpen) => !isOpen)}
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isSidebarOpen ? (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => {
            setIsSidebarOpen(false);
            setIsBrandMenuOpen(false);
          }}
        />
      ) : null}

      <aside className={isSidebarOpen ? 'sidebar is-open' : 'sidebar'} aria-hidden={!isSidebarOpen}>
        <div className="sidebar-mobile-head">
          <div
            className={isBrandMenuOpen ? 'brand-menu-wrap menu-open' : 'brand-menu-wrap'}
            ref={brandMenuRef}
          >
            <button
              className="brand-lockup compact brand-menu-trigger"
              type="button"
              aria-expanded={isBrandMenuOpen}
              aria-label="Open account menu"
              onClick={() => {
                setIsBrandMenuOpen((isOpen) => !isOpen);
              }}
            >
              <span className="brand-mark">
                <img src="/nemexus-logo.png" alt="NemeXus logo" />
              </span>
              <span className="brand-copy">
                <span className="brand-title-row">
                  <h1>NemeXus</h1>
                  <ChevronDown size={16} />
                </span>
                <p>{profile?.email || 'user@example.com'}</p>
                <p>{profile?.role || 'dashboard'}</p>
              </span>
            </button>

            {isBrandMenuOpen ? (
              <div className="brand-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={onThemeToggle}
                >
                  {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  {isDarkMode ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleEditAccountOpen}
                >
                  <Pencil size={16} />
                  Edit account
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={onSignOut}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>

          <button
            className="mobile-menu-button"
            type="button"
            aria-label="Close navigation"
            onClick={() => {
              setIsSidebarOpen(false);
              setIsBrandMenuOpen(false);
            }}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <div className="tab-group" key={tab.key}>
                <button
                  className={activeView === tab.key ? 'active' : ''}
                  type="button"
                  onClick={() => handleTabSelect(tab.key)}
                >
                  <Icon size={17} />
                  {tab.label}
                </button>
                {tab.key === 'dashboard' && activeView === 'dashboard' && openSubnav === 'dashboard' ? (
                  <div className="tabs-subnav dashboard-subnav">
                    {DASHBOARD_SECTION_GROUPS.map((group) => (
                      <div className="dashboard-subnav-group" key={group.label}>
                        <span className="dashboard-subnav-label">{group.label}</span>
                        {group.sections.map((section) => {
                          const SectionIcon = section.icon;
                          return (
                            <button
                              type="button"
                              key={section.key}
                              className={visibleDashboardSections.includes(section.key) ? 'active' : ''}
                              onClick={() => handleDashboardSectionSelect(section.key)}
                            >
                              <SectionIcon size={14} />
                              {section.label}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <div className="topbar-title-row">
              <button
                className="topbar-menu-button"
                type="button"
                aria-label="Open navigation"
                aria-expanded={isSidebarOpen}
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div className="topbar-title-copy">
                <p className="eyebrow">Live Supabase workspace</p>
                <h2>{titleize(activeView)}</h2>
              </div>
              <div className="notification-menu-wrap mobile-notification-wrap" ref={mobileNotificationMenuRef}>
                <button
                  className="mobile-title-refresh notification-button compact"
                  type="button"
                  aria-label={`${notificationCount} notifications`}
                  aria-expanded={isNotificationPanelOpen}
                  onClick={handleNotificationSelect}
                >
                  <Bell size={16} />
                  {notificationCount ? <span className="notification-count">{notificationCount}</span> : null}
                </button>
                {isNotificationPanelOpen ? renderNotificationPanel() : null}
              </div>
            </div>
          </div>
          <div className="topbar-status-row">
            <div className="status-strip" aria-label="Workspace status">
              <span className="status-pill connected">
                <CheckCircle2 size={14} />
                Connected
              </span>
              <button
                className={operationAlertCount ? 'status-pill status-pill-button warning' : 'status-pill status-pill-button connected'}
                type="button"
                aria-label={`Open notifications, ${operationAlertCount} unread alerts`}
                onClick={handleAlertPillSelect}
              >
                <AlertTriangle size={14} />
                {operationAlertCount} alerts
              </button>
            </div>
            <div className="topbar-actions">
              <span className="freshness-pill">
                <span aria-hidden="true" />
                {formatLastUpdated(lastUpdatedAt)}
              </span>
              <div className="notification-menu-wrap" ref={desktopNotificationMenuRef}>
                <button
                  className="notification-button"
                  type="button"
                  aria-expanded={isNotificationPanelOpen}
                  onClick={handleNotificationSelect}
                >
                  <Bell size={16} />
                  <span className="notification-button-label">Notifications</span>
                  {notificationCount ? <span className="notification-count">{notificationCount}</span> : null}
                </button>
                {isNotificationPanelOpen ? renderNotificationPanel() : null}
              </div>
              <button
                className="refresh-view-button"
                type="button"
                aria-label="Refresh current view"
                title="Refresh current view"
                disabled={loading || refreshing}
                onClick={onRefresh}
              >
                <RefreshCw className={refreshing ? 'spin' : undefined} size={16} />
              </button>
            </div>
          </div>
        </header>

        {message ? <div className="notice">{message}</div> : null}
        {renderActiveView()}
      </section>

      {shouldShowFloatingPresence && activeFloatingUsers.length ? (
        <aside
          className={showScrollTop ? 'floating-presence-stack with-scroll-top' : 'floating-presence-stack'}
          aria-label="Active users"
        >
          {activeFloatingUsers.map((account) => (
            <button
              className="floating-presence-item active"
              key={account.id || account.email}
              type="button"
              aria-label={`${account.full_name || account.email || 'User'}, ${formatRoleLabel(account.role) || 'User'}, active now`}
              onClick={() => handleFloatingPresenceOpen(account)}
            >
              <span className="floating-presence-identity" aria-hidden="true">
                <span className="floating-presence-avatar">
                  {account.initials}
                  <span className="floating-presence-dot" />
                </span>
                <span className="floating-presence-name">{account.firstName}</span>
              </span>
              <span className="floating-presence-popover" role="tooltip">
                <strong>{account.full_name || account.email || 'User'}</strong>
                <span>{formatRoleLabel(account.role) || 'User'} · Active now</span>
              </span>
            </button>
          ))}
        </aside>
      ) : null}

      <button
        className={showScrollTop ? 'scroll-top-button visible' : 'scroll-top-button'}
        type="button"
        aria-label="Scroll to top"
        onClick={handleScrollTop}
      >
        <ArrowUp size={22} />
      </button>

      {isEditAccountOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsEditAccountOpen(false)}>
          <section
            className="confirm-dialog account-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-account-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="dialog-close-button"
              type="button"
              aria-label="Close edit account"
              onClick={() => setIsEditAccountOpen(false)}
            >
              <X size={18} />
            </button>
            <h3 id="edit-account-title">Edit account</h3>
            <form className="account-edit-form" onSubmit={handleAccountSubmit}>
              <label>
                Name
                <input type="text" value={profile?.full_name || ''} readOnly disabled />
              </label>
              <label>
                Gmail
                <input
                  type="text"
                  inputMode="email"
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                New password
                <div className="password-input-wrap">
                  <input
                    type={showAccountPassword ? 'text' : 'password'}
                    value={accountPassword}
                    onChange={(event) => setAccountPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="Leave blank to keep current password"
                  />
                  <button
                    type="button"
                    className="password-visibility-button"
                    aria-label={showAccountPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowAccountPassword((current) => !current)}
                  >
                    {showAccountPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {accountMessage ? <p className="form-message">{accountMessage}</p> : null}
              <div className="confirm-dialog-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setIsEditAccountOpen(false)}
                  disabled={accountBusy}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={accountBusy}>
                  {accountBusy ? <Loader2 className="spin" size={16} /> : <Pencil size={16} />}
                  Save account
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedNotificationAlert?.reading ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedNotificationAlert(null)}>
          <section className="reading-detail-dialog" role="dialog" aria-modal="true" aria-label="Reading details" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="dialog-close-button" aria-label="Close details" onClick={() => setSelectedNotificationAlert(null)}>
              <X size={18} />
            </button>
            <header className="reading-detail-header">
              <p className="eyebrow">{selectedNotificationAlert.reading.site_type === 'CHLORINATION' ? 'Chlorination' : 'Deepwell'}</p>
              <h3>{getReadingSiteName(selectedNotificationAlert.reading)}</h3>
              <span>{formatReadingSlotLabel(selectedNotificationAlert.reading.slot_datetime || selectedNotificationAlert.reading.reading_datetime)}</span>
            </header>
            <div className="reading-detail-meta">
              <div>
                <span>Submitted by</span>
                <strong>{getReadingOperatorName(selectedNotificationAlert.reading)}</strong>
              </div>
              <div>
                <span>Saved</span>
                <strong>{formatDateTime(selectedNotificationAlert.reading.created_at || selectedNotificationAlert.reading.reading_datetime)}</strong>
              </div>
            </div>
            <div className={`reading-detail-values ${selectedNotificationAlert.reading.site_type === 'CHLORINATION' ? 'chlorination' : 'deepwell'}`}>
              {getReadingDetailFields(selectedNotificationAlert.reading).map(([key, label, value]) => {
                const isHighlighted = selectedNotificationAlert.alertField && key === selectedNotificationAlert.alertField;

                return (
                  <div className={isHighlighted ? 'alert-highlight' : undefined} key={key}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                );
              })}
            </div>
            {selectedNotificationAlert.reading.remarks ? (
              <div className="reading-detail-remarks">
                <span>Remarks</span>
                <strong>{selectedNotificationAlert.reading.remarks}</strong>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
