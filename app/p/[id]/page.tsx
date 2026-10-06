import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { fetchPostById, fetchSavedPostIds } from "../../../features/social/data/queries";
import PostDetailClient from "../../../features/social/components/post-detail-client";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at) redirect("/login");
  // Existing cookie-authenticated queries keep privacy, block rules and RLS intact.
  const [post, saved] = await Promise.all([
    fetchPostById(supabase, user.id, id), fetchSavedPostIds(supabase, user.id),
  ]);
  if (!post?.profile) notFound();
  return <PostDetailClient currentUserId={user.id} profile={post.profile}
    initialPosts={[post]} initialSaved={saved} initialPostId={post.id} detailOnly />;
}
