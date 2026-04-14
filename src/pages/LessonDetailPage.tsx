import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CreditCard as Edit, Trash2, Share2, FileText, Image as ImageIcon, Download, X } from 'lucide-react';
import LessonQAPanel from '../components/LessonQAPanel';

interface Lesson {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  genre_id: string | null;
  tags: string[];
  created_at: string;
  genre?: { name: string } | null;
}

interface LessonFile {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
}

export default function LessonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [files, setFiles] = useState<LessonFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (id) {
      loadLessonDetails();
    }
  }, [id, user]);

  const loadLessonDetails = async () => {
    if (!id || !user) return;

    setLoading(true);

    const [lessonResult, filesResult] = await Promise.all([
      supabase
        .from('lessons')
        .select('*, genre:genres(*)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('lesson_files')
        .select('*')
        .eq('lesson_id', id)
        .order('uploaded_at', { ascending: false }),
    ]);

    if (lessonResult.data) {
      setLesson(lessonResult.data);
      setIsOwner(lessonResult.data.owner_id === user.id);
    }

    if (filesResult.data) {
      setFiles(filesResult.data);
      loadThumbnails(filesResult.data);
    }

    setLoading(false);
  };

  const loadThumbnails = async (filesList: LessonFile[]) => {
    console.log('=== THUMBNAIL LOADING START ===');
    console.log('Files to load:', filesList.length);

    const { data: { session } } = await supabase.auth.getSession();
    console.log('Session check:', {
      hasSession: !!session,
      userId: session?.user?.id
    });

    if (!session) {
      console.error('No active session when loading thumbnails');
      return;
    }

    const imageFiles = filesList.filter(file => file.file_type.startsWith('image/'));
    console.log('Image files found:', imageFiles.length);
    console.log('Image file details:', imageFiles.map(f => ({
      id: f.id,
      filename: f.filename,
      path: f.storage_path
    })));

    const loadingState: Record<string, boolean> = {};
    imageFiles.forEach(file => {
      loadingState[file.id] = true;
    });
    setLoadingThumbnails(loadingState);

    const thumbnailPromises = imageFiles.map(async (file) => {
      try {
        console.log(`Attempting to get URL for: ${file.filename}`);
        const url = await getFileUrl(file.storage_path);
        console.log(`Result for ${file.filename}:`, url ? 'SUCCESS' : 'FAILED');
        return { id: file.id, url: url || '', filename: file.filename };
      } catch (error) {
        console.error(`Failed to load thumbnail for ${file.filename}:`, error);
        return { id: file.id, url: '', filename: file.filename };
      }
    });

    const results = await Promise.all(thumbnailPromises);
    console.log('All thumbnail results:', results);

    const urlsMap: Record<string, string> = {};
    const loadingMap: Record<string, boolean> = {};

    results.forEach(({ id, url }) => {
      if (url) {
        urlsMap[id] = url;
      }
      loadingMap[id] = false;
    });

    console.log('URLs created:', Object.keys(urlsMap).length);
    console.log('=== THUMBNAIL LOADING END ===');

    setThumbnailUrls(urlsMap);
    setLoadingThumbnails(loadingMap);
  };

  const handleDelete = async () => {
    if (!lesson || !id) return;

    try {
      const { error } = await supabase.from('lessons').delete().eq('id', id);

      if (error) throw error;

      navigate('/library');
    } catch (error) {
      console.error('Error deleting lesson:', error);
    }
  };

  const getFileUrl = async (filePath: string) => {
    console.log('[getFileUrl] Starting for path:', filePath);
    const { data, error } = await supabase.storage.from('lesson-files').createSignedUrl(filePath, 3600);

    if (error) {
      console.error('[getFileUrl] ERROR:', {
        errorObject: error,
        errorMessage: error?.message || 'No message',
        errorName: error?.name || 'No name',
        errorStringified: JSON.stringify(error),
        filePath,
        userId: user?.id,
        lessonId: lesson?.id
      });
      return undefined;
    }

    if (data?.signedUrl) {
      console.log('[getFileUrl] SUCCESS - URL created');
    } else {
      console.error('[getFileUrl] No URL returned but no error either');
    }

    return data?.signedUrl;
  };

  const handleFileClick = async (file: LessonFile) => {
    const url = await getFileUrl(file.storage_path);
    if (!url) return;

    if (file.file_type.startsWith('image/')) {
      setSelectedImage(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDownload = async (file: LessonFile) => {
    const url = await getFileUrl(file.storage_path);
    if (!url) return;

    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Lesson not found</h2>
          <button
            onClick={() => navigate('/library')}
            className="text-slate-600 hover:text-slate-900"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/library')}
              className="flex items-center space-x-2 text-slate-700 hover:text-slate-900"
              data-testid="lesson-detail-back-button"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Library</span>
            </button>

            {isOwner && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="flex items-center space-x-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  data-testid="lesson-detail-share-button"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => navigate(`/lessons/${id}/edit`)}
                  className="flex items-center space-x-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  data-testid="lesson-detail-edit-button"
                >
                  <Edit className="w-5 h-5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  data-testid="lesson-detail-delete-button"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-4" data-testid="lesson-detail-title">
            {lesson.title}
          </h1>

          <div className="flex flex-wrap gap-2 mb-6">
            {lesson.genre && (
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm" data-testid="lesson-detail-genre">
                {lesson.genre.name}
              </span>
            )}
            {lesson.tags && lesson.tags.map(tag => (
              <span key={tag} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-sm" data-testid="lesson-detail-tag">
                {tag}
              </span>
            ))}
          </div>

          <div className="prose max-w-none">
            <p className="text-slate-700 whitespace-pre-wrap" data-testid="lesson-detail-description">
              {lesson.description}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Files ({files.length})
          </h2>

          {files.length === 0 ? (
            <div className="text-center py-8" data-testid="lesson-detail-no-files">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No files uploaded yet</p>
              {isOwner && (
                <button
                  onClick={() => navigate(`/lessons/${id}/edit`)}
                  className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  data-testid="lesson-detail-upload-files-button"
                >
                  Upload Files
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="lesson-detail-files-list">
              {files.map(file => (
                <div
                  key={file.id}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  data-testid={`lesson-detail-file-${file.id}`}
                >
                  <div
                    onClick={() => handleFileClick(file)}
                    className="cursor-pointer mb-3 group"
                  >
                    {file.file_type.startsWith('image/') ? (
                      <div className="aspect-video bg-slate-100 rounded flex items-center justify-center overflow-hidden relative">
                        {loadingThumbnails[file.id] ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400"></div>
                          </div>
                        ) : thumbnailUrls[file.id] ? (
                          <img
                            src={thumbnailUrls[file.id]}
                            alt={file.filename}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="w-12 h-12 text-slate-400" />
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video bg-slate-100 rounded flex items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900 truncate mb-1" data-testid="lesson-file-name">
                    {file.filename}
                  </p>
                  <p className="text-xs text-slate-500 mb-3" data-testid="lesson-file-size">
                    {(file.file_size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={() => handleDownload(file)}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors text-sm"
                    data-testid={`lesson-file-download-${file.id}`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <LessonQAPanel lessonId={lesson.id} />
      </main>

      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" data-testid="lesson-detail-delete-dialog">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Lesson</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to delete this lesson? This action cannot be undone.</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                data-testid="lesson-detail-delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                data-testid="lesson-detail-delete-confirm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareDialog && (
        <ShareDialog
          lessonId={lesson.id}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
          data-testid="lesson-detail-image-lightbox"
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-slate-300"
            onClick={() => setSelectedImage(null)}
            data-testid="lesson-detail-lightbox-close"
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={selectedImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function ShareDialog({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [sharedUsers, setSharedUsers] = useState<Array<{ id: string; email: string; username: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSharedUsers();
  }, []);

  const loadSharedUsers = async () => {
    const { data } = await supabase
      .from('lesson_shares')
      .select('shared_with:profiles(id, email, username)')
      .eq('lesson_id', lessonId)
      .eq('owner_id', user!.id);

    if (data) {
      setSharedUsers(data.map((item: any) => item.shared_with).filter(Boolean));
    }
  };

  const handleShare = async () => {
    setError('');
    setLoading(true);

    if (email === user?.email) {
      setError('You cannot share a lesson with yourself');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, username')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      setError('User not found. Please check the email address');
      setLoading(false);
      return;
    }

    if (sharedUsers.some(u => u.id === profile.id)) {
      setError('Lesson already shared with this user');
      setLoading(false);
      return;
    }

    const { error: shareError } = await supabase.from('lesson_shares').insert({
      lesson_id: lessonId,
      owner_id: user!.id,
      shared_with_id: profile.id,
    });

    if (shareError) {
      setError('Failed to share lesson');
      setLoading(false);
      return;
    }

    setSharedUsers([...sharedUsers, profile]);
    setEmail('');
    setLoading(false);
  };

  const handleRevoke = async (userId: string) => {
    const { error } = await supabase
      .from('lesson_shares')
      .delete()
      .eq('lesson_id', lessonId)
      .eq('shared_with_id', userId);

    if (!error) {
      setSharedUsers(sharedUsers.filter(u => u.id !== userId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" data-testid="lesson-share-dialog">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Share Lesson</h3>

        <div className="mb-4">
          <label htmlFor="share-email" className="block text-sm font-medium text-slate-700 mb-2">
            Email Address
          </label>
          <div className="flex space-x-2">
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              data-testid="lesson-share-email-input"
              aria-label="User email to share with"
            />
            <button
              onClick={handleShare}
              disabled={loading || !email}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400"
              data-testid="lesson-share-submit-button"
            >
              Share
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" data-testid="lesson-share-error">
              {error}
            </p>
          )}
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Shared with</h4>
          {sharedUsers.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid="lesson-share-empty-list">
              This lesson has not been shared with anyone yet
            </p>
          ) : (
            <div className="space-y-2" data-testid="lesson-share-users-list">
              {sharedUsers.map(sharedUser => (
                <div key={sharedUser.id} className="flex items-center justify-between p-2 bg-slate-50 rounded" data-testid={`lesson-share-user-${sharedUser.id}`}>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{sharedUser.username}</p>
                    <p className="text-xs text-slate-500">{sharedUser.email}</p>
                  </div>
                  <button
                    onClick={() => handleRevoke(sharedUser.id)}
                    className="text-sm text-red-600 hover:text-red-700"
                    data-testid={`lesson-share-remove-${sharedUser.id}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          data-testid="lesson-share-close-button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
