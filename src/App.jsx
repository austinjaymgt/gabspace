import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from './hooks/useMediaQuery'
import Gabi from './components/Gabi'
import OrbiWidget from './components/OrbiWidget'
import gabspaceLockup from './assets/gabspace-lockup-dark-bg.svg'
import SplashScreen from './components/SplashScreen'
import { supabase } from './supabaseClient'
import { Icon } from './components/Icon'
import IntranetManager from './pages/IntranetManager'
import ProDev from './pages/ProDev'
import CreativeStrategy from './pages/CreativeStrategy'
import Briefs from './pages/Briefs'
import Packages from './pages/Packages'
import Expenses from './pages/Expenses'
import Snapshot from './pages/Snapshot'
import AdminPanel from './pages/AdminPanel'
import Sidebar from './components/Sidebar'
import MobileTabBar from './components/MobileTabBar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import AllClients from './pages/AllClients'
import Projects from './pages/Projects'
import Events from './pages/Events'
import Vendors from './pages/Vendors'
import Invoices from './pages/Invoices'
import Tasks from './pages/Tasks'
import ContentCalendar from './pages/ContentCalendar'
import Assets from './pages/Assets'
import BusinessEvents from './pages/BusinessEvents'
import MyEvents from './pages/MyEvents'
import EventBrainstorm from './pages/EventBrainstorm'
import Intranet from './pages/Intranet'
import TeamGoals from './pages/TeamGoals'
import ClientPortalManager from './pages/ClientPortalManager'
import ClientPortalView from './pages/ClientPortalView'
import { theme as t } from './theme'
import SubHeader from './components/SubHeader'
import Settings from './pages/Settings'
import TeamMembers from './pages/TeamMembers'
import OnboardingModal from './components/OnboardingModal'
import Resources from './pages/Resources'
import AddBusinessFlow from './components/AddBusinessFlow'

