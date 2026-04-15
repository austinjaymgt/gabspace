import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import ProDev from './pages/ProDev'
import CreativeStrategy from './pages/CreativeStrategy'
import Briefs from './pages/Briefs'
import Packages from './pages/Packages'
import DepartmentBudget from './pages/DepartmentBudget'
import Inquiries from './pages/Inquiries'
import BetaAdmin from './pages/BetaAdmin'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import AllStakeholders from './pages/AllStakeholders'
import Projects from './pages/Projects'
import Events from './pages/Events'
import Vendors from './pages/Vendors'
import Invoices from './pages/Invoices'
import Tasks from './pages/Tasks'
import ClientPortal from './pages/ClientPortal'
import Expenses from './pages/Expenses'
import Revenue from './pages/Revenue'
import FinanceOverview from './pages/FinanceOverview'
import Campaigns from './pages/Campaigns'
import ContentCalendar from './pages/ContentCalendar'
import Assets from './pages/Assets'
import BusinessEvents from './pages/BusinessEvents'
import MyEvents from './pages/MyEvents'
import EventBrainstorm from './pages/EventBrainstorm'
import Intranet from './pages/Intranet'
import TeamGoals from './pages/TeamGoals'
import { theme as t } from './theme'
import SubHeader from './components/SubHeader'
import Settings from './pages/Settings'
import OnboardingModal from './components/OnboardingModal'

export default function App() {
  const [session, setSession] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const [workspaceId, setWorkspaceId] = useState(null)
  const [userRole, setUserRole] = useState(null)
const [workspaceLoading, setWorkspaceLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('user_settings')
      .select('onboarding_completed')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) setShowOnboarding(true)
      })
  }, [session])

  useEffect(() => {
    if (!session) {
  setWorkspaceId(null)
  setUserRole(null)
  setWorkspaceLoading(false)
  return
}
    setWorkspaceLoading(true)

    supabase
  .from('user_profiles')
  .select('workspace_id, role')
  .eq('user_id', session.user.id)
  .not('role', 'eq', 'employee')
  .maybeSingle()
  .then(async ({ data, error }) => {
    console.log('profile data:', data, 'error:', error)
    if (data) {
      setWorkspaceId(data.workspace_id)
          setUserRole(data.role)
          setWorkspaceLoading(false)
          return
        }

        const { data: invite } = await supabase
          .from('invites')
          .select('workspace_id, role, id, invited_by')
          .eq('email', session.user.email)
          .eq('accepted', false)
          .maybeSingle()

        if (invite) {
          await supabase.from('user_profiles').insert({
            user_id: session.user.id,
            workspace_id: invite.workspace_id,
            role: invite.role,
            invited_by: invite.invited_by,
          })
          await supabase.from('invites').update({ accepted: true }).eq('id', invite.id)
          setWorkspaceId(invite.workspace_id)
          setUserRole(invite.role)
        }

        setWorkspaceLoading(false)
      })
  }, [session])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else setSession(data.session)
    setLoading(false)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else setError('Check your email to confirm your account!')
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) return setError('Enter your email above first.')
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
    if (resetError) setError(resetError.message)
    else setResetSent(true)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null)
    setWorkspaceId(null)
    setUserRole(null)
  }

  const pageProps = { workspaceId, userRole, session }
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole)
  const isStaff = ['owner', 'admin', 'member'].includes(userRole)
  const isClientOnly = userRole === 'client'

  function AccessDenied() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans }}>
        <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>Access denied</h2>
        <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>You don't have permission to view this page.</p>
      </div>
    )
  }

