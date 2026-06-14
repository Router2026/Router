import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';

const Home            = lazy(() => import('./pages/Home'));
const Explore         = lazy(() => import('./pages/Explore'));
const MapView         = lazy(() => import('./pages/MapView'));
const TripPlanner     = lazy(() => import('./pages/TripPlanner'));
const POIDetail       = lazy(() => import('./pages/POIDetail'));
const TripDetail      = lazy(() => import('./pages/TripDetail'));
const Profile         = lazy(() => import('./pages/Profile'));
const PublicUserProfile = lazy(() => import('./pages/PublicUserProfile'));
const Reports         = lazy(() => import('./pages/Reports'));
const CommunityVideos = lazy(() => import('./pages/CommunityVideos'));
const Leaderboard     = lazy(() => import('./pages/Leaderboard'));
const AddReport       = lazy(() => import('./pages/AddReport'));
const AddReview       = lazy(() => import('./pages/AddReview'));
const UploadVideo     = lazy(() => import('./pages/UploadVideo'));
const MyTrips         = lazy(() => import('./pages/MyTrips'));
const Login           = lazy(() => import('./pages/Login'));
const Register        = lazy(() => import('./pages/Register'));
const VerifyEmail     = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword  = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword   = lazy(() => import('./pages/ResetPassword'));
const RouteGenerator  = lazy(() => import('./pages/RouteGenerator'));
const AdminPanel      = lazy(() => import('./pages/AdminPanel'));
const AdminPlaces     = lazy(() => import('./pages/AdminPlaces'));
const ContributePOI   = lazy(() => import('./pages/ContributePOI'));
const PublicTrips     = lazy(() => import('./pages/PublicTrips'));
const PublicTripDetail = lazy(() => import('./pages/PublicTripDetail'));
const Favorites       = lazy(() => import('./pages/Favorites'));
const ProfileEdit     = lazy(() => import('./pages/ProfileEdit'));
const MyPlaces        = lazy(() => import('./pages/MyPlaces'));
const EditMyPlace     = lazy(() => import('./pages/EditMyPlace'));
const AuthCallback    = lazy(() => import('./pages/AuthCallback'));
const TermsOfService  = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy   = lazy(() => import('./pages/PrivacyPolicy'));
const LegalDisclaimer = lazy(() => import('./pages/LegalDisclaimer'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontFamily: 'Heebo, sans-serif' }}>
      טוען...
    </div>
  );
}

import { AuthProvider, useAuth } from './context/AuthContext';
import { TripBucketProvider } from './context/TripBucketContext';
import { FavoritesProvider } from './context/FavoritesContext';
import GuestBanner from './components/GuestBanner';
import OnboardingTour, { useShouldShowTour } from './components/OnboardingTour';
import InstallPrompt from './components/InstallPrompt';
import { setAuthToken } from './api';
import './index.css';

function TokenSync() {
  const { token } = useAuth();
  useEffect(() => { setAuthToken(token); }, [token]);
  return null;
}

const Wrap = ({ name, children }: Readonly<{ name: string; children: React.ReactNode }>) => (
  <Layout currentPageName={name}>{children}</Layout>
);

/**
 * Protects a route.
 * allowGuest=true  → guests can see it (read-only browse)
 * allowGuest=false → must be a real registered user
 */
function RequireAuth({ children, allowGuest = false }: Readonly<{ children: React.ReactNode; allowGuest?: boolean }>) {
  const { user, isLoading, isGuest } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <output aria-label="טוען" style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'Heebo, sans-serif', display: 'block' }}>
        טוען...
      </output>
    );
  }

  // Not authenticated at all → send to login
  if (!user && !isGuest) return <Navigate to="/Login" state={{ from: location }} replace />;

  // Guest trying to access a registered-only page → send to login
  if (isGuest && !allowGuest) return <Navigate to="/Login" state={{ from: location }} replace />;

  return <>{children}</>;
}

