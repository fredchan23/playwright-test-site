import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, LogOut, FileText, X, SlidersHorizontal, LayoutGrid, List, Settings } from 'lucide-react';
import RangeSlider from '../components/RangeSlider';

interface Genre {
  id: string;
  name: string;
}

interface LessonFile {
  id: string;
  lesson_id: string;
  file_size: number;
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  tags: string[];
  genre_id: string | null;
  owner_id: string;
  created_at: string;
  genre?: Genre | null;
  owner?: { username: string };
  shared_by?: string;
  files?: LessonFile[];
  total_file_size?: number;
}

type ViewMode = 'card' | 'list';

export default function LibraryPage() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [ownLessons, setOwnLessons] = useState<Lesson[]>([]);
  const [sharedLessons, setSharedLessons] = useState<Lesson[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [fileSizeRange, setFileSizeRange] = useState<[number, number]>([0, 10]);
  const [maxFileSize, setMaxFileSize] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('library-view-mode');
    return (saved === 'list' || saved === 'card') ? saved : 'card';
  });

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    setLoadError(false);

    try {
      const [genresResult, ownLessonsResult, sharedLessonsResult, filesResult] = await Promise.all([
        supabase.from('genres').select('*').order('name'),
        supabase
          .from('lessons')
          .select('*, genre:genres(*)')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('lesson_shares')
          .select('lesson:lessons(*, genre:genres(*), owner:profiles(username))')
          .eq('shared_with_id', user.id),
        supabase.from('lesson_files').select('id, lesson_id, file_size'),
      ]);

      if (genresResult.error) throw genresResult.error;
      if (ownLessonsResult.error) throw ownLessonsResult.error;
      if (sharedLessonsResult.error) throw sharedLessonsResult.error;

      if (genresResult.data) {
        setGenres(genresResult.data);
      }

      const lessonFilesMap = new Map<string, LessonFile[]>();
      let maxSize = 10;

      if (filesResult.data) {
        filesResult.data.forEach((file: LessonFile) => {
          if (!lessonFilesMap.has(file.lesson_id)) {
            lessonFilesMap.set(file.lesson_id, []);
          }
          lessonFilesMap.get(file.lesson_id)!.push(file);
          const fileSizeMB = file.file_size / (1024 * 1024);
          if (fileSizeMB > maxSize) {
            maxSize = Math.ceil(fileSizeMB);
          }
        });
      }

      setMaxFileSize(maxSize);
      setFileSizeRange([0, maxSize]);

      if (ownLessonsResult.data) {
        const lessonsWithFiles = ownLessonsResult.data.map((lesson) => {
          const files = lessonFilesMap.get(lesson.id) || [];
          const total_file_size = files.reduce((sum, file) => sum + file.file_size, 0) / (1024 * 1024);
          return { ...lesson, files, total_file_size };
        });
        setOwnLessons(lessonsWithFiles);
        extractTags(lessonsWithFiles);
      }

      if (sharedLessonsResult.data) {
        type SharedLessonRow = { lesson: Lesson | null };
        const rows = sharedLessonsResult.data as unknown as SharedLessonRow[];
        const shared = rows
          .map((share) => {
            if (!share.lesson) return null;
            const files = lessonFilesMap.get(share.lesson.id) || [];
            const total_file_size = files.reduce((sum, file) => sum + file.file_size, 0) / (1024 * 1024);
            return {
              ...share.lesson,
              shared_by: share.lesson.owner?.username,
              files,
              total_file_size,
            };
          })
          .filter((l): l is NonNullable<typeof l> => l !== null);
        setSharedLessons(shared as Lesson[]);
        extractTags([...ownLessonsResult.data || [], ...shared]);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const extractTags = (lessons: Lesson[]) => {
    const tagSet = new Set<string>();
    lessons.forEach(lesson => {
      lesson.tags?.forEach(tag => tagSet.add(tag));
    });
    setAvailableTags(Array.from(tagSet).sort());
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filterLessons = (lessons: Lesson[]) => {
    let filtered = [...lessons];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lesson =>
        lesson.title.toLowerCase().includes(query) ||
        lesson.description.toLowerCase().includes(query) ||
        lesson.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (selectedGenres.length > 0) {
      filtered = filtered.filter(lesson =>
        lesson.genre_id && selectedGenres.includes(lesson.genre_id)
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(lesson =>
        selectedTags.every(tag => lesson.tags?.includes(tag))
      );
    }

    if (fileSizeRange[0] > 0 || fileSizeRange[1] < maxFileSize) {
      filtered = filtered.filter(lesson => {
        const totalSize = lesson.total_file_size || 0;
        return totalSize >= fileSizeRange[0] && totalSize <= fileSizeRange[1];
      });
    }

    return filtered;
  };

  const toggleGenre = (genreId: string) => {
    setSelectedGenres(prev =>
      prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedTags([]);
    setSearchQuery('');
    setFileSizeRange([0, maxFileSize]);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('library-view-mode', mode);
  };

  const filteredOwnLessons = filterLessons(ownLessons);
  const filteredSharedLessons = filterLessons(sharedLessons);
  const totalFiltered = filteredOwnLessons.length + filteredSharedLessons.length;
  const totalLessons = ownLessons.length + sharedLessons.length;
  const hasFileSizeFilter = fileSizeRange[0] > 0 || fileSizeRange[1] < maxFileSize;
  const hasActiveFilters = searchQuery || selectedGenres.length > 0 || selectedTags.length > 0 || hasFileSizeFilter;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading library...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" data-testid="library-error">
        <div className="text-center">
          <p className="text-slate-700 font-medium mb-2">Failed to load your library.</p>
          <p className="text-slate-500 text-sm mb-6">Check your connection and try again.</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            data-testid="library-error-retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold tracking-tight">SN</span>
              </div>
              <h1 className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-slate-900">StudyNode</span>
                <span className="text-sm font-medium text-slate-400">Library</span>
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {isAdmin && (
                <button
                  onClick={() => navigate('/settings')}
                  className="flex items-center space-x-2 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  data-testid="library-settings-button"
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="library-logout-button"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              data-testid="library-search-input"
              aria-label="Search lessons"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                data-testid="library-search-clear-button"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            data-testid="library-filters-toggle-button"
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="bg-slate-900 text-white text-xs px-2 py-0.5 rounded-full">
                {(selectedGenres.length + selectedTags.length) || ''}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/lessons/create')}
            className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            data-testid="library-create-lesson-button"
          >
            <Plus className="w-5 h-5" />
            <span>Create Lesson</span>
          </button>
        </div>

        {showFilters && (
          <div className="mb-8 bg-white rounded-lg shadow-sm border border-slate-200 p-6" data-testid="library-filters-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-slate-600 hover:text-slate-900"
                  data-testid="library-clear-filters-button"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Genre</h4>
              <div className="flex flex-wrap gap-2">
                {genres.map(genre => (
                  <button
                    key={genre.id}
                    onClick={() => toggleGenre(genre.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedGenres.includes(genre.id)
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    data-testid={`library-filter-genre-${genre.name.toLowerCase()}`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>

            {availableTags.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                      data-testid={`library-filter-tag-${tag.toLowerCase()}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <RangeSlider
                min={0}
                max={maxFileSize}
                step={0.1}
                values={fileSizeRange}
                onChange={setFileSizeRange}
                label="Lesson File Size"
                formatValue={(v) => `${v.toFixed(1)} MB`}
              />
            </div>
          </div>
        )}

        {hasActiveFilters && (
          <div className="mb-4 text-sm text-slate-600" data-testid="library-results-count">
            Showing {totalFiltered} of {totalLessons} lessons
          </div>
        )}

        {filteredOwnLessons.length === 0 && filteredSharedLessons.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2" data-testid="library-empty-message">
              {hasActiveFilters ? 'No lessons found matching your search' : "You haven't created any lessons yet"}
            </h3>
            <p className="text-slate-600 mb-6">
              {hasActiveFilters ? 'Try adjusting your filters or search query' : 'Create your first lesson to get started'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => navigate('/lessons/create')}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                data-testid="library-empty-create-button"
              >
                <Plus className="w-5 h-5" />
                <span>Create Your First Lesson</span>
              </button>
            )}
          </div>
        )}

        {filteredOwnLessons.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900" data-testid="library-my-lessons-heading">
                My Lessons ({filteredOwnLessons.length})
              </h2>
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1" data-testid="library-view-toggle">
                <button
                  onClick={() => handleViewModeChange('card')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'card'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-label="Card view"
                  data-testid="library-view-card-button"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-label="List view"
                  data-testid="library-view-list-button"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
            {viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOwnLessons.map(lesson => (
                  <LessonCard key={lesson.id} lesson={lesson} isOwned={true} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredOwnLessons.map(lesson => (
                  <LessonListItem key={lesson.id} lesson={lesson} isOwned={true} />
                ))}
              </div>
            )}
          </section>
        )}

        {filteredSharedLessons.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4" data-testid="library-shared-lessons-heading">
              Shared with Me ({filteredSharedLessons.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSharedLessons.map(lesson => (
                <LessonCard key={lesson.id} lesson={lesson} isOwned={false} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

const GENRE_COLORS: Record<string, { border: string; badge: string; dot: string }> = {
  Programming: { border: 'border-t-blue-500',    badge: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500' },
  Design:      { border: 'border-t-rose-500',    badge: 'bg-rose-50 text-rose-700',    dot: 'bg-rose-500' },
  Business:    { border: 'border-t-emerald-500', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  Language:    { border: 'border-t-amber-500',   badge: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500' },
  Science:     { border: 'border-t-violet-500',  badge: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  Mathematics: { border: 'border-t-indigo-500',  badge: 'bg-indigo-50 text-indigo-700', dot: 'bg-indigo-500' },
  Arts:        { border: 'border-t-orange-500',  badge: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
};
const DEFAULT_GENRE_COLORS = { border: 'border-t-slate-400', badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' };

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function LessonListItem({ lesson, isOwned }: { lesson: Lesson; isOwned: boolean }) {
  const navigate = useNavigate();
  const colors = GENRE_COLORS[lesson.genre?.name ?? ''] ?? DEFAULT_GENRE_COLORS;

  return (
    <div
      onClick={() => navigate(`/lessons/${lesson.id}`)}
      className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
      data-testid={`library-lesson-list-${lesson.id}`}
    >
      <div className="flex items-center gap-3">
        <div className={`hidden sm:block w-1 self-stretch rounded-full shrink-0 ${colors.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900" data-testid="lesson-list-title">
              {lesson.title}
            </h3>
            {!isOwned && (
              <span className="shrink-0 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium border border-amber-200" data-testid="lesson-list-shared-by">
                Shared{lesson.shared_by ? ` · ${lesson.shared_by}` : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 line-clamp-1 mb-2" data-testid="lesson-list-description">
            {lesson.description}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {lesson.genre && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${colors.badge}`} data-testid="lesson-list-genre">
                {lesson.genre.name}
              </span>
            )}
            {lesson.tags?.map(tag => (
              <span key={tag} className="px-2 py-0.5 border border-slate-200 text-slate-500 text-xs rounded-full" data-testid="lesson-list-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-slate-400 whitespace-nowrap shrink-0">
          <span data-testid="lesson-list-date">{formatDate(lesson.created_at)}</span>
          {lesson.files && lesson.files.length > 0 && (
            <span data-testid="lesson-list-file-count">{lesson.files.length} file{lesson.files.length !== 1 ? 's' : ''}</span>
          )}
          {lesson.total_file_size !== undefined && lesson.total_file_size > 0 && (
            <span data-testid="lesson-list-file-size">{lesson.total_file_size.toFixed(1)} MB</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonCard({ lesson, isOwned }: { lesson: Lesson; isOwned: boolean }) {
  const navigate = useNavigate();
  const colors = GENRE_COLORS[lesson.genre?.name ?? ''] ?? DEFAULT_GENRE_COLORS;

  return (
    <div
      onClick={() => navigate(`/lessons/${lesson.id}`)}
      className={`bg-white rounded-lg border border-slate-200 border-t-4 ${colors.border} p-5 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col`}
      data-testid={`library-lesson-card-${lesson.id}`}
    >
      <div className="flex-1 mb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-base font-semibold text-slate-900 leading-snug" data-testid="lesson-card-title">
            {lesson.title}
          </h3>
          {!isOwned && (
            <span className="shrink-0 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium border border-amber-200" data-testid="lesson-card-shared-by">
              Shared
            </span>
          )}
        </div>
        {!isOwned && lesson.shared_by && (
          <p className="text-xs text-slate-400 mb-1">by {lesson.shared_by}</p>
        )}
        <p className="text-sm text-slate-500 line-clamp-2" data-testid="lesson-card-description">
          {lesson.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {lesson.genre && (
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${colors.badge}`} data-testid="lesson-card-genre">
            {lesson.genre.name}
          </span>
        )}
        {lesson.tags?.slice(0, 2).map(tag => (
          <span key={tag} className="px-2 py-0.5 border border-slate-200 text-slate-500 text-xs rounded-full" data-testid="lesson-card-tag">
            {tag}
          </span>
        ))}
        {(lesson.tags?.length ?? 0) > 2 && (
          <span className="px-2 py-0.5 border border-slate-200 text-slate-400 text-xs rounded-full">
            +{lesson.tags!.length - 2}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
        <span data-testid="lesson-card-date">{formatDate(lesson.created_at)}</span>
        {lesson.files && lesson.files.length > 0 && (
          <span data-testid="lesson-card-file-count">{lesson.files.length} file{lesson.files.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}