export default function App() {
  const isMobile = useIsMobile()
  const [session, setSession] = useState(null)
  const [currentPage, setCurrentPage] = useState('home')
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [businessSpaceId, setBusinessSpaceId] = useState(null)
  const [businessIdentityVersion, setBusinessIdentityVersion] = useState(0)
  const [portalActivityVersion, setPortalActivityVersion] = useState(0)
  const [userRole, setUserRole] = useState(null)
const [workspaceLoading, setWorkspaceLoading] = useState(true)
const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
const [signupsOpen, setSignupsOpen] = useState(true)
const [showAddBusinessFlow, setShowAddBusinessFlow] = useState(false)
const [addBusinessForced, setAddBusinessForced] = useState(false)
const [authChecked, setAuthChecked] = useState(false)
const [authSplashDone, setAuthSplashDone] = useState(false)
const [showDailySplash, setShowDailySplash] = useState(false)
const [showWelcomeSplash, setShowWelcomeSplash] = useState(false)
const splashStartRef = useRef(null)
const authStartRef = useRef(null)
const DAILY_SPLASH_KEY = 'gabspace_splash_last_shown'
const COLD_SPLASH_MIN_MS = 1600
const DAILY_SPLASH_MIN_MS = 1800
const WELCOME_SPLASH_MS = 2600

  useEffect(() => {
    authStartRef.current = Date.now()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthChecked(true)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase re-validates the session on tab focus and hands back a new
      // object each time (even when the user hasn't changed), which would
      // otherwise re-trigger the [session] workspace fetch below and blow
      // away whatever the user was doing. Only update when the user actually
      // changes (sign in/out/switch).
      setSession(prev => (prev?.user?.id === session?.user?.id ? prev : session))
    })
  }, [])

  // Hold the cold-auth splash for a minimum stretch so the gif/tagline are
  // actually visible, even when Supabase resolves the session instantly.
  useEffect(() => {
    if (!authChecked) return
    const elapsed = Date.now() - (authStartRef.current ?? Date.now())
    const timer = setTimeout(() => setAuthSplashDone(true), Math.max(0, COLD_SPLASH_MIN_MS - elapsed))
    return () => clearTimeout(timer)
  }, [authChecked])

  // Daily first-open splash — gated once per calendar day, using the same
  // gap that's already spent fetching the user's workspace/profile.
  useEffect(() => {
    if (!authChecked || !session) return
    const today = new Date().toDateString()
    if (localStorage.getItem(DAILY_SPLASH_KEY) !== today) {
      splashStartRef.current = Date.now()
      setShowDailySplash(true)
    }
  }, [authChecked, session])

  useEffect(() => {
    if (!showDailySplash || workspaceLoading) return
    const elapsed = Date.now() - splashStartRef.current
    const timer = setTimeout(() => {
      localStorage.setItem(DAILY_SPLASH_KEY, new Date().toDateString())
      setShowDailySplash(false)
    }, Math.max(0, DAILY_SPLASH_MIN_MS - elapsed))
    return () => clearTimeout(timer)
  }, [showDailySplash, workspaceLoading])

  useEffect(() => {
    if (!showWelcomeSplash) return
    const timer = setTimeout(() => setShowWelcomeSplash(false), WELCOME_SPLASH_MS)
    return () => clearTimeout(timer)
  }, [showWelcomeSplash])

  // Post-confirmation landing spot (emailRedirectTo points signup
  // confirmations here). Shows the onboarding checklist once, gated on
  // user_settings.onboarding_completed rather than the path itself, so
  // revisiting /welcome after finishing doesn't show it again.
  useEffect(() => {
    if (!session || window.location.pathname !== '/welcome') return
    supabase
      .from('user_settings')
      .select('onboarding_completed')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) setShowOnboarding(true)
        else window.history.replaceState({}, '', '/')
      })
  }, [session])

  // Platform-admin flag — is_platform_admin() server-side is the real
  // boundary (RLS); this just mirrors it for UI-layer gating.
  useEffect(() => {
    if (!session) { setIsPlatformAdmin(false); return }
    supabase
      .from('user_settings')
      .select('is_platform_admin')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setIsPlatformAdmin(!!data?.is_platform_admin))
  }, [session])

  // Signup kill switch — checked pre-auth, so the signup form can fall back
  // to a waitlist capture form when closed.
  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('signups_open')
      .single()
      .then(({ data }) => { if (data) setSignupsOpen(data.signups_open) })
  }, [])

  // Picks a fallback if the given business is archived (e.g. archived by a
  // co-owner in another session) — the active business_space_id should
  // never silently point at something archived. Self-heals user_profiles
  // when a fallback exists; flags needsCreate when this was the only one.
  async function resolveActiveBusiness(userId, businessSpaceIdToCheck, currentRole) {
    if (!businessSpaceIdToCheck) return { needsCreate: true }

    const { data: business } = await supabase
      .from('business_spaces')
      .select('archived_at')
      .eq('id', businessSpaceIdToCheck)
      .maybeSingle()
    if (!business?.archived_at) return { businessSpaceId: businessSpaceIdToCheck, role: currentRole }

    const { data: memberships } = await supabase
      .from('business_space_members')
      .select('business_space_id, role, business_spaces(archived_at)')
      .eq('user_id', userId)
      .neq('business_space_id', businessSpaceIdToCheck)
    const fallback = (memberships || []).find(m => m.business_spaces && !m.business_spaces.archived_at)
    if (!fallback) return { needsCreate: true }

    await supabase
      .from('user_profiles')
      .update({ business_space_id: fallback.business_space_id, role: fallback.role })
      .eq('user_id', userId)
    return { businessSpaceId: fallback.business_space_id, role: fallback.role }
  }

  useEffect(() => {
    if (!session) {
  setBusinessSpaceId(null)
  setUserRole(null)
  setWorkspaceLoading(false)
  return
}
    setWorkspaceLoading(true)

    supabase
      .from('user_profiles')
.select('business_space_id, role')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(async ({ data, error }) => {

    console.log('profile data:', data, 'error:', error)
    if (data) {
  const resolved = await resolveActiveBusiness(session.user.id, data.business_space_id, data.role)
  if (resolved.needsCreate) {
    setBusinessSpaceId(null)
    setUserRole(null)
    setAddBusinessForced(true)
  } else {
    setBusinessSpaceId(resolved.businessSpaceId)
    setUserRole(resolved.role)
  }

  setWorkspaceLoading(false)
} else {
  // Authenticated session with no matching user_profiles row (e.g. the
  // local DB was reset out from under a still-cached session) — this
  // account no longer exists here. Sign out rather than rendering a
  // half-logged-in app shell with a businessSpaceId that can never resolve.
  await supabase.auth.signOut()
  setSession(null)
  setBusinessSpaceId(null)
  setUserRole(null)
  setWorkspaceLoading(false)
}
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          workspace_name: workspaceName,
        },
        emailRedirectTo: `${window.location.origin}/welcome`,
      }
    })
    if (error) setError(error.message)
    else setError('Check your email to confirm your account!')
    setLoading(false)
  }

  async function handleWaitlistSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: waitlistError } = await supabase.from('waitlist').insert({ email })
    if (waitlistError) {
      setError(waitlistError.message.includes('duplicate') ? "You're already on the waitlist." : waitlistError.message)
    } else {
      setError("You're on the list — we'll email you when signups open back up.")
      setEmail('')
    }
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
    setBusinessSpaceId(null)
    setUserRole(null)
  }

  async function handleBusinessSpaceSwitch(newId) {
    const { data: business } = await supabase
      .from('business_spaces')
      .select('archived_at')
      .eq('id', newId)
      .maybeSingle()
    if (business?.archived_at) return { error: { message: 'This business is archived — restore it first.' } }

    const { data: membership } = await supabase
      .from('business_space_members')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('business_space_id', newId)
      .maybeSingle()

    const { error } = await supabase
      .from('user_profiles')
      .update({ business_space_id: newId, role: membership?.role || 'employee' })
      .eq('user_id', session.user.id)
    if (!error) {
      setBusinessSpaceId(newId)
      if (membership?.role) setUserRole(membership.role)
    }
    return { error }
  }

  async function handleArchiveBusinessSpace() {
    const { error } = await supabase.rpc('archive_business_space', { target_business_space_id: businessSpaceId })
    if (error) return { error }

    const { data } = await supabase
      .from('user_profiles')
      .select('business_space_id, role')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (data) {
      setBusinessSpaceId(data.business_space_id)
      setUserRole(data.role)
    }
    bumpBusinessIdentityVersion()
    setCurrentPage('dashboard')
    return {}
  }

  async function handleRestoreBusinessSpace(id) {
    const { error } = await supabase.rpc('restore_business_space', { target_business_space_id: id })
    if (!error) bumpBusinessIdentityVersion()
    return { error }
  }

  async function handleCreateBusinessSpace(name) {
    const { data: newId, error } = await supabase.rpc('create_business_space', { business_name: name })
    if (error) return { error }
    const result = await handleBusinessSpaceSwitch(newId)
    return { ...result, businessSpaceId: newId }
  }

  function bumpBusinessIdentityVersion() {
    setBusinessIdentityVersion(v => v + 1)
  }

  function bumpPortalActivity() {
    setPortalActivityVersion(v => v + 1)
  }

