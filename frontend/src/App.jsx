import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkErrorBanner from './components/NetworkErrorBanner';
import {
    SignIn,
    SignUp,
    SignedIn,
    SignedOut,
    RedirectToSignIn,
    useUser,
    SignOutButton,
} from '@clerk/clerk-react';
import { LayoutDashboard, BarChart3, CalendarDays, LogOut } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import Dashboard   from './pages/Dashboard';
import Analytics   from './pages/Analytics';
import Appointments from './pages/Appointments';
import PatientDetailPage from './pages/PatientDetailPage';

// Shown while Clerk is still resolving the user's auth state
const LoadingScreen = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</p>
    </div>
);

// Reusable style object that centres Clerk's sign-in and sign-up cards on the page
const centredPage = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f9fafb',
};

const NAV_LINKS = [
    { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
    { to: '/analytics',    label: 'Analytics',    Icon: BarChart3 },
    { to: '/appointments', label: 'Appointments', Icon: CalendarDays },
];

function AppSidebar({ user }) {
    const { pathname } = useLocation();
    // Derive email and two-letter initials from the Clerk user object
    const email = user?.primaryEmailAddress?.emailAddress
        || user?.emailAddresses?.[0]?.emailAddress
        || '';
    const initials = email.slice(0, 2).toUpperCase();

    return (
        // item 2 — fixed positioning keeps sidebar in place while content scrolls
        <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 flex flex-col z-40 border-r border-gray-800">
            {/* Logo — item 1: no subtitle */}
            <div className="px-4 py-5">
                <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer">
                    <div className="size-8 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-sm">D</div>
                    <div className="text-sm font-semibold text-gray-100">Diacify</div>
                </Link>
            </div>

            <div className="border-t border-gray-800" />

            {/* Nav links */}
            <div className="flex-1 px-2 py-3">
                <nav className="space-y-1">
                    {NAV_LINKS.map(({ to, label, Icon }) => {
                        const isActive = pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                                    isActive
                                        ? 'bg-gray-800 text-white'
                                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                            >
                                <Icon className="size-4" />
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="border-t border-gray-800" />

            {/* User section — items 3 & 4 */}
            <div className="px-3 py-4 mb-4">
                <div className="flex items-center gap-2">
                    {/* item 3 — initials avatar */}
                    <div className="rounded-full bg-blue-600 w-8 h-8 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs text-gray-300 font-medium truncate max-w-35">{email}</div>
                        <div className="text-xs text-gray-500">Clinician</div>
                    </div>
                </div>
                {/* item 4 — sign out with LogOut icon */}
                <SignOutButton>
                    <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer mt-3">
                        <LogOut size={15} />
                        Sign out
                    </button>
                </SignOutButton>
            </div>
        </aside>
    );
}

function SidebarLayout({ user, children }) {
    return (
        <div>
            <AppSidebar user={user} />
            {/* item 2 — ml-64 offsets fixed sidebar; h-screen + overflow-y-auto scrolls content independently */}
            <main className="ml-64 h-screen overflow-y-auto">{children}</main>
        </div>
    );
}

// Wraps any route that requires the user to be signed in
function ProtectedRoute({ children }) {
    // isLoaded becomes true once Clerk has finished checking the session
    const { isLoaded, isSignedIn, user } = useUser();

    // Holds rendering until Clerk has resolved the auth state
    if (!isLoaded) return <LoadingScreen />;

    return (
        <>
            {/* Renders the page and passes the user object down to the child */}
            <SignedIn>{children(user, SidebarLayout)}</SignedIn>
            {/* Redirects unauthenticated visitors to the sign-in page */}
            <SignedOut><RedirectToSignIn /></SignedOut>
        </>
    );
}

// Defines all client-side routes and their auth requirements
export default function App() {
    return (
        <ErrorBoundary>
        <NetworkErrorBanner />
        <Routes>

            {/* Landing page — accessible without authentication */}
            <Route path="/" element={<LandingPage />} />

            {/* routing="path" is required so Clerk can manage its own internal sub-routes */}
            <Route
                path="/sign-in/*"
                element={
                    <div style={centredPage}>
                        <SignIn routing="path" path="/sign-in" />
                    </div>
                }
            />

            <Route
                path="/sign-up/*"
                element={
                    <div style={centredPage}>
                        <SignUp routing="path" path="/sign-up" />
                    </div>
                }
            />

            {/* Passes the Clerk user ID to Dashboard so it can scope API requests */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        {(user, Layout) => (
                            <Layout user={user}>
                                <Dashboard clerkId={user.id} />
                            </Layout>
                        )}
                    </ProtectedRoute>
                }
            />

            {/* Passes the Clerk user ID to Analytics so it can scope API requests */}
            <Route
                path="/analytics"
                element={
                    // children is a function (render prop pattern)- ProtectedRoute calls it
                    // with the user object so the child component receives clerkId without
                    // needing to access Clerk directly
                    <ProtectedRoute>
                        {(user, Layout) => (
                            <Layout user={user}>
                                <Analytics clerkId={user.id} />
                            </Layout>
                        )}
                    </ProtectedRoute>
                }
            />

            {/* Appointments page */}
            <Route
                path="/appointments"
                element={
                    <ProtectedRoute>
                        {(user, Layout) => (
                            <Layout user={user}>
                                <Appointments />
                            </Layout>
                        )}
                    </ProtectedRoute>
                }
            />

            {/* Patient profile page */}
            <Route
                path="/patients/:id"
                element={
                    <ProtectedRoute>
                        {(user, Layout) => (
                            <Layout user={user}>
                                <PatientDetailPage clerkId={user.id} />
                            </Layout>
                        )}
                    </ProtectedRoute>
                }
            />

            {/* Redirects any unrecognised path back to the landing page */}
            <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
        </ErrorBoundary>
    );
}