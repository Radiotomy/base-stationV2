import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AIHelpAssistant from '@/components/assistant/AIHelpAssistant';
import Header from '@/components/layout/Header';
import Breadcrumbs from '@/components/layout/Breadcrumbs';

// Pages
import Home from './pages/Home';
import Playlists from './pages/Playlists';
import PlaylistDetail from './pages/PlaylistDetail';
import Charts from './pages/Charts';
import Radio from './pages/Radio';
import FeaturedArtists from './pages/FeaturedArtists';
import Challenges from './pages/Challenges';
import Leaderboard from './pages/Leaderboard';
import Badges from './pages/Badges';
import AIStudio from './pages/AIStudio';
import LyricsStudio from './pages/LyricsStudio';
import MusicStudio from './pages/MusicStudio';
import VideoStudio from './pages/VideoStudio';
import LiveStudio from './pages/LiveStudio';
import CoverArtStudio from './pages/CoverArtStudio';
import AudioRemixStudio from './pages/AudioRemixStudio';
import VoiceCreator from './pages/VoiceCreator';
import SubmitTrack from './pages/SubmitTrack';
import ArtistProfile from './pages/ArtistProfile';
import SolanaRegistry from './pages/SolanaRegistry';
import BlockchainRegistry from './pages/BlockchainRegistry';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOverview from './pages/admin/AdminOverview';
import AdminTracks from './pages/admin/AdminTracks';
import AdminChallenges from './pages/admin/AdminChallenges';
import AdminFeatured from './pages/admin/AdminFeatured';
import AdminArtists from './pages/admin/AdminArtists';
import AdminSolana from './pages/admin/AdminSolana';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import CreatorDashboard from './pages/CreatorDashboard';
import MobileLayout from './components/layout/MobileLayout';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading AIVTV…</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <>
      {user && <Header user={user} />}
      {user && <Breadcrumbs />}
      <Routes>
        <Route element={<MobileLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlists/:id" element={<PlaylistDetail />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/radio" element={<Radio />} />
          <Route path="/featured-artists" element={<FeaturedArtists />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/badges" element={<Badges />} />
          <Route path="/ai-studio" element={<AIStudio />} />
          <Route path="/lyrics-studio" element={<LyricsStudio />} />
          <Route path="/music-studio" element={<MusicStudio />} />
          <Route path="/cover-art-studio" element={<CoverArtStudio />} />
          <Route path="/video-studio" element={<VideoStudio />} />
          <Route path="/live-studio" element={<LiveStudio />} />
          <Route path="/audio-remix-studio" element={<AudioRemixStudio />} />
          <Route path="/voice-creator" element={<VoiceCreator />} />
          <Route path="/submit" element={<SubmitTrack />} />
          <Route path="/artist/:id" element={<ArtistProfile />} />
          <Route path="/solana" element={<SolanaRegistry />} />
          <Route path="/blockchain" element={<BlockchainRegistry />} />
          <Route path="/creator-dashboard" element={<CreatorDashboard />} />
        </Route>
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<AdminOverview />} />
          <Route path="tracks" element={<AdminTracks />} />
          <Route path="challenges" element={<AdminChallenges />} />
          <Route path="featured" element={<AdminFeatured />} />
          <Route path="artists" element={<AdminArtists />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="solana" element={<AdminSolana />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <AIHelpAssistant />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App