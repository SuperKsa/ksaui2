class WSSClient {
    /**
     * 创建一个WebSocket客户端实例
     * @param {string} url WebSocket服务器的URL
     */
    constructor(url) {
        this.url = url;
        this.websocket = null;
        this.isReconnecting = false;
        this.pingInterval = null;
        this.reconnectDelay = 1000; // 重连延迟时间（毫秒）
        this.pingIntervalTime = 150000; // 心跳间隔时间（毫秒）
        this.PongLastTime = 0; //心跳 Pong 最后应答时间
        this.PingLastTime = 0; //心跳 Ping 最后发送时间

        this.connectEd = false; // 是否已连接
        this.connectCall = [];
        this.closeCall = [];
        this.messageCallback = [];
    }

    /**
     * 建立WebSocket连接
     */
    connect(callFunc) {
        this.websocket = new WebSocket(this.url);

        this.websocket.onopen = () => {
            console.log('WebSocket 连接已建立');
            this.connectEd = true;
            this.PongLastTime = new Date().getTime();
            this.startHeartbeat();
            this.connectCall.forEach((func)=>{
                func();
            });
            callFunc && callFunc();
        };

        this.websocket.onclose = () => {
            console.warn('WebSocket 连接已关闭');

            this.connectEd = false;
            this.stopHeartbeat();
            this.reconnect();
            this.closeCall.forEach((func)=>{
                func();
            });
        };

        this.websocket.onmessage = (event) => {
            if (event.data === 'Pong') {
                // 收到心跳应答
                this.connectEd = true;
                this.PongLastTime = new Date().getTime();
            } else {
                let message = {};
                try{
                    message = JSON.parse(event.data);
                    this.messageCallback.forEach((func)=>{
                        func(message);
                    });
                }catch (e) {
                    console.error('消息回调报错', e)
                }


            }
        };
    }

    /**
     * 连接断开后自动重新连接
     */
    reconnect() {
        if (this.isReconnecting) return;

        this.isReconnecting = true;
        console.log('尝试重新连接...');
        this.reconnectTimeout = setTimeout(() => {
            this.connect();
            this.isReconnecting = false;
        }, this.reconnectDelay);
    }

    /**
     * 启动心跳检测
     */
    startHeartbeat() {
        this.pingInterval = setInterval(() => {
            let time = new Date().getTime();
            if(this.connectEd && time - this.PongLastTime > this.pingIntervalTime + 1000){
                console.log('心跳超时，连接已断开', time - this.PongLastTime);
                this.websocket.close();
            }
            if(time - this.PingLastTime > this.pingIntervalTime){
                this.sendPing();
            }
        }, 1000);
    }

    /**
     * 停止心跳检测
     */
    stopHeartbeat() {
        clearInterval(this.pingInterval);
    }

    /**
     * 设置接收消息的回调函数
     * @param {function} callback 收到消息时的回调函数
     */
    onMessage(callback) {
        typeof callback ==  'function' && this.messageCallback.push(callback);
    }

    /**
     * 发送消息给WebSocket服务器
     * @param {Object} message 要发送的消息对象
     * @param call
     */
    send(message, call) {
        if (this.websocket.readyState === WebSocket.OPEN) {
            const messageString = JSON.stringify(message);
            this.websocket.send(encodeURIComponent(messageString));
            console.log('发送消息:', message);
            call && call();
        } else {
            console.warn('WebSocket 连接未打开，无法发送消息', message);
        }
    }

    /**
     * 发送心跳消息
     */
    sendPing() {
        if (this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send('Ping');
            this.PingLastTime = new Date().getTime();
        }else{
            console.warn('发送心跳 Ping 连接已断开');
        }



    }

    onConnect(func){
        typeof func ==  'function' && this.connectCall.push(func);
    }

    onClose(func){
        typeof func ==  'function' && this.closeCall.push(func);
    }
}