class WSSClient {
    /**
     * 创建一个WebSocket客户端实例
     * @param {string} url WebSocket服务器的URL
     * @param {int} heartTime 心跳超时时间 秒
     */
    constructor(url, heartTime = 1) {
        this.url = url;
        this.websocket = null;
        this.isReconnecting = false;
        this.pingInterval = null;
        this.reconnectDelay = 1000; // 重连延迟时间（毫秒）
        this.pingIntervalTime = heartTime * 1000; // 心跳间隔时间（毫秒）
        this.PongLastTime = 0; //心跳 Pong 最后应答时间
        this.PingLastTime = 0; //心跳 Ping 最后发送时间

        this.connectEd = false; // 是否已连接
        this.connectCall = [];
        this.closeCall = [];
        this.messageCallback = [];
        this.SendQueue = []; //待发送消息队列
    }

    /**
     * 建立WebSocket连接
     */
    connect(callFunc) {
        this.websocket = new WebSocket(this.url);

        this.websocket.onopen = () => {
            console.log('WebSocket 连接已建立');
            let Dialog = $('.ks-Dialog_warning');
            if(Dialog.length){
                $.layerHide(Dialog.attr('key'))
            }
            this.connectEd = true;
            this.PongLastTime = new Date().getTime();
            this.startHeartbeat();
            this.connectCall.forEach((func) => {
                func();
            });
            callFunc && callFunc();
        };

        this.websocket.onclose = (e) => {
            const closeCode = e.code;
            const closeReason = e.reason;
            console.warn(`WebSocket 连接已关闭 关闭代码：${closeCode}，关闭原因：${closeReason}`);
            if(!$('.ks-Dialog_warning').length){
              $.Dialog('warning', '与服务器连接已丢失，请等待');
           }
            this.connectEd = false;
            this.stopHeartbeat();
            this.reconnect();
            this.closeCall.forEach((func) => {
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
                try {
                    message = JSON.parse(event.data);
                    this.messageCallback.forEach((func) => {
                        func(message);
                    });
                } catch (e) {
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
        setTimeout(() => {
            this.connect();
            this.isReconnecting = false;
        }, this.reconnectDelay);
    }

    /**
     * 启动心跳检测
     */
    startHeartbeat() {
        if (!this.pingIntervalTime) {
            return;
        }
        this.pingInterval = setInterval(() => {
            let time = new Date().getTime();
            if (this.connectEd && time - this.PongLastTime > this.pingIntervalTime * 5) {
                console.log('心跳超时，连接已断开', time - this.PongLastTime);
                this.websocket.close();
            }
            if (time - this.PingLastTime > this.pingIntervalTime) {
                this.sendPing();
            }
        }, 1000);
    }

    /**
     * 停止心跳检测
     */
    stopHeartbeat() {
        this.pingInterval && clearInterval(this.pingInterval);
    }

    /**
     * 设置接收消息的回调函数
     * @param {function} callback 收到消息时的回调函数
     */
    onMessage(callback) {
        typeof callback == 'function' && this.messageCallback.push(callback);
    }

    /**
     * 发送消息给WebSocket服务器
     * @param {Object} message 要发送的消息对象
     * @param call
     */
    send(message, call) {

        if (this.websocket.readyState === WebSocket.OPEN) {
            const messageString = JSON.stringify(message);
            const maxChunkSize = 65535; // 最大分片大小
              for (let i = 0; i < messageString.length; i += maxChunkSize) {
                const chunk = messageString.slice(i, i + maxChunkSize);
                if (i + maxChunkSize >= messageString.length) {
                  // 最后一个分片
                  this.websocket.send(chunk);
                } else {
                  // 中间分片
                  this.websocket.send(chunk, { fin: true });
                }
              }
            // 发送数据
            //this.websocket.send(messageString);
            // console.log('发送消息:', message);
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
        } else {
            console.warn('发送心跳 Ping 连接已断开');
        }
    }

    onConnect(func) {
        typeof func == 'function' && this.connectCall.push(func);
    }

    onClose(func) {
        typeof func == 'function' && this.closeCall.push(func);
    }
}