import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  posterUrl,
  fetchEventGallery,
  uploadEventGalleryImage,
  deleteEventGalleryImage,
  eventGalleryImageUrl,
} from '../services/eventService';
import Modal from './common/Modal';
import LoadingSpinner from './common/LoadingSpinner';

/**
 * Click-through popup for a single event: full details up top, and a photo
 * gallery below where the event's organizers can post pictures from this
 * and previous years' editions of the same event.
 *
 * @param {{ event: object, canManage: boolean, onClose: () => void }} props
 */
export default function EventDetailsModal({ event, canManage, onClose }) {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [gallery, setGallery] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [galleryFile, setGalleryFile] = useState(null);
  const [galleryYear, setGalleryYear] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!event) return;
    setLoadingGallery(true);
    fetchEventGallery(event.id)
      .then(setGallery)
      .catch((err) => showToast(err.message || 'Could not load the photo gallery.', 'error'))
      .finally(() => setLoadingGallery(false));
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!event) return null;

  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    if (!galleryFile) return;
    setUploading(true);
    try {
      const image = await uploadEventGalleryImage(event.id, galleryFile, { year: galleryYear, caption: galleryCaption });
      setGallery((prev) => [
        { ...image, uploaded_by: user.username, uploaded_by_name: user.name, created_at: Date.now() },
        ...prev,
      ]);
      setGalleryFile(null);
      setGalleryYear('');
      setGalleryCaption('');
      showToast('Photo added to the gallery.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not upload this photo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (imgId) => {
    try {
      await deleteEventGalleryImage(event.id, imgId);
      setGallery((prev) => prev.filter((img) => img.id !== imgId));
    } catch (err) {
      showToast(err.message || 'Could not remove this photo.', 'error');
    }
  };

  return (
    <Modal open onClose={onClose} title={event.title}>
      <div className="space-y-5">
        {event.has_poster && (
          <img src={posterUrl(event.id)} alt="" className="h-40 w-full rounded-xl object-cover" loading="lazy" />
        )}

        {event.description && <p className="text-sm text-ink-light">{event.description}</p>}

        <div className="flex flex-wrap gap-3 text-xs text-ink-light">
          <span>📅 {event.date}</span>
          <span>🕒 {event.time || 'TBA'}</span>
          <span>📍 {event.venue || 'TBA'}</span>
          {event.author_name && <span>👤 {event.author_name}</span>}
          <span>👥 {event.rsvp_count ?? 0} attending</span>
        </div>

        <div className="border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-light">Photo gallery</h3>
          <p className="mb-3 text-xs text-ink-light">Pictures from this and previous years of {event.title}.</p>

          {canManage && (
            <form onSubmit={handleUploadPhoto} className="mb-4 space-y-2 rounded-lg border border-dashed border-line p-3">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setGalleryFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
              <div className="flex gap-2">
                <input
                  value={galleryYear}
                  onChange={(e) => setGalleryYear(e.target.value)}
                  placeholder="Year (e.g. 2024)"
                  className="w-28 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                />
                <input
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  placeholder="Caption (optional)"
                  className="flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={uploading || !galleryFile}
                className="rounded-lg bg-teal px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : 'Add photo'}
              </button>
            </form>
          )}

          {loadingGallery ? (
            <LoadingSpinner label="Loading photos…" />
          ) : gallery.length === 0 ? (
            <p className="text-sm text-ink-light">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((img) => (
                <div key={img.id} className="group relative">
                  <img
                    src={eventGalleryImageUrl(event.id, img.id)}
                    alt={img.caption || ''}
                    className="aspect-square w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                  {img.year && (
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      {img.year}
                    </span>
                  )}
                  {(img.uploaded_by === user.username || canManage) && (
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(img.id)}
                      className="absolute right-1 top-1 hidden rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white group-hover:block"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
