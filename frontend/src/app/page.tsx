import { fetchStories, fetchEpisodes, fetchManifest } from "@/lib/api";
import { EditionPlayer } from "@/components/EditionPlayer";
import { LeadStory, StoryCard } from "@/components/StoryCard";

export const revalidate = 300;

export default async function HomePage() {
  const [stories, episodes] = await Promise.all([
    fetchStories({ all: true }),
    fetchEpisodes(),
  ]);

  const latestEpisode = episodes[0] ?? null;
  let manifest = null;
  if (latestEpisode) {
    manifest = await fetchManifest(latestEpisode.id);
  }

  const leadStory = stories[0] ?? null;
  const gridStories = stories.slice(1, 5);

  return (
    <div className="space-y-10">
      {/* Edition Player */}
      {latestEpisode && manifest?.playlist ? (
        <EditionPlayer
          episodeId={latestEpisode.id}
          edition={latestEpisode.edition}
          date={latestEpisode.date}
          playlist={manifest.playlist}
          totalDuration={manifest.totalDurationSeconds}
        />
      ) : (
        <div className="rounded-lg bg-muted/50 p-6 text-center text-sm text-muted-foreground">
          Next edition coming soon
        </div>
      )}

      {/* Lead Story */}
      {leadStory && (
        <LeadStory
          headline={leadStory.headline}
          summary={leadStory.summary}
          topic={leadStory.topic}
          slug={leadStory.slug}
          imageUrl={leadStory.image_url}
          source={leadStory.source}
          createdAt={leadStory.created_at}
        />
      )}

      {/* Story Grid */}
      {gridStories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {gridStories.map((story: any) => (
            <StoryCard
              key={story.id}
              headline={story.headline}
              summary={story.summary}
              topic={story.topic}
              slug={story.slug}
              imageUrl={story.image_url}
              source={story.source}
              createdAt={story.created_at}
            />
          ))}
        </div>
      )}

      {/* More Stories */}
      {stories.length > 5 && (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">More Stories</h2>
          <div className="space-y-4">
            {stories.slice(5, 15).map((story: any) => (
              <a
                key={story.id}
                href={`/story/${story.slug}`}
                className="flex gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: `var(--color-topic-${story.topic})` }}
                  >
                    {story.topic}
                  </span>
                  <h3
                    className="mt-0.5 text-sm font-medium leading-snug group-hover:text-[var(--color-coral)] transition-colors line-clamp-2"
                  >
                    {story.headline}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">{story.source}</p>
                </div>
                {story.image_url && (
                  <div className="w-20 h-14 rounded overflow-hidden bg-muted shrink-0">
                    <img src={story.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
