import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import VerifiedBadge from "../../../features/social/components/verified-badge";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
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

  const { data: post } = await supabase
    .from("posts")
    .select("id,author_id,caption,media_path,media_type,created_at")
    .eq("id", id)
    .maybeSingle();

  if (!post) notFound();

  const { data: author } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,verified")
    .eq("id", post.author_id)
    .maybeSingle();

  if (!author) notFound();

  const mediaUrl = post.media_path
    ? supabase.storage.from("media").getPublicUrl(post.media_path).data.publicUrl
    : "";

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
          <time>{new Date(post.created_at).toLocaleString()}</time>
        </div>

        {mediaUrl &&
          (post.media_type === "video" ? (
            <video src={mediaUrl} controls playsInline preload="metadata" />
          ) : (
            <img src={mediaUrl} alt={post.caption || "AVENZO post"} />
          ))}

        {post.caption && <p>{post.caption}</p>}

        <Link
          className="btn secondary"
          href={"/messages?sharePost=" + encodeURIComponent(post.id)}
        >
          Share in Messages
        </Link>
      </article>
    </main>
  );
}
