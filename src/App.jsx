import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminGate from '@/components/auth/AdminGate';
import AIHelpAssistant from '@/components/assistant/AIHelpAssistant';
import Header from '@/components/layout/Header';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import PWAInstallPrompt from '@/components/onboarding/PWAInstallPrompt';
import MobileLayout from './components/layout/MobileLayout';

// Pages — lazy-loaded so each route only downloads its own code (big mobile perf win)
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Home = lazy(() => import('./pages/Home.jsx'));
const Playlists = lazy(() => import('./pages/Playlists'));
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail'));
const Charts = lazy(() => import('./pages/Charts'));
const Radio = lazy(() => import('./pages/Radio'));
const FeaturedArtists = lazy(() => import('./pages/FeaturedArtists'));
const Challenges = lazy(() => import('./pages/Challenges'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const Badges = lazy(() => import('./pages/Badges'));
const AIStudio = lazy(() => import('./pages/AIStudio'));
const StudioHub = lazy(() => import('./pages/StudioHub'));
const LyricsStudio = lazy(() => import('./pages/LyricsStudio'));
const MusicStudio = lazy(() => import('./pages/MusicStudio'));
const VideoStudio = lazy(() => import('./pages/VideoStudio'));
const AssetGallery = lazy(() => import('./pages/AssetGallery'));
const LiveStudio = lazy(() => import('./pages/LiveStudio'));
const LiveManager = lazy(() => import('./pages/LiveManager'));
const LiveWatch = lazy(() => import('./pages/LiveWatch'));
const LiveSummary = lazy(() => import('./pages/LiveSummary'));
const AudiusTrending = lazy(() => import('./pages/AudiusTrending'));
const AudiusSearch = lazy(() => import('./pages/AudiusSearch'));
const AudiusArtist = lazy(() => import('./pages/AudiusArtist'));
const AudiusTrack = lazy(() => import('./pages/AudiusTrack'));
const CoverArtStudio = lazy(() => import('./pages/CoverArtStudio'));
const StemCreatorStudio = lazy(() => import('./pages/StemCreatorStudio'));
const MashupStudio = lazy(() => import('./pages/MashupStudio'));
const VocalHarmonizer = lazy(() => import('./pages/VocalHarmonizer'));
const MasteringStudio = lazy(() => import('./pages/MasteringStudio'));
const CoverSongStudio = lazy(() => import('./pages/CoverSongStudio'));
const VisualizerStudio = lazy(() => import('./pages/VisualizerStudio'));
const PromoStudio = lazy(() => import('./pages/PromoStudio'));
const SoundFXStudio = lazy(() => import('./pages/SoundFXStudio'));
const StudioHistory = lazy(() => import('./pages/StudioHistory'));
const AudioRemixStudio = lazy(() => import('./pages/AudioRemixStudio'));
const VoiceCreator = lazy(() => import('./pages/VoiceCreator'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const SubmitTrack = lazy(() => import('./pages/SubmitTrack'));
const ArtistProfile = lazy(() => import('./pages/ArtistProfile'));
const SolanaRegistry = lazy(() => import('./pages/SolanaRegistry'));
const BlockchainRegistry = lazy(() => import('./pages/BlockchainRegistry'));
const ID3TagStudio = lazy(() => import('./pages/ID3TagStudio'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminTracks = lazy(() => import('./pages/admin/AdminTracks'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminChallenges = lazy(() => import('./pages/admin/AdminChallenges'));
const AdminFeatured = lazy(() => import('./pages/admin/AdminFeatured'));
const AdminArtists = lazy(() => import('./pages/admin/AdminArtists'));
const AdminSolana = lazy(() => import('./pages/admin/AdminSolana'));
const AdminBlockchainWallets = lazy(() => import('./pages/admin/AdminBlockchainWallets'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminAIIntegrations = lazy(() => import('./pages/admin/AdminAIIntegrations'));
const CreatorDashboard = lazy(() => import('./pages/CreatorDashboard'));
const Credits = lazy(() => import('./pages/Credits'));
const CommunityTemplates = lazy(() => import('./pages/CommunityTemplates'));
const SocialMediaAutomation = lazy(() => import('./pages/SocialMediaAutomation'));
const WhyBaseStation = lazy(() => import('./pages/WhyBaseStation'));
const NewsHub = lazy(() => import('./pages/NewsHub'));
const About = lazy(() => import('./pages/About'));
const Help = lazy(() => import('./pages/Help'));
const Terms = lazy(() => import('./pages/Terms'));
const AITransparency = lazy(() => import('./pages/AITransparency'));
const CreativeOwnership = lazy(() => import('./pages/CreativeOwnership'));
const CommunityGovernance = lazy(() => import('./pages/CommunityGovernance'));
const FanClub = lazy(() => import('./pages/FanClub'));
const CreatorStore = lazy(() => import('./pages/CreatorStore'));
const SmokeTests = lazy(() => import('./pages/dev/SmokeTests'));
const ErrorLogViewer = lazy(() => import('./pages/dev/ErrorLogViewer'));
const LiveRegression = lazy(() => import('./pages/dev/LiveRegression'));
const LiveMulticlient = lazy(() => import('./pages/dev/LiveMulticlient'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-[#FF9A4D]/30 border-t-[#FF9A4D] rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingPublicSettings, user } = useAuth();

  if (isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading Base Station…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {user && <Header user={user} />}
      {user && <Breadcrumbs />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
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
            <Route path="/live-manager" element={<LiveManager />} />
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
            <Route path="/promo-studio" element={<PromoStudio />} />
            <Route path="/sfx-studio" element={<SoundFXStudio />} />
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
            <Route path="/news-hub" element={<NewsHub />} />
            <Route path="/about" element={<About />} />
            <Route path="/help" element={<Help />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/transparency" element={<AITransparency />} />
            <Route path="/creative-ownership" element={<CreativeOwnership />} />
            <Route path="/governance" element={<CommunityGovernance />} />
            <Route path="/fanclub/:creatorId" element={<FanClub />} />
            <Route path="/creator-store/:creatorId" element={<CreatorStore />} />
            <Route path="/dev/smoke-tests" element={<AdminGate><SmokeTests /></AdminGate>} />
            <Route path="/dev/error-log" element={<AdminGate><ErrorLogViewer /></AdminGate>} />
            <Route path="/dev/live-regression" element={<AdminGate><LiveRegression /></AdminGate>} />
            <Route path="/dev/live-multiclient" element={<AdminGate><LiveMulticlient /></AdminGate>} />
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
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
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