function RequireAdmin({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'Heebo, sans-serif' }}>טוען...</div>;
  if (!user || ('isGuest' in user && user.isGuest)) return <Navigate to="/Login" state={{ from: location }} replace />;
  if (!('is_admin' in user) || !user.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Inner app rendered inside Router so GuestBanner can use useNavigate */
function AppRoutes() {
  const { user, isGuest } = useAuth();
  const { show: showTour, markDone } = useShouldShowTour();

  return (
    <>
      <TokenSync />
      <GuestBanner />
      <InstallPrompt />
      {(!!user || isGuest) && showTour && <OnboardingTour onComplete={markDone} />}

      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Auth & callback ───────────────────────────────── */}
        <Route path="/Login" element={<Wrap name="Login"><Login /></Wrap>} />
        <Route path="/Register" element={<Wrap name="Register"><Register /></Wrap>} />
        <Route path="/VerifyEmail" element={<Wrap name="VerifyEmail"><VerifyEmail /></Wrap>} />
        <Route path="/ForgotPassword" element={<Wrap name="ForgotPassword"><ForgotPassword /></Wrap>} />
        <Route path="/ResetPassword" element={<Wrap name="ResetPassword"><ResetPassword /></Wrap>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/ContributePOI" element={<ContributePOI />} />
        <Route path="/terms" element={<Wrap name="TermsOfService"><TermsOfService /></Wrap>} />
        <Route path="/privacy" element={<Wrap name="PrivacyPolicy"><PrivacyPolicy /></Wrap>} />
        <Route path="/disclaimer" element={<Wrap name="LegalDisclaimer"><LegalDisclaimer /></Wrap>} />

        {/* ── Fully public (no auth needed) ────────────────── */}
        <Route path="/trips" element={<Wrap name="Trips"><PublicTrips /></Wrap>} />
        <Route path="/trips/:id" element={<Wrap name="TripDetail"><PublicTripDetail /></Wrap>} />
        <Route path="/profile/:id" element={<Wrap name="UserProfile"><PublicUserProfile /></Wrap>} />
        <Route path="/my-places" element={<RequireAuth><Wrap name="MyPlaces"><MyPlaces /></Wrap></RequireAuth>} />
        <Route path="/my-places/:id/edit" element={<RequireAuth><Wrap name="EditMyPlace"><EditMyPlace /></Wrap></RequireAuth>} />

        {/* ── Guest-accessible (read-only browsing) ─────────── */}
        <Route path="/" element={<RequireAuth allowGuest><Wrap name="Home"><Home /></Wrap></RequireAuth>} />
        <Route path="/Home" element={<RequireAuth allowGuest><Wrap name="Home"><Home /></Wrap></RequireAuth>} />
        <Route path="/Explore" element={<RequireAuth allowGuest><Wrap name="Explore"><Explore /></Wrap></RequireAuth>} />
        <Route path="/MapView" element={<RequireAuth allowGuest><Wrap name="MapView"><MapView /></Wrap></RequireAuth>} />
        <Route path="/POIDetail" element={<RequireAuth allowGuest><Wrap name="POIDetail"><POIDetail /></Wrap></RequireAuth>} />
        <Route path="/Reports" element={<RequireAuth allowGuest><Wrap name="Reports"><Reports /></Wrap></RequireAuth>} />
        <Route path="/Leaderboard" element={<RequireAuth allowGuest><Wrap name="Leaderboard"><Leaderboard /></Wrap></RequireAuth>} />
        <Route path="/CommunityVideos" element={<RequireAuth allowGuest><Wrap name="CommunityVideos"><CommunityVideos /></Wrap></RequireAuth>} />

        {/* ── Registered users only ────────────────────────── */}
        <Route path="/TripPlanner" element={<RequireAdmin><Wrap name="TripPlanner"><TripPlanner /></Wrap></RequireAdmin>} />
        <Route path="/TripDetail" element={<RequireAuth><Wrap name="TripDetail"><TripDetail /></Wrap></RequireAuth>} />
        <Route path="/Profile" element={<RequireAuth><Wrap name="Profile"><Profile /></Wrap></RequireAuth>} />
        <Route path="/AddReport" element={<RequireAuth><Wrap name="AddReport"><AddReport /></Wrap></RequireAuth>} />
        <Route path="/AddReview" element={<RequireAuth><Wrap name="AddReview"><AddReview /></Wrap></RequireAuth>} />
        <Route path="/UploadVideo" element={<RequireAuth><Wrap name="UploadVideo"><UploadVideo /></Wrap></RequireAuth>} />
        <Route path="/MyTrips" element={<RequireAuth><Wrap name="MyTrips"><MyTrips /></Wrap></RequireAuth>} />
        <Route path="/RouteGenerator" element={<RequireAuth><Wrap name="RouteGenerator"><RouteGenerator /></Wrap></RequireAuth>} />
        <Route path="/Admin" element={<RequireAuth><Wrap name="Admin"><AdminPanel /></Wrap></RequireAuth>} />
        <Route path="/Admin/places" element={<RequireAuth><Wrap name="AdminPlaces"><AdminPlaces /></Wrap></RequireAuth>} />
        <Route path="/favorites" element={<RequireAuth><Wrap name="Favorites"><Favorites /></Wrap></RequireAuth>} />
        <Route path="/profile/edit" element={<RequireAuth><Wrap name="ProfileEdit"><ProfileEdit /></Wrap></RequireAuth>} />
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TripBucketProvider>
        <FavoritesProvider>
          <Router>
            <AppRoutes />
          </Router>
        </FavoritesProvider>
      </TripBucketProvider>
    </AuthProvider>
  );
}