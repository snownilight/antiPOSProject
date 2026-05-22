/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import API_BASE_URL from '../../utils/api';
import useWebSocket from '../../hooks/useWebSocket';
import './OrderInterface.css';

const OrderInterface = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tableIdFromQuery = searchParams.get('tableId');
  const prevTableIdRef = useRef(tableIdFromQuery);

  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [cart, setCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState({ tableName: '', orderNo: '' });

  // Customization State (POS-48)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({}); // groupId -> array of optionIds
  const [selectedBundleProducts, setSelectedBundleProducts] = useState({}); // bundleItemId -> selectedProductId
  const [showCustomModal, setShowCustomModal] = useState(false);



  const fetchTables = async () => {
    try {
      const resTables = await fetch(`${API_BASE_URL}/tables`);
      const jsonTables = await resTables.json();
      if (jsonTables.code === 200) {
        setTables(jsonTables.data);
      } else {
        setErrorMsg(jsonTables.message || '載入桌台資料失敗');
      }
    } catch (e) {
      console.error('Error loading tables:', e);
    }
  };

  // 1. 取得桌台、分類與商品資訊
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 桌台
        await fetchTables();

        // 分類
        const resCategories = await fetch(`${API_BASE_URL}/categories`);
        const jsonCategories = await resCategories.json();
        if (jsonCategories.code === 200) {
          setCategories(jsonCategories.data);
        } else {
          setErrorMsg(jsonCategories.message || '載入分類資料失敗');
        }

        // 商品
        const resProducts = await fetch(`${API_BASE_URL}/products`);
        const jsonProducts = await resProducts.json();
        if (jsonProducts.code === 200) {
          // 只保留 AVAILABLE 的商品
          const availableProducts = jsonProducts.data.filter(p => p.status === 'AVAILABLE');
          setProducts(availableProducts);
        } else {
          setErrorMsg(jsonProducts.message || '載入商品資料失敗');
        }
      } catch (e) {
        console.error('Error loading data:', e);
        setErrorMsg('載入資料失敗，請確認後端服務是否正常。');
      }
    };

    fetchData();
  }, []);

  // WebSocket 即時更新：收到訂單事件時自動刷新桌台狀態 (POS-33)
  useWebSocket('/topic/orders', useCallback((event) => {
    console.log('[OrderInterface] 收到 WebSocket 事件:', event);
    fetchTables();
  }, []));

  // 自動清理任何可能殘留的 Modal Backdrop，保障 SPA 路由切換事件穿透安全
  useEffect(() => {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    const hasBackdrop = backdrops.length > 0;
    const isBodyModalOpen = document.body.classList.contains('modal-open');

    if (hasBackdrop || isBodyModalOpen) {
      backdrops.forEach(el => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }, []);

  // 2. 當 URL 中的 tableId 參數變更時，同步更新 selectedTableId 狀態 (防意外覆蓋防護)
  useEffect(() => {
    if (tableIdFromQuery) {
      setSelectedTableId(tableIdFromQuery);
    } else if (prevTableIdRef.current && !tableIdFromQuery) {
      // 只有當 tableId 從有變為無時，才重設為空，避免手動切換下拉選單時被無條件蓋回空字串
      setSelectedTableId('');
    }
    prevTableIdRef.current = tableIdFromQuery;
  }, [tableIdFromQuery]);

  // 取得目前選定的桌台名稱
  const getSelectedTableName = () => {
    const t = tables.find(x => String(x.id) === String(selectedTableId));
    return t ? t.name : '';
  };

  // 購物車操作 (POS-48)
  const findOptionInProduct = (product, optionId) => {
    if (!product || !product.modifierGroups) return null;
    
    const searchGroups = (groups) => {
      for (const group of groups) {
        if (!group.options) continue;
        for (const opt of group.options) {
          if (opt.id === optionId) {
            return opt;
          }
          if (opt.modifierGroups) {
            const found = searchGroups(opt.modifierGroups);
            if (found) return found;
          }
        }
      }
      return null;
    };
    
    return searchGroups(product.modifierGroups);
  };

  const getActiveModifierGroups = (product, selectedOptionsMap) => {
    const activeGroups = [];
    if (!product || !product.modifierGroups) return activeGroups;
    
    const collectActive = (groups) => {
      groups.forEach(group => {
        activeGroups.push(group);
        const selectedIds = selectedOptionsMap[group.id] || [];
        selectedIds.forEach(optId => {
          const opt = group.options?.find(o => o.id === optId);
          if (opt) {
            if (opt.bundleItems) {
              opt.bundleItems.forEach(bi => {
                if (bi.modifierGroups) {
                  collectActive(bi.modifierGroups);
                }
              });
            }
            if (opt.modifierGroups) {
              collectActive(opt.modifierGroups);
            }
          }
        });
      });
    };
    
    collectActive(product.modifierGroups);
    return activeGroups;
  };

  const calculateOptionsPriceSum = (product, optionIds, bundleProds = selectedBundleProducts) => {
    if (!product.modifierGroups || !optionIds || optionIds.length === 0) return 0;
    let sum = 0;
    
    const scanGroups = (groups) => {
      groups.forEach(group => {
        if (group.options) {
          group.options.forEach(opt => {
            if (optionIds.includes(opt.id)) {
              sum += opt.priceModifier;
              if (opt.bundleItems) {
                opt.bundleItems.forEach(bi => {
                  if (bi.targetCategoryId) {
                    const selProdId = bundleProds?.[bi.id];
                    if (selProdId) {
                      const selProd = products.find(p => p.id === selProdId);
                      if (selProd) {
                        const diff = selProd.price - (bi.baseAllowance || 0);
                        if (diff > 0) {
                          sum += diff;
                        }
                      }
                    }
                  }
                  if (bi.modifierGroups) {
                    scanGroups(bi.modifierGroups);
                  }
                });
              }
            }
            if (opt.modifierGroups) {
              scanGroups(opt.modifierGroups);
            }
          });
        }
      });
    };
    
    scanGroups(product.modifierGroups);
    return sum;
  };

  const getOptionNamesText = (product, optionIds, bundleProds) => {
    if (!product.modifierGroups || !optionIds || optionIds.length === 0) return '';
    
    const formatOption = (opt) => {
      let optText = opt.name;
      if (opt.priceModifier > 0) {
        optText += `(+$${opt.priceModifier})`;
      }
      
      // If bundleItems exist, format them dynamically (POS-48)
      if (opt.bundleItems && opt.bundleItems.length > 0) {
        const cleanedName = opt.name.replace(/\s*\([^)]*\)/g, '').trim();
        let formattedName = cleanedName;
        if (opt.priceModifier > 0) {
          formattedName += `(+$${opt.priceModifier})`;
        }
        
        const biTexts = [];
        opt.bundleItems.forEach(bi => {
          let displayName = bi.name;
          let diffPriceText = '';
          
          if (bi.targetCategoryId && bundleProds) {
            const selProdId = bundleProds[bi.id];
            const selProd = products.find(p => p.id === selProdId);
            if (selProd) {
              displayName = selProd.name;
              const diff = selProd.price - (bi.baseAllowance || 0);
              if (diff > 0) {
                diffPriceText = `(+$${diff})`;
              }
            }
          }
          
          const selectedSubOpts = [];
          if (bi.modifierGroups) {
            bi.modifierGroups.forEach(subGroup => {
              if (subGroup.options) {
                subGroup.options.forEach(subOpt => {
                  if (optionIds.includes(subOpt.id)) {
                    let subOptName = subOpt.name;
                    if (subOpt.priceModifier > 0) {
                      subOptName += `(+$${subOpt.priceModifier})`;
                    }
                    selectedSubOpts.push(subOptName);
                  }
                });
              }
            });
          }
          if (selectedSubOpts.length > 0) {
            biTexts.push(`${displayName}${diffPriceText}（${selectedSubOpts.join('、')}）`);
          } else {
            biTexts.push(`${displayName}${diffPriceText}`);
          }
        });
        
        return `${formattedName}：${biTexts.join(' / ')}`;
      }
      
      if (opt.modifierGroups && opt.modifierGroups.length > 0) {
        const subNames = [];
        opt.modifierGroups.forEach(subGroup => {
          if (subGroup.options) {
            subGroup.options.forEach(subOpt => {
              if (optionIds.includes(subOpt.id)) {
                subNames.push(formatOption(subOpt));
              }
            });
          }
        });
        if (subNames.length > 0) {
          optText += ` (${subNames.join(' / ')})`;
        }
      }
      return optText;
    };

    const names = [];
    product.modifierGroups.forEach(group => {
      if (group.options) {
        group.options.forEach(opt => {
          if (optionIds.includes(opt.id)) {
            names.push(formatOption(opt));
          }
        });
      }
    });
    
    return names.join(' / ');
  };

  const handleProductClick = (product) => {
    if (product.modifierGroups && product.modifierGroups.length > 0) {
      setSelectedProduct(product);
      const initial = {};
      const initialBundleProducts = {};
      
      const initGroup = (group) => {
        const defaultOptions = [];
        if (group.minSelection === 1 && group.maxSelection === 1 && group.options && group.options.length > 0) {
          const defaultOpt = group.options[0];
          defaultOptions.push(defaultOpt.id);
          
          if (defaultOpt.bundleItems) {
            defaultOpt.bundleItems.forEach(bi => {
              if (bi.targetCategoryId) {
                const available = products.filter(p => p.categoryId === bi.targetCategoryId && p.status === 'AVAILABLE' && !p.isDeleted);
                if (available.length > 0) {
                  initialBundleProducts[bi.id] = available[0].id;
                }
              }
              if (bi.modifierGroups) {
                bi.modifierGroups.forEach(initGroup);
              }
            });
          }
          
          if (defaultOpt.modifierGroups) {
            defaultOpt.modifierGroups.forEach(initGroup);
          }
        }
        initial[group.id] = defaultOptions;
      };
      
      product.modifierGroups.forEach(initGroup);
      setSelectedOptions(initial);
      setSelectedBundleProducts(initialBundleProducts);
      setShowCustomModal(true);
    } else {
      addCustomizedToCart(product, [], '', {});
    }
  };

  const addCustomizedToCart = (product, optionIds, note = '', bundleProds = selectedBundleProducts) => {
    const sortedOptionIds = [...optionIds].sort((a, b) => a - b);
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => 
        item.product.id === product.id && 
        JSON.stringify(item.optionIds) === JSON.stringify(sortedOptionIds) &&
        JSON.stringify(item.bundleSelectedProducts) === JSON.stringify(bundleProds) &&
        item.note === note
      );
      if (existingIdx > -1) {
        const newCart = [...prevCart];
        newCart[existingIdx].quantity += 1;
        return newCart;
      }
      const optionsPriceSum = calculateOptionsPriceSum(product, sortedOptionIds, bundleProds);
      const unitPrice = product.price + optionsPriceSum;
      return [...prevCart, { product, quantity: 1, optionIds: sortedOptionIds, note, unitPrice, bundleSelectedProducts: bundleProds }];
    });
  };

  const updateQuantity = (index, delta) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      const nextQty = newCart[index].quantity + delta;
      newCart[index].quantity = nextQty < 1 ? 1 : nextQty;
      return newCart;
    });
  };

  const updateNote = (index, note) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      newCart[index].note = note;
      return newCart;
    });
  };

  const removeFromCart = (index) => {
    setCart(prevCart => prevCart.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  // 計算購物車總金額
  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  };

  const buildStructuredSelectedOptions = (product, optionIds, bundleProds = selectedBundleProducts) => {
    if (!product || !product.modifierGroups || !optionIds || optionIds.length === 0) {
      return null;
    }
    
    const selectedOptionsPayload = [];
    
    product.modifierGroups.forEach(group => {
      if (group.options) {
        group.options.forEach(opt => {
          if (optionIds.includes(opt.id)) {
            const selOptPayload = {
              optionId: opt.id,
              bundleItems: []
            };
            
            if (opt.bundleItems && opt.bundleItems.length > 0) {
              opt.bundleItems.forEach(bi => {
                const childOptionIds = [];
                if (bi.modifierGroups) {
                  bi.modifierGroups.forEach(subG => {
                    if (subG.options) {
                      subG.options.forEach(subOpt => {
                        if (optionIds.includes(subOpt.id)) {
                          childOptionIds.push(subOpt.id);
                        }
                      });
                    }
                  });
                }
                
                const biSelection = {
                  bundleItemId: bi.id,
                  optionIds: childOptionIds
                };
                
                if (bi.targetCategoryId && bundleProds?.[bi.id]) {
                  biSelection.selectedProductId = bundleProds[bi.id];
                }
                
                selOptPayload.bundleItems.push(biSelection);
              });
            }
            
            selectedOptionsPayload.push(selOptPayload);
          }
        });
      }
    });
    
    return selectedOptionsPayload;
  };

  // 送出訂單
  const handleSubmitOrder = async () => {
    if (!selectedTableId) {
      setErrorMsg('請先選擇點餐桌台！');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('購物車為空，請先加入商品！');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = {
      tableId: parseInt(selectedTableId),
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        note: item.note || null,
        optionIds: item.optionIds || [],
        selectedOptions: buildStructuredSelectedOptions(item.product, item.optionIds, item.bundleSelectedProducts)
      }))
    };

    try {
      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.code === 200) {
        setSuccessInfo({
          tableName: getSelectedTableName(),
          orderNo: json.data.orderNo
        });
        setShowSuccessModal(true);
      } else {
        setErrorMsg(json.message || '送出訂單失敗。');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('系統錯誤，無法與後端伺服器連線。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessModalConfirm = () => {
    setShowSuccessModal(false);
    navigate('/admin/tables');
  };

  // 篩選商品
  const filteredProducts = selectedCategoryId === 'ALL'
    ? products
    : products.filter(p => String(p.categoryId) === String(selectedCategoryId));

  return (
    <div className="container-fluid p-0 animate-fade-in">


      {/* Main Layout */}
      <div className="order-layout">
        {/* Left Side: Product Menu */}
        <div className="menu-section">
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h2 className="page-title mb-0">外場點餐服務</h2>
            <button className="modern-btn modern-btn-outline py-2" onClick={() => navigate('/admin/tables')}>
              <i className="bi bi-arrow-left"></i> 返回桌台
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="alert alert-danger py-2 px-3 mb-3 d-flex justify-content-between align-items-center" style={{borderRadius: '10px'}}>
              <span style={{fontSize: '14px'}}><i className="bi bi-exclamation-triangle-fill me-2"></i>{errorMsg}</span>
              <button className="btn-close" onClick={() => setErrorMsg('')} style={{fontSize: '11px'}}></button>
            </div>
          )}

          {/* Categories Tab Bar */}
          <div className="category-scroll">
            <div 
              className={`category-tab ${selectedCategoryId === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCategoryId('ALL')}
            >
              全部商品
            </div>
            {categories.map(c => (
              <div 
                key={c.id} 
                className={`category-tab ${String(selectedCategoryId) === String(c.id) ? 'active' : ''}`}
                onClick={() => setSelectedCategoryId(c.id)}
              >
                {c.name}
              </div>
            ))}
          </div>

          {/* Products Grid */}
          <div className="product-grid-container">
            <div className="product-grid">
              {filteredProducts.map(p => (
                <div key={p.id} className="product-card">
                  <div className="product-img-wrapper">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="product-img" />
                    ) : (
                      <i className="bi bi-cup-hot product-placeholder-icon"></i>
                    )}
                  </div>
                  <div className="product-info">
                    <div>
                      <div className="product-title">{p.name}</div>
                      <div className="product-desc" title={p.description}>{p.description || '無商品描述'}</div>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <span className="product-price">${p.price}</span>
                      <button className="modern-btn py-1 px-3" style={{fontSize: '13px'}} onClick={() => handleProductClick(p)}>
                        <i className="bi bi-plus-lg"></i> 加入
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-center py-5 text-muted w-100" style={{ gridColumn: '1 / -1' }}>
                  此分類目前沒有販售中的商品
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Cart Panel */}
        <div className="cart-section">
          <div className="cart-container">
            {/* Cart Header: Table Selector */}
            <div className="cart-header">
              <h5 className="fw-bold text-dark mb-3"><i className="bi bi-receipt-cutoff me-2"></i>點餐清單</h5>
              
              {tableIdFromQuery && (
                <div className="locked-table-badge w-100 justify-content-center mb-2">
                  <i className="bi bi-lock-fill"></i> 桌台: {getSelectedTableName()}
                </div>
              )}
              
              <div style={{ display: tableIdFromQuery ? 'none' : 'block' }}>
                <label className="form-label text-muted mb-1" style={{fontSize: '12px'}}>選擇桌台</label>
                <select 
                  className="modern-input" 
                  value={selectedTableId}
                  onChange={e => setSelectedTableId(e.target.value)}
                >
                  <option value="">
                    {tables.length === 0 ? '資料載入中...' : '-- 請選擇桌台 --'}
                  </option>
                  {tables.map(t => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name} ({t.seats}人桌 - {t.status === 'EMPTY' ? '空閒' : t.status === 'OCCUPIED' ? '用餐中' : '清潔中'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="cart-list">
              {cart.map((item, idx) => (
                <div key={idx} className="cart-item">
                  <div className="cart-item-header">
                    <span className="cart-item-title">{item.product.name}</span>
                    <span className="cart-item-price">${item.unitPrice * item.quantity}</span>
                  </div>
                  {item.optionIds && item.optionIds.length > 0 && (
                    <div className="text-muted mb-1" style={{ fontSize: '12px', paddingLeft: '8px' }}>
                      {getOptionNamesText(item.product, item.optionIds, item.bundleSelectedProducts)}
                    </div>
                  )}
                  <div className="cart-item-controls">
                    {/* Quantity Selector */}
                    <div className="d-flex align-items-center gap-2">
                      <button className="qty-btn" onClick={() => updateQuantity(idx, -1)}>-</button>
                      <span className="fw-bold" style={{fontSize: '14px', minWidth: '20px', textAlign: 'center'}}>{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQuantity(idx, 1)}>+</button>
                    </div>

                    {/* Note Input */}
                    <input 
                      type="text" 
                      className="cart-item-note" 
                      placeholder="備註 (如: 少冰)"
                      value={item.note}
                      onChange={e => updateNote(idx, e.target.value)}
                    />

                    {/* Remove Button */}
                    <button className="btn btn-link text-danger p-0" title="移除" onClick={() => removeFromCart(idx)}>
                      <i className="bi bi-trash-fill" style={{fontSize: '16px'}}></i>
                    </button>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted gap-2 py-5">
                  <i className="bi bi-cart3" style={{fontSize: '48px', opacity: 0.3}}></i>
                  <span>購物車是空的</span>
                  <small style={{fontSize: '12px'}}>點選左側商品加入</small>
                </div>
              )}
            </div>

            {/* Cart Summary & Order Submit */}
            <div className="cart-summary">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="text-secondary fw-semibold">總計金額</span>
                <span className="fs-3 fw-bold text-dark">${calculateTotal()}</span>
              </div>
              <div className="d-flex gap-2">
                <button 
                  className="modern-btn modern-btn-outline flex-grow-1" 
                  onClick={clearCart} 
                  disabled={cart.length === 0}
                >
                  清空
                </button>
                <button 
                  className="modern-btn flex-grow-1 py-2" 
                  onClick={handleSubmitOrder} 
                  disabled={isSubmitting || cart.length === 0 || !selectedTableId}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      <span>送單中...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill"></i> 送出訂單
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Customization Modal (POS-48) */}
      <Modal show={showCustomModal} onHide={() => setShowCustomModal(false)} centered className="custom-modal">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold text-dark" style={{ fontSize: '18px' }}>
            {selectedProduct?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {(() => {
            const renderModifierGroup = (group, depth = 0) => {
              const selected = selectedOptions[group.id] || [];
              const isInvalid = (group.minSelection && selected.length < group.minSelection) ||
                                (group.maxSelection && group.maxSelection > 0 && selected.length > group.maxSelection);
              
              return (
                <div 
                  key={group.id} 
                  className="modifier-group-section mb-3" 
                  style={{ paddingLeft: `${depth * 16}px`, borderLeft: depth > 0 ? '2px dashed #dee2e6' : 'none' }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold text-dark mb-0" style={{ fontSize: depth > 0 ? '13px' : '14px' }}>
                      {group.name}
                      <span className="text-muted ms-1" style={{ fontSize: '11px', fontWeight: 'normal' }}>
                        ({group.minSelection === 1 && group.maxSelection === 1 ? '必選 1' : 
                          `選擇 ${group.minSelection || 0}~${group.maxSelection || '無限制'}`})
                      </span>
                    </h6>
                    {isInvalid && (
                      <span className="text-danger" style={{ fontSize: '11px' }}>
                        請符合選擇限制
                      </span>
                    )}
                  </div>
                  <div className="modifier-options-grid">
                    {group.options?.map(opt => {
                      const isChecked = selected.includes(opt.id);
                      const handleSelect = () => {
                        setSelectedOptions(prev => {
                          const currentSelected = prev[group.id] || [];
                          let nextSelected;
                          let deselectedOptions = [];
                          
                          if (group.maxSelection === 1) {
                            deselectedOptions = currentSelected.filter(id => id !== opt.id);
                            nextSelected = [opt.id];
                          } else {
                            if (currentSelected.includes(opt.id)) {
                              deselectedOptions = [opt.id];
                              nextSelected = currentSelected.filter(id => id !== opt.id);
                            } else {
                              if (group.maxSelection && group.maxSelection > 0 && currentSelected.length >= group.maxSelection) {
                                return prev;
                              }
                              nextSelected = [...currentSelected, opt.id];
                            }
                          }
                          
                          const newSelectedOptions = {
                            ...prev,
                            [group.id]: nextSelected
                          };
                          
                          const clearSubSelections = (optId) => {
                            const optionObj = findOptionInProduct(selectedProduct, optId);
                            if (optionObj) {
                              if (optionObj.bundleItems) {
                                optionObj.bundleItems.forEach(bi => {
                                  if (bi.modifierGroups) {
                                    bi.modifierGroups.forEach(subG => {
                                      delete newSelectedOptions[subG.id];
                                      if (subG.options) {
                                        subG.options.forEach(subOpt => {
                                          clearSubSelections(subOpt.id);
                                        });
                                      }
                                    });
                                  }
                                });
                              }
                              if (optionObj.modifierGroups) {
                                optionObj.modifierGroups.forEach(subG => {
                                  delete newSelectedOptions[subG.id];
                                  if (subG.options) {
                                    subG.options.forEach(subOpt => {
                                      clearSubSelections(subOpt.id);
                                    });
                                  }
                                });
                              }
                            }
                          };
                          
                          deselectedOptions.forEach(clearSubSelections);
                          
                          const initSubSelections = (optId) => {
                            const optionObj = findOptionInProduct(selectedProduct, optId);
                            if (optionObj) {
                              if (optionObj.bundleItems) {
                                optionObj.bundleItems.forEach(bi => {
                                  if (bi.targetCategoryId) {
                                    const available = products.filter(p => p.categoryId === bi.targetCategoryId && p.status === 'AVAILABLE' && !p.isDeleted);
                                    if (available.length > 0) {
                                      setSelectedBundleProducts(prev => {
                                        if (!prev[bi.id]) {
                                          return { ...prev, [bi.id]: available[0].id };
                                        }
                                        return prev;
                                      });
                                    }
                                  }
                                  if (bi.modifierGroups) {
                                    bi.modifierGroups.forEach(subG => {
                                      const subDefaults = [];
                                      if (subG.minSelection === 1 && subG.maxSelection === 1 && subG.options && subG.options.length > 0) {
                                        subDefaults.push(subG.options[0].id);
                                      }
                                      newSelectedOptions[subG.id] = subDefaults;
                                      subDefaults.forEach(initSubSelections);
                                    });
                                  }
                                });
                              }
                              if (optionObj.modifierGroups) {
                                optionObj.modifierGroups.forEach(subG => {
                                  const subDefaults = [];
                                  if (subG.minSelection === 1 && subG.maxSelection === 1 && subG.options && subG.options.length > 0) {
                                    subDefaults.push(subG.options[0].id);
                                  }
                                  newSelectedOptions[subG.id] = subDefaults;
                                  subDefaults.forEach(initSubSelections);
                                });
                              }
                            }
                          };
                          
                          if (group.maxSelection === 1) {
                            initSubSelections(opt.id);
                          } else {
                            if (!currentSelected.includes(opt.id)) {
                              initSubSelections(opt.id);
                            }
                          }
                          
                          return newSelectedOptions;
                        });
                      };
                      
                      return (
                        <div key={opt.id} style={{ display: 'contents' }}>
                          <div 
                            className={`modifier-option-card ${isChecked ? 'selected' : ''}`}
                            onClick={handleSelect}
                          >
                            <span className="modifier-option-name">{opt.name}</span>
                            {opt.priceModifier > 0 && (
                              <span className="modifier-option-price">+${opt.priceModifier}</span>
                            )}
                          </div>
                          {isChecked && (
                            <>
                              {opt.bundleItems && opt.bundleItems.length > 0 && (
                                <div className="modifier-bundle-items-container w-100 mt-2 mb-2" style={{ gridColumn: 'span 2' }}>
                                  {opt.bundleItems.map(bi => (
                                    <div key={bi.id} className="bundle-item-section mb-3 p-3 rounded bg-light border">
                                      <div className="bundle-item-header fw-bold text-dark border-bottom pb-1.5 mb-2 d-flex align-items-center justify-content-between" style={{ fontSize: '13px' }}>
                                        <span><i className="bi bi-tag-fill text-secondary me-1.5"></i>{bi.name}</span>
                                        {(!bi.modifierGroups || bi.modifierGroups.length === 0) && !bi.targetCategoryId && (
                                          <span className="text-muted fw-normal" style={{ fontSize: '11px' }}>此品項無客製化調整</span>
                                        )}
                                      </div>
                                      {bi.targetCategoryId && (
                                        <div className="bundle-product-selector mb-3">
                                          <div className="text-muted mb-2" style={{ fontSize: '12px' }}>
                                            請選擇品項（超過 ${bi.baseAllowance} 需補差額）：
                                          </div>
                                          <div className="d-flex flex-wrap gap-2">
                                            {products
                                              .filter(p => p.categoryId === bi.targetCategoryId && p.status === 'AVAILABLE' && !p.isDeleted)
                                              .map(p => {
                                                const diff = p.price - (bi.baseAllowance || 0);
                                                const isSelected = selectedBundleProducts[bi.id] === p.id;
                                                return (
                                                  <button
                                                    key={p.id}
                                                    type="button"
                                                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                    style={{ borderRadius: '20px', fontSize: '12px', padding: '6px 12px' }}
                                                    onClick={() => {
                                                      setSelectedBundleProducts(prev => ({
                                                        ...prev,
                                                        [bi.id]: p.id
                                                      }));
                                                    }}
                                                  >
                                                    {p.name}
                                                    {diff > 0 && ` (+$${diff})`}
                                                  </button>
                                                );
                                              })}
                                          </div>
                                        </div>
                                      )}
                                      {bi.modifierGroups && bi.modifierGroups.length > 0 ? (
                                        <div className="bundle-item-groups">
                                          {bi.modifierGroups.map(subGroup => renderModifierGroup(subGroup, depth + 1))}
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(!opt.bundleItems || opt.bundleItems.length === 0) && opt.modifierGroups && opt.modifierGroups.length > 0 && (
                                <div className="modifier-nested-groups-container w-100 mt-2 mb-2" style={{ gridColumn: 'span 2' }}>
                                  {opt.modifierGroups.map(subGroup => renderModifierGroup(subGroup, depth + 1))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            };
            return selectedProduct?.modifierGroups?.map(group => renderModifierGroup(group, 0));
          })()}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-between align-items-center">
          <span className="fw-bold text-primary" style={{ fontSize: '18px' }}>
            ${selectedProduct ? selectedProduct.price + calculateOptionsPriceSum(selectedProduct, Object.values(selectedOptions).flat(), selectedBundleProducts) : 0}
          </span>
          <button 
            className="modern-btn px-4" 
            onClick={() => {
              let isValid = true;
              const activeGroups = getActiveModifierGroups(selectedProduct, selectedOptions);
              activeGroups.forEach(group => {
                const selected = selectedOptions[group.id] || [];
                if (group.minSelection && selected.length < group.minSelection) isValid = false;
                if (group.maxSelection && group.maxSelection > 0 && selected.length > group.maxSelection) isValid = false;
              });
              
              if (!isValid) {
                alert('請檢查您的客製化選項是否符合選擇數量限制！');
                return;
              }

              // 驗證自選套餐是否有選定商品
              let bundleSelectValid = true;
              activeGroups.forEach(group => {
                const selected = selectedOptions[group.id] || [];
                selected.forEach(optId => {
                  const opt = group.options?.find(o => o.id === optId);
                  if (opt && opt.bundleItems) {
                    opt.bundleItems.forEach(bi => {
                      if (bi.targetCategoryId && !selectedBundleProducts[bi.id]) {
                        bundleSelectValid = false;
                      }
                    });
                  }
                });
              });
              if (!bundleSelectValid) {
                alert('請為套餐的所有自選項目選擇一個商品！');
                return;
              }
              
              const allSelectedOptionIds = Object.values(selectedOptions).flat();
              addCustomizedToCart(selectedProduct, allSelectedOptionIds, '', selectedBundleProducts);
              setShowCustomModal(false);
            }}
          >
            加入購物車
          </button>
        </Modal.Footer>
      </Modal>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <div className="success-icon-wrapper">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">點餐成功！</h4>
            <p className="text-secondary mb-4" style={{ fontSize: '15px' }}>
              桌台 <strong className="text-dark">{successInfo.tableName}</strong> 的訂單已成功送出。
            </p>
            <div className="p-3 bg-light rounded-3 mb-4 text-start" style={{ fontSize: '13px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted">訂單編號:</span>
                <span className="fw-mono text-dark fw-bold">{successInfo.orderNo}</span>
              </div>
            </div>
            <button className="modern-btn w-100 py-2.5" onClick={handleSuccessModalConfirm}>
              確定並返回桌台
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderInterface;
