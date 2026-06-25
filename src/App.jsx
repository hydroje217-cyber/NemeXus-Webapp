import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from './lib/supabase';
import AccessRequiredScreen from './screens/AccessRequiredScreen';
import DashboardScreen from './screens/DashboardScreen';
import LoadingScreen from './screens/LoadingScreen';
import LoginScreen from './screens/LoginScreen';
import SupabaseMissingScreen from './screens/SupabaseMissingScreen';
import {
  approveOperatorProfile,
  assignProfileRole,
  deleteProfileAccount,
  formatRoleLabel,
  getDashboardSnapshot,
  getProfile,
  isGeneralManagerRole,
  isAdminRole,
  isOfficeRole,
  isSummaryReportRole,
  resetProfilePassword,
  saveSummaryReportInput,
  updateAccountPresence,
  updateProfileEmail,
} from './services/dashboard';
import { loadSummaryReportInputs } from './screens/SummaryReportScreen';

const PRESENCE_HEARTBEAT_MS = 45 * 1000;
const DASHBOARD_REFRESH_MS = 30 * 1000;

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [summaryReportInputs, setSummaryReportInputs] = useState(loadSummaryReportInputs);
  const [loading, setLoading] = useState(true);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [message, setMessage] = useState('');
  const [activeView, setActiveView] = useState('dashboard');
  const [workingId, setWorkingId] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    return window.localStorage.getItem('nemexus-theme') || 'dark';
  });

  const isAdmin = isAdminRole(profile?.role);
  const isGeneralManager = isGeneralManagerRole(profile?.role);
  const canAccessSummaryReport = isSummaryReportRole(profile?.role);
  const canUseDashboard = isOfficeRole(profile?.role);

  async function loadDashboard({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshingDashboard(true);
    }

    try {
      const nextDashboard = await getDashboardSnapshot();
      setDashboard(nextDashboard);
      setSummaryReportInputs(nextDashboard.summaryReportInputs ?? {});
      setLastUpdatedAt(new Date().toISOString());
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
      setRefreshingDashboard(false);
    }
  }

  async function loadProfile(nextSession) {
    if (!nextSession?.user) {
      setProfile(null);
      setDashboard(null);
      setSummaryReportInputs(loadSummaryReportInputs());
      setLastUpdatedAt(null);
      setLoading(false);
      return;
    }

    try {
      const nextProfile = await getProfile(nextSession.user.id);
      setProfile(nextProfile);

      if (isOfficeRole(nextProfile?.role)) {
        await loadDashboard({ silent: true });
      } else {
        setDashboard(null);
        setSummaryReportInputs(loadSummaryReportInputs());
        setLastUpdatedAt(null);
      }
    } catch (error) {
      setMessage(error.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        setMessage(error.message || 'Failed to restore session.');
        setLoading(false);
        return;
      }

      setSession(data.session ?? null);
      if (data.session) {
        setActiveView('dashboard');
      }
      loadProfile(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession ?? null);
      if (event === 'SIGNED_IN' && nextSession) {
        setActiveView('dashboard');
      }
      loadProfile(nextSession ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin && (activeView === 'approvals' || activeView === 'accounts' || activeView === 'login-logs')) {
      setActiveView('dashboard');
    }

    if (!canAccessSummaryReport && activeView === 'summary-report') {
      setActiveView('dashboard');
    }
  }, [activeView, canAccessSummaryReport, isAdmin]);

  useEffect(() => {
    if (!supabaseReady || !supabase || !canUseDashboard) {
      return undefined;
    }

    let refreshTimer = 0;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadDashboard({ silent: true });
      }, 800);
    };

    const channel = supabase
      .channel('manager-dashboard-freshness')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_site_summaries' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chlorination_readings' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deepwell_readings' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_login_logs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'summary_report_inputs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, scheduleRefresh)
      .subscribe();
    const dashboardRefreshTimer = window.setInterval(() => {
      loadDashboard({ silent: true });
    }, DASHBOARD_REFRESH_MS);

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(dashboardRefreshTimer);
      supabase.removeChannel(channel);
    };
  }, [canUseDashboard]);

  useEffect(() => {
    if (!supabaseReady || !supabase || !session?.user) {
      return undefined;
    }

    let presenceTimer = 0;

    async function sendPresence() {
      if (document.visibilityState === 'hidden') {
        return;
      }

      try {
        await updateAccountPresence({
          userAgent: typeof window === 'undefined' ? null : window.navigator.userAgent,
        });
      } catch (error) {
        console.warn('Failed to update account presence.', error);
      }
    }

    sendPresence();
    presenceTimer = window.setInterval(sendPresence, PRESENCE_HEARTBEAT_MS);
    window.addEventListener('focus', sendPresence);
    document.addEventListener('visibilitychange', sendPresence);

    return () => {
      window.clearInterval(presenceTimer);
      window.removeEventListener('focus', sendPresence);
      document.removeEventListener('visibilitychange', sendPresence);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem('nemexus-theme', themeMode);
  }, [themeMode]);

  function handleThemeToggle() {
    setThemeMode((currentMode) => (currentMode === 'dark' ? 'light' : 'dark'));
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setDashboard(null);
    setSummaryReportInputs(loadSummaryReportInputs());
    setLastUpdatedAt(null);
    setActiveView('dashboard');
  }

  async function handleSaveSummaryReportInput(monthKey, input) {
    const savedInput = await saveSummaryReportInput({ monthKey, input });

    setSummaryReportInputs((currentInputs) => ({
      ...currentInputs,
      [savedInput.monthKey]: savedInput.input,
    }));

    return savedInput;
  }

  async function handleUpdateAccount({ email, password }) {
    if (!session?.user) {
      throw new Error('No signed-in account found.');
    }

    const nextEmail = email.trim();
    const currentEmail = session.user.email || profile?.email || '';
    const authUpdates = {};

    if (nextEmail && nextEmail !== currentEmail) {
      authUpdates.email = nextEmail;
    }

    if (password) {
      authUpdates.password = password;
    }

    if (!Object.keys(authUpdates).length) {
      throw new Error('Enter a new email or password to update.');
    }

    const { data, error } = await supabase.auth.updateUser(authUpdates);

    if (error) {
      throw new Error(error.message || 'Failed to update account.');
    }

    if (authUpdates.email) {
      await updateProfileEmail(session.user.id, nextEmail);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nemexus-last-email', nextEmail);
      }
    }

    const nextSession = data?.user ? { ...session, user: data.user } : session;
    setSession(nextSession);
    await loadProfile(nextSession);

    return authUpdates.email
      ? 'Account updated. Check the new email inbox if Supabase asks for confirmation.'
      : 'Password updated.';
  }

  async function handleApprove(account) {
    setWorkingId(account.id);
    setMessage('');

    try {
      await approveOperatorProfile(account.id);
      await loadDashboard({ silent: true });
      setMessage(`${account.full_name || account.email || 'Operator'} approved.`);
    } catch (error) {
      setMessage(error.message || 'Failed to approve operator.');
    } finally {
      setWorkingId('');
    }
  }

  async function handleRoleChange(account, nextRole) {
    if (isGeneralManager && account.role === 'admin') {
      setMessage('General managers cannot change admin account roles.');
      return;
    }

    setWorkingId(account.id);
    setMessage('');

    try {
      await assignProfileRole(account.id, nextRole);
      await loadDashboard({ silent: true });
      setMessage(`${account.full_name || account.email || 'Account'} updated to ${formatRoleLabel(nextRole)}.`);
    } catch (error) {
      setMessage(error.message || 'Failed to update role.');
    } finally {
      setWorkingId('');
    }
  }

  async function handlePasswordReset(account, password) {
    if (isGeneralManager && account.role === 'admin') {
      setMessage('General managers cannot reset admin account passwords.');
      return;
    }

    setWorkingId(account.id);
    setMessage('');

    try {
      await resetProfilePassword(account.id, password);
      await loadDashboard({ silent: true });
      setMessage(`${account.full_name || account.email || 'Account'} password updated.`);
    } catch (error) {
      setMessage(error.message || 'Failed to reset password.');
    } finally {
      setWorkingId('');
    }
  }

  async function handleDeleteAccount(account) {
    if (isGeneralManager && account.role === 'admin') {
      setMessage('General managers cannot delete admin accounts.');
      return;
    }

    setWorkingId(account.id);
    setMessage('');

    try {
      await deleteProfileAccount(account.id);
      await loadDashboard({ silent: true });
      setMessage(`${account.full_name || account.email || 'Account'} deleted.`);
    } catch (error) {
      setMessage(error.message || 'Failed to delete account.');
    } finally {
      setWorkingId('');
    }
  }

  if (!supabaseReady) {
    return <SupabaseMissingScreen />;
  }

  if (!session) {
    return <LoginScreen message={message} onMessage={setMessage} />;
  }

  if (loading) {
    return <LoadingScreen activeView={activeView} themeMode={themeMode} />;
  }

  if (!canUseDashboard) {
    return <AccessRequiredScreen onSignOut={handleSignOut} />;
  }

  return (
    <DashboardScreen
      activeView={activeView}
      dashboard={dashboard}
      summaryReportInputs={summaryReportInputs}
      canAccessSummaryReport={canAccessSummaryReport}
      isAdmin={isAdmin}
      isGeneralManager={isGeneralManager}
      loading={loading}
      refreshing={refreshingDashboard}
      message={message}
      profile={profile}
      session={session}
      lastUpdatedAt={lastUpdatedAt}
      themeMode={themeMode}
      workingId={workingId}
      onApprove={handleApprove}
      onNavigate={setActiveView}
      onRefresh={() => loadDashboard()}
      onSummaryReportInputsChange={setSummaryReportInputs}
      onSummaryReportInputSave={handleSaveSummaryReportInput}
      onRoleChange={handleRoleChange}
      onPasswordReset={handlePasswordReset}
      onDeleteAccount={handleDeleteAccount}
      onUpdateAccount={handleUpdateAccount}
      onSignOut={handleSignOut}
      onThemeToggle={handleThemeToggle}
    />
  );
}
