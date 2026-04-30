import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";

export default function FollowButton({ targetUserId, targetUserName, targetSlug, size = "default" }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [followRecord, setFollowRecord] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      setCurrentUser(user);
      if (!user || user.id === targetUserId) { setLoading(false); return; }
      const follows = await base44.entities.Follow.filter({ follower_id: user.id, following_id: targetUserId });
      if (follows.length > 0) { setIsFollowing(true); setFollowRecord(follows[0]); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [targetUserId]);

  const toggle = async () => {
    if (!currentUser) { toast.error("Sign in to follow artists"); return; }
    if (currentUser.id === targetUserId) return;

    setLoading(true);
    if (isFollowing && followRecord) {
      await base44.entities.Follow.delete(followRecord.id);
      setIsFollowing(false);
      setFollowRecord(null);
      toast.success(`Unfollowed ${targetUserName}`);
    } else {
      const rec = await base44.entities.Follow.create({
        follower_id: currentUser.id,
        follower_email: currentUser.email,
        follower_name: currentUser.full_name,
        following_id: targetUserId,
        following_name: targetUserName,
        following_slug: targetSlug,
      });
      setIsFollowing(true);
      setFollowRecord(rec);
      toast.success(`Now following ${targetUserName}!`);
      // Log to activity feed
      base44.entities.ActivityFeedItem.create({
        type: "artist_followed",
        actor_name: currentUser.full_name,
        actor_id: currentUser.id,
        title: `followed ${targetUserName}`,
        entity_id: targetUserId,
        entity_type: "user",
      }).catch(() => {});
    }
    setLoading(false);
  };

  if (!currentUser || currentUser.id === targetUserId) return null;

  return (
    <Button onClick={toggle} disabled={loading} size={size} variant={isFollowing ? "outline" : "default"}
      className={`rounded-full font-semibold ${isFollowing ? "border-border hover:border-red-500 hover:text-red-400" : "bg-purple-600 hover:bg-purple-500 text-white"}`}>
      {isFollowing ? (
        <><UserCheck className="w-4 h-4 mr-1.5" />Following</>
      ) : (
        <><UserPlus className="w-4 h-4 mr-1.5" />Follow</>
      )}
    </Button>
  );
}