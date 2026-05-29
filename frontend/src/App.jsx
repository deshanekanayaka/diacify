import { Routes, Route, Navigate, Link } from 'react-router-dom';
import {
    SignIn,
    SignUp,
    SignedIn,
    SignedOut,
    RedirectToSignIn,
    useUser,
    UserButton,
    SignOutButton,
} from '@clerk/clerk-react';
import {
    SidebarProvider,
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarInset,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { LayoutDashboard, BarChart3, CalendarDays } from 'lucide-react';
import LandingPage from './pages/LandingPage';
import Dashboard   from './pages/Dashboard';
import Analytics   from './pages/Analytics';
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

function AppSidebar({ user }) {
    const fullName = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Clinician';
    return (
        <Sidebar className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            <SidebarHeader className="px-4 py-4">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">D</div>
                    <div>
                        <div className="text-sm font-semibold">DiabetesPriority</div>
                        <div className="text-xs text-muted-foreground">Care Console</div>
                    </div>
                </div>
            </SidebarHeader>
            <Separator />
            <SidebarContent className="px-2 py-3">
                <SidebarGroup>
                    <SidebarGroupLabel className="px-2">Navigation</SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <Link to="/dashboard" className="flex items-center gap-2">
                                    <LayoutDashboard className="size-4" />
                                    <span>Dashboard</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <Link to="/analytics" className="flex items-center gap-2">
                                    <BarChart3 className="size-4" />
                                    <span>Analytics</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <Link to="/appointments" className="flex items-center gap-2">
                                    <CalendarDays className="size-4" />
                                    <span>Appointments</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <Separator />
            <SidebarFooter className="px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{fullName}</div>
                        <div className="text-xs text-muted-foreground truncate">Signed in</div>
                    </div>
                    <UserButton appearance={{ elements: { avatarBox: 'size-7' } }} />
                </div>
                <div className="mt-3">
                    <SignOutButton>
                        <button className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                            Sign out
                        </button>
                    </SignOutButton>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}

function SidebarLayout({ user, children }) {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-background text-foreground">
                <AppSidebar user={user} />
                <SidebarInset className="flex-1">
                    <div className="p-4 sm:p-6 lg:p-8">{children}</div>
                </SidebarInset>
            </div>
        </SidebarProvider>
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
    );
}