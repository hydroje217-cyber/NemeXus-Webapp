import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, Save, Trash2, UserRoundCheck } from 'lucide-react';
import {
  deleteShiftAssignment,
  listShiftAssignments,
  saveShiftAssignment,
} from '../services/shifts';
import { SHIFT_RULES, formatShiftWindow } from '../utils/shifts';

function formatDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function formatDisplayDate(value) {
  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value || '-';
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function assignmentKey(assignment) {
  return `${assignment.assignment_date}:${assignment.site_id}:${assignment.shift_key}`;
}

export default function ShiftsScreen({ operators = [], sites = [], profile, onRefreshDashboard }) {
  const today = useMemo(() => new Date(), []);
  const assignableOperators = useMemo(
    () => operators.filter((operator) => operator.is_active !== false && operator.is_approved !== false),
    [operators]
  );
  const [fromDate, setFromDate] = useState(formatDateInputValue(today));
  const [toDate, setToDate] = useState(formatDateInputValue(addDays(today, 7)));
  const [assignments, setAssignments] = useState([]);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    assignment_date: formatDateInputValue(today),
    shift_key: 'A',
    site_id: sites[0]?.id || '',
    profile_id: assignableOperators[0]?.id || '',
    notes: '',
  });
  const canManageShifts = profile?.role === 'admin' || profile?.role === 'manager';

  useEffect(() => {
    setForm((current) => ({
      ...current,
      site_id: current.site_id || sites[0]?.id || '',
      profile_id: current.profile_id || assignableOperators[0]?.id || '',
    }));
  }, [assignableOperators, sites]);

  async function loadAssignments() {
    setLoading(true);
    setMessage('');

    try {
      const result = await listShiftAssignments({ fromDate, toDate });
      setAssignments(result.assignments);
      setSetupRequired(result.setupRequired);
    } catch (error) {
      setMessage(error.message || 'Failed to load shift assignments.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssignments();
  }, [fromDate, toDate]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!canManageShifts) {
      setMessage('Only managers and admins can assign shifts.');
      return;
    }

    if (!form.assignment_date || !form.site_id || !form.profile_id || !form.shift_key) {
      setMessage('Choose a date, site, shift, and operator.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const saved = await saveShiftAssignment(form);
      setAssignments((current) => {
        const next = current.filter((assignment) => assignmentKey(assignment) !== assignmentKey(saved));
        return [...next, saved].sort((a, b) =>
          `${a.assignment_date}:${a.shift_key}`.localeCompare(`${b.assignment_date}:${b.shift_key}`)
        );
      });
      setSetupRequired(false);
      setMessage('Shift assignment saved.');
      await onRefreshDashboard?.();
    } catch (error) {
      setMessage(error.message || 'Failed to save shift assignment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(assignment) {
    if (!canManageShifts) {
      setMessage('Only managers and admins can delete shift assignments.');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await deleteShiftAssignment(assignment.id);
      setAssignments((current) => current.filter((item) => item.id !== assignment.id));
      setMessage('Shift assignment deleted.');
      await onRefreshDashboard?.();
    } catch (error) {
      setMessage(error.message || 'Failed to delete shift assignment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="shift-screen">
      <div className="shift-hero">
        <div className="shift-hero-copy">
          <span className="section-icon">
            <UserRoundCheck size={17} />
          </span>
          <div>
            <h3>Shift Assignments</h3>
            <p>Readings are matched automatically by timestamp, site, and assigned operator.</p>
          </div>
        </div>
        <button className="refresh-button" type="button" onClick={loadAssignments} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : undefined} />
          Refresh
        </button>
      </div>

      {setupRequired ? (
        <div className="notice shift-setup-notice">
          Run <strong>supabase-shift-assignments.sql</strong> in Supabase SQL Editor to enable saved shift assignments.
        </div>
      ) : null}

      {message ? <div className="notice">{message}</div> : null}

      <form className="shift-assignment-form panel" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <h3>Assign Operator</h3>
          <span>{canManageShifts ? 'Manager/Admin' : 'Read only'}</span>
        </div>

        <div className="shift-form-grid">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={form.assignment_date}
              disabled={!canManageShifts || saving}
              onChange={(event) => setForm((current) => ({ ...current, assignment_date: event.target.value }))}
            />
          </label>

          <label>
            <span>Site</span>
            <select
              value={form.site_id}
              disabled={!canManageShifts || saving}
              onChange={(event) => setForm((current) => ({ ...current, site_id: event.target.value }))}
            >
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.type})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Shift</span>
            <select
              value={form.shift_key}
              disabled={!canManageShifts || saving}
              onChange={(event) => setForm((current) => ({ ...current, shift_key: event.target.value }))}
            >
              {SHIFT_RULES.map((shift) => (
                <option key={shift.key} value={shift.key}>
                  {shift.label} ({formatShiftWindow(shift.key)})
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Operator</span>
            <select
              value={form.profile_id}
              disabled={!canManageShifts || saving}
              onChange={(event) => setForm((current) => ({ ...current, profile_id: event.target.value }))}
            >
              <option value="">Select operator</option>
              {assignableOperators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.full_name || operator.email}
                </option>
              ))}
            </select>
          </label>

          <label className="shift-notes-field">
            <span>Notes</span>
            <input
              type="text"
              value={form.notes}
              disabled={!canManageShifts || saving}
              placeholder="Optional"
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
        </div>

        <button className="primary-action shift-save-button" type="submit" disabled={!canManageShifts || saving}>
          <Save size={16} />
          {saving ? 'Saving...' : 'Save assignment'}
        </button>
      </form>

      <section className="panel">
        <div className="panel-heading">
          <h3>Schedule</h3>
          <span>{assignments.length} assignment(s)</span>
        </div>

        <div className="shift-range-row">
          <label>
            <CalendarDays size={15} />
            <span>From</span>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>
            <CalendarDays size={15} />
            <span>To</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </div>

        {!assignments.length ? (
          <div className="empty-state">No shift assignments found for this range.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>Site</th>
                  <th>Operator</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{formatDisplayDate(assignment.assignment_date)}</td>
                    <td>
                      {assignment.shift_key} <span className="muted-cell">{formatShiftWindow(assignment.shift_key)}</span>
                    </td>
                    <td>{assignment.site?.name || '-'}</td>
                    <td>{assignment.profile?.full_name || assignment.profile?.email || '-'}</td>
                    <td>{assignment.status || 'scheduled'}</td>
                    <td>{assignment.notes || '-'}</td>
                    <td>
                      <button
                        className="delete-account-button"
                        type="button"
                        disabled={!canManageShifts || saving}
                        onClick={() => handleDelete(assignment)}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
