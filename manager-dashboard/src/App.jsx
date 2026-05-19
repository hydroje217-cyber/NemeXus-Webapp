import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from './lib/supabase';
import AccessRequiredScreen from './screens/AccessRequiredScreen';
import DashboardScreen from './screens/DashboardScreen';
import LoadingScreen from './screens/LoadingScreen';
import LoginScreen from './screens/LoginScreen';
import SupabaseMissingScreen from './screens/SupabaseMissingScreen';
import {
  approveProfileAccount,
  assignProfileRole,
  deleteProfileAccount,
  getDashboardSnapshot,
  getProfile,
  isOfficeRole,
} from './services/dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const isAdmin = profile?.role === 'admin' || profile?.role === 'general_manager';
  const canUseDashboard =
    isOfficeRole(profile?.role) && profile?.is_active !== false && profile?.is_approved === true;

  function getProtectedAccountMessage(account) {
    if (account.id === profile?.id) {
      return '';
    }

    if (profile?.role === 'admin' && account.role === 'admin') {
      return 'Admins cannot change or delete another admin account.';
    }

    if (
      profile?.role === 'general_manager' &&
      (account.role === 'general_manager' || account.role === 'admin')
    ) {
      return 'General managers cannot change or delete general manager or admin accounts.';
    }

    return '';
  }

  async function loadDashboard({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }

    try {
      const nextDashboard = await getDashboardSnapshot();
      setDashboard(nextDashboard);
      setLastUpdatedAt(new Date().toISOString());
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(nextSession) {
    if (!nextSession?.user) {
      setProfile(null);
      setDashboard(null);
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
      loadProfile(data.session ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) {
        return;
      }

      setSession(nextSession ?? null);
      loadProfile(nextSession ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAdmin && (activeView === 'approvals' || activeView === 'accounts')) {
      setActiveView('readings');
    }
  }, [activeView, isAdmin]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, scheduleRefresh)
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [canUseDashboard]);

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
    setLastUpdatedAt(null);
  }

  async function handleApprove(account) {
    setWorkingId(account.id);
    setMessage('');

    try {
      await approveProfileAccount(account.id);
      await loadDashboard({ silent: true });
      setMessage(`${account.full_name || account.email || 'Account'} approved.`);
    } catch (error) {
      setMessage(error.message || 'Failed to approve account.');
    } finally {
      setWorkingId('');
    }
  }

  async function handleRoleChange(account, nextRole) {
    const protectedMessage = getProtectedAccountMessage(account);

    if (protectedMessage) {
      setMessage(protectedMessage);
      return;
    }

    setWorkingId(account.id);
    setMessage('');

    try {
      await assignProfileRole(account.id, nextRole);
      await loadDashboard({ silent: true });
      setMessage(`${account.full_name || account.email || 'Account'} updated to ${nextRole}.`);
    } catch (error) {
      setMessage(error.message || 'Failed to update role.');
    } finally {
      setWorkingId('');
    }
  }

  async function handleDeleteAccount(account) {
    const protectedMessage = getProtectedAccountMessage(account);

    if (protectedMessage) {
      setMessage(protectedMessage);
      return;
    }

    if (account.id === profile?.id) {
      setMessage('You cannot delete your own account.');
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
      isAdmin={isAdmin}
      loading={loading}
      message={message}
      profile={profile}
      lastUpdatedAt={lastUpdatedAt}
      themeMode={themeMode}
      workingId={workingId}
      onApprove={handleApprove}
      onNavigate={setActiveView}
      onRefresh={() => loadDashboard()}
      onRoleChange={handleRoleChange}
      onDeleteAccount={handleDeleteAccount}
      onSignOut={handleSignOut}
      onThemeToggle={handleThemeToggle}
    />
  );
}
