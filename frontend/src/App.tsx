// import React from "react"; // React не используется напрямую в новых версиях
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "react-query";
import { Toaster } from "react-hot-toast";

// Pages
import RatingTable from "./pages/RatingTable";
import TournamentsList from "./pages/TournamentsList";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminLicensedPlayers from "./pages/admin/AdminLicensedPlayers";
import AdminUsers from "./pages/admin/AdminUsers";

// Components
import Layout from "./components/Layout";
import AdminLayout from "./components/admin/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 минут
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Публичные маршруты */}
            <Route
              path="/"
              element={
                <Layout>
                  <RatingTable />
                </Layout>
              }
            />

            <Route
              path="/tournaments"
              element={
                <Layout>
                  <TournamentsList />
                </Layout>
              }
            />

            {/* Редирект на главную страницу */}
            <Route path="/rating" element={<Navigate to="/" replace />} />

            {/* Админские маршруты */}
            <Route path="/admin/login" element={<AdminLogin />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/tournaments"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminTournaments />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/players"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminPlayers />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminSettings />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/licensed-players"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminLicensedPlayers />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <AdminUsers />
                  </AdminLayout>
                </ProtectedRoute>
              }
            />

            {/* 404 страница */}
            <Route
              path="*"
              element={
                <Layout>
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                      <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        404
                      </h1>
                      <p className="text-lg text-gray-600 mb-6">
                        Страница не найдена
                      </p>
                      <a href="/" className="btn-primary">
                        На главную
                      </a>
                    </div>
                  </div>
                </Layout>
              }
            />
          </Routes>
        </div>

        {/* Toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#363636",
              color: "#fff",
            },
            success: {
              style: {
                background: "#059669",
              },
            },
            error: {
              style: {
                background: "#DC2626",
              },
            },
          }}
        />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
