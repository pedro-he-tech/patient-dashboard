import { formatTimestamp, statusLabel } from "@/lib/patients/display";
import type { StatusHistoryResponse } from "@/lib/patients/types";

export function StatusTimeline({
  events,
}: {
  events: StatusHistoryResponse[];
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No status changes yet.</p>
    );
  }

  return (
    <ol className="ml-1.5 border-l border-border">
      {events.map((event) => (
        <li key={event.id} className="relative pb-6 pl-6 last:pb-0">
          <span
            aria-hidden
            className="absolute top-1 -left-[7px] size-3 rounded-full border-2 border-background bg-primary"
          />
          <p className="text-sm font-medium">
            {event.from_status
              ? `${statusLabel(event.from_status)} to ${statusLabel(event.to_status)}`
              : `Created as ${statusLabel(event.to_status)}`}
          </p>
          <time
            dateTime={event.changed_at}
            className="text-xs text-muted-foreground"
          >
            {formatTimestamp(event.changed_at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
