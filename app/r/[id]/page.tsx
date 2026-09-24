import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import VerifiedBadge from "../../../features/social/components/verified-badge";

export const dynamic = "force-dynamic";

export default async function ReelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email_confirmed_at) redirect("/login");

  const { data: reel } = await supabase
    .from("reels")
    .select("id,author_id,title,caption,media_path,cover_path,view_count,share_count,save_count,created_at")
    .eq("id", id)
    .maybeSingle();

  if (!reel) notFound();

  const { data: author } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,verified")
    .eq("id", reel.author_id)
    .maybeSingle();

  if (!author) notFound();

  const mediaUrl = supabase.storage
    .from("media")
    .getPublicUrl(reel.media_path).data.publicUrl;

  return (
    <main className="shared-detail-page">
      <header>
        <Link href="/home">← AVENZO</Link>
        <Link href={"/u/" + encodeURIComponent(author.username)}>
          @{author.username}<VerifiedBadge verified={author.verified} />
        </Link>
      </header>

      <article className="shared-detail-card">
        <div className="shared-detail-author">
          <div>
            <b>{author.display_name}</b>
            <span className="verified-line">@{author.username}<VerifiedBadge verified={author.verified} /></span>
          </div>
          <time>{new Date(reel.created_at).toLocaleString()}</time>
        </div>

        <video
          src={mediaUrl}
          poster={
            reel.cover_path
              ? supabase.storage.from("media").getPublicUrl(reel.cover_path).data.publicUrl
              : undefined
          }
          controls
          playsInline
          preload="metadata"
        />

        {reel.title && <h2>{reel.title}</h2>}

        <div className="reel-detail-stats">
          <span>{Number(reel.view_count || 0)} views</span>
          <span>{Number(reel.share_count || 0)} shares</span>
          <span>{Number(reel.save_count || 0)} saves</span>
        </div>

        {reel.caption && <p>{reel.caption}</p>}

        <Link
          className="btn secondary"
          href={"/messages?shareReel=" + encodeURIComponent(reel.id)}
        >
          Share in Messages
        </Link>
      </article>
    </main>
  );
}
