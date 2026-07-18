import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function SectionHeading({ children }) {
  return (
    <h3 className="text-xs uppercase tracking-widest text-amber-500 font-bold font-mono pt-2">{children}</h3>
  );
}

export default function SpacialHistoryDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="font-bold text-amber-500 hover:text-amber-400 underline underline-offset-2 text-left">
          Read the full Spacial Audio &amp; SAM Broadcaster story →
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto merc-card border border-amber-500/20">
        <DialogHeader>
          <div className="flex items-center space-x-3 text-xs uppercase tracking-widest text-amber-500 mb-1 font-mono">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" style={{ boxShadow: "0 0 8px #FF9A4D" }} />
            <span>Archive: 1999–Present</span>
          </div>
          <DialogTitle className="font-display text-2xl bg-gradient-to-r from-slate-100 via-slate-300 to-amber-500 bg-clip-text text-transparent">
            Spacial Audio &amp; the History of Internet Radio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>
            The story of Spacial Audio (often referred to as Spacial) and its flagship software,{" "}
            <em>SAM Broadcaster</em>, is central to the history of internet radio. By providing affordable,
            professional-grade tools to hobbyists and small-scale operators, the company helped transform
            webcasting from a niche experiment into a global phenomenon.
          </p>

          <SectionHeading>1. The Rise of Spacial Audio and SAM Broadcaster</SectionHeading>
          <p>
            Founded in 1999, Spacial Audio recognized early on that the internet offered a democratization
            of radio, allowing anyone to broadcast to a global audience.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-slate-100">SAM Broadcaster (Streaming Audio Manager):</strong> Launched
              in 2002, this software was a game-changer. It allowed a single PC to function as a full radio
              station, handling automation, live DJ switching, and audio processing. Before this, running a
              station required expensive, hardware-heavy setups.
            </li>
            <li>
              <strong className="text-slate-100">Technological Evolution:</strong> As the industry grew,
              Spacial expanded its portfolio with SAM DJ (for live event DJs), SAM Cast (a live audio
              encoder), and eventually SpacialNet (hosting services) in 2006.
            </li>
            <li>
              <strong className="text-slate-100">Acquisition:</strong> In 2009, Spacial was acquired by
              Triton Digital, a leader in digital audio and podcasting. This move integrated their
              user-friendly software with high-end streaming infrastructure, helping them scale to serve
              broadcasters in over 160 countries.
            </li>
          </ul>

          <SectionHeading>2. Impact on Webcasting Growth</SectionHeading>
          <p>
            SAM Broadcaster did not just provide a tool; it provided an ecosystem. It bridged the gap
            between raw technical streaming and professional-quality radio.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-slate-100">Lowering the Barrier to Entry:</strong> By automating
              complex tasks (like managing playlists through "PAL scripts"), it allowed hobbyists to run
              24/7 stations without needing to be at their computers at all times.
            </li>
            <li>
              <strong className="text-slate-100">Professionalization:</strong> The software included
              built-in tools for listener statistics and reporting. This was crucial for the "legalization"
              of the hobbyist webcaster, as it gave them the ability to track the data required for royalty
              reporting.
            </li>
          </ul>

          <SectionHeading>3. Legalities and the Shaping of Webcasting Laws</SectionHeading>
          <p>
            The growth of webcasting technology significantly outpaced existing laws in the early 2000s,
            leading to a "tangled web" of regulations. Technologies like those provided by Spacial were
            built alongside—and sometimes in response to—the development of complex music licensing laws.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-slate-100">The DMCA and Compulsory Licenses:</strong> The Digital
              Millennium Copyright Act (DMCA) introduced a "compulsory license" (Section 114). This allowed
              webcasters to play copyrighted music without negotiating individual deals with every record
              label, provided they followed specific rules, paid statutory royalties, and implemented
              reporting systems.
            </li>
            <li>
              <strong className="text-slate-100">Royalty Reporting:</strong> Because of these legal
              requirements, software like SAM Broadcaster became an essential compliance tool. It generated
              the logs necessary for webcasters to report their performances to entities like SoundExchange,
              ASCAP, BMI, and SESAC.
            </li>
            <li>
              <strong className="text-slate-100">Ongoing Legal Evolution:</strong> Webcasting royalty rates
              are not static; they are frequently negotiated and adjusted by the Copyright Royalty Board
              (CRB). While the early 2000s focused on whether webcasters could exist legally, the focus
              today remains on the sustainability of these rates for both platforms and artists.
            </li>
          </ul>

          <SectionHeading>Summary</SectionHeading>
          <p>
            Spacial Audio helped define the "Golden Age" of internet radio by providing the necessary
            software to manage a station on a budget. Their tools helped standardize the industry,
            effectively teaching a generation of radio hobbyists how to run a legal, tracked, and
            professional-sounding stream. As webcasting transitioned from a fringe hobby to a core component
            of the modern media landscape, the reporting features embedded in software like SAM Broadcaster
            became the backbone for the complex royalty systems that sustain digital music today.
          </p>

          <div className="border-t border-white/10 pt-4 text-center">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Archive Record: Spacial Audio · 1999–2009 · Triton Digital</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}