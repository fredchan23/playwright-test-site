import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LibraryPage from './pages/LibraryPage';
import CreateLessonPage from './pages/CreateLessonPage';
import LessonDetailPage from './pages/LessonDetailPage';
import EditLessonPage from './pages/EditLessonPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lessons/create"
            element={
              <ProtectedRoute>
                <CreateLessonPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lessons/:id"
            element={
              <ProtectedRoute>
                <LessonDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lessons/:id/edit"
            element={
              <ProtectedRoute>
                <EditLessonPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/library" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
