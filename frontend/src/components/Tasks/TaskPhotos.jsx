import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';

const PHOTO_TYPES = [
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'progress', label: 'Progress' },
  { value: 'other', label: 'Other' },
];

const TYPE_COLORS = {
  before: 'bg-blue-100 text-blue-700 border-blue-300',
  after: 'bg-green-100 text-green-700 border-green-300',
  progress: 'bg-amber-100 text-amber-700 border-amber-300',
  other: 'bg-gray-100 text-gray-600 border-gray-300',
};

const TaskPhotos = ({ taskId, isAdmin }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('progress');
  const [caption, setCaption] = useState('');
  const [lightbox, setLightbox] = useState(null); // photo object
  const fileRef = useRef(null);

  const loadPhotos = async () => {
    try {
      const res = await api.get(`/tasks/${taskId}/photos`);
      setPhotos(res.data?.photos || []);
    } catch (e) {
      console.error('Load photos error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPhotos(); }, [taskId]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('photo_type', selectedType);
      if (caption.trim()) formData.append('caption', caption.trim());

      const res = await api.post(`/tasks/${taskId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotos((prev) => [...prev, res.data.photo]);
      setCaption('');
    } catch (e) {
      alert(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api.delete(`/tasks/${taskId}/photos/${photo.id}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      if (lightbox?.id === photo.id) setLightbox(null);
    } catch (e) {
      alert(e.response?.data?.error || 'Delete failed');
    }
  };

  const photoUrl = (p) => `/${p.file_path.replace(/\\/g, '/')}`;

  return (
    <div>
      {/* Upload controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="text-sm px-2 py-1.5 border border-gray-300 rounded-lg bg-white"
        >
          {PHOTO_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption (optional)"
          className="flex-1 min-w-[120px] text-sm px-2 py-1.5 border border-gray-300 rounded-lg"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="text-sm px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition"
        >
          {uploading ? 'Uploading…' : '📷 Add Photo'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Photo grid */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-gray-500">No photos yet. Tap "Add Photo" to capture or upload.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-square cursor-pointer"
              onClick={() => setLightbox(photo)}
            >
              <img
                src={photoUrl(photo)}
                alt={photo.caption || photo.photo_type}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TYPE_COLORS[photo.photo_type] || TYPE_COLORS.other}`}>
                  {photo.photo_type.charAt(0).toUpperCase() + photo.photo_type.slice(1)}
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(photo); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white text-xs rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  aria-label="Delete photo"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[10001] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={photoUrl(lightbox)}
              alt={lightbox.caption || lightbox.photo_type}
              className="w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="flex items-center justify-between mt-2">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TYPE_COLORS[lightbox.photo_type] || TYPE_COLORS.other}`}>
                  {lightbox.photo_type.charAt(0).toUpperCase() + lightbox.photo_type.slice(1)}
                </span>
                {lightbox.caption && (
                  <span className="ml-2 text-sm text-gray-200">{lightbox.caption}</span>
                )}
                {lightbox.uploaded_by_name && (
                  <span className="ml-2 text-xs text-gray-400">by {lightbox.uploaded_by_name}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="text-white text-2xl leading-none hover:text-gray-300"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskPhotos;
