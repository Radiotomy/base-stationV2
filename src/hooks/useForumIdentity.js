import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const LS_KEY = "bs_forum_identity";

function getStoredGuest() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the current forum identity:
 * - Logged-in BASE Station users are auto-provisioned server-side.
 * - Anonymous visitors use a lightweight guest profile stored in localStorage.
 */
export default function useForumIdentity() {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  const identify = useCallback(async () => {
    setLoading(true);
    const guest = getStoredGuest();
    try {
      const res = await base44.functions.invoke("forumApi", {
        action: "identify",
        member_id: guest?.member_id,
        token: guest?.token,
      });
      setMember(res.data?.member || null);
    } catch {
      setMember(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    identify();
  }, [identify]);

  const registerGuest = useCallback(async (displayName, email) => {
    const res = await base44.functions.invoke("forumApi", {
      action: "registerGuest",
      display_name: displayName,
      email,
    });
    if (res.data?.error) throw new Error(res.data.error);
    localStorage.setItem(LS_KEY, JSON.stringify({ member_id: res.data.member_id, token: res.data.token }));
    setMember({ id: res.data.member_id, display_name: res.data.display_name, source: "guest" });
    return res.data;
  }, []);

  const guestCreds = getStoredGuest();

  return { member, loading, registerGuest, guestCreds };
}