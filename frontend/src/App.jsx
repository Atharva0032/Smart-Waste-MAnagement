import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Loader from './components/Loader';
import { useAuth } from './context/AuthContext';

// Public pages.
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import TrackComplaint from './pages/TrackComplaint';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';

// Authenticated pages grouped by role.
import UserDashboard from './pages/user/UserDashboard';
import SubmitComplaint from './pages/user/SubmitComplaint';
import MyComplaints from './pages/user/MyComplaints';
import ComplaintDetail from './pages/user/ComplaintDetail';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminWorkers from './pages/admin/AdminWorkers';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerComplaints from './pages/worker/WorkerComplaints';

// Scroll to the top whenever the route changes.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

// Sends an authenticated visitor to the home that matches their role.
function RoleRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <Loader fullScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'worker') return <Navigate to="/worker" replace />;
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Loader fullScreen />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/track" element={<TrackComplaint />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Role-aware entry point */}
          <Route path="/app" element={<RoleRedirect />} />

          {/* Citizen routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={['user']}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints/new"
            element={
              <ProtectedRoute roles={['user']}>
                <SubmitComplaint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints"
            element={
              <ProtectedRoute roles={['user']}>
                <MyComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints/:id"
            element={
              <ProtectedRoute roles={['user', 'admin', 'worker']}>
                <ComplaintDetail />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/complaints"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/workers"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminWorkers />
              </ProtectedRoute>
            }
          />

          {/* Municipal worker routes */}
          <Route
            path="/worker"
            element={
              <ProtectedRoute roles={['worker']}>
                <WorkerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/worker/complaints"
            element={
              <ProtectedRoute roles={['worker']}>
                <WorkerComplaints />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
