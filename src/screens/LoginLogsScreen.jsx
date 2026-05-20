import { Clock3 } from 'lucide-react';
import { formatRoleLabel } from '../services/dashboard';

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

function formatDevice(value) {
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

export default function LoginLogsScreen({ logs }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Login Logs</h3>
        <span>{logs.length} recent login(s)</span>
      </div>

      {!logs.length ? (
        <div className="empty-state">No login logs found.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Email</th>
                <th>Role</th>
                <th>Logged in</th>
                <th>Browser</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.full_name || '-'}</td>
                  <td>{log.email || '-'}</td>
                  <td>{formatRoleLabel(log.role) || '-'}</td>
                  <td>
                    <span className="inline-table-icon">
                      <Clock3 size={14} />
                      {formatDateTime(log.logged_in_at)}
                    </span>
                  </td>
                  <td>{formatDevice(log.user_agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
