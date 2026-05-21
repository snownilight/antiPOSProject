import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * WebSocket 自訂 Hook (POS-33)
 * 透過 STOMP over SockJS 訂閱指定 topic，收到訊息時執行 callback。
 * 元件 unmount 時自動斷線。
 *
 * @param {string} topic - 訂閱的 topic 路徑 (例如 '/topic/orders')
 * @param {function} onMessage - 收到訊息時的 callback，參數為解析後的 JSON 物件
 */
const WS_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api')
    .replace('/api', '/ws');

export default function useWebSocket(topic, onMessage) {
    const clientRef = useRef(null);
    // 使用 ref 保存最新的 onMessage，避免重新連線
    const onMessageRef = useRef(onMessage);

    const stableTopic = useRef(topic);

    useEffect(() => {
        onMessageRef.current = onMessage;
        stableTopic.current = topic;
    }, [topic, onMessage]);

    useEffect(() => {
        const client = new Client({
            webSocketFactory: () => new SockJS(WS_URL),
            reconnectDelay: 5000,
            onConnect: () => {
                console.log('[WebSocket] 已連線至', WS_URL);
                client.subscribe(stableTopic.current, (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        onMessageRef.current(payload);
                    } catch (err) {
                        console.error('[WebSocket] 解析訊息失敗:', err);
                    }
                });
            },
            onStompError: (frame) => {
                console.error('[WebSocket] STOMP 錯誤:', frame.headers['message']);
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            console.log('[WebSocket] 斷線中...');
            client.deactivate();
        };
    }, []); // 只在 mount/unmount 時執行

    return clientRef;
}
