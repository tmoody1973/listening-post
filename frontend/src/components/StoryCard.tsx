import { TopicLabel } from "./TopicLabel";

interface StoryCardProps {
  headline: string;
  summary: string | null;
  topic: string;
  slug: string;
  imageUrl: string | null;
  source: string;
  createdAt: string;
}

export function StoryCard({ headline, summary, topic, slug, imageUrl, source, createdAt }: StoryCardProps) {
  return (
    <a href={`/story/${slug}`} className="group block">
      {imageUrl && (
        <div className="aspect-[16/10] rounded-lg overflow-hidden mb-3 bg-muted">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      <TopicLabel topic={topic} />
      <h3 className="mt-1 font-medium leading-snug group-hover:text-[var(--color-coral)] transition-colors" style={{ fontFamily: "var(--font-serif)" }}>
        {headline}
      </h3>
      {summary && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
          {summary}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        AI-generated · {source}
      </p>
    </a>
  );
}

export function LeadStory({ headline, summary, topic, slug, imageUrl, source }: StoryCardProps) {
  return (
    <a href={`/story/${slug}`} className="group block">
      {imageUrl && (
        <div className="aspect-[16/9] rounded-lg overflow-hidden mb-4 bg-muted">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      <TopicLabel topic={topic} />
      <h2
        className="mt-2 text-xl font-medium leading-tight group-hover:text-[var(--color-coral)] transition-colors"
             >
        {headline}
      </h2>
      {summary && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
          {summary}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        AI-generated from multiple sources
      </p>
    </a>
  );
}
