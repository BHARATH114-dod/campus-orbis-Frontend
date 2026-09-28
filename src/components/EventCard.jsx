import { posterUrl } from '../services/eventService';

/**
 * @param {{
 *   event: { id, title, description, date, time, venue, rsvp_count, rsvped, author_name, has_poster },
 *   onRsvp?: (id: string) => void,
 *   onDelete?: (id: string) => void,
 *   canManage?: boolean,
 *   isPast?: boolean,
 *   showRsvpButton?: boolean,
 *   extraActions?: React.ReactNode, // e.g. a certificate/CSV-export link, supplied by the page
 * }} props
 */
export default function EventCard({
  event,
  onRsvp,
  onDelete,
  onOpenDetails,
  canManage = false,
  isPast = false,
  showRsvpButton = true,
  extraActions,
}) {
  return (
    <div
      onClick={() => onOpenDetails?.(event)}
      role={onOpenDetails ? 'button' : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      className="overflow-hidden rounded-2xl border border-line bg-paper-card shadow-sm cursor-pointer transition-shadow hover:shadow-md"
    >
      {event.has_poster && (
        <img
          src={posterUrl(event.id)}
          alt=""
          className="h-36 w-full object-cover"
          loading="lazy"
        />
      )}

      <div className="p-5">
        <h3 className="text-base font-semibold text-ink">{event.title}</h3>
        <p className="mt-1 line-clamp-3 text-sm text-ink-light">{event.description}</p>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-light">
          <span>📅 {event.date}</span>
          <span>🕒 {event.time || 'TBA'}</span>
          <span>📍 {event.venue || 'TBA'}</span>
          {event.author_name && <span>👤 {event.author_name}</span>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {isPast ? (
            <span className="rounded-full bg-line/60 px-3 py-1.5 text-xs font-semibold text-ink-light">
              Event completed
            </span>
          ) : (
            showRsvpButton && (
              <button
                type="button"
                onClick={() => onRsvp?.(event.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  event.rsvped
                    ? 'border border-teal text-teal hover:bg-teal/10'
                    : 'bg-gold text-white hover:opacity-90'
                }`}
              >
                {event.rsvped ? 'Cancel RSVP' : "I'll attend"}
              </button>
            )
          )}
          <span className="text-xs text-ink-light">{event.rsvp_count ?? 0} attending</span>
          {extraActions}
          {canManage && (
            <button
              type="button"
              onClick={() => onDelete?.(event.id)}
              className="ml-auto text-xs font-semibold text-crimson hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
