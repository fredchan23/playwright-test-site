import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

interface ExistingFile {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
}

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function EditLessonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genreId, setGenreId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<UploadedFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [filesToDelete, setFilesToDelete] = useState<ExistingFile[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  // Generation counter: ensures only the latest loadLessonData() response is applied.
  // React StrictMode double-invokes useEffect, launching two concurrent fetches;
  // without this guard the slower (second) response can overwrite user edits.
  const loadGenRef = useRef(0);

  useEffect(() => {
    if (id) {
      loadLessonData();
    }
  }, [id]);

  const loadLessonData = async () => {
    if (!id || !user) return;
    const currentGen = ++loadGenRef.current;

    const [genresResult, lessonResult, filesResult] = await Promise.all([
      supabase.from('genres').select('*').order('name'),
      supabase.from('lessons').select('*').eq('id', id).maybeSingle(),
      supabase.from('lesson_files').select('*').eq('lesson_id', id),
    ]);

    // If a newer fetch has started (e.g. StrictMode second invocation), discard these results.
    if (currentGen !== loadGenRef.current) return;

    if (genresResult.data) {
      setGenres(genresResult.data);
    }

    if (lessonResult.data) {
      if (lessonResult.data.owner_id !== user.id) {
        navigate('/library');
        return;
      }

      setTitle(lessonResult.data.title);
      setDescription(lessonResult.data.description);
      setGenreId(lessonResult.data.genre_id || '');
      setTags(lessonResult.data.tags || []);
    }

    if (filesResult.data) {
      setExistingFiles(filesResult.data);
    }

    setInitialLoading(false);
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
        setHasChanges(true);
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
    setHasChanges(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newErrors: Record<string, string> = {};

    selectedFiles.forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        newErrors.files = 'File type not supported. Please upload PDF, JPG, PNG, or GIF files';
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        newErrors.files = 'File size exceeds 10MB limit';
        return;
      }

      const uploadedFile: UploadedFile = { file };

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          uploadedFile.preview = reader.result as string;
          setNewFiles(prev => [...prev, uploadedFile]);
          setHasChanges(true);
        };
        reader.readAsDataURL(file);
      } else {
        setNewFiles(prev => [...prev, uploadedFile]);
        setHasChanges(true);
      }
    });

    setErrors(newErrors);
    e.target.value = '';
  };

  const removeNewFile = (index: number) => {
    setNewFiles(newFiles.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const removeExistingFile = (fileId: string) => {
    const file = existingFiles.find(f => f.id === fileId);
    if (file) setFilesToDelete([...filesToDelete, file]);
    setExistingFiles(existingFiles.filter(f => f.id !== fileId));
    setHasChanges(true);
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

    if (Object.keys(newErrors).length === 0 && id) {
      setLoading(true);

      try {
        const { error: updateError } = await supabase
          .from('lessons')
          .update({
            title: title.trim(),
            description: description.trim(),
            genre_id: genreId || null,
            tags,
          })
          .eq('id', id);

        if (updateError) throw updateError;

        for (const file of filesToDelete) {
          await supabase.storage.from('lesson-files').remove([file.storage_path]);
          await supabase.from('lesson_files').delete().eq('id', file.id);
        }

        for (const uploadedFile of newFiles) {
          const fileExt = uploadedFile.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `${id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('lesson-files')
            .upload(filePath, uploadedFile.file);

          if (uploadError) throw uploadError;

          const { error: fileError } = await supabase.from('lesson_files').insert({
            lesson_id: id,
            filename: uploadedFile.file.name,
            file_type: uploadedFile.file.type,
            file_size: uploadedFile.file.size,
            storage_path: filePath,
          });

          if (fileError) throw fileError;
        }

        navigate(`/lessons/${id}`);
      } catch {
        setErrors({ form: 'Failed to update lesson. Please try again.' });
        setLoading(false);
      }
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancelDialog(true);
    } else {
      navigate(`/lessons/${id}`);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-2 border-transparent animate-spin mx-auto mb-4"
            style={{ borderTopColor: 'var(--accent)', borderRightColor: 'var(--accent)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading lesson…</p>
        </div>
      </div>
    );
  }

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
          data-testid="edit-lesson-back-button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-9 flex justify-center">
        <div className="w-full max-w-[600px]">
          <h1 className="text-2xl font-bold tracking-tight mb-7" style={{ color: 'var(--text-primary)' }}>
            Edit Lesson
          </h1>

          <form
            onSubmit={handleSubmit}
            className="rounded-[var(--radius-lg)] p-7 flex flex-col gap-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
            data-testid="edit-lesson-form"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="title" className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setHasChanges(true); }}
                placeholder="Enter lesson title"
                style={{
                  border: `1px solid ${errors.title ? 'oklch(0.58 0.18 25)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 12px', fontSize: 14,
                  color: 'var(--text-primary)', background: 'var(--surface)',
                  outline: 'none', height: 40, fontFamily: 'inherit', width: '100%',
                }}
                data-testid="edit-lesson-title-input"
                aria-label="Lesson title"
              />
              {errors.title && (
                <p className="text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="edit-lesson-title-error">
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
                onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
                rows={6}
                placeholder="Enter lesson description"
                style={{
                  border: `1px solid ${errors.description ? 'oklch(0.58 0.18 25)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 12px', fontSize: 14,
                  color: 'var(--text-primary)', background: 'var(--surface)',
                  outline: 'none', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', width: '100%',
                }}
                data-testid="edit-lesson-description-input"
                aria-label="Lesson description"
              />
              {errors.description && (
                <p className="text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="edit-lesson-description-error">
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
                onChange={(e) => { setGenreId(e.target.value); setHasChanges(true); }}
                style={{
                  border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                  fontSize: 14, color: 'var(--text-primary)', background: 'var(--surface)',
                  outline: 'none', height: 40, fontFamily: 'inherit', appearance: 'none', width: '100%',
                }}
                data-testid="edit-lesson-genre-dropdown"
                aria-label="Select genre"
              >
                <option value="">Select a genre</option>
                {genres.map(genre => (
                  <option key={genre.id} value={genre.id}>
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
                style={{
                  border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
                  fontSize: 14, color: 'var(--text-primary)', background: 'var(--surface)',
                  outline: 'none', height: 40, fontFamily: 'inherit', width: '100%',
                }}
                data-testid="edit-lesson-tags-input"
                aria-label="Lesson tags"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                      style={{ background: 'var(--surface2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      data-testid={`edit-lesson-tag-chip-${tag}`}
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                        data-testid={`edit-lesson-tag-remove-${tag}`}
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
                Files
              </label>

              {existingFiles.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-1">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Existing Files</p>
                  {existingFiles.map(file => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
                      data-testid={`edit-lesson-existing-file-${file.id}`}
                    >
                      <FileText className="w-7 h-7 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{file.filename}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{(file.file_size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExistingFile(file.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                        data-testid={`edit-lesson-existing-file-remove-${file.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="rounded-[var(--radius)] p-8 text-center"
                style={{ border: '2px dashed var(--border)', background: 'var(--surface2)' }}
              >
                <Upload className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Add more files</p>
                <label
                  className="inline-block px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  <span data-testid="edit-lesson-choose-files-button">Choose Files</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="edit-lesson-file-input"
                  />
                </label>
              </div>
              {errors.files && (
                <p className="text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="edit-lesson-file-error">
                  {errors.files}
                </p>
              )}

              {newFiles.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>New Files</p>
                  {newFiles.map((uploadedFile, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--accent-light)', border: '1px solid var(--border)' }}
                      data-testid={`edit-lesson-new-file-${index}`}
                    >
                      {uploadedFile.preview ? (
                        <img src={uploadedFile.preview} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                      ) : (
                        <FileText className="w-10 h-10 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{uploadedFile.file.name}</p>
                        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                        data-testid={`edit-lesson-new-file-remove-${index}`}
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
                data-testid="edit-lesson-form-error"
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
                data-testid="edit-lesson-cancel-button"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}
                data-testid="edit-lesson-save-button"
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} data-testid="edit-lesson-cancel-dialog">
          <div className="w-full max-w-[400px] p-6 rounded-[var(--radius-lg)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Discard changes?</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>You have unsaved changes. Are you sure you want to leave?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
                data-testid="edit-lesson-cancel-dialog-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate(`/lessons/${id}`)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'oklch(0.58 0.18 25)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                data-testid="edit-lesson-cancel-dialog-confirm"
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
