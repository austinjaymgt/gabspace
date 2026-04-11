import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Inquiries from './pages/Inquiries'
import BetaAdmin from './pages/BetaAdmin' 
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
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

  // Auth layer — workspace + role
  const [workspaceId, setWorkspaceId] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)

  // Session listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    supabase.auth.onAuthStateChange((_event, session) => setSession(session))
  }, [])

  // Onboarding check
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

  // Workspace + role fetch
  useEffect(() => {
  if (!session) {
    setWorkspaceId(null)
    setUserRole(null)
    return
  }
  setWorkspaceLoading(true)

  supabase
    .from('user_profiles')
    .select('workspace_id, role')
    .eq('user_id', session.user.id)
    .maybeSingle()
    .then(async ({ data }) => {
      if (data) {
        setWorkspaceId(data.workspace_id)
        setUserRole(data.role)
        setWorkspaceLoading(false)
        return
      }

      // No profile yet — check for a pending invite matching this email
      const { data: invite } = await supabase
        .from('invites')
        .select('workspace_id, role, id, invited_by')
        .eq('email', session.user.email)
        .eq('accepted', false)
        .maybeSingle()

      if (invite) {
        // Create their profile
        await supabase.from('user_profiles').insert({
          user_id: session.user.id,
          workspace_id: invite.workspace_id,
          role: invite.role,
          invited_by: invite.invited_by,
        })

        // Mark invite accepted
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

  // Shared props passed to every page
  const pageProps = { workspaceId, userRole, session }

  // Role guards
  const isOwnerOrAdmin = ['owner', 'admin'].includes(userRole)
  const isStaff = ['owner', 'admin', 'member'].includes(userRole)
  const isClientOnly = userRole === 'client'

  function AccessDenied() {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans,
      }}>
        <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>
          Access denied
        </h2>
        <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>
          You don't have permission to view this page.
        </p>
      </div>
    )
  }

  function renderPage() {
      console.log('renderPage → userRole:', userRole, 'workspaceLoading:', workspaceLoading)
    // Client role goes straight to portal
    if (isClientOnly && currentPage !== 'client-portal') {
      return <ClientPortal {...pageProps} />
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...pageProps} onNavigate={setCurrentPage} />

      // Clients
      case 'clients':
      case 'all-clients':
        return isStaff ? <Clients {...pageProps} /> : <AccessDenied />

      case 'client-portal':
        return <ClientPortal {...pageProps} />

      // Projects & Events
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
      // Tasks
      case 'tasks':
        return <Tasks {...pageProps} />

      // Finance — owner/admin only
      case 'invoices':
        return isOwnerOrAdmin ? <Invoices {...pageProps} /> : <AccessDenied />
      case 'expenses':
        return isOwnerOrAdmin ? <Expenses {...pageProps} /> : <AccessDenied />
      case 'revenue':
        return isOwnerOrAdmin ? <Revenue {...pageProps} /> : <AccessDenied />
      case 'finance-overview':
        return isOwnerOrAdmin ? <FinanceOverview {...pageProps} onNavigate={setCurrentPage} /> : <AccessDenied />

      // Marketing
      case 'campaigns':
        return isStaff ? <Campaigns {...pageProps} /> : <AccessDenied />
      case 'campaign-tracking':
        return isStaff ? <ContentCalendar {...pageProps} /> : <AccessDenied />
      case 'assets':
        return isStaff ? <Assets {...pageProps} /> : <AccessDenied />

      // Vendors
      case 'vendors':
        return isStaff ? <Vendors {...pageProps} /> : <AccessDenied />

      // Settings — owner/admin only
      case 'settings':
          if (workspaceLoading) return null
        return isOwnerOrAdmin ? <Settings {...pageProps} /> : <AccessDenied />

      case 'beta-admin':
        return isOwnerOrAdmin ? <BetaAdmin {...pageProps} /> : <AccessDenied />

      default:
        return (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans,
          }}>
            <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>
              Coming soon
            </h2>
            <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>
              This section is under construction.
            </p>
          </div>
        )
    }
  }

  // Login screen
  if (!session) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', backgroundColor: t.colors.bg, fontFamily: t.fonts.sans,
      }}>
        <div style={{
          backgroundColor: t.colors.bgCard, borderRadius: t.radius.xl,
          padding: '48px', width: '100%', maxWidth: '400px',
          boxShadow: t.shadows.lg, margin: '0 16px',
        }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: t.colors.textPrimary, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            gabspace
          </h1>
          <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary, margin: '0 0 32px' }}>
            Clarity meets creativity
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: t.radius.md,
                backgroundColor: error.includes('Check') ? '#f0fff8' : t.colors.dangerLight,
                color: error.includes('Check') ? t.colors.primary : t.colors.danger,
                fontSize: t.fontSizes.base,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Email</label>
              <input
                style={{ padding: '10px 14px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans }}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{
                    padding: '10px 14px', borderRadius: t.radius.md,
                    border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md,
                    outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans,
                    width: '100%', boxSizing: 'border-box', paddingRight: '44px',
                  }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  onClick={() => setShowPassword(prev => !prev)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', fontSize: '16px',
                    color: t.colors.textTertiary, padding: '2px', lineHeight: 1,
                  }}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                padding: '12px', borderRadius: t.radius.md, border: 'none',
                backgroundColor: t.colors.primary, color: t.colors.textInverse,
                fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans,
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            {resetSent ? (
              <div style={{
                padding: '10px 14px', borderRadius: t.radius.md,
                backgroundColor: '#f0fff8', color: t.colors.primary,
                fontSize: t.fontSizes.base, textAlign: 'center',
              }}>
                ✓ Password reset email sent — check your inbox
              </div>
            ) : (
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                style={{
                  background: 'none', border: 'none', color: t.colors.textTertiary,
                  fontSize: t.fontSizes.sm, cursor: 'pointer', textAlign: 'center',
                  fontFamily: t.fonts.sans, textDecoration: 'underline', padding: 0,
                }}
              >
                Forgot password?
              </button>
            )}

            <button
              onClick={handleSignUp}
              disabled={loading}
              style={{
                padding: '12px', borderRadius: t.radius.md, border: `1px solid ${t.colors.border}`,
                backgroundColor: t.colors.bgCard, color: t.colors.textSecondary,
                fontSize: t.fontSizes.md, fontWeight: '500', cursor: 'pointer', fontFamily: t.fonts.sans,
              }}
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Workspace still loading
  if (workspaceLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', backgroundColor: t.colors.bg, fontFamily: t.fonts.sans,
      }}>
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
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userRole={userRole} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100vh', minWidth: 0 }}>
        <TopBar session={session} onLogout={handleLogout} currentPage={currentPage} onMenuClick={() => setSidebarOpen(true)} onNavigate={setCurrentPage} userRole={userRole} />
        <SubHeader currentPage={currentPage} onNavigate={setCurrentPage} session={session} />
        <div style={{ flex: 1 }}>
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
