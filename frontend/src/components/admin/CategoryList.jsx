/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { Modal, Form } from 'react-bootstrap';

const CategoryList = () => {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', sortOrder: 0 });

  const fetchCategories = async () => {
    try {
      const res = await fetch('http://localhost:8081/api/categories');
      const json = await res.json();
      if (json.code === 200) {
        setCategories(json.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleClose = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', sortOrder: 0 });
  };

  const handleShow = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, sortOrder: category.sortOrder });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingCategory 
      ? `http://localhost:8081/api/categories/${editingCategory.id}`
      : 'http://localhost:8081/api/categories';
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchCategories();
        handleClose();
      }
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除此分類嗎？')) return;
    try {
      const res = await fetch(`http://localhost:8081/api/categories/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCategories();
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  return (
    <div className="glass-panel">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="page-title mb-0">分類管理</h2>
        <button className="modern-btn" onClick={() => handleShow()}>
          <i className="bi bi-plus-lg"></i> 新增分類
        </button>
      </div>

      <table className="modern-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>分類名稱</th>
            <th>排序權重</th>
            <th className="text-end">操作</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(cat => (
            <tr key={cat.id}>
              <td>{cat.id}</td>
              <td className="fw-semibold">{cat.name}</td>
              <td>{cat.sortOrder}</td>
              <td className="text-end">
                <button className="modern-btn modern-btn-outline me-2 py-1 px-2" onClick={() => handleShow(cat)}>
                  <i className="bi bi-pencil"></i>
                </button>
                <button className="modern-btn modern-btn-danger py-1 px-2" onClick={() => handleDelete(cat.id)}>
                  <i className="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr>
              <td colSpan="4" className="text-center py-5 text-muted">目前沒有任何分類</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modal */}
      <Modal show={showModal} onHide={handleClose} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">{editingCategory ? '編輯分類' : '新增分類'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>分類名稱</Form.Label>
              <input 
                type="text" 
                className="modern-input" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>排序權重 (越小越前面)</Form.Label>
              <input 
                type="number" 
                className="modern-input" 
                value={formData.sortOrder}
                onChange={e => setFormData({...formData, sortOrder: parseInt(e.target.value) || 0})}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="border-0 pt-0">
            <button type="button" className="modern-btn modern-btn-outline" onClick={handleClose}>
              取消
            </button>
            <button type="submit" className="modern-btn">
              儲存
            </button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryList;
