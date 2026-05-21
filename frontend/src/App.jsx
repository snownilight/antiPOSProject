import { Routes, Route, Navigate } from 'react-router-dom'
import ProductDashboard from './pages/admin/ProductDashboard'
import CategoryList from './components/admin/CategoryList'
import ProductList from './components/admin/ProductList'
import TableList from './components/admin/TableList'
import OrderInterface from './components/admin/OrderInterface'
import KitchenDisplay from './components/admin/KitchenDisplay'
import OrderList from './components/admin/OrderList'
import CustomerOrder from './pages/CustomerOrder'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/tables" replace />} />
      <Route path="/order" element={<CustomerOrder />} />
      <Route path="/admin" element={<ProductDashboard />}>
        <Route path="products" element={<ProductList />} />
        <Route path="categories" element={<CategoryList />} />
        <Route path="tables" element={<TableList />} />
        <Route path="order" element={<OrderInterface />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="kitchen" element={<KitchenDisplay />} />
      </Route>
    </Routes>
  )
}

export default App
