import { useState } from 'react';
import { Trash2, X } from 'lucide-react';

const ROLE_OPTIONS = ['operator', 'supervisor', 'manager', 'admin'];

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

export default function AccountsScreen({ accounts, currentProfileId, workingId, onRoleChange, onDeleteAccount }) {
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState(null);
  const [pendingRoleChange, setPendingRoleChange] = useState(null);

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

                return (
                  <tr key={account.id}>
                    <td>{account.full_name || '-'}</td>
                    <td>{account.email || '-'}</td>
                    <td>
                      <select
                        value={account.role || 'operator'}
                        disabled={workingId === account.id}
                        onChange={(event) =>
                          setPendingRoleChange({
                            account,
                            currentRole: account.role || 'operator',
                            nextRole: event.target.value,
                          })
                        }
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
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
                        disabled={isCurrentAccount || workingId === account.id}
                        title={isCurrentAccount ? 'You cannot delete your own account.' : undefined}
                        aria-label={`Delete ${account.full_name || account.email || 'account'}`}
                        onClick={() => setPendingDeleteAccount(account)}
                      >
                        <Trash2 size={16} />
                        {isCurrentAccount ? 'Current account' : 'Delete'}
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
              {pendingRoleChange.currentRole} to {pendingRoleChange.nextRole}.
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
    </section>
  );
}
