import { useState } from 'react';
import { Briefcase, Eye, EyeOff, KeyRound, ShieldCheck, Trash2, UserCog, Users, X } from 'lucide-react';
import { formatRoleLabel, GENERAL_MANAGER_ROLE, normalizeRole } from '../services/dashboard';

const ROLE_OPTIONS = ['operator', 'supervisor', 'manager', GENERAL_MANAGER_ROLE, 'admin'];
const ACCOUNT_FILTERS = [
  { key: 'all', label: 'All', icon: Users },
  { key: 'operator', label: 'Operators', icon: UserCog },
  { key: 'supervisor', label: 'Supervisors', icon: ShieldCheck },
  { key: 'manager', label: 'Managers', icon: Briefcase },
  { key: GENERAL_MANAGER_ROLE, label: 'General Managers', icon: Briefcase },
  { key: 'admin', label: 'Admins', icon: KeyRound },
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

export default function AccountsScreen({
  accounts,
  currentProfileId,
  isGeneralManager,
  workingId,
  onRoleChange,
  onPasswordReset,
  onDeleteAccount,
}) {
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState(null);
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [accountFilter, setAccountFilter] = useState('all');
  const filteredAccounts = accounts.filter((account) => {
    if (accountFilter === 'all') {
      return true;
    }

    return (normalizeRole(account.role) || 'operator') === accountFilter;
  });
  const accountCountLabel =
    accountFilter === 'all' ? `${accounts.length} accounts` : `${filteredAccounts.length} of ${accounts.length} accounts`;

  function handleDeleteConfirm() {
    if (!pendingDeleteAccount) {
      return;
    }

    onDeleteAccount(pendingDeleteAccount);
    setPendingDeleteAccount(null);
  }

  function handleRoleChangeConfirm() {
    if (!pendingRoleChange) {
      return;
    }

    onRoleChange(pendingRoleChange.account, pendingRoleChange.nextRole);
    setPendingRoleChange(null);
  }

  function handlePasswordResetConfirm() {
    if (!pendingPasswordReset) {
      return;
    }

    onPasswordReset(pendingPasswordReset, newPassword.trim());
    setPendingPasswordReset(null);
    setNewPassword('');
    setShowNewPassword(false);
  }

  function handlePasswordResetCancel() {
    setPendingPasswordReset(null);
    setNewPassword('');
    setShowNewPassword(false);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div className="account-heading-main">
          <h3>Account Roles</h3>
          <div className="account-filter-row" aria-label="Filter accounts">
            {ACCOUNT_FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={accountFilter === key ? 'active' : ''}
                aria-pressed={accountFilter === key}
                onClick={() => setAccountFilter(key)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <span>{accountCountLabel}</span>
      </div>

      {!accounts.length ? (
        <div className="empty-state">No accounts found.</div>
      ) : !filteredAccounts.length ? (
        <div className="empty-state">No accounts match this filter.</div>
      ) : (
        <div className="table-wrap account-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Approved</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => {
                const isCurrentAccount = account.id === currentProfileId;
                const isProtectedAdmin = isGeneralManager && account.role === 'admin';
                const accountRole = normalizeRole(account.role) || 'operator';

                return (
                  <tr key={account.id}>
                    <td>{account.full_name || '-'}</td>
                    <td>{account.email || '-'}</td>
                    <td>
                      <select
                        value={accountRole}
                        disabled={workingId === account.id || isProtectedAdmin}
                        title={isProtectedAdmin ? 'General managers cannot change admin roles.' : undefined}
                        onChange={(event) =>
                          setPendingRoleChange({
                            account,
                            currentRole: accountRole,
                            nextRole: event.target.value,
                          })
                        }
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {formatRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{account.is_approved ? 'Yes' : 'No'}</td>
                    <td>{formatDateTime(account.created_at)}</td>
                    <td>
                      <div className="account-action-row">
                        <button
                          className="reset-password-button"
                          type="button"
                          disabled={workingId === account.id || isProtectedAdmin}
                          title={isProtectedAdmin ? 'General managers cannot reset admin account passwords.' : undefined}
                          aria-label={`Reset password for ${account.full_name || account.email || 'account'}`}
                          onClick={() => {
                            setNewPassword('');
                            setShowNewPassword(false);
                            setPendingPasswordReset(account);
                          }}
                        >
                          <KeyRound size={16} />
                          Reset
                        </button>
                        <button
                          className="delete-account-button"
                          type="button"
                          disabled={isCurrentAccount || workingId === account.id || isProtectedAdmin}
                          title={
                            isCurrentAccount
                              ? 'You cannot delete your own account.'
                              : isProtectedAdmin
                                ? 'General managers cannot delete admin accounts.'
                                : undefined
                          }
                          aria-label={`Delete ${account.full_name || account.email || 'account'}`}
                          onClick={() => setPendingDeleteAccount(account)}
                        >
                          <Trash2 size={16} />
                          {isCurrentAccount ? 'Current' : isProtectedAdmin ? 'Protected' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingDeleteAccount ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingDeleteAccount(null)}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="dialog-close-button"
              type="button"
              aria-label="Cancel delete"
              onClick={() => setPendingDeleteAccount(null)}
            >
              <X size={18} />
            </button>
            <h3 id="delete-account-title">Delete account?</h3>
            <p>
              This will delete {pendingDeleteAccount.full_name || pendingDeleteAccount.email || 'this account'} from
              Supabase Auth and remove the matching profile row.
            </p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-action" onClick={() => setPendingDeleteAccount(null)}>
                Cancel
              </button>
              <button type="button" className="danger-action" onClick={handleDeleteConfirm}>
                <Trash2 size={16} />
                Delete account
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRoleChange ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingRoleChange(null)}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-change-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="dialog-close-button"
              type="button"
              aria-label="Cancel role change"
              onClick={() => setPendingRoleChange(null)}
            >
              <X size={18} />
            </button>
            <h3 id="role-change-title">Change account role?</h3>
            <p>
              Change {pendingRoleChange.account.full_name || pendingRoleChange.account.email || 'this account'} from{' '}
              {formatRoleLabel(pendingRoleChange.currentRole)} to {formatRoleLabel(pendingRoleChange.nextRole)}.
            </p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-action" onClick={() => setPendingRoleChange(null)}>
                Cancel
              </button>
              <button type="button" onClick={handleRoleChangeConfirm}>
                Confirm role
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingPasswordReset ? (
        <div className="modal-backdrop" role="presentation" onClick={handlePasswordResetCancel}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="dialog-close-button"
              type="button"
              aria-label="Cancel password reset"
              onClick={handlePasswordResetCancel}
            >
              <X size={18} />
            </button>
            <h3 id="password-reset-title">Set new password</h3>
            <form className="account-edit-form" onSubmit={(event) => {
              event.preventDefault();
              handlePasswordResetConfirm();
            }}>
              <p>
                Enter a new password for {pendingPasswordReset.full_name || pendingPasswordReset.email || 'this account'}.
              </p>
              <label>
                New password
                <div className="password-input-wrap">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="password-visibility-button"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowNewPassword((current) => !current)}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <div className="confirm-dialog-actions">
                <button type="button" className="secondary-action" onClick={handlePasswordResetCancel}>
                  Cancel
                </button>
                <button type="submit" className="primary-action" disabled={newPassword.trim().length < 6}>
                  <KeyRound size={16} />
                  Save password
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
