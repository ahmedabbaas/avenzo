import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";

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
    .select("id,author_id,caption,media_path,created_at")
    .eq("id", id)
    .maybeSingle();

  if (!reel) notFound();

  const { data: author } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url")
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
          @{author.username}
        </Link>
      </header>

      <article className="shared-detail-card">
        <div className="shared-detail-author">
          <div>
            <b>{author.display_name}</b>
            <span>@{author.username}</span>
          </div>
          <time>{new Date(reel.created_at).toLocaleString()}</time>
        </div>

        <video src={mediaUrl} controls playsInline preload="metadata" />

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
