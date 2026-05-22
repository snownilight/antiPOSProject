import { Routes, Route, Navigate } from 'react-router-dom'
import ProductDashboard from './pages/admin/ProductDashboard'
import CategoryList from './components/admin/CategoryList'
import ProductList from './components/admin/ProductList'
import TableList from './components/admin/TableList'
import OrderInterface from './components/admin/OrderInterface'
import KitchenDisplay from './components/admin/KitchenDisplay'
import OrderList from './components/admin/OrderList'
import CustomerOrder from './pages/CustomerOrder'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Forbidden from './pages/Forbidden'
import AdminDashboard from './components/admin/AdminDashboard'

const HomeRedirect = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'KITCHEN') {
    return <Navigate to="/admin/kitchen" replace />;
  }
  if (user.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/admin/tables" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/order" element={<CustomerOrder />} />
        
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'WAITER', 'KITCHEN']}>
              <ProductDashboard />
            </ProtectedRoute>
          }
        >
          <Route 
            path="dashboard" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="products" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ProductList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="categories" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <CategoryList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="tables" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'WAITER']}>
                <TableList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="order" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'WAITER']}>
                <OrderInterface />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="orders" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'WAITER']}>
                <OrderList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="kitchen" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'KITCHEN']}>
                <KitchenDisplay />
              </ProtectedRoute>
            } 
          />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
