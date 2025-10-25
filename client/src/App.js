import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminViolations from './pages/admin/Violations';
import AdminEnforcers from './pages/admin/Enforcers';
import AdminReports from './pages/admin/Reports';
import AdminSettings from './pages/admin/Settings';
import RepeatOffenders from './pages/admin/RepeatOffenders';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import PageTransition from './components/PageTransition';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <PageTransition>
        <Routes>
          {user.role === 'admin' ? (
            <>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<AdminDashboard />} />
              <Route path="/violations" element={<AdminViolations />} />
              <Route path="/enforcers" element={<AdminEnforcers />} />
              <Route path="/reports" element={<AdminReports />} />
              <Route path="/repeat-offenders" element={<RepeatOffenders />} />
              <Route path="/settings" element={<AdminSettings />} />
            </>
          ) : (
            // Enforcers should not access the web interface
            // They will use IoT handheld devices instead
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="max-w-md w-full space-y-8 p-8">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      Access Restricted
                    </h2>
                    <p className="text-gray-600 mb-6">
                      Traffic enforcers should use the IoT handheld device for system access. This web interface is for administrators only.
                    </p>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('token');
                        window.location.reload();
                      }}
                      className="btn-primary"
                    >
                      Return to Login
                    </button>
                  </div>
                </div>
              </div>
            } />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PageTransition>
    </Layout>
  );
}

export default App;
