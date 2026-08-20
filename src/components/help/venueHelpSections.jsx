import { Link } from 'react-router-dom';
import { Building2, Users, ListMusic } from 'lucide-react';

/**
 * Help content for 3D venues — kept in its own module so the main Help list stays
 * legible, matching the podcast and Foundry help modules.
 */
const VENUE_HELP_SECTIONS = [
  {
    id: 'venues',
    title: '3D Venues — your own always-on room',
    icon: Building2,
    keywords: 'venue venues 3d room space portals stage template festival club acoustic jazz arena visibility fan club gate public directory create',
    body: (
      <>
        <p>A <strong className="text-foreground">venue</strong> is a permanent 3D room that belongs to you. Unlike a live session — which is one performance — a venue stays up between shows, so fans always have somewhere to walk into. Create and manage them in <Link to="/live-venues" className="text-amber-400 hover:underline">Live Venues</Link>.</p>
        <p><strong className="text-foreground">Getting set up:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Create a venue</strong> — pick a name and a template. No Portals account is needed: the room is provisioned for you.</li>
          <li><strong>Templates</strong> — festival stage, electronic club, intimate acoustic, jazz lounge, hip-hop arena, pop showcase, country barn, tropical outdoor. Switching template changes the world in place and keeps your name, links and programming.</li>
          <li><strong>Branding</strong> — set the cover art and loading screen fans see on the way in.</li>
          <li><strong>Bring your own room</strong> — if you own a Portals space, connect your access key first and the venue is created under <em>your</em> account, owned by your wallet.</li>
        </ul>
        <p><strong className="text-foreground">Who gets in — two separate switches:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Visibility</strong> controls being <em>found</em>: Public lists you in the <Link to="/venues" className="text-purple-400 hover:underline">venue directory</Link>, Unlisted works only via your direct link, Private takes the page down. New venues start Unlisted on purpose.</li>
          <li><strong>Access gate</strong> controls getting <em>in</em>: Open is anyone; Fan Club means only active members get the room link and the programme. It's enforced on our servers, not in the page — so a shared link doesn't defeat it.</li>
        </ul>
        <p>Every fan is prompted for a name and avatar as they enter, so your room fills with people rather than anonymous guests.</p>
      </>
    ),
  },
  {
    id: 'venue-programming',
    title: 'Idle programming — music playing when you are not live',
    icon: ListMusic,
    keywords: 'idle programming playlist schedule loop venue always on radio channel volume pause stage screen now playing queue asleep room',
    body: (
      <>
        <p>A venue doesn't have to sit silent between shows. <strong className="text-foreground">Idle programming</strong> loops a playlist of your own tracks and videos through the room's stage.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Programmes</strong> — build a playlist from anything in your library; audio plays with your cover art, video plays on the stage wall.</li>
          <li><strong>Default loop</strong> — the programme that plays any time nothing else is scheduled.</li>
          <li><strong>Schedule blocks</strong> — override the default for a window ("Lo-fi mornings, 9–12 daily"), in your own timezone.</li>
          <li><strong>Transport</strong> — set the in-room volume, or pause the room without stopping the schedule.</li>
        </ul>
        <p>Everyone hears the same moment of the same track: the position is worked out from the programme's start time, so a fan arriving late lands exactly where everyone else is. The same programme is playable on the web at your <strong className="text-foreground">venue stage page</strong>, for fans who don't want to load a 3D world.</p>
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-amber-300 font-bold text-sm mb-1">💡 If an update won't apply: wake the room first</p>
          <p>3D rooms go to sleep when nobody is inside them, and a sleeping room can't be written to — staff, template and stage changes will tell you so. Open your venue's <strong className="text-foreground">3D room</strong> link, let it load for a few seconds, then apply the change.</p>
        </div>
      </>
    ),
  },
  {
    id: 'venue-staff',
    title: 'Venue Staff — AI characters in your room',
    icon: Users,
    keywords: 'staff npc npcs ai character host guide bartender dancer avatar glb rigged animation persona greeter venue 3d talk',
    body: (
      <>
        <p><strong className="text-foreground">Venue Staff</strong> places talking AI characters in your room. Fans click one and have a short conversation with it. Set them up on your venue page under <strong className="text-foreground">Venue Staff</strong>.</p>
        <p><strong className="text-foreground">Four roles, each with its own spot in the room:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Host</strong> — near the entrance; greets arrivals and says what's playing.</li>
          <li><strong>Stage Guide</strong> — beside the stage; talks about you and the music.</li>
          <li><strong>Bartender</strong> — background character for the bar area.</li>
          <li><strong>Hype Dancer</strong> — dances near the stage to keep the floor alive.</li>
        </ul>
        <p><strong className="text-foreground">Each character needs:</strong> a name, an <strong>https link to a rigged GLB avatar</strong> (rigged means it has a skeleton — without one it stands frozen, so tick the "not rigged" box and it won't be given an animation), an animation, and optional character notes on how it should talk.</p>
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-emerald-300 font-bold text-sm mb-1">🛡️ They can't make things up about you</p>
          <p>A character is only ever told facts your venue can back up — the venue name, your name, and what is playing. It's instructed to say "I don't know" about anything else (tour dates, prices, merch), never to invent songs or events, and never to promise something the room can't do. Your character notes shape the <em>personality</em>, not the facts.</p>
        </div>
        <p>Turn a character off any time — your notes are kept, they're just not placed in the room.</p>
      </>
    ),
  },
];

export default VENUE_HELP_SECTIONS;