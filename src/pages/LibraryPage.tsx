import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, LogOut, FileText, X, SlidersHorizontal } from 'lucide-react';

interface Genre {
  id: string;
  name: string;
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
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [ownLessons, setOwnLessons] = useState<Lesson[]>([]);
  const [sharedLessons, setSharedLessons] = useState<Lesson[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);

    const [genresResult, ownLessonsResult, sharedLessonsResult] = await Promise.all([
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
    ]);

    if (genresResult.data) {
      setGenres(genresResult.data);
    }

    if (ownLessonsResult.data) {
      setOwnLessons(ownLessonsResult.data);
      extractTags(ownLessonsResult.data);
    }

    if (sharedLessonsResult.data) {
      const shared = sharedLessonsResult.data
        .map((share: any) => ({
          ...share.lesson,
          shared_by: share.lesson.owner?.username,
        }))
        .filter(Boolean);
      setSharedLessons(shared);
      extractTags([...ownLessonsResult.data || [], ...shared]);
    }

    setLoading(false);
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
  };

  const filteredOwnLessons = filterLessons(ownLessons);
  const filteredSharedLessons = filterLessons(sharedLessons);
  const totalFiltered = filteredOwnLessons.length + filteredSharedLessons.length;
  const totalLessons = ownLessons.length + sharedLessons.length;
  const hasActiveFilters = searchQuery || selectedGenres.length > 0 || selectedTags.length > 0;

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8 text-slate-700" />
              <h1 className="text-xl font-bold text-slate-900">LMS - Playwright Training</h1>
            </div>
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
              <div>
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
            <h2 className="text-xl font-semibold text-slate-900 mb-4" data-testid="library-my-lessons-heading">
              My Lessons ({filteredOwnLessons.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOwnLessons.map(lesson => (
                <LessonCard key={lesson.id} lesson={lesson} isOwned={true} />
              ))}
            </div>
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

function LessonCard({ lesson, isOwned }: { lesson: Lesson; isOwned: boolean }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/lessons/${lesson.id}`)}
      className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
      data-testid={`library-lesson-card-${lesson.id}`}
    >
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-slate-900 mb-1" data-testid="lesson-card-title">
          {lesson.title}
        </h3>
        {!isOwned && lesson.shared_by && (
          <p className="text-xs text-slate-500" data-testid="lesson-card-shared-by">
            Shared by {lesson.shared_by}
          </p>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-4 line-clamp-2" data-testid="lesson-card-description">
        {lesson.description}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {lesson.genre && (
          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded" data-testid="lesson-card-genre">
            {lesson.genre.name}
          </span>
        )}
      </div>
      {lesson.tags && lesson.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lesson.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded" data-testid="lesson-card-tag">
              {tag}
            </span>
          ))}
          {lesson.tags.length > 3 && (
            <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-xs rounded">
              +{lesson.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
