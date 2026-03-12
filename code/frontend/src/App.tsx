import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import RouteGenerator from './pages/RouteGenerator';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setAuthToken } from './api';
import './index.css';

// Sync auth token to api module whenever auth state changes
function TokenSync() {
  const { token } = useAuth();
  useEffect(() => { setAuthToken(token); }, [token]);
  return null;
}

const Wrap = ({ name, children }: { name: string; children: React.ReactNode }) => (
  <Layout currentPageName={name}>{children}</Layout>
);

export default function App() {
  return (
    <AuthProvider>
      <TokenSync />
      <Router>
        <Routes>
          <Route path="/" element={<Wrap name="Home"><Home /></Wrap>} />
          <Route path="/Home" element={<Wrap name="Home"><Home /></Wrap>} />
          <Route path="/Explore" element={<Wrap name="Explore"><Explore /></Wrap>} />
          <Route path="/MapView" element={<Wrap name="MapView"><MapView /></Wrap>} />
          <Route path="/TripPlanner" element={<Wrap name="TripPlanner"><TripPlanner /></Wrap>} />
          <Route path="/POIDetail" element={<Wrap name="POIDetail"><POIDetail /></Wrap>} />
          <Route path="/TripDetail" element={<Wrap name="TripDetail"><TripDetail /></Wrap>} />
          <Route path="/Profile" element={<Wrap name="Profile"><Profile /></Wrap>} />
          <Route path="/Reports" element={<Wrap name="Reports"><Reports /></Wrap>} />
          <Route path="/CommunityVideos" element={<Wrap name="CommunityVideos"><CommunityVideos /></Wrap>} />
          <Route path="/Leaderboard" element={<Wrap name="Leaderboard"><Leaderboard /></Wrap>} />
          <Route path="/AddReport" element={<Wrap name="AddReport"><AddReport /></Wrap>} />
          <Route path="/AddReview" element={<Wrap name="AddReview"><AddReview /></Wrap>} />
          <Route path="/UploadVideo" element={<Wrap name="UploadVideo"><UploadVideo /></Wrap>} />
          <Route path="/MyTrips" element={<Wrap name="MyTrips"><MyTrips /></Wrap>} />
          <Route path="/Login" element={<Wrap name="Login"><Login /></Wrap>} />
          <Route path="/Register" element={<Wrap name="Register"><Register /></Wrap>} />
          <Route path="/RouteGenerator" element={<Wrap name="RouteGenerator"><RouteGenerator /></Wrap>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
