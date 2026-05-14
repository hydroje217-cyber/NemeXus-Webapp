import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  Droplets,
  FlaskConical,
  History,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
  X,
  Zap,
} from 'lucide-react';
import AccountsScreen from './AccountsScreen';
import ApprovalsScreen from './ApprovalsScreen';
import OverviewScreen, { buildOperationAlerts } from './OverviewScreen';
import ReadingsScreen from './ReadingsScreen';

function titleize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : 'Dashboard';
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
  };
}

function getTabs(isAdmin) {
  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'readings', label: 'Readings', icon: Droplets },
  ];

  if (isAdmin) {
    tabs.push({ key: 'approvals', label: 'Approvals', icon: CheckCircle2 });
    tabs.push({ key: 'accounts', label: 'Accounts', icon: Users });
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

export default function DashboardScreen({
  activeView,
  dashboard,
  isAdmin,
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
  onRoleChange,
  onDeleteAccount,
  onSignOut,
  onThemeToggle,
}) {
  const tabs = getTabs(isAdmin);
  const recentReadings = dashboard?.recentReadings ?? [];
  const operationAlerts = buildOperationAlerts(dashboard);
  const [isCurrentUserOnline, setIsCurrentUserOnline] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.navigator.onLine;
  });
  const loginNotification = buildLoginNotification(profile, session, isCurrentUserOnline);
  const notifications = loginNotification ? [loginNotification, ...operationAlerts] : operationAlerts;
  const operationAlertCount = operationAlerts.length;
  const notificationCount = notifications.length;
  const [dashboardSection, setDashboardSection] = useState('summary');
  const [visibleDashboardSections, setVisibleDashboardSections] = useState(['summary']);
  const [dashboardScrollRequest, setDashboardScrollRequest] = useState(0);
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notificationSeverityFilter, setNotificationSeverityFilter] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [openSubnav, setOpenSubnav] = useState('dashboard');
  const brandMenuRef = useRef(null);
  const desktopNotificationMenuRef = useRef(null);
  const mobileNotificationMenuRef = useRef(null);
  const isDarkMode = themeMode === 'dark';

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
          onRoleChange={onRoleChange}
          onDeleteAccount={onDeleteAccount}
        />
      );
    }

    return (
      <OverviewScreen
        dashboard={dashboard}
        refreshing={refreshing}
        activeSection={dashboardSection}
        scrollRequest={dashboardScrollRequest}
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
    setIsBrandMenuOpen(false);
  }

  function renderNotificationPanel() {
    const severityTabs = Object.entries(NOTIFICATION_SEVERITY_LABELS).map(([key, label]) => ({
      key,
      label,
      count: key === 'all' ? notificationCount : notifications.filter((alert) => alert.severity === key).length,
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
            <span>{notificationCount ? `${notificationCount} notification(s)` : 'No notifications'}</span>
          </div>
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
            filteredAlerts.map((alert) => (
              <article className={`notification-item ${alert.severity}`} key={alert.key}>
                <div>
                  <strong>{alert.title}</strong>
                  <span>{alert.severity}</span>
                </div>
                <p>{alert.detail}</p>
              </article>
            ))
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
              <span className={operationAlertCount ? 'status-pill warning' : 'status-pill connected'}>
                <AlertTriangle size={14} />
                {operationAlertCount} alerts
              </span>
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
            </div>
          </div>
        </header>

        {message ? <div className="notice">{message}</div> : null}
        {renderActiveView()}
      </section>

      <button
        className={showScrollTop ? 'scroll-top-button visible' : 'scroll-top-button'}
        type="button"
        aria-label="Scroll to top"
        onClick={handleScrollTop}
      >
        <ArrowUp size={22} />
      </button>
    </main>
  );
}
