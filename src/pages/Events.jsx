import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchEvents,
  createEvent,
  deleteEvent,
  toggleRsvp,
  rsvpCsvUrl,
  certificateUrl,
} from '../services/eventService';
import { canManageEvent } from '../utils/permissions';
import { isPastDate, todayStr } from '../utils/date';
import EventCard from '../components/EventCard';
import EventDetailsModal from '../components/EventDetailsModal';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CAN_CREATE_ROLES = ['college_admin', 'hod', 'faculty'];
const CAN_EXPORT_ROLES = ['college_admin', 'hod', 'faculty'];

export default function Events() {
  const { user, role } = useAuth();
  const { showToast } = useToast();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '', venue: '' });
  const [posterFile, setPosterFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [detailsEvent, setDetailsEvent] = useState(null);

  const canCreate = CAN_CREATE_ROLES.includes(role);
  const canExport = CAN_EXPORT_ROLES.includes(role);

  const load = () => {
    setLoading(true);
    fetchEvents()
      .then(setEvents)
      .catch((err) => showToast(err.message || 'Could not load events.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRsvp = async (id) => {
    // optimistic update
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, rsvped: !e.rsvped, rsvp_count: e.rsvp_count + (e.rsvped ? -1 : 1) }
          : e
      )
    );
    try {
      const { rsvped, rsvp_count } = await toggleRsvp(id);
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, rsvped, rsvp_count } : e)));
    } catch (err) {
      showToast(err.message || 'Could not update your RSVP.', 'error');
      load(); // reconcile with the server
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this event? This cannot be undone.')) return;
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      showToast('Event removed.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not remove this event.', 'error');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim() || !form.date) {
      setFormError('Title and date are required.');
      return;
    }
    if (form.date < todayStr()) {
      setFormError('Event date cannot be in the past.');
      return;
    }
    setSubmitting(true);
    try {
      const event = await createEvent(form, posterFile);
      setEvents((prev) => [...prev, event]);
      showToast('Event created.', 'success');
      setModalOpen(false);
      setForm({ title: '', description: '', date: '', time: '', venue: '' });
      setPosterFile(null);
    } catch (err) {
      setFormError(err.message || 'Could not create this event.');
    } finally {
      setSubmitting(false);
    }
  };

  const upcoming = events.filter((e) => !isPastDate(e.date));
  const past = events.filter((e) => isPastDate(e.date));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Events</h1>
          <p className="text-sm text-ink-light">Campus events you can RSVP to.</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-hero-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            + New event
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading events…" />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper-card p-8 text-center text-sm text-ink-light">
          No events yet.
        </div>
      ) : (
        <>
          <Section title="Upcoming">
            {upcoming.length === 0 ? (
              <EmptyNote text="No upcoming events." />
            ) : (
              <Grid>
                {upcoming.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onRsvp={role === 'student' ? handleRsvp : undefined}
                    showRsvpButton={role === 'student'}
                    onDelete={handleDelete}
                    onOpenDetails={setDetailsEvent}
                    canManage={canManageEvent(user, ev)}
                    extraActions={
                      canExport && ev.rsvp_count > 0 ? (
                        <a
                          href={rsvpCsvUrl(ev.id)}
                          download
                          className="text-xs font-semibold text-teal hover:underline"
                        >
                          ⬇ RSVP list (CSV)
                        </a>
                      ) : null
                    }
                  />
                ))}
              </Grid>
            )}
          </Section>

          <Section title="Past">
            {past.length === 0 ? (
              <EmptyNote text="No past events." />
            ) : (
              <Grid>
                {past.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    isPast
                    onDelete={handleDelete}
                    onOpenDetails={setDetailsEvent}
                    canManage={canManageEvent(user, ev)}
                    extraActions={
                      role === 'student' && ev.rsvped ? (
                        <a
                          href={certificateUrl(ev.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-teal hover:underline"
                        >
                          🎓 Certificate
                        </a>
                      ) : canExport && ev.rsvp_count > 0 ? (
                        <a
                          href={rsvpCsvUrl(ev.id)}
                          download
                          className="text-xs font-semibold text-teal hover:underline"
                        >
                          ⬇ RSVP list (CSV)
                        </a>
                      ) : null
                    }
                  />
                ))}
              </Grid>
            )}
          </Section>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New event">
        <form onSubmit={handleCreate} noValidate className="space-y-4">
          <TextField label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
          <TextArea
            label="Description"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          />
          <TextField
            label="Date"
            type="date"
            min={todayStr()}
            value={form.date}
            onChange={(v) => setForm((f) => ({ ...f, date: v }))}
          />
          <TextField
            label="Time"
            placeholder="e.g. 4:00 PM"
            value={form.time}
            onChange={(v) => setForm((f) => ({ ...f, time: v }))}
          />
          <TextField
            label="Venue"
            placeholder="e.g. Main Auditorium"
            value={form.venue}
            onChange={(v) => setForm((f) => ({ ...f, venue: v }))}
          />
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Poster image (optional)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>

          {formError && <p className="text-xs text-crimson">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-hero-primary py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Schedule event'}
          </button>
        </form>
      </Modal>

      {detailsEvent && (
        <EventDetailsModal
          event={detailsEvent}
          canManage={canManageEvent(user, detailsEvent)}
          onClose={() => setDetailsEvent(null)}
        />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function EmptyNote({ text }) {
  return <p className="text-sm text-ink-light">{text}</p>;
}

function TextField({ label, value, onChange, type = 'text', min, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <input
        type={type}
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
      />
    </div>
  );
}
