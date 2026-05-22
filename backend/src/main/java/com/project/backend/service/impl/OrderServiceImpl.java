package com.project.backend.service.impl;

import com.project.backend.dto.OrderCreateRequest;
import com.project.backend.dto.OrderEventDTO;
import com.project.backend.dto.OrderItemCreateRequest;
import com.project.backend.entity.DiningTable;
import com.project.backend.entity.Order;
import com.project.backend.entity.OrderItem;
import com.project.backend.entity.OrderItemOption;
import com.project.backend.entity.Product;
import com.project.backend.mapper.OrderMapper;
import com.project.backend.service.DiningTableService;
import com.project.backend.service.OrderService;
import com.project.backend.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class OrderServiceImpl implements OrderService {

    @Autowired
    private OrderMapper orderMapper;

    @Autowired
    private ProductService productService;

    @Autowired
    private DiningTableService diningTableService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Value("${order.require-staff-confirm:false}")
    private boolean requireStaffConfirm;

    private static final List<String> VALID_ORDER_STATUSES = Arrays.asList(
            "PENDING_CONFIRM", "PENDING", "PREPARING", "READY", "PAID", "CANCELLED");
    private static final List<String> BILLABLE_ORDER_STATUSES = Arrays.asList("PENDING_CONFIRM", "PENDING", "PREPARING", "READY");
    private static final List<String> KITCHEN_ORDER_STATUSES = Arrays.asList("PENDING", "PREPARING");

    @Override
    @Transactional
    public Order createOrder(OrderCreateRequest request) {
        // 1. 驗證與獲取桌台
        DiningTable table = null;
        boolean isGuestOrder = false;
        
        if (request.getTableToken() != null && !request.getTableToken().trim().isEmpty()) {
            isGuestOrder = true;
            try {
                table = diningTableService.getTableByToken(request.getTableToken().trim());
            } catch (Exception e) {
                throw new IllegalArgumentException("開單失敗：找不到指定的桌台 (Token: " + request.getTableToken() + ")");
            }
        } else if (request.getTableId() != null) {
            try {
                table = diningTableService.getTableById(request.getTableId());
            } catch (Exception e) {
                throw new IllegalArgumentException("開單失敗：找不到指定的桌台 (ID: " + request.getTableId() + ")");
            }
        } else {
            throw new IllegalArgumentException("開單失敗：桌台 ID 或 Token 不能為空");
        }

        // 2. 計算總金額與建立訂單品項
        BigDecimal totalAmount = BigDecimal.ZERO;
        List<OrderItem> itemsToCreate = new ArrayList<>();

        for (OrderItemCreateRequest itemReq : request.getItems()) {
            Product product;
            try {
                product = productService.getProductById(itemReq.getProductId());
            } catch (Exception e) {
                throw new IllegalArgumentException("開單失敗：找不到商品 (ID: " + itemReq.getProductId() + ")");
            }

            // 檢查商品狀態是否為可用
            if (!"AVAILABLE".equalsIgnoreCase(product.getStatus())) {
                throw new IllegalArgumentException("開單失敗：商品「" + product.getName() + "」已售罄或暫不供應");
            }

            // 處理客製化選項 (包含套餐二級客製化與子餐點獨立客製化) (POS-48)
            List<OrderItemOption> selectedOptions = new ArrayList<>();
            BigDecimal priceModifierSum = BigDecimal.ZERO;

            // 獲取該商品支援的所有直接客製化群組
            List<com.project.backend.entity.ModifierGroup> modifierGroups = product.getModifierGroups();
            if (modifierGroups == null) {
                modifierGroups = new ArrayList<>();
            }

            // 1. 初始化並標準化所選選項
            Set<Long> primaryOptionIds = new java.util.HashSet<>();
            Map<Long, Map<Long, List<Long>>> bundleSelections = new java.util.HashMap<>(); // parentOptionId -> (bundleItemId -> list of childOptionIds)
            Map<Long, List<Long>> legacySubOptionSelections = new java.util.HashMap<>(); // parentOptionId -> list of childOptionIds

            if (itemReq.getSelectedOptions() != null && !itemReq.getSelectedOptions().isEmpty()) {
                // 新格式：結構化輸入
                for (com.project.backend.dto.OrderItemCreateRequest.SelectedOptionRequest selOpt : itemReq.getSelectedOptions()) {
                    primaryOptionIds.add(selOpt.getOptionId());
                    if (selOpt.getBundleItems() != null && !selOpt.getBundleItems().isEmpty()) {
                        Map<Long, List<Long>> biMap = new java.util.HashMap<>();
                        for (com.project.backend.dto.OrderItemCreateRequest.BundleItemSelection biSel : selOpt.getBundleItems()) {
                            if (biSel.getOptionIds() != null) {
                                biMap.put(biSel.getBundleItemId(), biSel.getOptionIds());
                            }
                        }
                        bundleSelections.put(selOpt.getOptionId(), biMap);
                    }
                }
            } else if (itemReq.getOptionIds() != null && !itemReq.getOptionIds().isEmpty()) {
                // 舊格式：扁平輸入，自動重構樹狀結構
                List<Long> flatIds = itemReq.getOptionIds();
                Set<Long> productPrimaryOptionIds = new java.util.HashSet<>();
                Map<Long, com.project.backend.entity.ModifierOption> allPrimaryOptions = new java.util.HashMap<>();

                for (com.project.backend.entity.ModifierGroup group : modifierGroups) {
                    if (group.getOptions() != null) {
                        for (com.project.backend.entity.ModifierOption opt : group.getOptions()) {
                            productPrimaryOptionIds.add(opt.getId());
                            allPrimaryOptions.put(opt.getId(), opt);
                        }
                    }
                }

                for (Long id : flatIds) {
                    if (productPrimaryOptionIds.contains(id)) {
                        primaryOptionIds.add(id);
                    }
                }

                List<Long> remainingIds = flatIds.stream()
                        .filter(id -> !primaryOptionIds.contains(id))
                        .collect(Collectors.toList());

                for (Long parentOptId : primaryOptionIds) {
                    com.project.backend.entity.ModifierOption parentOpt = allPrimaryOptions.get(parentOptId);
                    if (parentOpt == null) continue;

                    // 1. 嘗試歸入子餐點 (Bundle Items)
                    if (parentOpt.getBundleItems() != null && !parentOpt.getBundleItems().isEmpty()) {
                        Map<Long, List<Long>> biMap = new java.util.HashMap<>();
                        for (com.project.backend.entity.BundleItem bi : parentOpt.getBundleItems()) {
                            List<Long> biOptionIds = new ArrayList<>();
                            if (bi.getModifierGroups() != null) {
                                for (com.project.backend.entity.ModifierGroup mg : bi.getModifierGroups()) {
                                    if (mg.getOptions() != null) {
                                        for (com.project.backend.entity.ModifierOption mo : mg.getOptions()) {
                                            if (remainingIds.contains(mo.getId())) {
                                                biOptionIds.add(mo.getId());
                                            }
                                        }
                                    }
                                }
                            }
                            if (!biOptionIds.isEmpty()) {
                                biMap.put(bi.getId(), biOptionIds);
                            }
                        }
                        if (!biMap.isEmpty()) {
                            bundleSelections.put(parentOptId, biMap);
                        }
                    }

                    // 2. 嘗試歸入舊有二級客製化群組 (legacy sub-groups)
                    if (parentOpt.getModifierGroups() != null && !parentOpt.getModifierGroups().isEmpty()) {
                        List<Long> legacyIds = new ArrayList<>();
                        for (com.project.backend.entity.ModifierGroup mg : parentOpt.getModifierGroups()) {
                            if (mg.getOptions() != null) {
                                for (com.project.backend.entity.ModifierOption mo : mg.getOptions()) {
                                    if (remainingIds.contains(mo.getId())) {
                                        legacyIds.add(mo.getId());
                                    }
                                }
                            }
                        }
                        if (!legacyIds.isEmpty()) {
                            legacySubOptionSelections.put(parentOptId, legacyIds);
                        }
                    }
                }
            }

            // 2. 驗證商品的一級客製化群組選擇數量限制
            for (com.project.backend.entity.ModifierGroup group : modifierGroups) {
                long selectedCount = 0;
                if (group.getOptions() != null) {
                    for (com.project.backend.entity.ModifierOption opt : group.getOptions()) {
                        if (primaryOptionIds.contains(opt.getId())) {
                            selectedCount++;
                        }
                    }
                }
                if (group.getMinSelection() != null && selectedCount < group.getMinSelection()) {
                    throw new IllegalArgumentException("開單失敗：商品「" + product.getName() + "」的客製化群組「" + group.getName() + "」最少需選擇 " + group.getMinSelection() + " 項");
                }
                if (group.getMaxSelection() != null && group.getMaxSelection() > 0 && selectedCount > group.getMaxSelection()) {
                    throw new IllegalArgumentException("開單失敗：商品「" + product.getName() + "」的客製化群組「" + group.getName() + "」最多只能選擇 " + group.getMaxSelection() + " 項");
                }
            }

            // 3. 驗證套餐子餐點或舊有二級客製化群組的限制
            for (Long parentOptId : primaryOptionIds) {
                com.project.backend.entity.ModifierOption parentOpt = null;
                for (com.project.backend.entity.ModifierGroup group : modifierGroups) {
                    if (group.getOptions() != null) {
                        for (com.project.backend.entity.ModifierOption opt : group.getOptions()) {
                            if (opt.getId().equals(parentOptId)) {
                                parentOpt = opt;
                                break;
                            }
                        }
                    }
                }
                if (parentOpt == null) {
                    throw new IllegalArgumentException("開單失敗：找不到指定的套餐選項 ID: " + parentOptId);
                }

                // A. 驗證新版套餐子餐點 (Bundle Items)
                if (parentOpt.getBundleItems() != null && !parentOpt.getBundleItems().isEmpty()) {
                    Map<Long, List<Long>> biSelections = bundleSelections.getOrDefault(parentOptId, new java.util.HashMap<>());
                    
                    // 防禦：檢查是否傳入不屬於該套餐選項的子餐點選擇
                    for (Long biId : biSelections.keySet()) {
                        boolean biExists = parentOpt.getBundleItems().stream().anyMatch(bi -> bi.getId().equals(biId));
                        if (!biExists) {
                            throw new IllegalArgumentException("開單失敗：套餐選項「" + parentOpt.getName() + "」不包含子餐點 ID: " + biId);
                        }
                    }

                    for (com.project.backend.entity.BundleItem bi : parentOpt.getBundleItems()) {
                        List<Long> selectedBiOptIds = biSelections.getOrDefault(bi.getId(), new ArrayList<>());

                        // 收集此子餐點所有合法選項 ID
                        Set<Long> allowedBiOptIds = new java.util.HashSet<>();
                        if (bi.getModifierGroups() != null) {
                            for (com.project.backend.entity.ModifierGroup subGroup : bi.getModifierGroups()) {
                                if (subGroup.getOptions() != null) {
                                    for (com.project.backend.entity.ModifierOption subOpt : subGroup.getOptions()) {
                                        allowedBiOptIds.add(subOpt.getId());
                                    }
                                }
                            }
                        }

                        // 防注入與歸屬驗證：拒絕不屬於該子餐點的客製化選項
                        for (Long subOptId : selectedBiOptIds) {
                            if (!allowedBiOptIds.contains(subOptId)) {
                                throw new IllegalArgumentException("開單失敗：套餐子餐點「" + bi.getName() + "」不支援或不包含此客製化選項 ID: " + subOptId);
                            }
                        }

                        // 驗證子餐點客製化群組的數量限制
                        if (bi.getModifierGroups() != null) {
                            for (com.project.backend.entity.ModifierGroup subGroup : bi.getModifierGroups()) {
                                long subSelectedCount = 0;
                                if (subGroup.getOptions() != null) {
                                    for (com.project.backend.entity.ModifierOption subOpt : subGroup.getOptions()) {
                                        if (selectedBiOptIds.contains(subOpt.getId())) {
                                            subSelectedCount++;
                                        }
                                    }
                                }
                                if (subGroup.getMinSelection() != null && subSelectedCount < subGroup.getMinSelection()) {
                                    throw new IllegalArgumentException("開單失敗：套餐子餐點「" + bi.getName() + "」的客製化群組「" + subGroup.getName() + "」最少需選擇 " + subGroup.getMinSelection() + " 項");
                                }
                                if (subGroup.getMaxSelection() != null && subGroup.getMaxSelection() > 0 && subSelectedCount > subGroup.getMaxSelection()) {
                                    throw new IllegalArgumentException("開單失敗：套餐子餐點「" + bi.getName() + "」的客製化群組「" + subGroup.getName() + "」最多只能選擇 " + subGroup.getMaxSelection() + " 項");
                                }
                            }
                        }
                    }
                }

                // B. 驗證舊有二級客製化群組 (legacy sub-groups)
                if ((parentOpt.getBundleItems() == null || parentOpt.getBundleItems().isEmpty()) && 
                    parentOpt.getModifierGroups() != null && !parentOpt.getModifierGroups().isEmpty()) {
                    List<Long> legacySelectedIds = legacySubOptionSelections.getOrDefault(parentOptId, new ArrayList<>());
                    for (com.project.backend.entity.ModifierGroup subGroup : parentOpt.getModifierGroups()) {
                        long subSelectedCount = 0;
                        if (subGroup.getOptions() != null) {
                            for (com.project.backend.entity.ModifierOption subOpt : subGroup.getOptions()) {
                                if (legacySelectedIds.contains(subOpt.getId())) {
                                    subSelectedCount++;
                                }
                            }
                        }
                        if (subGroup.getMinSelection() != null && subSelectedCount < subGroup.getMinSelection()) {
                            throw new IllegalArgumentException("開單失敗：套餐選項「" + parentOpt.getName() + "」的客製化群組「" + subGroup.getName() + "」最少需選擇 " + subGroup.getMinSelection() + " 項");
                        }
                        if (subGroup.getMaxSelection() != null && subGroup.getMaxSelection() > 0 && subSelectedCount > subGroup.getMaxSelection()) {
                            throw new IllegalArgumentException("開單失敗：套餐選項「" + parentOpt.getName() + "」的客製化群組「" + subGroup.getName() + "」最多只能選擇 " + subGroup.getMaxSelection() + " 項");
                        }
                    }
                }
            }

            // 4. 安全防護：檢查是否有非法的 optionId
            Set<Long> allowedOptionIds = new java.util.HashSet<>();
            for (com.project.backend.entity.ModifierGroup group : modifierGroups) {
                if (group.getOptions() != null) {
                    for (com.project.backend.entity.ModifierOption opt : group.getOptions()) {
                        allowedOptionIds.add(opt.getId());
                        if (primaryOptionIds.contains(opt.getId())) {
                            if (opt.getBundleItems() != null) {
                                for (com.project.backend.entity.BundleItem bi : opt.getBundleItems()) {
                                    if (bi.getModifierGroups() != null) {
                                        for (com.project.backend.entity.ModifierGroup subGroup : bi.getModifierGroups()) {
                                            if (subGroup.getOptions() != null) {
                                                for (com.project.backend.entity.ModifierOption subOpt : subGroup.getOptions()) {
                                                    allowedOptionIds.add(subOpt.getId());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            if (opt.getModifierGroups() != null) {
                                for (com.project.backend.entity.ModifierGroup subGroup : opt.getModifierGroups()) {
                                    if (subGroup.getOptions() != null) {
                                        for (com.project.backend.entity.ModifierOption subOpt : subGroup.getOptions()) {
                                            allowedOptionIds.add(subOpt.getId());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Set<Long> rawRequestedIds = new java.util.HashSet<>();
            if (itemReq.getOptionIds() != null) {
                rawRequestedIds.addAll(itemReq.getOptionIds());
            }
            if (itemReq.getSelectedOptions() != null) {
                for (com.project.backend.dto.OrderItemCreateRequest.SelectedOptionRequest selOpt : itemReq.getSelectedOptions()) {
                    if (selOpt.getOptionId() != null) {
                        rawRequestedIds.add(selOpt.getOptionId());
                    }
                    if (selOpt.getBundleItems() != null) {
                        for (com.project.backend.dto.OrderItemCreateRequest.BundleItemSelection biSel : selOpt.getBundleItems()) {
                            if (biSel.getOptionIds() != null) {
                                rawRequestedIds.addAll(biSel.getOptionIds());
                            }
                        }
                    }
                }
            }

            for (Long reqId : rawRequestedIds) {
                if (!allowedOptionIds.contains(reqId)) {
                    throw new IllegalArgumentException("開單失敗：商品「" + product.getName() + "」不包含或不適用客製化選項 ID: " + reqId);
                }
            }


            // 5. 實體建構與價格累加
            for (com.project.backend.entity.ModifierGroup group : modifierGroups) {
                if (group.getOptions() == null) continue;
                for (com.project.backend.entity.ModifierOption opt : group.getOptions()) {
                    if (primaryOptionIds.contains(opt.getId())) {
                        priceModifierSum = priceModifierSum.add(opt.getPriceModifier());

                        OrderItemOption itemOpt = new OrderItemOption();
                        itemOpt.setOptionId(opt.getId());
                        itemOpt.setOptionName(opt.getName());
                        itemOpt.setPriceModifier(opt.getPriceModifier());
                        itemOpt.setParentId(null);
                        itemOpt.setBundleItemId(null);
                        itemOpt.setBundleItemName(null);
                        selectedOptions.add(itemOpt);

                        // A. 處理套餐子餐點
                        if (opt.getBundleItems() != null && !opt.getBundleItems().isEmpty()) {
                            Map<Long, List<Long>> biSelections = bundleSelections.getOrDefault(opt.getId(), new java.util.HashMap<>());
                            for (com.project.backend.entity.BundleItem bi : opt.getBundleItems()) {
                                List<Long> selectedBiOptIds = biSelections.getOrDefault(bi.getId(), new ArrayList<>());
                                if (bi.getModifierGroups() != null) {
                                    for (com.project.backend.entity.ModifierGroup subGroup : bi.getModifierGroups()) {
                                        if (subGroup.getOptions() == null) continue;
                                        for (com.project.backend.entity.ModifierOption subOpt : subGroup.getOptions()) {
                                            if (selectedBiOptIds.contains(subOpt.getId())) {
                                                priceModifierSum = priceModifierSum.add(subOpt.getPriceModifier());

                                                OrderItemOption subItemOpt = new OrderItemOption();
                                                subItemOpt.setOptionId(subOpt.getId());
                                                subItemOpt.setOptionName(subOpt.getName());
                                                subItemOpt.setPriceModifier(subOpt.getPriceModifier());
                                                subItemOpt.setParentId(opt.getId());
                                                subItemOpt.setBundleItemId(bi.getId());
                                                subItemOpt.setBundleItemName(bi.getName());
                                                selectedOptions.add(subItemOpt);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // B. 處理舊有二級客製化群組
                        if ((opt.getBundleItems() == null || opt.getBundleItems().isEmpty()) && 
                            opt.getModifierGroups() != null && !opt.getModifierGroups().isEmpty()) {
                            List<Long> legacySelectedIds = legacySubOptionSelections.getOrDefault(opt.getId(), new ArrayList<>());
                            for (com.project.backend.entity.ModifierGroup subGroup : opt.getModifierGroups()) {
                                if (subGroup.getOptions() == null) continue;
                                for (com.project.backend.entity.ModifierOption subOpt : subGroup.getOptions()) {
                                    if (legacySelectedIds.contains(subOpt.getId())) {
                                        priceModifierSum = priceModifierSum.add(subOpt.getPriceModifier());

                                        OrderItemOption subItemOpt = new OrderItemOption();
                                        subItemOpt.setOptionId(subOpt.getId());
                                        subItemOpt.setOptionName(subOpt.getName());
                                        subItemOpt.setPriceModifier(subOpt.getPriceModifier());
                                        subItemOpt.setParentId(opt.getId());
                                        subItemOpt.setBundleItemId(null);
                                        subItemOpt.setBundleItemName(null);
                                        selectedOptions.add(subItemOpt);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            BigDecimal price = product.getPrice().add(priceModifierSum);
            BigDecimal quantity = new BigDecimal(itemReq.getQuantity());
            BigDecimal subtotal = price.multiply(quantity);
            totalAmount = totalAmount.add(subtotal);

            OrderItem orderItem = new OrderItem();
            orderItem.setProductId(product.getId());
            orderItem.setProductName(product.getName());
            orderItem.setPrice(price);
            orderItem.setQuantity(itemReq.getQuantity());
            orderItem.setSubtotal(subtotal);
            orderItem.setNote(itemReq.getNote());
            orderItem.setOptions(selectedOptions);
            itemsToCreate.add(orderItem);
        }

        // 3. 產生 15 碼訂單編號
        String orderNo = generateOrderNo();

        // 4. 決定初始狀態與插入訂單主檔
        String initialStatus = "PENDING";
        if (isGuestOrder && requireStaffConfirm) {
            initialStatus = "PENDING_CONFIRM";
        }

        Order order = new Order();
        order.setTableId(table.getId());
        order.setOrderNo(orderNo);
        order.setTotalAmount(totalAmount);
        order.setStatus(initialStatus);
        orderMapper.insert(order);

        // 5. 插入訂單明細
        for (OrderItem item : itemsToCreate) {
            item.setOrderId(order.getId());
            orderMapper.insertOrderItem(item);
            
            if (item.getOptions() != null) {
                // 先插入所有一級/父選項，並建立 optionId 到資料庫 ID (id) 的對應
                Map<Long, Long> parentDbIdMap = new HashMap<>();
                for (OrderItemOption opt : item.getOptions()) {
                    if (opt.getParentId() == null) {
                        opt.setOrderItemId(item.getId());
                        orderMapper.insertOrderItemOption(opt);
                        parentDbIdMap.put(opt.getOptionId(), opt.getId());
                    }
                }
                
                // 再插入所有二級/子選項，將 parentId 設為對應的資料庫一級選項 ID
                for (OrderItemOption opt : item.getOptions()) {
                    if (opt.getParentId() != null) {
                        Long dbParentId = parentDbIdMap.get(opt.getParentId());
                        opt.setOrderItemId(item.getId());
                        opt.setParentId(dbParentId);
                        orderMapper.insertOrderItemOption(opt);
                    }
                }
            }
        }

        // 6. 連動更新桌台狀態為 OCCUPIED (用餐中)
        if (!"OCCUPIED".equalsIgnoreCase(table.getStatus())) {
            diningTableService.updateTableStatus(table.getId(), "OCCUPIED");
        }

        Order createdOrder = getOrderById(order.getId());

        // 7. 廣播 WebSocket 事件 (POS-33)
        broadcastOrderEvent("ORDER_CREATED", createdOrder);

        return createdOrder;
    }

    @Override
    public Order getOrderById(Long id) {
        Order order = orderMapper.findById(id);
        if (order == null) {
            throw new IllegalArgumentException("找不到指定的訂單 (ID: " + id + ")");
        }
        return order;
    }

    @Override
    public Order getOrderByOrderNo(String orderNo) {
        Order order = orderMapper.findByOrderNo(orderNo);
        if (order == null) {
            throw new IllegalArgumentException("找不到指定的訂單編號 (OrderNo: " + orderNo + ")");
        }
        return order;
    }

    @Override
    public List<Order> getAllActiveOrders(Long tableId, String status) {
        return orderMapper.findAllActive(tableId, status);
    }

    @Override
    public List<Order> getAllActiveOrders(Long tableId, List<String> statuses) {
        return orderMapper.findAllActiveByStatuses(tableId, normalizeStatuses(statuses));
    }

    @Override
    public List<Order> getKitchenOrders() {
        return orderMapper.findAllActiveByStatuses(null, KITCHEN_ORDER_STATUSES);
    }

    @Override
    @Transactional
    public Order updateOrderStatus(Long id, String status) {
        Order order = getOrderById(id);
        String upperStatus = status.toUpperCase();
        if (!VALID_ORDER_STATUSES.contains(upperStatus)) {
            throw new IllegalArgumentException("不合法的訂單狀態: " + status);
        }

        if (order.getStatus().equals(upperStatus)) {
            return order; // 狀態一致無須更新
        }

        // 業務規則驗證：例如已付款或已取消訂單不允許再修改狀態
        if ("PAID".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus())) {
            throw new IllegalArgumentException("訂單已結帳或已取消，無法變更狀態");
        }

        order.setStatus(upperStatus);
        orderMapper.update(order);

        // 7. 桌台狀態連動邏輯
        if ("PAID".equals(upperStatus)) {
            // 付款成功連動更新桌台為 CLEANING (清潔中)
            diningTableService.updateTableStatus(order.getTableId(), "CLEANING");
        } else if ("CANCELLED".equals(upperStatus)) {
            // 取消訂單時，如果桌台沒有其他活動中訂單，則連動更新桌台為 EMPTY (空閒)
            List<Order> activeOrders = orderMapper.findAllActiveByStatuses(order.getTableId(), BILLABLE_ORDER_STATUSES);
            boolean hasOtherPending = activeOrders.stream()
                    .anyMatch(o -> !o.getId().equals(order.getId()));
            if (!hasOtherPending) {
                diningTableService.updateTableStatus(order.getTableId(), "EMPTY");
            }
        }

        Order updatedOrder = getOrderById(id);

        // 廣播 WebSocket 事件 (POS-33)
        broadcastOrderEvent("ORDER_STATUS_CHANGED", updatedOrder);

        return updatedOrder;
    }
    
    @Override
    @Transactional
    public Order checkoutOrder(Long id) {
        Order order = getOrderById(id);
        
        if ("PAID".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus())) {
            throw new IllegalArgumentException("訂單已結帳或已取消，無法重複結帳");
        }
        
        // 1. 計算金額
        List<OrderItem> items = orderMapper.findItemsByOrderId(id);
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (OrderItem item : items) {
            totalAmount = totalAmount.add(item.getSubtotal());
        }
        order.setTotalAmount(totalAmount);
        
        // 2. 更新狀態為 PAID
        order.setStatus("PAID");
        orderMapper.update(order);
        
        // 3. 桌台狀態連動邏輯
        diningTableService.updateTableStatus(order.getTableId(), "CLEANING");

        Order checkedOutOrder = getOrderById(id);

        // 4. 廣播 WebSocket 事件 (POS-33)
        broadcastOrderEvent("ORDER_STATUS_CHANGED", checkedOutOrder);

        return checkedOutOrder;
    }

    @Override
    @Transactional
    public void deleteOrder(Long id) {
        Order order = getOrderById(id);
        // 僅允許刪除已付款或已取消的訂單以防誤刪活動中的訂單
        if (BILLABLE_ORDER_STATUSES.contains(order.getStatus())) {
            throw new IllegalArgumentException("無法刪除未付款的活動中訂單，請先取消或結帳");
        }
        orderMapper.softDelete(id);
    }

    /**
     * 產生符合規則的 15 碼訂單編號
     * 結構: TW-YYMMDD-XXXXX
     * - 前綴: TW
     * - 日期: 採用 UTC+8 (Asia/Taipei) 的 YYMMDD
     * - 混淆流水號: 5 碼隨機字元 (排除易混淆字元 I, O, L, U)
     */
    private String generateOrderNo() {
        String prefix = "TW";
        LocalDate date = LocalDate.now(ZoneId.of("Asia/Taipei"));
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyMMdd");
        String dateStr = date.format(formatter);

        // 排除 I, O, L, U 之後的字元池
        String charPool = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        java.util.concurrent.ThreadLocalRandom random = java.util.concurrent.ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(charPool.charAt(random.nextInt(charPool.length())));
        }

        return prefix + "-" + dateStr + "-" + sb.toString();
    }

    private List<String> normalizeStatuses(List<String> statuses) {
        if (statuses == null) {
            return null;
        }

        List<String> normalized = statuses.stream()
                .filter(status -> status != null && !status.trim().isEmpty())
                .map(status -> status.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .collect(Collectors.toList());

        for (String status : normalized) {
            if (!VALID_ORDER_STATUSES.contains(status)) {
                throw new IllegalArgumentException("不合法的訂單狀態: " + status);
            }
        }

        return normalized;
    }

    /**
     * 廣播訂單事件至 WebSocket 客戶端 (POS-33)
     * @param event 事件類型 (ORDER_CREATED / ORDER_STATUS_CHANGED)
     * @param order 訂單資料
     */
    private void broadcastOrderEvent(String event, Order order) {
        OrderEventDTO dto = OrderEventDTO.builder()
                .event(event)
                .orderId(order.getId())
                .orderNo(order.getOrderNo())
                .tableName(order.getTableName())
                .tableId(order.getTableId())
                .status(order.getStatus())
                .timestamp(LocalDateTime.now(ZoneId.of("Asia/Taipei"))
                        .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME))
                .build();
        messagingTemplate.convertAndSend("/topic/orders", dto);
    }
}
