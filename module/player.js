/**
* 初始化播放器
* @param mediaMap 需要播放的资源索引 {'音频标识':'播放地址'}
* @param loadCall 音频加载完成的回调函数
* @param errCall 音频加载失败的回调函数
*/
$.playerClass = class {
    /**
    * 初始化播放器
    * @param mediaMap 需要播放的资源索引 {'音频标识':'播放地址'}
    * @param loadCall 音频加载完成的回调函数
    * @param errCall 音频加载失败的回调函数
    */
    constructor(mediaMap, loadCall, errCall) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        this.Playing = {}; //正在播放的对象
        this._loadCall = loadCall;
        this._errCall = errCall;
        this.permission = false; //是否获得用户交互授权
        this.loadSounds(mediaMap);
    }

    loadSound(url) {
        return fetch(url)
            .then(response => response.arrayBuffer())
            .then(buffer => this.audioContext.decodeAudioData(buffer));
    }

    loadSounds(sounds) {
        const soundUrls = Object.values(sounds);

        Promise.all(soundUrls.map(url => this.loadSound(url)))
            .then(audioBuffers => {
                Object.keys(sounds).forEach((key, index) => {
                    this.sounds[key] = audioBuffers[index];
                });
                console.log('所有音频已加载完毕');
                this._loadCall && this._loadCall();
            })
            .catch(error => {
                console.error('音频加载错误:', error);
                this._errCall && this._errCall();
            });
    }

    createPlayer(buffer, loopCount=1, onEndedCallback) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.loop = loopCount === -1 ? true : false;
        let loopCounter = 0;

        source.onended = function () {
            loopCounter++;
            if (loopCounter > 0 && (loopCount === -1 || loopCounter < loopCount)) {
                source.start();
            } else {
                onEndedCallback && onEndedCallback();
            }
        };

        const play = () => {
            source.start();
        };

        const pause = () => {
            this.audioContext.suspend();
        };

        const resume = () => {
            this.audioContext.resume();
        };

        const stop = () => {
            loopCounter = -99;
            source.stop();
        };

        return {
            play,
            pause,
            resume,
            stop,
        };
    }

    /**
     * 播放音频
     * @param key 音频标识
     * @param loopCount 循环次数 -1=一直循环
     * @param call 播放完成回调函数
     * @param newPlay 是否全新播放
     * @returns {*}
     */
    play(key, loopCount=1, newPlay=false , call) {
        let self = this;
        function _pl(){
            if(!$.player.permission){
                return;
            }
            let obj = self.createPlayer(self.sounds[key], loopCount, () => {
                self.Playing[key] && delete self.Playing[key];
                call && call();
            });
            obj.play();
            return obj;
        }
        if(newPlay){
            _pl()
        }else{
            if (this.Playing[key] && !newPlay) {
                this.Playing[key].resume();
            } else {
                this.stop(key);
                this.Playing[key] = _pl();
            }
        }
        return this.Playing[key];
    }

    /**
     * 暂停
     * @param key
     */
    pause(key) {

        this.Playing[key] && this.Playing[key].pause();
    }

    /**
     * 继续播放
     * @param key 音频标识
     */
    resume(key) {
        this.Playing[key] && this.Playing[key].resume();
    }

    /**
     * 停止播放
     * @param key 音频标识
     */
    stop(key) {
        this.Playing[key] && this.Playing[key].stop();
    }
}
$.player = null;
$.playerInit = function (mediaMap, loadCall, errCall) {
    $.player = new $.playerClass(mediaMap, loadCall, errCall);
    $(document).click(function () {
        $.player.permission = true;
    });
    return $.player;
}

/**
 *
 * @param buffer
 * @param loopCount
 * @param initFunc
 * @param endCallback
 * @returns {player}
 */
$.playerBuffer = function (buffer, loopCount=1, initFunc, endCallback) {

    function player(){
        const self = this;

        this.loopCounter = 0;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.playing = 0;
        this.currentTime = 0;
        this.startTime = 0;

        function createSource(){
            self.source = self.audioContext.createBufferSource();
            self.source.buffer = buffer;
            self.source.connect(self.audioContext.destination);
            self.source.loop = loopCount === -1 ? true : false;
            self.source.onended = function () {
                self.loopCounter++;
                if (self.loopCounter > 0 && (loopCount === -1 || self.loopCounter < loopCount)) {
                    source.start();
                } else {
                    endCallback && endCallback.apply(self, [self]);
                }
            };
        }
        createSource();

        function getCurrentTime(){
            self.currentTime = self.audioContext.currentTime - self.startTime;
            self.playing && requestAnimationFrame(getCurrentTime);
        }

        this.play = (fromTime = 0, call) => {
            if(this.playing === 2){ //如果是暂停状态
                this.resume(); //继续播放
            }else if(!this.playing){
                if(!this.source){
                    createSource();
                }
                this.playing = 1;
                this.startTime = this.audioContext.currentTime - fromTime;
                this.source.start(0, fromTime);
                requestAnimationFrame(getCurrentTime);
                call && call.apply(self, [self]);
            }
          }

        this.pause = () => {
            this.playing = 2;
            this.audioContext.suspend();
        }

        this.resume = () => {
            this.audioContext.resume();
        }

        this.stop = () => {
            if (this.playing) {
                this.playing = 0;
                loopCounter = -99;
                this.source.stop();
                this.source.disconnect();
                this.source = null;
            }
        }

        initFunc && initFunc.apply(this, [this]);

        return this;
    }

    return new player();
}