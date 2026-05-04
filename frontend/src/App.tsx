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
import TournamentRegistrationPublic from "./pages/TournamentRegistrationPublic";
import TournamentInProgressPublic from "./pages/TournamentInProgressPublic";
import RatingRules from "./pages/RatingRules";
import Licenses from "./pages/Licenses";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTournaments from "./pages/admin/AdminTournaments";
import AdminTournamentRegistration from "./pages/admin/AdminTournamentRegistration";
import AdminTournamentInProgress from "./pages/admin/AdminTournamentInProgress";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPlayers from "./pages/admin/AdminPlayers";
import AdminLicensedPlayers from "./pages/admin/AdminLicensedPlayers";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminHelpLayout from "./pages/admin/help/AdminHelpLayout";
import AdminHelpIndex from "./pages/admin/help/AdminHelpIndex";
import HelpTournamentResultsExcel from "./pages/admin/help/HelpTournamentResultsExcel";
import HelpUserRoles from "./pages/admin/help/HelpUserRoles";

// Components
import Layout from "./components/Layout";
import AdminLayout from "./components/admin/AdminLayout";
import AdminRoleRoute from "./components/admin/AdminRoleRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import { UserRole } from "./types";

const ROLES_ALL_STAFF = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.LICENSE_MANAGER,
];
const ROLES_LICENSE_SECTION = [UserRole.ADMIN, UserRole.LICENSE_MANAGER];
const ROLES_TOURNAMENT_STAFF = [UserRole.ADMIN, UserRole.MANAGER];

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
              path="/tournaments/:tournamentId/registration"
              element={
                <Layout>
                  <TournamentRegistrationPublic />
                </Layout>
              }
            />

            <Route
              path="/tournaments/:tournamentId/in-progress"
              element={
                <Layout>
                  <TournamentInProgressPublic />
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

            <Route
              path="/rating-rules"
              element={
                <Layout>
                  <RatingRules />
                </Layout>
              }
            />

            <Route
              path="/licenses"
              element={
                <Layout>
                  <Licenses />
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
                  <AdminRoleRoute allowedRoles={[UserRole.ADMIN]}>
                    <AdminLayout>
                      <AdminDashboard />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={[UserRole.ADMIN]}>
                    <AdminLayout>
                      <AdminDashboard />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/tournaments/:tournamentId/draft"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={ROLES_TOURNAMENT_STAFF}>
                    <AdminLayout>
                      <AdminTournamentRegistration />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/tournaments/:tournamentId/registration"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={ROLES_TOURNAMENT_STAFF}>
                    <AdminLayout>
                      <AdminTournamentRegistration />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/tournaments/:tournamentId/in-progress"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={ROLES_TOURNAMENT_STAFF}>
                    <AdminLayout>
                      <AdminTournamentInProgress />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/tournaments"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={ROLES_TOURNAMENT_STAFF}>
                    <AdminLayout>
                      <AdminTournaments />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/players"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={ROLES_ALL_STAFF}>
                    <AdminLayout>
                      <AdminPlayers />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={[UserRole.ADMIN]}>
                    <AdminLayout>
                      <AdminSettings />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/licensed-players"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={ROLES_LICENSE_SECTION}>
                    <AdminLayout>
                      <AdminLicensedPlayers />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={[UserRole.ADMIN]}>
                    <AdminLayout>
                      <AdminUsers />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={[UserRole.ADMIN]}>
                    <AdminLayout>
                      <AdminAuditLogs />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/help"
              element={
                <ProtectedRoute>
                  <AdminRoleRoute allowedRoles={ROLES_ALL_STAFF}>
                    <AdminLayout>
                      <AdminHelpLayout />
                    </AdminLayout>
                  </AdminRoleRoute>
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminHelpIndex />} />
              <Route
                path="tournament-results-excel"
                element={<HelpTournamentResultsExcel />}
              />
              <Route path="user-roles" element={<HelpUserRoles />} />
              <Route
                path="*"
                element={<Navigate to="/admin/help" replace />}
              />
            </Route>

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
