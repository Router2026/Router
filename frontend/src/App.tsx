import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Explore from './pages/Explore';
import MapView from './pages/MapView';
import TripPlanner from './pages/TripPlanner';
import POIDetail from './pages/POIDetail';
import TripDetail from './pages/TripDetail';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import CommunityVideos from './pages/CommunityVideos';
import Leaderboard from './pages/Leaderboard';
import AddReport from './pages/AddReport';
import AddReview from './pages/AddReview';
import UploadVideo from './pages/UploadVideo';
import MyTrips from './pages/MyTrips';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import RouteGenerator from './pages/RouteGenerator';
import AdminPanel from './pages/AdminPanel';
import ContributePOI from './pages/ContributePOI';
import PublicTrips from './pages/PublicTrips';
import PublicTripDetail from './pages/PublicTripDetail';
import Favorites from './pages/Favorites';
import ProfileEdit from './pages/ProfileEdit';
import AuthCallback from './pages/AuthCallback';

import { AuthProvider, useAuth } from './context/AuthContext';
import { TripBucketProvider } from './context/TripBucketContext';
import { FavoritesProvider } from './context/FavoritesContext';
import GuestBanner from './components/GuestBanner';
import OnboardingTour, { useShouldShowTour } from './components/OnboardingTour';
import { setAuthToken } from './api';
import './index.css';

function TokenSync() {
  const { token } = useAuth();
  useEffect(() => { setAuthToken(token); }, [token]);
  return null;
}

const Wrap = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <Layout currentPageName={name}>{children}</Layout>
);

/**
 * Protects a route.
 * allowGuest=true  → guests can see it (read-only browse)
 * allowGuest=false → must be a real registered user
 */
function RequireAuth({ children, allowGuest = false }: { children: React.ReactNode; allowGuest?: boolean }) {
  const { user, isLoading, isGuest } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div role="status" aria-label="טוען" style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'Heebo, sans-serif' }}>
        טוען...
      </div>
    );
  }

  // Not authenticated at all → send to login
  if (!user && !isGuest) return <Navigate to="/Login" state={{ from: location }} replace />;

  // Guest trying to access a registered-only page → send to login
  if (isGuest && !allowGuest) return <Navigate to="/Login" state={{ from: location }} replace />;

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
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
      {(!!user || isGuest) && showTour && <OnboardingTour onComplete={markDone} />}

      <Routes>
        {/* ── Auth & callback ───────────────────────────────── */}
        <Route path="/Login"           element={<Wrap name="Login"><Login /></Wrap>} />
        <Route path="/Register"        element={<Wrap name="Register"><Register /></Wrap>} />
        <Route path="/VerifyEmail"     element={<Wrap name="VerifyEmail"><VerifyEmail /></Wrap>} />
        <Route path="/ForgotPassword"  element={<Wrap name="ForgotPassword"><ForgotPassword /></Wrap>} />
        <Route path="/ResetPassword"   element={<Wrap name="ResetPassword"><ResetPassword /></Wrap>} />
        <Route path="/auth/callback"   element={<AuthCallback />} />
        <Route path="/ContributePOI"   element={<ContributePOI />} />

        {/* ── Fully public (no auth needed) ────────────────── */}
        <Route path="/trips"           element={<Wrap name="Trips"><PublicTrips /></Wrap>} />
        <Route path="/trips/:id"       element={<Wrap name="TripDetail"><PublicTripDetail /></Wrap>} />

        {/* ── Guest-accessible (read-only browsing) ─────────── */}
        <Route path="/"             element={<RequireAuth allowGuest><Wrap name="Home"><Home /></Wrap></RequireAuth>} />
        <Route path="/Home"         element={<RequireAuth allowGuest><Wrap name="Home"><Home /></Wrap></RequireAuth>} />
        <Route path="/Explore"      element={<RequireAuth allowGuest><Wrap name="Explore"><Explore /></Wrap></RequireAuth>} />
        <Route path="/MapView"      element={<RequireAuth allowGuest><Wrap name="MapView"><MapView /></Wrap></RequireAuth>} />
        <Route path="/POIDetail"    element={<RequireAuth allowGuest><Wrap name="POIDetail"><POIDetail /></Wrap></RequireAuth>} />
        <Route path="/Reports"      element={<RequireAuth allowGuest><Wrap name="Reports"><Reports /></Wrap></RequireAuth>} />
        <Route path="/Leaderboard"  element={<RequireAuth allowGuest><Wrap name="Leaderboard"><Leaderboard /></Wrap></RequireAuth>} />
        <Route path="/CommunityVideos" element={<RequireAuth allowGuest><Wrap name="CommunityVideos"><CommunityVideos /></Wrap></RequireAuth>} />

        {/* ── Registered users only ────────────────────────── */}
        <Route path="/TripPlanner"    element={<RequireAdmin><Wrap name="TripPlanner"><TripPlanner /></Wrap></RequireAdmin>} />
        <Route path="/TripDetail"     element={<RequireAuth><Wrap name="TripDetail"><TripDetail /></Wrap></RequireAuth>} />
        <Route path="/Profile"        element={<RequireAuth><Wrap name="Profile"><Profile /></Wrap></RequireAuth>} />
        <Route path="/AddReport"      element={<RequireAuth><Wrap name="AddReport"><AddReport /></Wrap></RequireAuth>} />
        <Route path="/AddReview"      element={<RequireAuth><Wrap name="AddReview"><AddReview /></Wrap></RequireAuth>} />
        <Route path="/UploadVideo"    element={<RequireAuth><Wrap name="UploadVideo"><UploadVideo /></Wrap></RequireAuth>} />
        <Route path="/MyTrips"        element={<RequireAuth><Wrap name="MyTrips"><MyTrips /></Wrap></RequireAuth>} />
        <Route path="/RouteGenerator" element={<RequireAuth><Wrap name="RouteGenerator"><RouteGenerator /></Wrap></RequireAuth>} />
        <Route path="/Admin"          element={<RequireAuth><Wrap name="Admin"><AdminPanel /></Wrap></RequireAuth>} />
        <Route path="/favorites"      element={<RequireAuth><Wrap name="Favorites"><Favorites /></Wrap></RequireAuth>} />
        <Route path="/profile/edit"   element={<RequireAuth><Wrap name="ProfileEdit"><ProfileEdit /></Wrap></RequireAuth>} />
      </Routes>
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