const pageProps = { businessSpaceId, userRole, session, onBusinessIdentityChange: bumpBusinessIdentityVersion, onArchiveBusiness: handleArchiveBusinessSpace, portalActivityVersion, onPortalActivityChange: bumpPortalActivity }
  const isOwnerOrAdmin = ['owner', 'co-owner'].includes(userRole)
  const isStaff = ['owner', 'co-owner', 'employee'].includes(userRole)
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
  switch (currentPage) {
      case 'dashboard':
        return <Dashboard {...pageProps} onNavigate={setCurrentPage} />

      case 'allclients':
      case 'all-allclients':
        return isStaff ? <AllClients {...pageProps} /> : <AccessDenied />
      case 'resources':
  return <Resources {...pageProps} />

      case 'projects':
        return isStaff ? <Projects {...pageProps} /> : <AccessDenied />
      case 'events':
        return isStaff ? <Events {...pageProps} /> : <AccessDenied />
      case 'my-events':
        return <MyEvents {...pageProps} />
      case 'brainstorm':
      case 'spark':
        return isStaff ? <EventBrainstorm {...pageProps} /> : <AccessDenied />
      case 'business-events':
        return isStaff ? <BusinessEvents {...pageProps} /> : <AccessDenied />

      case 'tasks':
        return <Tasks {...pageProps} />

      case 'income':
        return isOwnerOrAdmin ? <Invoices {...pageProps} /> : <AccessDenied />
      case 'expenses':
        return isOwnerOrAdmin ? <Expenses {...pageProps} /> : <AccessDenied />
      case 'snapshot':
        return isOwnerOrAdmin ? <Snapshot {...pageProps} onNavigate={setCurrentPage} /> : <AccessDenied />
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

      case 'team-members':
        return isOwnerOrAdmin ? <TeamMembers {...pageProps} /> : <AccessDenied />

      case 'intranet':
        return <Intranet />

      case 'pro-dev':
        return isStaff ? <ProDev {...pageProps} /> : <AccessDenied />

      case 'settings':
        if (workspaceLoading) return null
        return isOwnerOrAdmin ? <Settings {...pageProps} /> : <AccessDenied />

      case 'admin':
        return isPlatformAdmin ? <AdminPanel {...pageProps} /> : <AccessDenied />
      case 'packages':
        return <Packages {...pageProps} />
      case 'briefs':
        return <Briefs {...pageProps} />

      case 'creative-strategy':
        return isStaff ? <CreativeStrategy {...pageProps} /> : <AccessDenied />

      case 'intranet-manager':
        return isOwnerOrAdmin ? <IntranetManager {...pageProps} /> : <AccessDenied />

      case 'client-portal-manager':
        return isStaff ? <ClientPortalManager {...pageProps} /> : <AccessDenied />
      
        default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: t.fonts.sans }}>
            <h2 style={{ fontSize: t.fontSizes.xl, fontWeight: '600', color: t.colors.textPrimary, margin: '0 0 8px' }}>Coming soon</h2>
            <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary }}>This section is under construction.</p>
          </div>
          
        )
    }
  }
