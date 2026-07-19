import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Public forum API — works for anonymous visitors (guest registration with a
// local token) AND logged-in BASE Station users (auto-provisioned membership).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json();
    const action = body?.action;

    let platformUser = null;
    try {
      platformUser = await base44.auth.me();
    } catch (_e) {
      platformUser = null;
    }

    const clean = (s, max) => String(s || '').trim().slice(0, max);

    // Resolve the acting forum member: platform user (auto-create) or guest token.
    const resolveMember = async () => {
      if (platformUser) {
        const existing = await svc.entities.ForumMember.filter({ user_id: platformUser.id }, '-created_date', 1);
        if (existing.length > 0) return existing[0];
        return await svc.entities.ForumMember.create({
          display_name: clean(platformUser.full_name, 40) || (platformUser.email || 'Member').split('@')[0],
          email: platformUser.email || '',
          source: 'member',
          user_id: platformUser.id,
          token: crypto.randomUUID(),
        });
      }
      const memberId = clean(body.member_id, 64);
      const token = clean(body.token, 64);
      if (!memberId || !token) return null;
      let m = null;
      try {
        m = await svc.entities.ForumMember.get(memberId);
      } catch (_e) {
        m = null;
      }
      if (m && m.token && m.token === token) return m;
      return null;
    };

    const publicMember = (m) => ({ id: m.id, display_name: m.display_name, source: m.source });

    if (action === 'registerGuest') {
      const displayName = clean(body.display_name, 40);
      if (displayName.length < 2) {
        return Response.json({ error: 'Display name must be at least 2 characters.' }, { status: 400 });
      }
      const m = await svc.entities.ForumMember.create({
        display_name: displayName,
        email: clean(body.email, 120),
        source: 'guest',
        token: crypto.randomUUID(),
      });
      return Response.json({ member_id: m.id, token: m.token, display_name: m.display_name, source: 'guest' });
    }

    if (action === 'identify') {
      const m = await resolveMember();
      return Response.json({ member: m ? publicMember(m) : null });
    }

    if (action === 'listThreads') {
      const category = clean(body.category, 20);
      const query = ['legal', 'cos', 'ai_policy', 'general'].includes(category) ? { category } : {};
      const threads = await svc.entities.ForumThread.filter(query, '-updated_date', 100);
      threads.sort((a, b) => (b.is_pinned === true) - (a.is_pinned === true));
      return Response.json({ threads });
    }

    if (action === 'getThread') {
      const threadId = clean(body.thread_id, 64);
      let thread = null;
      try {
        thread = await svc.entities.ForumThread.get(threadId);
      } catch (_e) {
        thread = null;
      }
      if (!thread) return Response.json({ error: 'Thread not found.' }, { status: 404 });
      const replies = await svc.entities.ForumReply.filter({ thread_id: threadId }, 'created_date', 300);
      return Response.json({ thread, replies });
    }

    if (action === 'createThread') {
      const m = await resolveMember();
      if (!m) return Response.json({ error: 'Please register a forum profile first.' }, { status: 401 });
      const title = clean(body.title, 140);
      const text = clean(body.body, 5000);
      if (title.length < 4) return Response.json({ error: 'Title must be at least 4 characters.' }, { status: 400 });
      if (text.length < 2) return Response.json({ error: 'Post body is too short.' }, { status: 400 });
      const category = ['legal', 'cos', 'ai_policy', 'general'].includes(body.category) ? body.category : 'general';
      const thread = await svc.entities.ForumThread.create({
        title,
        body: text,
        category,
        author_name: m.display_name,
        member_id: m.id,
        author_source: m.source,
        reply_count: 0,
      });
      return Response.json({ thread });
    }

    if (action === 'createReply') {
      const m = await resolveMember();
      if (!m) return Response.json({ error: 'Please register a forum profile first.' }, { status: 401 });
      const threadId = clean(body.thread_id, 64);
      const text = clean(body.body, 5000);
      if (text.length < 2) return Response.json({ error: 'Reply is too short.' }, { status: 400 });
      let thread = null;
      try {
        thread = await svc.entities.ForumThread.get(threadId);
      } catch (_e) {
        thread = null;
      }
      if (!thread) return Response.json({ error: 'Thread not found.' }, { status: 404 });
      if (thread.is_locked) return Response.json({ error: 'This thread is locked.' }, { status: 403 });
      const reply = await svc.entities.ForumReply.create({
        thread_id: threadId,
        body: text,
        author_name: m.display_name,
        member_id: m.id,
        author_source: m.source,
      });
      await svc.entities.ForumThread.update(threadId, { reply_count: (thread.reply_count || 0) + 1 });
      return Response.json({ reply });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});