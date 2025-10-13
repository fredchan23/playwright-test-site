import { useState, useEffect } from 'react';
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
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (id) {
      loadLessonData();
    }
  }, [id]);

  const loadLessonData = async () => {
    if (!id || !user) return;

    const [genresResult, lessonResult, filesResult] = await Promise.all([
      supabase.from('genres').select('*').order('name'),
      supabase.from('lessons').select('*').eq('id', id).maybeSingle(),
      supabase.from('lesson_files').select('*').eq('lesson_id', id),
    ]);

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
    setFilesToDelete([...filesToDelete, fileId]);
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

        for (const fileId of filesToDelete) {
          const file = existingFiles.find(f => f.id === fileId);
          if (file) {
            await supabase.storage.from('lesson-files').remove([file.storage_path]);
            await supabase.from('lesson_files').delete().eq('id', fileId);
          }
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
      } catch (error) {
        console.error('Error updating lesson:', error);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading lesson...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 text-slate-700 hover:text-slate-900"
              data-testid="edit-lesson-back-button"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Edit Lesson</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-8" data-testid="edit-lesson-form">
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-2">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setHasChanges(true); }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                errors.title ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="Enter lesson title"
              data-testid="edit-lesson-title-input"
              aria-label="Lesson title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600" data-testid="edit-lesson-title-error">
                {errors.title}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setHasChanges(true); }}
              rows={6}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                errors.description ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="Enter lesson description"
              data-testid="edit-lesson-description-input"
              aria-label="Lesson description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600" data-testid="edit-lesson-description-error">
                {errors.description}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="genre" className="block text-sm font-medium text-slate-700 mb-2">
              Genre
            </label>
            <select
              id="genre"
              value={genreId}
              onChange={(e) => { setGenreId(e.target.value); setHasChanges(true); }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
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

          <div className="mb-6">
            <label htmlFor="tags" className="block text-sm font-medium text-slate-700 mb-2">
              Tags
            </label>
            <input
              id="tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInput}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              placeholder="Enter tags separated by commas"
              data-testid="edit-lesson-tags-input"
              aria-label="Lesson tags"
            />
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center space-x-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg"
                    data-testid={`edit-lesson-tag-chip-${tag}`}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-slate-500 hover:text-slate-700"
                      data-testid={`edit-lesson-tag-remove-${tag}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Files
            </label>

            {existingFiles.length > 0 && (
              <div className="mb-4 space-y-2">
                <h4 className="text-sm font-medium text-slate-600">Existing Files</h4>
                {existingFiles.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg"
                    data-testid={`edit-lesson-existing-file-${file.id}`}
                  >
                    <FileText className="w-8 h-8 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(file.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExistingFile(file.id)}
                      className="text-slate-400 hover:text-slate-600"
                      data-testid={`edit-lesson-existing-file-remove-${file.id}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">Add more files</p>
              <label className="inline-block px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer transition-colors">
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
              <p className="mt-2 text-sm text-red-600" data-testid="edit-lesson-file-error">
                {errors.files}
              </p>
            )}

            {newFiles.length > 0 && (
              <div className="mt-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-600">New Files</h4>
                {newFiles.map((uploadedFile, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg"
                    data-testid={`edit-lesson-new-file-${index}`}
                  >
                    {uploadedFile.preview ? (
                      <img src={uploadedFile.preview} alt="" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <FileText className="w-12 h-12 text-slate-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewFile(index)}
                      className="text-slate-400 hover:text-slate-600"
                      data-testid={`edit-lesson-new-file-remove-${index}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.form && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700" data-testid="edit-lesson-form-error">
              {errors.form}
            </div>
          )}

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid="edit-lesson-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              data-testid="edit-lesson-save-button"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>

      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" data-testid="edit-lesson-cancel-dialog">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Discard changes?</h3>
            <p className="text-slate-600 mb-6">You have unsaved changes. Are you sure you want to leave?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                data-testid="edit-lesson-cancel-dialog-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate(`/lessons/${id}`)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
