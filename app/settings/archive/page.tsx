import StoryArchiveHighlightsClient from "../../../features/settings/components/story-archive-highlights-client";
import SettingsShell from "../../../features/settings/components/settings-shell";
import { requireSettingsUser } from "../../../features/settings/server/settings-user";

export const metadata = { title: "Story Archive & Highlights" };
export const dynamic = "force-dynamic";

export default async function StoryArchivePage() {
  const { user } = await requireSettingsUser();

  return (
    <SettingsShell
      eyebrow="STORIES"
      title="Archive & Highlights"
      description="Manage your private Story Archive and choose which archived Stories stay visible on your profile as Highlights."
    >
      <StoryArchiveHighlightsClient currentUserId={user.id} />
    </SettingsShell>
  );
}
