import { Routes, Route, Navigate } from 'react-router-dom'
import ProductDashboard from './pages/admin/ProductDashboard'
import CategoryList from './components/admin/CategoryList'
import ProductList from './components/admin/ProductList'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/products" replace />} />
      <Route path="/admin" element={<ProductDashboard />}>
        <Route path="products" element={<ProductList />} />
        <Route path="categories" element={<CategoryList />} />
      </Route>
    </Routes>
  )
}

export default App
