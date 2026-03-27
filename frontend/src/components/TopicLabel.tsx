import { getTopicColor } from "@/lib/api";

export function TopicLabel({ topic }: { topic: string }) {
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: getTopicColor(topic) }}
    >
      {topic}
    </span>
  );
}
