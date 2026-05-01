import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { artist_name, track_title, bio_snippet, genre, primary_color, template_style, release_date, platforms } = await req.json();
    if (!artist_name || !track_title || !platforms || platforms.length === 0) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const platformSpecs = {
      instagram_post:     { w: 1080, h: 1080, aspect: '1:1', desc: 'Instagram feed post' },
      instagram_story:    { w: 1080, h: 1920, aspect: '9:16', desc: 'Instagram story' },
      twitter_card:       { w: 1200, h: 675, aspect: '16:9', desc: 'Twitter/X card' },
      facebook_cover:     { w: 820, h: 312, aspect: 'wide', desc: 'Facebook profile cover' },
      tiktok_thumbnail:   { w: 1080, h: 1920, aspect: '9:16', desc: 'TikTok video thumbnail' },
      pinterest_pin:      { w: 1000, h: 1500, aspect: '2:3', desc: 'Pinterest pin' },
      linkedin_post:      { w: 1200, h: 627, aspect: '16:9', desc: 'LinkedIn feed' },
    };

    const templatePrompts = {
      modern_minimal: 'Clean, typography-focused design with plenty of whitespace. Minimalist aesthetic.',
      vibrant_gradient: 'Bold colorful gradient background with vibrant, eye-catching design. Dynamic energy.',
      dark_moody: 'Dark cinematic atmosphere with sophisticated lighting. Premium, professional feel.',
      playful_bold: 'Fun, energetic, Gen-Z vibes. Playful typography and vibrant colors. Trendy aesthetic.',
      sleek_premium: 'Luxury and sophisticated design. Sleek, modern, elegant aesthetic. High-end feeling.',
    };

    const generatedCards = {};
    const releaseText = release_date ? `Release: ${new Date(release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Now Available';

    for (const platform of platforms) {
      const spec = platformSpecs[platform];
      if (!spec) continue;

      const prompt = `Create a promotional music card for social media with these specifications:
- Artist: ${artist_name}
- Track: "${track_title}"
- ${genre ? `Genre: ${genre}` : ''}
- ${bio_snippet ? `Tagline: "${bio_snippet}"` : ''}
- Release info: ${releaseText}
- Primary brand color: ${primary_color}
- Design style: ${templatePrompts[template_style] || 'Modern and professional'}
- Dimensions: ${spec.w}×${spec.h} (${spec.aspect})
- Platform: ${spec.desc}

Create a visually stunning, professional promotional card that would work perfectly for ${platform} with the primary color ${primary_color} incorporated throughout the design. Make it eye-catching and shareable. Include the artist name prominently, track title, and release date. The design should feel modern, trendy, and aligned with current social media aesthetics.`;

      try {
        const cardUrl = await base44.integrations.Core.GenerateImage({ prompt });
        generatedCards[platform] = cardUrl.url;
      } catch (err) {
        console.error(`Failed to generate ${platform}:`, err.message);
      }
    }

    return Response.json({ generated_cards: generatedCards });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});