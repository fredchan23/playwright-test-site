import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

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

  useEffect(() => {
    loadGenres();
  }, []);

  const loadGenres = async () => {
    const { data } = await supabase.from('genres').select('*').order('name');
    if (data) {
      setGenres(data);
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
          setFiles(prev => [...prev, uploadedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setFiles(prev => [...prev, uploadedFile]);
      }
    });

    setErrors(newErrors);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    const dataTransfer = new DataTransfer();
    droppedFiles.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    handleFileSelect({ target: fileInput } as any);
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 text-slate-700 hover:text-slate-900"
              data-testid="create-lesson-back-button"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Library</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Create New Lesson</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-8" data-testid="create-lesson-form">
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-2">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                errors.title ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="Enter lesson title"
              data-testid="create-lesson-title-input"
              aria-label="Lesson title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600" data-testid="create-lesson-title-error">
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
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                errors.description ? 'border-red-500' : 'border-slate-300'
              }`}
              placeholder="Enter lesson description"
              data-testid="create-lesson-description-input"
              aria-label="Lesson description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600" data-testid="create-lesson-description-error">
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
              onChange={(e) => setGenreId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
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
              data-testid="create-lesson-tags-input"
              aria-label="Lesson tags"
            />
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center space-x-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-lg"
                    data-testid={`create-lesson-tag-chip-${tag}`}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-slate-500 hover:text-slate-700"
                      data-testid={`create-lesson-tag-remove-${tag}`}
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
              Files (PDF, JPG, PNG, GIF - Max 10MB each)
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors"
              data-testid="create-lesson-upload-dropzone"
            >
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">Drag and drop files here, or</p>
              <label className="inline-block px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer transition-colors">
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
              <p className="mt-2 text-sm text-red-600" data-testid="create-lesson-file-error">
                {errors.files}
              </p>
            )}

            {files.length > 0 && (
              <div className="mt-4 space-y-3" data-testid="create-lesson-files-list">
                {files.map((uploadedFile, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg"
                    data-testid={`create-lesson-file-item-${index}`}
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
                      onClick={() => removeFile(index)}
                      className="text-slate-400 hover:text-slate-600"
                      data-testid={`create-lesson-file-remove-${index}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.form && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700" data-testid="create-lesson-form-error">
              {errors.form}
            </div>
          )}

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              data-testid="create-lesson-cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              data-testid="create-lesson-save-button"
            >
              {loading ? 'Creating...' : 'Create Lesson'}
            </button>
          </div>
        </form>
      </main>

      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" data-testid="create-lesson-cancel-dialog">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Discard changes?</h3>
            <p className="text-slate-600 mb-6">You have unsaved changes. Are you sure you want to leave?</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                data-testid="create-lesson-cancel-dialog-cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => navigate('/library')}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
