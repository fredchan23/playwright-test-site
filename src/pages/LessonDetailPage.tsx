import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, SquarePen as Edit, Trash2, Share2, FileText, Image as ImageIcon, Download, X, BookOpen, Sparkles } from 'lucide-react';
import LessonQAPanel from '../components/LessonQAPanel';
import useIsMobile from '../hooks/useIsMobile';

const GENRE_COLORS: Record<string, { bg: string; text: string }> = {
  Arts:        { bg: 'oklch(0.93 0.05 340)', text: 'oklch(0.45 0.15 340)' },
  Business:    { bg: 'oklch(0.94 0.05 80)',  text: 'oklch(0.45 0.14 80)'  },
  Design:      { bg: 'oklch(0.93 0.05 300)', text: 'oklch(0.45 0.16 300)' },
  Language:    { bg: 'oklch(0.93 0.05 200)', text: 'oklch(0.45 0.14 200)' },
  Mathematics: { bg: 'oklch(0.93 0.05 250)', text: 'oklch(0.45 0.16 250)' },
  Programming: { bg: 'oklch(0.93 0.05 178)', text: 'oklch(0.42 0.14 178)' },
  Science:     { bg: 'oklch(0.93 0.05 130)', text: 'oklch(0.42 0.14 130)' },
};

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const isPdf = (file: { file_type: string }) => file.file_type === 'application/pdf';

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
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<'lesson' | 'qa'>('lesson');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [files, setFiles] = useState<LessonFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return;
    }

    const imageFiles = filesList.filter(file => file.file_type.startsWith('image/'));
    const pdfFiles = filesList.filter(isPdf);
    const previewFiles = [...imageFiles, ...pdfFiles];

    const loadingState: Record<string, boolean> = {};
    previewFiles.forEach(file => {
      loadingState[file.id] = true;
    });
    setLoadingThumbnails(loadingState);

    const imagePromises = imageFiles.map(async (file) => {
      try {
        const url = await getFileUrl(file.storage_path);
        return { id: file.id, url: url || '' };
      } catch {
        return { id: file.id, url: '' };
      }
    });

    const pdfPromises = pdfFiles.map(async (file) => {
      try {
        const signedUrl = await getFileUrl(file.storage_path);
        if (!signedUrl) return { id: file.id, url: '' };
        const pdf = await pdfjsLib.getDocument(signedUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport, canvas }).promise;
        return { id: file.id, url: canvas.toDataURL('image/png') };
      } catch {
        return { id: file.id, url: '' };
      }
    });

    const results = await Promise.all([...imagePromises, ...pdfPromises]);

    const urlsMap: Record<string, string> = {};
    const loadingMap: Record<string, boolean> = {};

    results.forEach(({ id, url }) => {
      if (url) {
        urlsMap[id] = url;
      }
      loadingMap[id] = false;
    });

    setThumbnailUrls(urlsMap);
    setLoadingThumbnails(loadingMap);
  };

  const handleDelete = async () => {
    if (!lesson || !id) return;

    try {
      const { error } = await supabase.from('lessons').delete().eq('id', id);

      if (error) throw error;

      navigate('/library');
    } catch {
      setDeleteError(true);
    }
  };

  const getFileUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage.from('lesson-files').createSignedUrl(filePath, 900);

    if (error) {
      return undefined;
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

  if (!lesson) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Lesson not found</h2>
          <button
            onClick={() => navigate('/library')}
            className="text-sm"
            style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          padding: isMobile ? '10px 14px' : '14px 28px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border-light)',
        }}
      >
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          data-testid="lesson-detail-back-button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Library
        </button>

        {isOwner && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowShareDialog(true)}
              className="flex items-center gap-1.5 rounded-lg text-sm font-medium"
              style={{
                padding: isMobile ? '6px' : '6px 12px',
                color: 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              data-testid="lesson-detail-share-button"
            >
              <Share2 className="w-3.5 h-3.5" />
              {!isMobile && 'Share'}
            </button>
            <button
              onClick={() => navigate(`/lessons/${id}/edit`)}
              className="flex items-center gap-1.5 rounded-lg text-sm font-medium"
              style={{
                padding: isMobile ? '6px' : '6px 12px',
                color: 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              data-testid="lesson-detail-edit-button"
            >
              <Edit className="w-3.5 h-3.5" />
              {!isMobile && 'Edit'}
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-1.5 rounded-lg text-sm font-medium"
              style={{
                padding: isMobile ? '6px' : '6px 12px',
                background: isMobile ? 'none' : 'oklch(0.95 0.04 25)',
                color: 'oklch(0.45 0.18 25)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              data-testid="lesson-detail-delete-button"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {!isMobile && 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Mobile tab bar */}
      {isMobile && (
        <div
          className="flex shrink-0"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)' }}
          data-testid="lesson-detail-tab-bar"
        >
          {([
            { id: 'lesson', label: 'Lesson', Icon: BookOpen, testid: 'lesson-detail-tab-lesson' },
            { id: 'qa',     label: 'Ask AI',  Icon: Sparkles, testid: 'lesson-detail-tab-qa' },
          ] as const).map(({ id: tabId, label, Icon, testid }) => (
            <button
              key={tabId}
              onClick={() => setMobileTab(tabId)}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium"
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: mobileTab === tabId ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: mobileTab === tabId ? 600 : 400,
                borderBottom: mobileTab === tabId ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              data-testid={testid}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Main content */}
        {(!isMobile || mobileTab === 'lesson') && (
        <div className="flex-1 overflow-y-auto" style={{ padding: isMobile ? '24px 18px' : '32px 36px' }}>
          <div className="max-w-[680px]">
            {lesson.genre && (
              <span
                className="inline-block px-2.5 py-1 text-[11px] rounded-full font-medium font-mono mb-3"
                style={{
                  background: GENRE_COLORS[lesson.genre.name]?.bg ?? 'var(--surface2)',
                  color: GENRE_COLORS[lesson.genre.name]?.text ?? 'var(--text-secondary)',
                }}
                data-testid="lesson-detail-genre"
              >
                {lesson.genre.name}
              </span>
            )}
            <h1
              className="text-[26px] font-bold tracking-tight leading-snug mb-3"
              style={{ color: 'var(--text-primary)' }}
              data-testid="lesson-detail-title"
            >
              {lesson.title}
            </h1>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {lesson.tags && lesson.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[11px] rounded-full font-mono"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  data-testid="lesson-detail-tag"
                >
                  {tag}
                </span>
              ))}
            </div>

            <p
              className="text-[15px] whitespace-pre-wrap mb-8"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}
              data-testid="lesson-detail-description"
            >
              {lesson.description}
            </p>

            {/* Files section */}
            <h2 className="text-[15px] font-semibold mb-3.5 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <FileText className="w-3.5 h-3.5" />
              Files ({files.length})
            </h2>

          {files.length === 0 ? (
            <div className="text-center py-8" data-testid="lesson-detail-no-files">
              <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No files uploaded yet</p>
              {isOwner && (
                <button
                  onClick={() => navigate(`/lessons/${id}/edit`)}
                  className="mt-4 px-4 py-2 text-sm font-medium rounded-lg text-white"
                  style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  data-testid="lesson-detail-upload-files-button"
                >
                  Upload Files
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3" data-testid="lesson-detail-files-list">
              {files.map(file => (
                <div
                  key={file.id}
                  className="rounded-[var(--radius)] overflow-hidden"
                  style={{ width: 170, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}
                  data-testid={`lesson-detail-file-${file.id}`}
                >
                  <div
                    onClick={() => handleFileClick(file)}
                    className="cursor-pointer group"
                    style={{ height: 110, background: 'var(--surface2)', borderBottom: '1px solid var(--border-light)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {(file.file_type.startsWith('image/') || isPdf(file)) ? (
                      <>
                        {loadingThumbnails[file.id] ? (
                          <div
                            className="w-7 h-7 rounded-full border-2 border-transparent animate-spin"
                            style={{ borderTopColor: 'var(--accent)', borderRightColor: 'var(--accent)' }}
                          />
                        ) : thumbnailUrls[file.id] ? (
                          <img
                            src={thumbnailUrls[file.id]}
                            alt={file.filename}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                            data-testid={isPdf(file) ? `lesson-file-pdf-thumbnail-${file.id}` : undefined}
                          />
                        ) : (
                          file.file_type.startsWith('image/')
                            ? <ImageIcon className="w-7 h-7" style={{ color: 'var(--text-muted)' }} />
                            : <FileText className="w-7 h-7" style={{ color: 'var(--text-muted)' }} />
                        )}
                      </>
                    ) : (
                      <FileText className="w-7 h-7" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[11px] font-medium truncate mb-0.5" style={{ color: 'var(--text-primary)' }} data-testid="lesson-file-name">
                      {file.filename}
                    </p>
                    <p className="text-[11px] font-mono mb-2" style={{ color: 'var(--text-muted)' }} data-testid="lesson-file-size">
                      {(file.file_size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => handleDownload(file)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium"
                      style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' }}
                      data-testid={`lesson-file-download-${file.id}`}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          </div>
        </div>
        )}

        {/* Q&A panel — right column on desktop, full-width tab on mobile */}
        {(!isMobile || mobileTab === 'qa') && (
          <div
            className="flex flex-col"
            style={isMobile
              ? { flex: 1, minHeight: 0, background: 'var(--surface)' }
              : { width: 360, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)' }
            }
          >
            <LessonQAPanel lessonId={lesson.id} columnMode={true} />
          </div>
        )}
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} data-testid="lesson-detail-delete-dialog">
          <div className="w-full max-w-[400px] p-6 rounded-[var(--radius-lg)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Delete Lesson</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Are you sure you want to delete this lesson? This action cannot be undone.</p>
            {deleteError && (
              <p className="mb-4 text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="lesson-detail-delete-error">
                Failed to delete lesson. Please try again.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteDialog(false); setDeleteError(false); }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
                data-testid="lesson-detail-delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'oklch(0.58 0.18 25)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
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
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setSelectedImage(null)}
          data-testid="lesson-detail-image-lightbox"
        >
          <button
            className="absolute top-4 right-4 text-white"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => setSelectedImage(null)}
            data-testid="lesson-detail-lightbox-close"
          >
            <X className="w-7 h-7" />
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
      type SharedWithRow = { shared_with: { id: string; email: string; username: string } | null };
      const rows = data as unknown as SharedWithRow[];
      setSharedUsers(rows.map((item) => item.shared_with).filter((u): u is { id: string; email: string; username: string } => Boolean(u)));
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
    setError('');
    const { error: revokeError } = await supabase
      .from('lesson_shares')
      .delete()
      .eq('lesson_id', lessonId)
      .eq('shared_with_id', userId);

    if (revokeError) {
      setError('Failed to remove user. Please try again.');
      return;
    }

    setSharedUsers(sharedUsers.filter(u => u.id !== userId));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} data-testid="lesson-share-dialog">
      <div className="w-full max-w-[440px] p-6 rounded-[var(--radius-lg)]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Share Lesson</h3>

        <div className="mb-4">
          <label htmlFor="share-email" className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Email Address
          </label>
          <div className="flex gap-2">
            <input
              id="share-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              style={{
                flex: 1, border: '1px solid var(--border)', borderRadius: 8,
                padding: '9px 12px', fontSize: 14, color: 'var(--text-primary)',
                background: 'var(--surface)', outline: 'none', fontFamily: 'inherit',
              }}
              data-testid="lesson-share-email-input"
              aria-label="User email to share with"
            />
            <button
              onClick={handleShare}
              disabled={loading || !email}
              className="px-4 py-2 text-sm font-medium rounded-lg text-white"
              style={{ background: 'var(--accent)', border: 'none', cursor: loading || !email ? 'not-allowed' : 'pointer', opacity: loading || !email ? 0.6 : 1, fontFamily: 'inherit' }}
              data-testid="lesson-share-submit-button"
            >
              Share
            </button>
          </div>
          {error && (
            <p className="mt-1.5 text-xs" style={{ color: 'oklch(0.45 0.18 25)' }} data-testid="lesson-share-error">
              {error}
            </p>
          )}
        </div>

        <div className="mb-5">
          <h4 className="text-[13px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Shared with</h4>
          {sharedUsers.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }} data-testid="lesson-share-empty-list">
              This lesson has not been shared with anyone yet
            </p>
          ) : (
            <div className="flex flex-col gap-1.5" data-testid="lesson-share-users-list">
              {sharedUsers.map(sharedUser => (
                <div
                  key={sharedUser.id}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: 'var(--surface2)' }}
                  data-testid={`lesson-share-user-${sharedUser.id}`}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{sharedUser.username}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sharedUser.email}</p>
                  </div>
                  <button
                    onClick={() => handleRevoke(sharedUser.id)}
                    className="text-xs font-medium"
                    style={{ color: 'oklch(0.45 0.18 25)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
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
          className="w-full px-4 py-2 rounded-lg text-sm font-medium"
          style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit' }}
          data-testid="lesson-share-close-button"
        >
          Close
        </button>
      </div>
    </div>
  );
}
