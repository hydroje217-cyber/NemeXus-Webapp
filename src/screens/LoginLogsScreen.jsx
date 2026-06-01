import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, History, Radio } from 'lucide-react';
import { formatRoleLabel, normalizeRole } from '../services/dashboard';

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const LOG_FILTERS = [
  { key: 'login', label: 'Login Logs', icon: History },
  { key: 'active', label: 'Active Status Logs', icon: Radio },
];

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatUserAgent(value) {
  if (!value) {
    return '-';
  }

  if (value.includes('Edg/')) {
    return 'Microsoft Edge';
  }

  if (value.includes('Chrome/')) {
    return 'Chrome';
  }

  if (value.includes('Firefox/')) {
    return 'Firefox';
  }

  if (value.includes('Safari/')) {
    return 'Safari';
  }

  return value.length > 72 ? `${value.slice(0, 72)}...` : value;
}

function getPresenceStatus(value) {
  if (!value) {
    return { label: 'Never seen', className: 'presence-badge offline' };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { label: 'Unknown', className: 'presence-badge offline' };
  }

  const elapsedMs = Date.now() - date.getTime();

  if (elapsedMs <= ACTIVE_WINDOW_MS) {
    return { label: 'Active now', className: 'presence-badge active' };
  }

  const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));

  if (elapsedMinutes < 60) {
    return { label: `Seen ${elapsedMinutes}m ago`, className: 'presence-badge idle' };
  }

  return { label: `Seen ${Math.round(elapsedMinutes / 60)}h ago`, className: 'presence-badge offline' };
}

function sortByLastSeen(accounts) {
  return [...accounts].sort((first, second) => {
    const secondTime = new Date(second.last_seen_at || second.created_at || 0).getTime();
    const firstTime = new Date(first.last_seen_at || first.created_at || 0).getTime();

    return secondTime - firstTime;
  });
}

export default function LoginLogsScreen({
  accounts = [],
  highlightedActiveAccountId = '',
  highlightedLoginLogId = '',
  logs = [],
  onLogFilterChange,
}) {
  const [logFilter, setLogFilter] = useState('login');
  const [roleFilter, setRoleFilter] = useState('all');
  const highlightedRowRef = useRef(null);
  const activeStatusLogs = useMemo(() => sortByLastSeen(accounts), [accounts]);
  const roleOptions = useMemo(() => {
    const roles = new Set([
      ...accounts.map((account) => normalizeRole(account.role)).filter(Boolean),
      ...logs.map((log) => normalizeRole(log.role)).filter(Boolean),
    ]);

    return Array.from(roles).sort();
  }, [accounts, logs]);
  const filteredLoginLogs = useMemo(
    () => (roleFilter === 'all' ? logs : logs.filter((log) => normalizeRole(log.role) === roleFilter)),
    [logs, roleFilter]
  );
  const filteredActiveStatusLogs = useMemo(
    () =>
      roleFilter === 'all'
        ? activeStatusLogs
        : activeStatusLogs.filter((account) => normalizeRole(account.role) === roleFilter),
    [activeStatusLogs, roleFilter]
  );
  const isLoginFilter = logFilter === 'login';
  const visibleCount = isLoginFilter ? filteredLoginLogs.length : filteredActiveStatusLogs.length;
  const activeFilterLabel = isLoginFilter ? 'recent login(s)' : 'active status record(s)';

  useEffect(() => {
    onLogFilterChange?.(logFilter);
  }, [logFilter, onLogFilterChange]);

  useEffect(() => {
    if (!highlightedLoginLogId) {
      return;
    }

    setLogFilter('login');
    setRoleFilter('all');
  }, [highlightedLoginLogId]);

  useEffect(() => {
    if (!highlightedActiveAccountId) {
      return;
    }

    setLogFilter('active');
    setRoleFilter('all');
  }, [highlightedActiveAccountId]);

  useEffect(() => {
    if ((!highlightedLoginLogId && !highlightedActiveAccountId) || !highlightedRowRef.current) {
      return;
    }

    highlightedRowRef.current.scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }, [filteredActiveStatusLogs, filteredLoginLogs, highlightedActiveAccountId, highlightedLoginLogId, logFilter]);

  return (
    <section className="panel">
      <div className="panel-heading logs-panel-heading">
        <div className="account-heading-main">
          <h3>Logs</h3>
          <div className="account-filter-row" aria-label="Filter logs">
            {LOG_FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={logFilter === key ? 'active' : ''}
                aria-pressed={logFilter === key}
                onClick={() => setLogFilter(key)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <label className="log-role-filter">
            <span>Role</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              {roleOptions.map((role) => (
                <option value={role} key={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <span>{visibleCount} {activeFilterLabel}</span>
      </div>

      {isLoginFilter && !filteredLoginLogs.length ? (
        <div className="empty-state">No login logs found.</div>
      ) : isLoginFilter ? (
        <div className="table-wrap logs-table-wrap login-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Email</th>
                <th>Role</th>
                <th>Logged in</th>
                <th>Browser</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoginLogs.map((log) => {
                const isHighlighted = highlightedLoginLogId && String(log.id) === String(highlightedLoginLogId);

                return (
                  <tr className={isHighlighted ? 'selected-log-row' : undefined} key={log.id} ref={isHighlighted ? highlightedRowRef : null}>
                    <td>{log.full_name || '-'}</td>
                    <td>{log.email || '-'}</td>
                    <td>{formatRoleLabel(log.role) || '-'}</td>
                    <td>
                      <span className="inline-table-icon">
                        <Clock3 size={14} />
                        {formatDateTime(log.logged_in_at)}
                      </span>
                    </td>
                    <td>{log.browser || formatUserAgent(log.user_agent)}</td>
                    <td>{log.device || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !filteredActiveStatusLogs.length ? (
        <div className="empty-state">No active status logs found.</div>
      ) : (
        <div className="table-wrap logs-table-wrap active-status-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active status</th>
                <th>Last seen</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredActiveStatusLogs.map((account) => {
                const presenceStatus = getPresenceStatus(account.last_seen_at);
                const isHighlighted = highlightedActiveAccountId && String(account.id) === String(highlightedActiveAccountId);

                return (
                  <tr className={isHighlighted ? 'selected-log-row' : undefined} key={account.id} ref={isHighlighted ? highlightedRowRef : null}>
                    <td>{account.full_name || '-'}</td>
                    <td>{account.email || '-'}</td>
                    <td>{formatRoleLabel(account.role) || '-'}</td>
                    <td>
                      <span className={presenceStatus.className}>{presenceStatus.label}</span>
                    </td>
                    <td>
                      <span className="inline-table-icon">
                        <Clock3 size={14} />
                        {formatDateTime(account.last_seen_at)}
                      </span>
                    </td>
                    <td>{formatDateTime(account.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
