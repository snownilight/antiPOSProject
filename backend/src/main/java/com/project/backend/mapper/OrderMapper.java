package com.project.backend.mapper;

import com.project.backend.entity.Order;
import com.project.backend.entity.OrderItem;
import com.project.backend.entity.OrderItemOption;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface OrderMapper {
    Order findById(Long id);
    
    Order findByOrderNo(String orderNo);
    
    List<Order> findAllActive(@Param("tableId") Long tableId, @Param("status") String status);

    List<Order> findAllActiveByStatuses(@Param("tableId") Long tableId, @Param("statuses") List<String> statuses);
    
    int insert(Order order);
    
    int update(Order order);
    
    int softDelete(Long id);
    
    // Order Item operations
    int insertOrderItem(OrderItem item);
    
    List<OrderItem> findItemsByOrderId(Long orderId);

    // Selected options operations (POS-48)
    int insertOrderItemOption(OrderItemOption option);
    
    List<OrderItemOption> findOptionsByOrderItemId(Long orderItemId);
}
