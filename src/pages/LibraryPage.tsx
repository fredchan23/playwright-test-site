import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, FileText, X, SlidersHorizontal, LayoutGrid, List, Share2, File } from 'lucide-react';
import RangeSlider from '../components/RangeSlider';
import useIsMobile from '../hooks/useIsMobile';

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
  const { user } = useAuth();
  const isMobile = useIsMobile();
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
    return saved === 'list' || saved === 'card' ? saved : 'card';
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

      if (genresResult.data) setGenres(genresResult.data);

      const lessonFilesMap = new Map<string, LessonFile[]>();
      let maxSize = 10;

      if (filesResult.data) {
        filesResult.data.forEach((file: LessonFile) => {
          if (!lessonFilesMap.has(file.lesson_id)) {
            lessonFilesMap.set(file.lesson_id, []);
          }
          lessonFilesMap.get(file.lesson_id)!.push(file);
          const fileSizeMB = file.file_size / (1024 * 1024);
          if (fileSizeMB > maxSize) maxSize = Math.ceil(fileSizeMB);
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
            const total_file_size =
              files.reduce((sum, file) => sum + file.file_size, 0) / (1024 * 1024);
            return {
              ...share.lesson,
              shared_by: share.lesson.owner?.username,
              files,
              total_file_size,
            };
          })
          .filter((l): l is NonNullable<typeof l> => l !== null);
        setSharedLessons(shared as Lesson[]);
        extractTags([...(ownLessonsResult.data || []), ...shared]);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const extractTags = (lessons: Lesson[]) => {
    const tagSet = new Set<string>();
    lessons.forEach((lesson) => lesson.tags?.forEach((tag) => tagSet.add(tag)));
    setAvailableTags(Array.from(tagSet).sort());
  };

  const filterLessons = (lessons: Lesson[]) => {
    let filtered = [...lessons];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lesson) =>
          lesson.title.toLowerCase().includes(query) ||
          lesson.description.toLowerCase().includes(query) ||
          lesson.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedGenres.length > 0) {
      filtered = filtered.filter(
        (lesson) => lesson.genre_id && selectedGenres.includes(lesson.genre_id)
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((lesson) =>
        selectedTags.every((tag) => lesson.tags?.includes(tag))
      );
    }

    if (fileSizeRange[0] > 0 || fileSizeRange[1] < maxFileSize) {
      filtered = filtered.filter((lesson) => {
        const totalSize = lesson.total_file_size || 0;
        return totalSize >= fileSizeRange[0] && totalSize <= fileSizeRange[1];
      });
    }

    return filtered;
  };

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
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
  const hasActiveFilters =
    searchQuery || selectedGenres.length > 0 || selectedTags.length > 0 || hasFileSizeFilter;
  const activeFilterCount = selectedGenres.length + selectedTags.length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-2 border-transparent animate-spin mx-auto mb-4"
            style={{ borderTopColor: 'var(--accent)', borderRightColor: 'var(--accent)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading library…
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
        data-testid="library-error"
      >
        <div className="text-center">
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Failed to load your library.
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Check your connection and try again.
          </p>
          <button
            onClick={loadData}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white"
            style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer' }}
            data-testid="library-error-retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex flex-col gap-2"
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border-light)',
          padding: isMobile ? '10px 14px' : '20px 28px 16px',
        }}
      >
        {/* Row 1: search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search lessons…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: 38,
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0 36px 0 34px',
              fontSize: 14,
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            data-testid="library-search-input"
            aria-label="Search lessons"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              data-testid="library-search-clear-button"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Filters + New Lesson */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg text-sm font-medium"
            style={{
              padding: isMobile ? '7px 10px' : '7px 14px',
              background: showFilters ? 'var(--accent-light)' : 'var(--surface)',
              color: showFilters ? 'var(--accent)' : 'var(--text-primary)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            data-testid="library-filters-toggle-button"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {!isMobile && 'Filters'}
            {activeFilterCount > 0 && (
              <span
                className="text-[11px] px-1.5 py-0.5 rounded-full text-white"
                style={{ background: 'var(--accent)' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex-1" />

          <button
            onClick={() => navigate('/lessons/create')}
            className="flex items-center gap-1.5 rounded-lg text-sm font-medium text-white"
            style={{
              padding: isMobile ? '7px 10px' : '7px 14px',
              background: 'var(--accent)',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            data-testid="library-create-lesson-button"
          >
            <Plus className="w-3.5 h-3.5" />
            {!isMobile && 'New Lesson'}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: isMobile ? '16px 16px' : '24px 28px' }}>
        {/* Filters panel */}
        {showFilters && (
          <div
            className="rounded-[var(--radius)] p-5 mb-5"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
            data-testid="library-filters-panel"
          >
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Filter by Genre
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-medium"
                  style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  data-testid="library-clear-filters-button"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {genres.map((genre) => {
                const active = selectedGenres.includes(genre.id);
                const colors = GENRE_COLORS[genre.name] ?? DEFAULT_GENRE_COLORS;
                return (
                  <button
                    key={genre.id}
                    onClick={() => toggleGenre(genre.id)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium"
                    style={{
                      background: active ? colors.bg : 'var(--surface2)',
                      color: active ? colors.text : 'var(--text-secondary)',
                      border: `1.5px solid ${active ? colors.text : 'transparent'}`,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                    data-testid={`library-filter-genre-${genre.name.toLowerCase()}`}
                  >
                    {genre.name}
                  </button>
                );
              })}
            </div>

            {availableTags.length > 0 && (
              <>
                <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Tags
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: selectedTags.includes(tag) ? 'var(--accent)' : 'var(--surface2)',
                        color: selectedTags.includes(tag) ? '#fff' : 'var(--text-secondary)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                      data-testid={`library-filter-tag-${tag.toLowerCase()}`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </>
            )}

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
        )}

        {hasActiveFilters && (
          <div className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }} data-testid="library-results-count">
            Showing {totalFiltered} of {totalLessons} lessons
          </div>
        )}

        {filteredOwnLessons.length === 0 && filteredSharedLessons.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--border)' }} />
            <h3
              className="text-base font-semibold mb-2"
              style={{ color: 'var(--text-primary)' }}
              data-testid="library-empty-message"
            >
              {hasActiveFilters
                ? 'No lessons found matching your search'
                : "You haven't created any lessons yet"}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              {hasActiveFilters
                ? 'Try adjusting your filters or search query'
                : 'Create your first lesson to get started'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={() => navigate('/lessons/create')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                data-testid="library-empty-create-button"
              >
                <Plus className="w-4 h-4" />
                Create Your First Lesson
              </button>
            )}
          </div>
        )}

        {filteredOwnLessons.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-baseline gap-2">
                <h2
                  className="text-[17px] font-bold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                  data-testid="library-my-lessons-heading"
                >
                  My Lessons
                </h2>
                <span className="text-[13px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {filteredOwnLessons.length}
                </span>
              </div>
              <div
                className="flex gap-1 p-0.5 rounded-lg"
                style={{ background: 'var(--surface2)' }}
                data-testid="library-view-toggle"
              >
                <button
                  onClick={() => handleViewModeChange('card')}
                  className="p-1.5 rounded-md"
                  style={{
                    background: viewMode === 'card' ? 'var(--surface)' : 'transparent',
                    color: viewMode === 'card' ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: viewMode === 'card' ? 'var(--shadow-sm)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="Card view"
                  aria-pressed={viewMode === 'card'}
                  data-testid="library-view-card-button"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleViewModeChange('list')}
                  className="p-1.5 rounded-md"
                  style={{
                    background: viewMode === 'list' ? 'var(--surface)' : 'transparent',
                    color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="List view"
                  aria-pressed={viewMode === 'list'}
                  data-testid="library-view-list-button"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredOwnLessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} isOwned={true} />
                ))}
              </div>
            ) : (
              <div
                className="rounded-[var(--radius)] overflow-hidden"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {filteredOwnLessons.map((lesson, i) => (
                  <div key={lesson.id}>
                    {i > 0 && (
                      <div style={{ height: 1, background: 'var(--border-light)', margin: '0 16px' }} />
                    )}
                    <LessonListItem lesson={lesson} isOwned={true} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {filteredSharedLessons.length > 0 && (
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex items-baseline gap-2">
                <h2
                  className="text-[17px] font-bold tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                  data-testid="library-shared-lessons-heading"
                >
                  Shared with Me
                </h2>
                <span className="text-[13px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {filteredSharedLessons.length}
                </span>
              </div>
              <div className="flex-1 h-px" style={{ background: 'var(--border-light)' }} />
              <div
                className="flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-[3px]"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                <Share2 className="w-[11px] h-[11px]" />
                From others
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredSharedLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} isOwned={false} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Color system ──────────────────────────────────────────────────────────────

export const GENRE_COLORS: Record<string, { bg: string; text: string }> = {
  Arts:        { bg: 'oklch(0.93 0.05 340)', text: 'oklch(0.45 0.15 340)' },
  Business:    { bg: 'oklch(0.94 0.05 80)',  text: 'oklch(0.45 0.14 80)'  },
  Design:      { bg: 'oklch(0.93 0.05 300)', text: 'oklch(0.45 0.16 300)' },
  Language:    { bg: 'oklch(0.93 0.05 200)', text: 'oklch(0.45 0.14 200)' },
  Mathematics: { bg: 'oklch(0.93 0.05 250)', text: 'oklch(0.45 0.16 250)' },
  Programming: { bg: 'oklch(0.93 0.05 178)', text: 'oklch(0.42 0.14 178)' },
  Science:     { bg: 'oklch(0.93 0.05 130)', text: 'oklch(0.42 0.14 130)' },
};
const DEFAULT_GENRE_COLORS = { bg: 'var(--surface2)', text: 'var(--text-secondary)' };

const BAR_COLORS: Record<string, string> = {
  Arts:        'oklch(0.62 0.19 340)',
  Business:    'oklch(0.68 0.17 55)',
  Design:      'oklch(0.60 0.20 300)',
  Language:    'oklch(0.60 0.16 200)',
  Mathematics: 'oklch(0.58 0.20 265)',
  Programming: 'oklch(0.56 0.16 178)',
  Science:     'oklch(0.58 0.18 145)',
};

const TINT_BG: Record<string, string> = {
  Arts:        'oklch(0.985 0.012 340)',
  Business:    'oklch(0.985 0.012 55)',
  Design:      'oklch(0.985 0.012 300)',
  Language:    'oklch(0.985 0.012 200)',
  Mathematics: 'oklch(0.985 0.012 265)',
  Programming: 'oklch(0.985 0.012 178)',
  Science:     'oklch(0.985 0.012 145)',
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── LessonListItem ─────────────────────────────────────────────────────────────

function LessonListItem({ lesson, isOwned }: { lesson: Lesson; isOwned: boolean }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(false);
  const genreName = lesson.genre?.name ?? '';
  const colors = GENRE_COLORS[genreName] ?? DEFAULT_GENRE_COLORS;
  const barColor = BAR_COLORS[genreName] ?? 'var(--border)';

  return (
    <div
      onClick={() => navigate(`/lessons/${lesson.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center cursor-pointer"
      style={{
        gap: isMobile ? 10 : 14,
        padding: isMobile ? '14px 14px' : '13px 18px',
        background: hovered ? 'var(--surface2)' : 'transparent',
        borderLeft: `3px solid ${hovered ? barColor : 'transparent'}`,
        transition: 'background 0.12s',
      }}
      data-testid={`library-lesson-list-${lesson.id}`}
    >
      {/* Genre dot */}
      <div
        className="shrink-0 rounded-full"
        style={{ width: 8, height: 8, background: barColor }}
      />

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span
            className="text-sm font-semibold tracking-tight truncate"
            style={{ color: 'var(--text-primary)', flex: 1, minWidth: 0 }}
            data-testid="lesson-list-title"
          >
            {lesson.title}
          </span>
          {!isOwned && (
            <span
              className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              data-testid="lesson-list-shared-by"
            >
              Shared{lesson.shared_by ? ` · ${lesson.shared_by}` : ''}
            </span>
          )}
          {isMobile && lesson.genre && (
            <span
              className="shrink-0 text-[11px] font-medium font-mono rounded-full"
              style={{ background: colors.bg, color: colors.text, padding: '3px 9px' }}
              data-testid="lesson-list-genre"
            >
              {lesson.genre.name}
            </span>
          )}
        </div>
        <p
          className="text-xs line-clamp-1"
          style={{ color: 'var(--text-secondary)' }}
          data-testid="lesson-list-description"
        >
          {lesson.description}
        </p>
        {isMobile && (
          <div className="flex items-center gap-2.5 mt-1">
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }} data-testid="lesson-list-date">
              {formatDate(lesson.created_at)}
            </span>
            <span className="flex items-center gap-[3px] text-[11px] font-mono" style={{ color: 'var(--text-muted)' }} data-testid="lesson-list-file-count">
              <File className="w-[11px] h-[11px]" />
              {lesson.files?.length ?? 0}
            </span>
          </div>
        )}
      </div>

      {/* Genre tag — desktop only */}
      {!isMobile && lesson.genre && (
        <span
          className="shrink-0 text-[11px] font-medium font-mono rounded-full"
          style={{ background: colors.bg, color: colors.text, padding: '3px 9px' }}
          data-testid="lesson-list-genre"
        >
          {lesson.genre.name}
        </span>
      )}

      {/* Date — desktop only */}
      {!isMobile && (
        <span
          className="shrink-0 text-[11px] font-mono text-right"
          style={{ color: 'var(--text-muted)', width: 80 }}
          data-testid="lesson-list-date"
        >
          {formatDate(lesson.created_at)}
        </span>
      )}

      {/* File count — desktop only */}
      {!isMobile && (
        <span
          className="shrink-0 flex items-center justify-end gap-[3px] text-[11px] font-mono"
          style={{ color: 'var(--text-muted)', width: 44 }}
          data-testid="lesson-list-file-count"
        >
          <File className="w-[11px] h-[11px]" />
          {lesson.files?.length ?? 0}
        </span>
      )}
    </div>
  );
}

// ── LessonCard ─────────────────────────────────────────────────────────────────

function LessonCard({ lesson, isOwned }: { lesson: Lesson; isOwned: boolean }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const genreName = lesson.genre?.name ?? '';
  const colors = GENRE_COLORS[genreName] ?? DEFAULT_GENRE_COLORS;
  const barColor = BAR_COLORS[genreName] ?? 'var(--border)';
  const tintBg = TINT_BG[genreName] ?? 'var(--surface)';

  return (
    <div
      onClick={() => navigate(`/lessons/${lesson.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer flex flex-col"
      style={{
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: `1px solid ${hovered ? barColor : 'var(--border-light)'}`,
        background: hovered ? 'var(--surface)' : tintBg,
        boxShadow: hovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.15s ease',
      }}
      data-testid={`library-lesson-card-${lesson.id}`}
    >
      {/* Genre color bar */}
      <div style={{ height: 4, background: barColor, flexShrink: 0 }} />

      <div className="flex flex-col flex-1 px-[18px] pt-4 pb-[14px]">
        {/* Genre tag + shared badge */}
        <div className="flex items-center justify-between mb-2.5">
          {lesson.genre && (
            <span
              className="text-[11px] font-medium font-mono rounded-full"
              style={{ background: colors.bg, color: colors.text, padding: '3px 9px' }}
              data-testid="lesson-card-genre"
            >
              {lesson.genre.name}
            </span>
          )}
          {!isOwned && (
            <span
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full font-semibold"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              data-testid="lesson-card-shared-by"
            >
              <Share2 className="w-2.5 h-2.5" />
              Shared{lesson.shared_by ? ` · ${lesson.shared_by}` : ''}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          className="text-[15px] font-bold leading-snug tracking-tight mb-[7px]"
          style={{ color: 'var(--text-primary)' }}
          data-testid="lesson-card-title"
        >
          {lesson.title}
        </h3>

        {/* Description */}
        <p
          className="text-[12.5px] line-clamp-2 flex-1 mb-3"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}
          data-testid="lesson-card-description"
        >
          {lesson.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-[5px] mb-3.5">
          {lesson.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium font-mono rounded-full"
              style={{
                background: 'var(--surface2)',
                color: 'var(--text-muted)',
                padding: '2px 7px',
              }}
              data-testid="lesson-card-tag"
            >
              {tag}
            </span>
          ))}
          {(lesson.tags?.length ?? 0) > 3 && (
            <span
              className="text-[10px] font-medium font-mono rounded-full"
              style={{ background: 'var(--surface2)', color: 'var(--text-muted)', padding: '2px 7px' }}
            >
              +{lesson.tags!.length - 3}
            </span>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-2.5 text-[11px] font-mono"
          style={{
            borderTop: `1px solid ${hovered ? 'var(--border)' : 'var(--border-light)'}`,
            color: 'var(--text-muted)',
          }}
        >
          <span data-testid="lesson-card-date">{formatDate(lesson.created_at)}</span>
          {lesson.files && lesson.files.length > 0 && (
            <span className="flex items-center gap-1" data-testid="lesson-card-file-count">
              <File className="w-[11px] h-[11px]" />
              {lesson.files.length} {lesson.files.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