// Client portal public view — token in URL, no auth required
  if (new URLSearchParams(window.location.search).get('portal')) {
    return <ClientPortalView />
  }

// Cold auth check — brands the gap while Supabase confirms the session
  if (!authChecked || !authSplashDone) {
    return <SplashScreen tagline="loading your space…" />
  }

// Login / Signup screen
  if (!session) {
    const isSignup = mode === 'signup'
    const showWaitlistForm = isSignup && !signupsOpen
    return (
      <div className="force-light-theme" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', backgroundImage: 'var(--gradient-bg)', fontFamily: t.fonts.sans }}>
        <img src={gabspaceLockup} alt="gabspace" style={{ height: '44px', width: 'auto' }} />
        <div style={{ backgroundColor: t.colors.bgCard, borderRadius: t.radius.card, padding: '48px', width: '100%', maxWidth: '400px', boxShadow: t.shadows.lg, margin: '0 16px' }}>
          <p style={{ fontSize: t.fontSizes.md, color: t.colors.textTertiary, margin: '0 0 32px', fontStyle: 'italic' }}>
            {showWaitlistForm ? "signups are paused — join the waitlist." : isSignup ? 'create your space.' : 'welcome back.'}
          </p>

          <form onSubmit={showWaitlistForm ? handleWaitlistSubmit : (isSignup ? handleSignUp : handleLogin)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: error.includes('Check') || error.includes('on the list') ? t.colors.successLight : t.colors.dangerLight, color: error.includes('Check') || error.includes('on the list') ? t.colors.success : t.colors.danger, fontSize: t.fontSizes.base }}>
                {error}
              </div>
            )}

            {isSignup && !showWaitlistForm && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Your name</label>
                  <input
                    style={{ padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans }}
                    type="text"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Workspace name</label>
                  <input
                    style={{ padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans }}
                    type="text"
                    placeholder="Jane Doe Studio"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Email</label>
              <input
                style={{ padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans }}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {!showWaitlistForm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: t.fontSizes.sm, fontWeight: '500', color: t.colors.textSecondary }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ padding: '10px 14px', borderRadius: t.radius.full, border: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.md, outline: 'none', color: t.colors.textPrimary, fontFamily: t.fonts.sans, width: '100%', boxSizing: 'border-box', paddingRight: '44px' }}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: t.colors.textTertiary, padding: '2px', lineHeight: 1 }}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ padding: '12px', borderRadius: t.radius.full, border: 'none', backgroundColor: t.colors.primary, color: '#FFFFFF', fontSize: t.fontSizes.md, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans }}
            >
              {showWaitlistForm
                ? (loading ? 'Joining...' : 'Join waitlist')
                : loading ? (isSignup ? 'Creating account...' : 'Signing in...') : (isSignup ? 'Create account' : 'Sign in')}
            </button>

            {!isSignup && (
              resetSent ? (
                <div style={{ padding: '10px 14px', borderRadius: t.radius.md, backgroundColor: t.colors.successLight, color: t.colors.success, fontSize: t.fontSizes.base, textAlign: 'center' }}>
                  ✓ Password reset email sent — check your inbox
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: t.colors.textTertiary, fontSize: t.fontSizes.sm, cursor: 'pointer', textAlign: 'center', fontFamily: t.fonts.sans, textDecoration: 'underline', padding: 0 }}
                >
                  Forgot password?
                </button>
              )
            )}

            <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '16px', borderTop: `1px solid ${t.colors.border}`, fontSize: t.fontSizes.sm, color: t.colors.textTertiary, fontFamily: t.fonts.sans }}>
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(null); }}
                style={{ background: 'none', border: 'none', color: t.colors.primary, fontSize: t.fontSizes.sm, fontWeight: '600', cursor: 'pointer', fontFamily: t.fonts.sans, padding: 0 }}
              >
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // Temporary GABi visual test — visit /?gabi to see all moods
  if (new URLSearchParams(window.location.search).has('gabi')) {
    const moods = ['idle', 'working', 'thinking', 'celebrating']
    return (
      <div style={{ minHeight: '100vh', fontFamily: 'sans-serif', padding: '40px 24px', boxSizing: 'border-box' }}>
        {/* Light background section */}
        <div style={{ backgroundColor: '#F7F5F0', borderRadius: 16, padding: '32px', marginBottom: 32 }}>
          <p style={{ margin: '0 0 24px', fontWeight: 600, color: '#414042', fontSize: 14 }}>Light background — all 4 moods</p>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {moods.map(m => (
              <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                  <Gabi mood={m} size={40} theme="light" />
                  <Gabi mood={m} size={56} theme="light" />
                  <Gabi mood={m} size={80} theme="light" />
                </div>
                <span style={{ fontSize: 12, color: '#7F5793', fontWeight: 600 }}>{m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dark background section */}
        <div style={{ backgroundColor: '#414042', borderRadius: 16, padding: '32px' }}>
          <p style={{ margin: '0 0 24px', fontWeight: 600, color: '#B8B0E8', fontSize: 14 }}>Dark background — all 4 moods</p>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {moods.map(m => (
              <div key={m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                  <Gabi mood={m} size={40} theme="dark" />
                  <Gabi mood={m} size={56} theme="dark" />
                  <Gabi mood={m} size={80} theme="dark" />
                </div>
                <span style={{ fontSize: 12, color: '#B8B0E8', fontWeight: 600 }}>{m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (workspaceLoading || showDailySplash) {
    return <SplashScreen tagline="welcome back." />
  }

  const overlays = (
    <>
      {showOnboarding && (
  <OnboardingModal
    userId={session.user.id}
    onComplete={() => {
      setShowOnboarding(false)
      window.history.replaceState({}, '', '/')
      // Onboarding just finished — this is a once-per-user "you've arrived" moment,
      // not the daily splash, so mark today as seen to avoid showing both back to back.
      localStorage.setItem(DAILY_SPLASH_KEY, new Date().toDateString())
      setShowWelcomeSplash(true)
    }}
    onSkip={() => { setShowOnboarding(false); window.history.replaceState({}, '', '/') }}
    onNavigate={(page) => { setShowOnboarding(false); window.history.replaceState({}, '', '/'); setCurrentPage(page) }}
  />
)}

      {showWelcomeSplash && (
  <SplashScreen tagline="you're all set — welcome to your space." />
)}

      {(showAddBusinessFlow || addBusinessForced) && (
  <AddBusinessFlow
    forced={addBusinessForced}
    onCreate={handleCreateBusinessSpace}
    onClose={addBusinessForced ? undefined : () => setShowAddBusinessFlow(false)}
    onDone={() => {
      setShowAddBusinessFlow(false)
      setAddBusinessForced(false)
      bumpBusinessIdentityVersion()
      setCurrentPage('dashboard')
    }}
  />
)}
    </>
  )

  // Home is a distinct full-screen moment before entering the workspace —
  // no sidebar/topbar/subheader/floating Gabi badge. Those come back the
  // instant the user navigates anywhere else.
  if (currentPage === 'home' && !isClientOnly && !addBusinessForced) {
    return (
      <>
        {overlays}
        <Home session={session} businessSpaceId={businessSpaceId} onSwitchBusinessSpace={handleBusinessSpaceSwitch} onNavigate={setCurrentPage} />
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: t.colors.bg, backgroundImage: 'var(--gradient-bg)', fontFamily: t.fonts.sans, display: 'flex' }}>
      {overlays}
{!isMobile && <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} userRole={userRole} onLogout={handleLogout} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} businessSpaceId={businessSpaceId} portalActivityVersion={portalActivityVersion} isPlatformAdmin={isPlatformAdmin} />}      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100vh', minWidth: 0, paddingBottom: isMobile ? 'calc(60px + env(safe-area-inset-bottom))' : 0 }}>
        <TopBar session={session} onLogout={handleLogout} currentPage={currentPage} onMenuClick={() => setSidebarOpen(true)} onNavigate={setCurrentPage} userRole={userRole} businessSpaceId={businessSpaceId} onSwitchBusinessSpace={handleBusinessSpaceSwitch} onOpenCreateBusinessFlow={() => setShowAddBusinessFlow(true)} onRestoreBusinessSpace={handleRestoreBusinessSpace} businessIdentityVersion={businessIdentityVersion} hideMenuButton={isMobile} />
        <SubHeader currentPage={currentPage} onNavigate={setCurrentPage} session={session} businessSpaceId={businessSpaceId} />
        <div style={{ flex: 1 }}>
          {renderPage()}
        </div>
      </div>
      {isMobile && <MobileTabBar currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout} businessSpaceId={businessSpaceId} isPlatformAdmin={isPlatformAdmin} />}
      <div style={{ position: 'fixed', bottom: isMobile ? 'calc(72px + env(safe-area-inset-bottom))' : 24, right: isMobile ? 12 : 24, zIndex: 999 }}>
        <OrbiWidget session={session} businessSpaceId={businessSpaceId} onSwitchBusinessSpace={handleBusinessSpaceSwitch} isMobile={isMobile} onNavigate={setCurrentPage} />
      </div>
    </div>
  )
}
