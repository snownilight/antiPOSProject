import { Routes, Route, Navigate } from 'react-router-dom'
import ProductDashboard from './pages/admin/ProductDashboard'
import CategoryList from './components/admin/CategoryList'
import ProductList from './components/admin/ProductList'
import TableList from './components/admin/TableList'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/products" replace />} />
      <Route path="/admin" element={<ProductDashboard />}>
        <Route path="products" element={<ProductList />} />
        <Route path="categories" element={<CategoryList />} />
        <Route path="tables" element={<TableList />} />
      </Route>
    </Routes>
  )
}

export default App