function renderPage() {
  if (isClientOnly && currentPage !== 'client-portal') {
    return <ClientPortal {...pageProps} />
  }

  switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...pageProps} onNavigate={setCurrentPage} />

      case 'allstakeholders':
      case 'all-allstakeholders':
        return isStaff ? <AllStakeholders {...pageProps} /> : <AccessDenied />
      case 'resources':
        return isStaff ? <Vendors {...pageProps} /> : <AccessDenied />  

      case 'client-portal':
        return <ClientPortal {...pageProps} />

      case 'projects':
        return isStaff ? <Projects {...pageProps} /> : <AccessDenied />
      case 'events':
        return isStaff ? <Events {...pageProps} /> : <AccessDenied />
      case 'my-events':
        return <MyEvents {...pageProps} />
      case 'brainstorm':
        return isStaff ? <EventBrainstorm {...pageProps} /> : <AccessDenied />
      case 'business-events':
        return isStaff ? <BusinessEvents {...pageProps} /> : <AccessDenied />
      case 'inquiries':
        return isStaff ? <Inquiries {...pageProps} /> : <AccessDenied />

      case 'tasks':
        return <Tasks {...pageProps} />

      case 'invoices':
        return isOwnerOrAdmin ? <Invoices {...pageProps} /> : <AccessDenied />
      case 'department-budget':
        return isOwnerOrAdmin ? <DepartmentBudget {...pageProps} /> : <AccessDenied />
      case 'campaigns':
          return isStaff ? <CreativeStrategy {...pageProps} /> : <AccessDenied />
      case 'campaign-tracking':
        return isStaff ? <ContentCalendar {...pageProps} /> : <AccessDenied />
      case 'assets':
        return isStaff ? <Assets {...pageProps} /> : <AccessDenied />

      case 'vendors':
        return isStaff ? <Vendors {...pageProps} /> : <AccessDenied />

      case 'team-goals':
        return isStaff ? <TeamGoals {...pageProps} /> : <AccessDenied />

      case 'intranet':
        return <Intranet />

      case 'pro-dev':
        return isStaff ? <ProDev {...pageProps} /> : <AccessDenied />

      case 'settings':
        if (workspaceLoading) return null
        return isOwnerOrAdmin ? <Settings {...pageProps} /> : <AccessDenied />

      case 'beta-admin':
        return isOwnerOrAdmin ? <BetaAdmin {...pageProps} /> : <AccessDenied />
      case 'packages':
        return <Packages {...pageProps} />
      case 'briefs':
        return <Briefs {...pageProps} />

      case 'creative-strategy':
        return isStaff ? <CreativeStrategy {...pageProps} /> : <AccessDenied />

      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans }}>
            <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>Coming soon</h2>
            <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>This section is under construction.</p>
          </div>
        )
    }
  }

  // Login screen
  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.nav, fontFamily: t.fonts.sans }}>
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.xl, padding: '48px', width: '100%', maxWidth: '400px', boxShadow: t.shadows.lg, margin: '0 16px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.5px', fontFamily: t.fonts.heading }}>
            curators
          </h1>
          <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary, margin: '0 0 32px', fontStyle: 'italic' }}>
            where events meet excellence.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: error.includes('Check') ? '#f0fff8' : t.colors.dangerLight, color: error.includes('Check') ? t.colors.primary : t.colors.danger, fontSize: t.fontSizes.base }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Email</label>
              <input
                style={{ padding: '10px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans }}
                type="email"
                placeholder="you@prizepicks.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ padding: '10px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans, width: '100%', boxSizing: 'border-box', paddingRight: '44px' }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  onClick={() => setShowPassword(prev => !prev)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: t.colors.textTertiary, padding: '2px', lineHeight: 1 }}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{ padding: '12px', borderRadius: t.radius.md, border: 'none', backgroundColor: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            {resetSent ? (
              <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: '#f0fff8', color: t.colors.primary, fontSize: t.fontSizes.base, textAlign: 'center' }}>
                ✓ Password reset email sent — check your inbox
              </div>
            ) : (
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: t.colors.textTertiary, fontSize: t.fontSizes.sm, cursor: 'pointer', textAlign: 'center', fontFamily: t.fonts.sans, textDecoration: 'underline', padding: 0 }}
              >
                Forgot password?
              </button>
            )}

            <button
              onClick={handleSignUp}
              disabled={loading}
              style={{ padding: '12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, backgroundColor: t.colors.bgCard, color: t.colors.textSecondary, fontSize: t.fontSizes.md, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans }}
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (workspaceLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg, fontFamily: t.fonts.sans }}>
        <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>Loading workspace…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: t.colors.bg, fontFamily: t.fonts.sans, display: 'flex' }}>
      {showOnboarding && (
        <OnboardingModal
          userId={session.user.id}
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
          onNavigate={(page) => setCurrentPage(page)}
        />
      )}
<Sidebar currentPage={currentPage} onNavigate={setCurrentPage} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userRole={userRole} onLogout={handleLogout} />      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100vh', minWidth: 0 }}>
        <TopBar session={session} onLogout={handleLogout} currentPage={currentPage} onMenuClick={() => setSidebarOpen(true)} onNavigate={setCurrentPage} userRole={userRole} />
        <SubHeader currentPage={currentPage} onNavigate={setCurrentPage} session={session} />
        <div style={{ flex: 1 }}>
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
