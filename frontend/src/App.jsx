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
import CRM from './pages/CRM';
import CustomerDetail from './pages/CustomerDetail';
import VehicleDetail from './pages/VehicleDetail';
import InvoiceDetail from './pages/InvoiceDetail';
import NewInvoice from './pages/NewInvoice';
import PayInvoice from './pages/PayInvoice';
import QuickJobsAdmin from './pages/QuickJobsAdmin';
import CustomerStatus from './pages/CustomerStatus';
import DispatchBoard from './pages/DispatchBoard';
import Layout from './components/Layout/Layout';
import FloatingActions from './components/Layout/FloatingActions';
import Logo from './components/Logo';
// import AffiliatesAdmin from './pages/AffiliatesAdmin'; // DISABLED — not in active use
// import AffiliateQuote from './pages/AffiliateQuote'; // DISABLED — not in active use

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
      <Route path="/pay/:token" element={<PayInvoice />} />
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
          <PrivateRoute>
            <Layout>
              <Admin />
            </Layout>
          </PrivateRoute>
        }
      />
      {/* /admin/shop-financing disabled — redirect to admin */}
      <Route path="/admin/shop-financing" element={<Navigate to="/admin" />} />
      <Route
        path="/crm"
        element={
          <PrivateRoute>
            <Layout>
              <CRM />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/quick-jobs"
        element={
          <AdminRoute>
            <Layout>
              <QuickJobsAdmin />
            </Layout>
          </AdminRoute>
        }
      />
      <Route
        path="/crm/invoices/new"
        element={
          <PrivateRoute>
            <Layout>
              <NewInvoice />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/customers/:id"
        element={
          <PrivateRoute>
            <Layout>
              <CustomerDetail />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/vehicles/:id"
        element={
          <PrivateRoute>
            <Layout>
              <VehicleDetail />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/invoices/:id"
        element={
          <PrivateRoute>
            <Layout>
              <InvoiceDetail />
            </Layout>
          </PrivateRoute>
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
      {/* /my-list is now consolidated into /tasks — redirect for any old bookmarks */}
      <Route path="/my-list" element={<Navigate to="/tasks" />} />
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
      {/* /affiliates/:token disabled — affiliate feature not in active use */}
      {/* <Route path="/affiliates/:token" element={<AffiliateQuote />} /> */}
      {/* /admin/affiliates disabled — affiliate feature not in active use */}
      {/* <Route path="/admin/affiliates" element={<AdminRoute><Layout><AffiliatesAdmin /></Layout></AdminRoute>} /> */}
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

