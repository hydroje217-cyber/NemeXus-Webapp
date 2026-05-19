import { useState } from 'react';
import { Trash2, X } from 'lucide-react';

const ROLE_OPTIONS = ['operator', 'supervisor', 'manager', 'general_manager', 'admin'];

const ROLE_LABELS = {
  operator: 'operator',
  supervisor: 'supervisor',
  manager: 'manager',
  general_manager: 'general manager',
  admin: 'admin',
};

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

function getProtectedAccountReason({ account, currentProfileId, currentProfileRole }) {
  const isCurrentAccount = account.id === currentProfileId;

  if (isCurrentAccount) {
    return '';
  }

  if (currentProfileRole === 'admin' && account.role === 'admin') {
    return 'Admins cannot change or delete another admin account.';
  }

  if (
    currentProfileRole === 'general_manager' &&
    (account.role === 'general_manager' || account.role === 'admin')
  ) {
    return 'General managers cannot change or delete general manager or admin accounts.';
  }

  return '';
}

export default function AccountsScreen({
  accounts,
  currentProfileId,
  currentProfileRole,
  workingId,
  onRoleChange,
  onDeleteAccount,
}) {
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState(null);

  function handleDeleteConfirm() {
    if (!pendingDeleteAccount) {
      return;
    }

    onDeleteAccount(pendingDeleteAccount);
    setPendingDeleteAccount(null);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h3>Account Roles</h3>
        <span>{accounts.length} accounts</span>
      </div>

      {!accounts.length ? (
        <div className="empty-state">No accounts found.</div>
      ) : (
        <div className="table-wrap">
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
              {accounts.map((account) => {
                const isCurrentAccount = account.id === currentProfileId;
                const protectedReason = getProtectedAccountReason({
                  account,
                  currentProfileId,
                  currentProfileRole,
                });
                const cannotDeleteReason = isCurrentAccount
                  ? 'You cannot delete your own account.'
                  : protectedReason;
                const isProtectedAccount = Boolean(protectedReason);

                return (
                  <tr key={account.id}>
                    <td>{account.full_name || '-'}</td>
                    <td>{account.email || '-'}</td>
                    <td>
                      <select
                        value={account.role || 'operator'}
                        disabled={workingId === account.id || isProtectedAccount}
                        title={protectedReason || undefined}
                        onChange={(event) => onRoleChange(account, event.target.value)}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role] || role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{account.is_approved ? 'Yes' : 'No'}</td>
                    <td>{formatDateTime(account.created_at)}</td>
                    <td>
                      <button
                        className="delete-account-button"
                        type="button"
                        disabled={isCurrentAccount || isProtectedAccount || workingId === account.id}
                        title={cannotDeleteReason || undefined}
                        aria-label={`Delete ${account.full_name || account.email || 'account'}`}
                        onClick={() => setPendingDeleteAccount(account)}
                      >
                        <Trash2 size={16} />
                        {isCurrentAccount ? 'Current account' : isProtectedAccount ? 'Protected' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingDeleteAccount ? (
        <div className="modal-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
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
    </section>
  );
}
