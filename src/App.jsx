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
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import PWAInstallPrompt from '@/components/onboarding/PWAInstallPrompt';

// Pages
import Home from './pages/Home.jsx';
import Playlists from './pages/Playlists';
import PlaylistDetail from './pages/PlaylistDetail';
import Charts from './pages/Charts';
import Radio from './pages/Radio';
import FeaturedArtists from './pages/FeaturedArtists';
import Challenges from './pages/Challenges';
import Leaderboard from './pages/Leaderboard';
import Badges from './pages/Badges';
import AIStudio from './pages/AIStudio';
import StudioHub from './pages/StudioHub';
import LyricsStudio from './pages/LyricsStudio';
import MusicStudio from './pages/MusicStudio';
import VideoStudio from './pages/VideoStudio';
import AssetGallery from './pages/AssetGallery';
import LiveStudio from './pages/LiveStudio';
import LiveWatch from './pages/LiveWatch';
import LiveSummary from './pages/LiveSummary';
import AudiusTrending from './pages/AudiusTrending';
import AudiusSearch from './pages/AudiusSearch';
import AudiusArtist from './pages/AudiusArtist';
import AudiusTrack from './pages/AudiusTrack';
import CoverArtStudio from './pages/CoverArtStudio';
import StemCreatorStudio from './pages/StemCreatorStudio';
import MashupStudio from './pages/MashupStudio';
import VocalHarmonizer from './pages/VocalHarmonizer';
import MasteringStudio from './pages/MasteringStudio';
import CoverSongStudio from './pages/CoverSongStudio';
import VisualizerStudio from './pages/VisualizerStudio';
import StudioHistory from './pages/StudioHistory';
import AudioRemixStudio from './pages/AudioRemixStudio';
import VoiceCreator from './pages/VoiceCreator';
import MyProfile from './pages/MyProfile';
import SubmitTrack from './pages/SubmitTrack';
import ArtistProfile from './pages/ArtistProfile';
import SolanaRegistry from './pages/SolanaRegistry';
import BlockchainRegistry from './pages/BlockchainRegistry';
import ID3TagStudio from './pages/ID3TagStudio';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOverview from './pages/admin/AdminOverview';
import AdminTracks from './pages/admin/AdminTracks';
import AdminUsers from './pages/admin/AdminUsers';
import AdminChallenges from './pages/admin/AdminChallenges';
import AdminFeatured from './pages/admin/AdminFeatured';
import AdminArtists from './pages/admin/AdminArtists';
import AdminSolana from './pages/admin/AdminSolana';
import AdminBlockchainWallets from './pages/admin/AdminBlockchainWallets';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAIIntegrations from './pages/admin/AdminAIIntegrations';
import CreatorDashboard from './pages/CreatorDashboard';
import Credits from './pages/Credits';
import CommunityTemplates from './pages/CommunityTemplates';
import SocialMediaAutomation from './pages/SocialMediaAutomation';
import WhyBaseStation from './pages/WhyBaseStation';
import Help from './pages/Help';
import FanClub from './pages/FanClub';
import CreatorStore from './pages/CreatorStore';
import SmokeTests from './pages/dev/SmokeTests';
import ErrorLogViewer from './pages/dev/ErrorLogViewer';
import LiveRegression from './pages/dev/LiveRegression';
import LiveMulticlient from './pages/dev/LiveMulticlient';
import MobileLayout from './components/layout/MobileLayout';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading Base Station…</p>
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
          <Route path="/studios" element={<StudioHub />} />
          <Route path="/ai-studio" element={<AIStudio />} />
          <Route path="/lyrics-studio" element={<LyricsStudio />} />
          <Route path="/music-studio" element={<MusicStudio />} />
          <Route path="/cover-art-studio" element={<CoverArtStudio />} />
          <Route path="/video-studio" element={<VideoStudio />} />
          <Route path="/asset-gallery" element={<AssetGallery />} />
          <Route path="/live-studio" element={<LiveStudio />} />
          <Route path="/live-watch" element={<LiveWatch />} />
          <Route path="/live-summary" element={<LiveSummary />} />
          <Route path="/audius-trending" element={<AudiusTrending />} />
          <Route path="/audius-search" element={<AudiusSearch />} />
          <Route path="/audius-artist/:id" element={<AudiusArtist />} />
          <Route path="/audius-track/:id" element={<AudiusTrack />} />
          <Route path="/audio-remix-studio" element={<AudioRemixStudio />} />
          <Route path="/stem-creator" element={<StemCreatorStudio />} />
          <Route path="/mashup-studio" element={<MashupStudio />} />
          <Route path="/vocal-harmonizer" element={<VocalHarmonizer />} />
          <Route path="/mastering-studio" element={<MasteringStudio />} />
          <Route path="/cover-song-studio" element={<CoverSongStudio />} />
          <Route path="/visualizer-studio" element={<VisualizerStudio />} />
          <Route path="/ai-studio/history" element={<StudioHistory />} />
          <Route path="/voice-creator" element={<VoiceCreator />} />
          <Route path="/my-profile" element={<MyProfile />} />
          <Route path="/submit" element={<SubmitTrack />} />
          <Route path="/artist/:id" element={<ArtistProfile />} />
          <Route path="/solana" element={<SolanaRegistry />} />
          <Route path="/blockchain" element={<BlockchainRegistry />} />
          <Route path="/id3-studio" element={<ID3TagStudio />} />
          <Route path="/creator-dashboard" element={<CreatorDashboard />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/templates" element={<CommunityTemplates />} />
          <Route path="/social-automation" element={<SocialMediaAutomation />} />
          <Route path="/why-base-station" element={<WhyBaseStation />} />
          <Route path="/help" element={<Help />} />
          <Route path="/fanclub/:creatorId" element={<FanClub />} />
          <Route path="/creator-store/:creatorId" element={<CreatorStore />} />
          <Route path="/dev/smoke-tests" element={<SmokeTests />} />
          <Route path="/dev/error-log" element={<ErrorLogViewer />} />
          <Route path="/dev/live-regression" element={<LiveRegression />} />
          <Route path="/dev/live-multiclient" element={<LiveMulticlient />} />
        </Route>
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="tracks" element={<AdminTracks />} />
          <Route path="challenges" element={<AdminChallenges />} />
          <Route path="featured" element={<AdminFeatured />} />
          <Route path="artists" element={<AdminArtists />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="ai-integrations" element={<AdminAIIntegrations />} />
          <Route path="solana" element={<AdminSolana />} />
          <Route path="blockchain-wallets" element={<AdminBlockchainWallets />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <AIHelpAssistant />
      {user && <OnboardingModal />}
      {user && <PWAInstallPrompt />}
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