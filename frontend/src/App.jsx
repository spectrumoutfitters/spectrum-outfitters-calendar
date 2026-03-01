import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { BASE_PATH } from './utils/basePath';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import { OpenScanProvider } from './contexts/OpenScanContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TimeEntries from './pages/TimeEntries';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Schedule from './pages/Schedule';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import InventoryManagement from './components/Admin/InventoryManagement';
import MyWorkList from './pages/MyWorkList';
import CustomerStatus from './pages/CustomerStatus';
import DispatchBoard from './pages/DispatchBoard';
import Layout from './components/Layout/Layout';
import FloatingActions from './components/Layout/FloatingActions';
import Logo from './components/Logo';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <Logo size="lg" className="mb-4" showText={true} />
          <div className="text-lg text-gray-600 dark:text-neutral-400 mt-4">Loading...</div>
        </div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <Logo size="lg" className="mb-4" />
          <div className="text-lg text-gray-600 dark:text-neutral-400">Loading...</div>
        </div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  
  return children;
};

// At /inventory: admins see the full management view; others see the worker inventory page.
const InventoryPage = () => {
  const { isAdmin } = useAuth();
  return isAdmin ? <InventoryManagement /> : <Inventory />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <PrivateRoute>
            <Layout>
              <Tasks />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/time"
        element={
          <PrivateRoute>
            <Layout>
              <TimeEntries />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <PrivateRoute>
            <Layout>
              <Schedule />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Layout>
              <Admin />
            </Layout>
          </AdminRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Layout>
              <Profile />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/products"
        element={
          <PrivateRoute>
            <Layout>
              <Products />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <PrivateRoute>
            <Layout>
              <InventoryPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/my-list"
        element={
          <PrivateRoute>
            <Layout>
              <MyWorkList />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/dispatch"
        element={
          <AdminRoute>
            <Layout>
              <DispatchBoard />
            </Layout>
          </AdminRoute>
        }
      />
      <Route path="/status/:token" element={<CustomerStatus />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router
        basename={BASE_PATH}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthProvider>
          <SocketProvider>
            <OpenScanProvider>
              <AppRoutes />
              <FloatingActions />
            </OpenScanProvider>
          </SocketProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;

