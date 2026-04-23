import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, X, FileText } from 'lucide-react';

interface Genre {
  id: string;
  name: string;
}

interface UploadedFile {
  file: File;
  preview?: string;
}

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const AUTOFILL_SIZE_LIMIT = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CreateLessonPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genreId, setGenreId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const autofillTriggered = useRef(false);

  useEffect(() => {
    loadGenres();
  }, []);

  const loadGenres = async () => {
    const { data } = await supabase.from('genres').select('*').order('name');
    if (data) {
      setGenres(data);
    }
  };

  const runAutofill = async (file: File) => {
    setAutofilling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const mimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
      const fileData = await fileToBase64(file);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lesson-metadata-suggest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ file_data: fileData, mime_type: mimeType }),
        },
      );

      if (!resp.ok) return;

      const data = await resp.json();

      if (data.title) setTitle((prev) => (prev === '' ? data.title : prev));
      if (data.description) setDescription((prev) => (prev === '' ? data.description : prev));
      if (data.tags && Array.isArray(data.tags)) {
        setTags((prev) => (prev.length === 0 ? (data.tags as string[]).slice(0, 3) : prev));
      }
      if (data.genre) {
        const match = genres.find(
          (g) => g.name.toLowerCase() === (data.genre as string).toLowerCase(),
        );
        if (match) setGenreId((prev) => (prev === '' ? match.id : prev));
      }
    } catch {
      // Silent fail — form behaves as if autofill never ran
    } finally {
      setAutofilling(false);
    }
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTags = tagInput
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag && !tags.includes(tag));

      if (newTags.length > 0) {
        setTags([...tags, ...newTags]);
        setTagInput('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const processFiles = (selectedFiles: File[]) => {
    const newErrors: Record<string, string> = {};
    let autofillFile: File | null = null;

    selectedFiles.forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        newErrors.files = 'File type not supported. Please upload PDF, JPG, PNG, or GIF files';
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        newErrors.files = 'File size exceeds 10MB limit';
        return;
      }

      if (!autofillTriggered.current && file.size <= AUTOFILL_SIZE_LIMIT) {
        autofillTriggered.current = true;
        autofillFile = file;
      }

      const uploadedFile: UploadedFile = { file };

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          uploadedFile.preview = reader.result as string;
          setFiles(prev => [...prev, uploadedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setFiles(prev => [...prev, uploadedFile]);
      }
    });

    setErrors(newErrors);

    if (autofillFile) runAutofill(autofillFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    processFiles(Array.from(e.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setLoading(true);

      try {
        const { data: lesson, error: lessonError } = await supabase
          .from('lessons')
          .insert({
            owner_id: user!.id,
            title: title.trim(),
            description: description.trim(),
            genre_id: genreId || null,
            tags,
          })
          .select()
          .single();

        if (lessonError) throw lessonError;

        for (const uploadedFile of files) {
          const fileExt = uploadedFile.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${lesson.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('lesson-files')
            .upload(filePath, uploadedFile.file);

          if (uploadError) throw uploadError;

          const { error: fileError } = await supabase.from('lesson_files').insert({
            lesson_id: lesson.id,
            filename: uploadedFile.file.name,
            file_type: uploadedFile.file.type,
            file_size: uploadedFile.file.size,
            storage_path: filePath,
          });

          if (fileError) throw fileError;
        }

        navigate(`/lessons/${lesson.id}`);
      } catch (error) {
        console.error('Error creating lesson:', error);
        setErrors({ form: 'Failed to create lesson. Please try again.' });
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    if (title || description || tags.length > 0 || files.length > 0) {
      setShowCancelDialog(true);
    } else {
      navigate('/library');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div
        className="px-7 py-3.5 flex items-center shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)' }}
      >
        <button
          onClick={handleCancel}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          data-testid="create-lesson-back-button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Library
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-9 flex justify-center">
        <div className="w-full max-w-[600px]">
        <h1 className="text-2xl font-bold tracking-tight mb-7" style={{ color: 'var(--text-primary)' }}>
          Create New Lesson
        </h1>

        <form
          onSubmit={handleSubmit}
          className="rounded-[var(--radius-lg)] p-7 flex flex-col gap-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
          data-testid="create-lesson-form"
        >
          {autofilling && (
            <>
              <style>{`
                @keyframes autofill-shimmer {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
                .autofill-shimmer-field {
                  background: linear-gradient(90deg,
                    var(--surface2) 25%,
                    var(--surface) 50%,
                    var(--surface2) 75%
                  ) !important;
                  background-size: 200% 100% !important;
                  animation: autofill-shimmer 1.4s ease-in-out infinite !important;
                }
              `}</style>
              <div
                data-testid="create-lesson-autofill-loading"
                className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                  color: 'var(--accent)',
                }}
              >
                <svg
                  className="w-4 h-4 shrink-0 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                </svg>
                <span>Analysing file for metadata suggestions…</span>
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter lesson title"
              disabled={autofilling}
              className={autofilling ? 'autofill-shimmer-field' : ''}
              style={{
                border: `1px solid ${errors.title ? 'oklch(0.58 0.18 25)' : 'var(--border)'}`,
                borderRadius: 8, padding: '10px 12px', fontSize: 14,
                color: 'var(--text-primary)', background: 'var(--surface)',
                outline: 'none', height: 40, fontFamily: 'inherit', width: '100%',
              }}
              data-testid="create-lesson-title-input"
              aria-label="Lesson title"
            />
            {errors.title && (
              <p className="text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="create-lesson-title-error">
                {errors.title}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Description *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Enter lesson description"
              disabled={autofilling}
              className={autofilling ? 'autofill-shimmer-field' : ''}
              style={{
                border: `1px solid ${errors.description ? 'oklch(0.58 0.18 25)' : 'var(--border)'}`,
                borderRadius: 8, padding: '10px 12px', fontSize: 14,
                color: 'var(--text-primary)', background: 'var(--surface)',
                outline: 'none', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', width: '100%',
              }}
              data-testid="create-lesson-description-input"
              aria-label="Lesson description"
            />
            {errors.description && (
              <p className="text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="create-lesson-description-error">
                {errors.description}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="genre" className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Genre
            </label>
            <select
              id="genre"
              value={genreId}
              onChange={(e) => setGenreId(e.target.value)}
              disabled={autofilling}
              className={autofilling ? 'autofill-shimmer-field' : ''}
              style={{
                border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                fontSize: 14, color: 'var(--text-primary)', background: 'var(--surface)',
                outline: 'none', height: 40, fontFamily: 'inherit', appearance: 'none', width: '100%',
              }}
              data-testid="create-lesson-genre-dropdown"
              aria-label="Select genre"
            >
              <option value="">Select a genre</option>
              {genres.map(genre => (
                <option key={genre.id} value={genre.id} data-testid={`create-lesson-genre-option-${genre.name.toLowerCase()}`}>
                  {genre.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tags" className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInput}
              placeholder="Enter tags separated by commas"
              disabled={autofilling}
              className={autofilling ? 'autofill-shimmer-field' : ''}
              style={{
                border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                fontSize: 14, color: 'var(--text-primary)', background: 'var(--surface)',
                outline: 'none', height: 40, fontFamily: 'inherit', width: '100%',
              }}
              data-testid="create-lesson-tags-input"
              aria-label="Lesson tags"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                    style={{ background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    data-testid={`create-lesson-tag-chip-${tag}`}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                      data-testid={`create-lesson-tag-remove-${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Files{' '}
              <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                (PDF, JPG, PNG, GIF — Max 10MB each)
              </span>
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="rounded-[var(--radius)] p-8 text-center"
              style={{
                border: '2px dashed var(--border)',
                background: 'var(--surface2)',
                cursor: 'pointer',
              }}
              data-testid="create-lesson-upload-dropzone"
            >
              <Upload className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                Drag and drop files here, or
              </p>
              <label
                className="inline-block px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                <span data-testid="create-lesson-choose-files-button">Choose Files</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="create-lesson-file-input"
                />
              </label>
            </div>
            {errors.files && (
              <p className="text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="create-lesson-file-error">
                {errors.files}
              </p>
            )}

            {files.length > 0 && (
              <div className="flex flex-col gap-2 mt-1" data-testid="create-lesson-files-list">
                {files.map((uploadedFile, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                    data-testid={`create-lesson-file-item-${index}`}
                  >
                    {uploadedFile.preview ? (
                      <img src={uploadedFile.preview} alt="" className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <FileText className="w-10 h-10" style={{ color: 'var(--text-muted)' }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                      data-testid={`create-lesson-file-remove-${index}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.form && (
            <div
              className="p-4 rounded-lg text-sm"
              style={{ background: 'oklch(0.95 0.04 25)', color: 'oklch(0.45 0.18 25)', border: '1px solid oklch(0.87 0.08 25)' }}
              data-testid="create-lesson-form-error"
            >
              {errors.form}
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', boxShadow: 'var(--shadow-sm)' }}
              data-testid="create-lesson-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || autofilling}
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)', border: 'none', cursor: (loading || autofilling) ? 'not-allowed' : 'pointer', opacity: (loading || autofilling) ? 0.7 : 1, fontFamily: 'inherit' }}
              data-testid="create-lesson-save-button"
            >
              {loading ? 'Creating…' : 'Create Lesson'}
            </button>
          </div>
        </form>
        </div>
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} data-testid="create-lesson-cancel-dialog">
          <div className="w-full max-w-[400px] p-6 rounded-[var(--radius-lg)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Discard changes?</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>You have unsaved changes. Are you sure you want to leave?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
                data-testid="create-lesson-cancel-dialog-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate('/library')}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'oklch(0.58 0.18 25)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                data-testid="create-lesson-cancel-dialog-confirm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
