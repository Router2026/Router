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
import { AuthProvider, useAuth } from './context/AuthContext';
import { setAuthToken } from './api';
import './index.css';
import ContributePOI from './pages/ContributePOI';

// Sync auth token to api module whenever auth state changes
function TokenSync() {
  const { token } = useAuth();
  useEffect(() => { setAuthToken(token); }, [token]);
  return null;
}

const Wrap = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <Layout currentPageName={name}>{children}</Layout>
);

// Guard: redirect unauthenticated users to /Login
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>טוען...</div>;
  if (!user) return <Navigate to="/Login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <TokenSync />
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/Login" element={<Wrap name="Login"><Login /></Wrap>} />
          <Route path="/Register" element={<Wrap name="Register"><Register /></Wrap>} />
          <Route path="/VerifyEmail" element={<Wrap name="VerifyEmail"><VerifyEmail /></Wrap>} />
          <Route path="/ForgotPassword" element={<Wrap name="ForgotPassword"><ForgotPassword /></Wrap>} />
          <Route path="/ResetPassword" element={<Wrap name="ResetPassword"><ResetPassword /></Wrap>} />

          {/* Protected routes */}
          <Route path="/" element={<RequireAuth><Wrap name="Home"><Home /></Wrap></RequireAuth>} />
          <Route path="/Home" element={<RequireAuth><Wrap name="Home"><Home /></Wrap></RequireAuth>} />
          <Route path="/Explore" element={<RequireAuth><Wrap name="Explore"><Explore /></Wrap></RequireAuth>} />
          <Route path="/MapView" element={<RequireAuth><Wrap name="MapView"><MapView /></Wrap></RequireAuth>} />
          <Route path="/TripPlanner" element={<RequireAuth><Wrap name="TripPlanner"><TripPlanner /></Wrap></RequireAuth>} />
          <Route path="/POIDetail" element={<RequireAuth><Wrap name="POIDetail"><POIDetail /></Wrap></RequireAuth>} />
          <Route path="/TripDetail" element={<RequireAuth><Wrap name="TripDetail"><TripDetail /></Wrap></RequireAuth>} />
          <Route path="/Profile" element={<RequireAuth><Wrap name="Profile"><Profile /></Wrap></RequireAuth>} />
          <Route path="/Reports" element={<RequireAuth><Wrap name="Reports"><Reports /></Wrap></RequireAuth>} />
          <Route path="/CommunityVideos" element={<RequireAuth><Wrap name="CommunityVideos"><CommunityVideos /></Wrap></RequireAuth>} />
          <Route path="/Leaderboard" element={<RequireAuth><Wrap name="Leaderboard"><Leaderboard /></Wrap></RequireAuth>} />
          <Route path="/AddReport" element={<RequireAuth><Wrap name="AddReport"><AddReport /></Wrap></RequireAuth>} />
          <Route path="/AddReview" element={<RequireAuth><Wrap name="AddReview"><AddReview /></Wrap></RequireAuth>} />
          <Route path="/UploadVideo" element={<RequireAuth><Wrap name="UploadVideo"><UploadVideo /></Wrap></RequireAuth>} />
          <Route path="/MyTrips" element={<RequireAuth><Wrap name="MyTrips"><MyTrips /></Wrap></RequireAuth>} />
          <Route path="/RouteGenerator" element={<RequireAuth><Wrap name="RouteGenerator"><RouteGenerator /></Wrap></RequireAuth>} />
          <Route path="/Admin" element={<RequireAuth><Wrap name="Admin"><AdminPanel /></Wrap></RequireAuth>} />
          <Route path="/ContributePOI" element={<ContributePOI />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
