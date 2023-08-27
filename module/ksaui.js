/*
 * KSAUI 前端UI组件库 V1.0
 *
 * 目前版本还处于开发中，请勿保存并用于生产环境！
 *  * ---------------------------------------
 * 待正式发布版本后，源代码将会公开开源
 *
 * @Author: cr180(cr180.com & ksaOS.com)
 * @Date: 2017-06-12 01:24:09
 * @LastEditors: CR180
 * @LastEditTime: 2020-08-23 17:25:34
 * @Description: file content
 */

$.ZINDEX = 999;
$.WINID = 1; //弹窗层初始ID
$.W = 0; //当前窗口宽度
$.H = 0; //当前窗口高度
$.mouseX = 0;
$.mouseY = 0;
$.device = 'PC'; //设备类型 PC MOBILE
$.deviceView = 0; //横屏竖屏 0=横屏 1=竖屏
$.ksauiRenderTree = {};


(function ($) {
    var UserAgent = navigator.userAgent;
    //低版本IE给html增加 .ks-ie9
    $.IE = _getIEversion();
    $.IE > 0 && $('html').addClass('ks-ie' + $.IE + ' ks-ie');

    function _getIEversion() {
        var ie = UserAgent.match(/msie\s([\d.]+)/i)
        var ie11 = UserAgent.match(/trident\/([\d.]+)/i);
        return parseInt(ie && ie[1] ? ie[1] : (ie11 && ie11[1] ? '11' : '0'));
    }

    $.isMobile = false;
    $.isWechat = false;
    $.W = window.innerWidth;
    $.H = window.innerHeight;

    var agent = navigator.userAgent.toLowerCase();
    //判断是否移动端
    if (/android|ipad|iphone/.test(agent) || (/mac os/.test(agent) && $.W < $.H)) {
        $.device = 'MOBILE';
        $.isMobile = true;
        $('html').attr('mobile', 'true').attr('device', 'mobile');
        $.isWechat = /microMessenger/i.test(agent);
    }
    if ($.device == 'PC') {
        //监听鼠标坐标
        $(document).on('mousemove', function (e) {
            $.mouseX = e.x || e.layerX || 0;
            $.mouseY = e.y || e.layerY || 0;
        });
        $('html').attr('device', 'pc');
    }
    $(window).resize(function () {
        $.W = window.innerWidth;
        $.H = window.innerHeight;
    });


    /**
     * 内部DOM渲染函数
     * @private
     */
    function _KSArenderStart() {
        //回调渲染函数
        function _documentRenderFun(option, ele, selector, update) {

            if (!ele._KSAUIRENDER_) {
                ele._KSAUIRENDER_ = {};
            }
            //监听属性变化
            if(option.monitor.length) {
                $.loop(option.monitor, function (val) {
                    var isCall;
                    if (update.type === 'attributes') {
                        isCall = val == ('attr.' + update.attributeName) ? update.attributeName : null;
                    }else if(val == 'html' && update.type === 'childList'){
                        isCall =val;
                    }
                    if (isCall) {
                        option.callback && option.callback.call(ele, ele, true, val);
                    }
                });
            }
            if (!ele._KSAUIRENDER_[selector]) {
                ele._KSAUIRENDER_[selector] = true;
                //渲染回调
                option.callback && option.callback.call(ele, ele);
            }
        }

        //创建回调渲染
        function _documentRender(ele, update) {
            if (ele.nodeType !== 1) {
                return;
            }
            ele = $(ele);
            $.loop($.ksauiRenderTree, function (option, selector) {
                ele.find(selector).map(function (el) {
                    _documentRenderFun(option, el, selector, update);
                });
                var thisEl = ele.filter(selector);
                thisEl.length && _documentRenderFun(option, thisEl[0], selector, update);
            });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        //监听节点变动 HTML5
        if (MutationObserver) {
            var observer = new MutationObserver(function (Mut) {
                $.loop(Mut, function (val) {
                    if (val.type === 'childList' && (val.addedNodes.length || val.removedNodes.length)) {
                        _documentRender(val.target, val);
                        $.loop(val.addedNodes, function (ele) {
                            if (ele.nodeType === 1 && $.isIndom(ele)) {
                                _documentRender(ele, val);
                            }
                        });
                        $.loop(val.removedNodes, function (ele) {
                            if (ele.nodeType === 1 && $.isIndom(ele)) {
                                _documentRender(ele, val);
                            }
                        });
                    }else if(val.type ==='attributes'){
                        _documentRender(val.target, val);
                    }
                });
            });
            observer.observe(document, {
                characterDataOldValue : true, //在文本在受监视节点上发生更改时记录节点文本的先前值
                attributeOldValue : true, //记录属性旧值
                attributes : true , //检测属性变动
                childList : true , //检测子节点变动
                subtree : true , //整个子孙节点变动
                //attributeFilter : ['style', 'clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight']
            });
            //监听节点变动 低版本浏览器
        } else {

            $(document).on('DOMContentLoaded DOMNodeInserted', function (Mut) {
                if (Mut.type === 'DOMNodeInserted') {
                    _documentRender(Mut.target);
                } else {
                    $.loop(document.body.children, function (ele) {
                        _documentRender(ele);
                    });
                }
            });
        }
    };

    $.render = function (selector, func, monitor) {
        var newMonitor = [];
        $.loop($.explode(' ', monitor), function(val){
            val = $.trim(val);
            if(val){
                newMonitor.push(val);
            }
        });

        if ($.isObject(selector) && !func) {
            $.loop(selector, function (val, key) {
                $.ksauiRenderTree[key] = {callback : val, monitor : newMonitor};
            });
        } else {
            $.ksauiRenderTree[selector] = {callback : func, monitor : newMonitor};
        }
    };

    /**
     * 移动端 不转页后退事件监听
     * @param {string} id 标识
     * @param {document} showID 需要关闭的dom(jquery) 不传入表示取消id监听
     * 后退检测到需要关闭的dom时会直接remove
     */
    $.BackEvent = function (id, showID) {
        var $this = this;
        $this.BackEventData = $this.BackEventData ? $this.BackEventData : {};
        $this.BackEventData.doms = $this.BackEventData.doms ? $this.BackEventData.doms : {};
        var Url = window.location.href;
        var idMrk = '#' + id;
        if (showID) {
            if (Url.indexOf(idMrk) == -1) {
                //history.pushState('', '', Url+idMrk);
                location.hash += idMrk;
            }
            $this.BackEventData.doms[id] = showID;
        } else {
            if (Url.indexOf(idMrk) != -1) {
                var newevn = {};
                $.loop($this.BackEventData.doms, function (v, k) {
                    if (k != id) {
                        newevn[k] = v;
                    }
                });
                $this.BackEventData.doms = newevn;
                window.history.go(-1);
            }
            return;
        }

        if (!$this.BackEventData.init) {
            $this.BackEventData.init = 1;
            $(window).on('popstate', function () {
                var u = window.location.href.indexOf('#');
                u = u == -1 ? '' : window.location.href.substr(u);
                var urlexps = {};
                $.loop($.explode('#', u), function (value) {
                    if (value) {
                        urlexps[value] = value;
                    }
                });
                var newevn = {};
                $.loop($this.BackEventData.doms, function (v, k) {
                    if (!urlexps[k]) {
                        $.layerHide($(v).attr('key'));
                    } else {
                        newevn[k] = v;
                    }
                });
                $this.BackEventData.doms = newevn;
            });
        }
    };

    /**
     * 监听窗口变化并在窗口变化后回调
     * @param {func} Fun 回调函数 参数1=宽度 参数2=高度
     * @param {number} ime 是否立即执行一次 1=立刻执行 2=dom完毕执行 3=1、2同时
     */
    $.resize = function (Fun, ime) {
        var $this = this;
        if (ime == 1 || ime == 3) {
            Fun(window.innerWidth, window.innerHeight);
        } else if (ime == 2 || ime == 3) {
            $(document).ready(function () {
                Fun(window.innerWidth, window.innerHeight);
            })
        }
        //监听窗口变化
        $(window).resize(function () {
            Fun && typeof (Fun) == 'function' && Fun(window.innerWidth, window.innerHeight);
            $this.deviceView = typeof (window.orientation) && $.inArray(window.orientation, [0, -90]) ? 0 : 1;
        });
    };

    /**
     * 本地缓存操作
     * @param Key 缓存键名
     * @param {json/string}  Val 有值=写入 ''=删除 不传值=读取
     * @param {int} outTime 过期时间
     * @returns {string|boolean|json|any} 存入的是JSON则返回的就是一个对象
     * @constructor
     */
    $.Cache = function (Key, Val, outTime) {

        var timetamp = Math.round(new Date().getTime()/1000);
        if (typeof (Storage) !== "undefined") {

            if (typeof (Val) === 'string' && !Val) {//删除
                localStorage.removeItem(Key);
                localStorage.removeItem(Key + '_jsjson');
                localStorage.removeItem(Key + '_Expired');
                return true;
            } else if (typeof (Val) !== 'undefined') {//添加
                if (typeof (Val) === 'object') {
                    Val = JSON.stringify(Val);
                    localStorage.setItem(Key + '_jsjson', 1);
                }
                localStorage.setItem(Key, Val);
                outTime = parseInt(outTime);
                //存在缓存时间 则标记缓存时间 过期日期是当前时间戳+过期时间秒
                if(outTime){
                    localStorage.setItem(Key+'_Expired', (timetamp+outTime));
                }
                return $.Cache(Key);
            } else {//获取
                //如果存在过期时间 则检查是否过期
                var _Expired = localStorage.getItem(Key+'_Expired');
                if(_Expired && _Expired < timetamp){
                    return;
                }
                Val = localStorage.getItem(Key);
                if (localStorage.getItem(Key + '_jsjson') == '1') {
                    Val = JSON.parse(Val);
                }
                return Val;
            }
        }
    };
    /**
     * 定位浮动层 限制在当前窗口内自适应围绕
     * @param centerObj 相对DOM对象
     * @param fellows 浮动层DOM对象
     * @constructor
     */
    $.Position = function (centerObj, fellows) {
        centerObj = $(centerObj);
        fellows = $(fellows);
        var offset = {left : centerObj.offset().left, top : (centerObj.offset().top + centerObj.height(true))};
        if (offset.left > this.W - fellows.width(true)) {
            offset.left = offset.left - fellows.width(true) - centerObj.height(true);
        }
        if (offset.top > this.H - fellows.height(true)) {
            offset.top = offset.top - fellows.height(true) - centerObj.height(true);
        }
        fellows.css(offset);
    };

    /**
     * 关闭当前iframe所在的父级layer
     */
    $.layerHideF = function () {
        if (!typeof (window.parent)) {
            return;
        }
        var id = $('body').attr('parentlayerid');
        if (id) {
            window.parent.$.layerHide(id);
        }
    };

    /**
     * 删除弹出层
     * @param {number} Id 弹出层ID
     */
    $.layerHide = function (Id, Fun) {
        $('body').removeClass('ks-body-layer-overflow');
        var o;
        if (!Id) {
            return;
        }
        o = $('#ks-layer-' + Id);
        if (!o.length) {
            return;
        }
        var option = LayerObject[Id] ? LayerObject[Id].option : {};
        if (Id) {
            var coverEle = o.next('[data-layer-key="' + Id + '"]');
            o.addClass('ks-anim-hide');
            coverEle.addClass('ks-anim-fadeout');
            if($.layerHideBackEvent === undefined || $.layerHideBackEvent) {
                option.backEvent && $.BackEvent('KsaLayer' + Id);
            }
            setTimeout(function () {
                o.active(false);
                Fun && Fun(Id);
                !option.cancel && option.close && option.close();
                option.hide && option.hide();
                if (option.cache) {
                    coverEle.length && coverEle.hide();
                    o.hide();
                } else {
                    coverEle.length && coverEle.remove();
                    o.remove();
                    delete LayerObject[Id];
                }
            }, 200);
        }
    };

    /**
     * 创建一个弹窗（所有弹出层 底层驱动）
     * @param {JSON/html/document} option 窗口HTML内容 或 JSON配置参数 或 jquery元素对象
     * @param {number} pos 窗口定位 （可选，可在参数1通过json配置）
     *                        00 : 从右到左滑出一个全屏（移动端适用 cover参数固定为0）
     *                    自动定位传值： jQ选择器 (根据元素坐标相对定位 适合各种下拉菜单、提示框)
     *                    指定定位传值：
     *                            1 2 3
     *                            4 5 6
     *                            7 8 9
     * @param {number} cover 是否遮罩层 0=否 1=是 2=是（带点击关闭窗口事件） 3=是（带双击关闭窗口事件）
     * @param {func} showFun 弹窗显示后回调（可选，可在参数1通过json配置）
     * @param {func} closeFun 弹窗关闭后回调（可选，可在参数1通过json配置）
     * @param {func} btnFun 底部按钮点击回调（可选，可在参数1通过json配置）
     * @param {func} initFun 初始化后回调函数（可选，可在参数1通过json配置）
     * @returns {k.fn.init}
     */
    var LayerObject = {};
    $.layer = function (option, pos, cover, showFun, closeFun, btnFun, initFun) {

        var EL = $(option.el || 'body');
        var ELoffset = EL.offset();
        //EL尺寸与位置
        var ELSize = {W : EL.width(true), H : EL.height(true), L : ELoffset.left, T : ELoffset.top};

        //layer动画样式名称
        var layerAnim = {
            0 : 'ks-anim-up',
            1 : 'ks-anim-right',
            2 : 'ks-anim-down',
            3 : 'ks-anim-left',
            4 : 'ks-anim-right',
            5 : 'ks-anim-scale',
            6 : 'ks-anim-left',
            7 : 'ks-anim-right',
            8 : 'ks-anim-up',
            9 : 'ks-anim-left',
            '00' : 'ks-anim-left',
        };

        var R = {
            ID : 1,
            layer : null, //当前layer KSA对象
            obj : {},
            isCache : false,
            autoCloseObj : null, //自动关闭 setTimeout对象
            init : function(){
                var _this = this;
                if(option.cache){
                    //从缓存抽取layer
                    $.loop(LayerObject, function(val){
                        if(val.cache === option.cache){
                            _this.obj = val;
                            _this.isCache = true;
                            _this.layer = $(_this.obj.dom);
                        }
                    });
                }
                _this.optionInit();
                !_this.isCache && _this.createDom();

                _this.sizeInit();
                this.show();

                if (!_this.isCache && option.ajaxUrl) {
                    $.API(option.ajaxUrl, option.ajaxPost, function (d) {
                        _this.layer.children('.ks-layer-content').html(d);
                        option.ajaxCall && option.ajaxCall.call(_this.layer, _this.layer.children('.ks-layer-content').children('*'));
                        window.setTimeout(function(){
                            _this.pos();
                        });
                    });
                }
                return this.obj;
            },
            //配置初始化
            optionInit : function(){
                if (typeof (option) == 'string' || (option instanceof $ && option[0].innerHTML)) {
                    option = {content : option};
                }
                //如果layer是一个远程url 则提示稍后
                if(option.ajaxUrl){
                    option.content = '<div class="ks-loading"></div>';
                }
                option = $.arrayMerge({
                    el : $.layerEL || 'body', //弹窗位置被限制在哪个元素中
                    title : null, //弹窗标题
                    content : null, //弹窗内容
                    class : '', //附加class 可以自定义样式
                    iframe : null, //iframe框架URL地址
                    ajaxUrl : null, //ajax地址 （注意ajax类型窗口调用不会返回任何数据）
                    ajaxPost : null,//ajaxPost 数据
                    type : '', //弹窗类型 与class组合 {class}_{type}
                    pos : pos ? pos : 5, //弹窗位置 参考layer pos介绍
                    btn : null, //按钮名称 数组
                    btnFun : btnFun, //按钮点击后回调 参数[index=按钮序号, txt=按钮文字, btnobj=按钮dom对象, dom=整个KSAUI对象]
                    cover : $.isset(cover) ? cover : 0, //是否遮罩层 0=否 1=是 2=是（带点击关闭窗口事件） 3=是（带双击关闭窗口事件） 坐标={top:0,right:0,bottom:0,left:0,event:click|dblclick}
                    coverClass : null, //遮罩层附加class
                    outTime : 0,//自动关闭时间 秒
                    init : initFun, //初始化回调（还未添加到body中） 参数[layerDom]
                    show : showFun, //弹出后回调 参数[layerDom]
                    close : closeFun, //关闭后回调 无参数
                    closeBtn : 1, //是否需要右上角关闭按钮 1=是 0=否
                    backEvent : null, //是否需要监听后退事件 1=是 0=否
                    cache : null, //是否缓存 传入唯一缓存键名
                    maxHeight : 0, //内容区最大高度
                    height : null, //内容区固定高度

                }, option);

                //手机端默认监听后退事件
                if (option.backEvent === null && $.isMobile) {
                    option.backEvent = 1;
                }
                if(option.type){
                    option.type = $.trim(option.type);
                    option.class += ' '+option.class+'_'+option.type;
                }
                option.cache = option.cache ? option.cache : null;
                if (option.iframe) {
                    option.class += ' ks-layer-iframe';
                    option.content = '<div class="ks-loading"></div><iframe src="' + option.iframe + '" width="100%" height="100%"></iframe>';
                }
            },
            //layer 尺寸、位置处理
            pos : function() {

                var _this = this;
                var style = {};
                var pos = option.pos;
                _this.countSize();
                var w = _this.obj.width,
                    h = _this.obj.height;
                if ($.inArray(pos, ['00', 1, 2, 3, 4, 5, 6, 7, 8, 9])) {
                    if ($.inArray(pos, [1, 4, 7])) {
                        style.left = 0;
                    }
                    if ($.inArray(pos, [1, 2, 3])) {
                        style.top = 0;
                    }
                    //X轴居中
                    if ($.inArray(pos, [2, 5, 8])) {
                        style['margin-left'] = $.intval(0 - w / 2);
                    }
                    //X轴居右
                    if ($.inArray(pos, [3, 6, 9])) {
                        style.right = 0;
                        style.left = 'initial';
                    }
                    //Y轴居中
                    if ($.inArray(pos, [4, 5, 6])) {
                        style['margin-top'] = $.intval(0 - h / 2);
                    }
                    //Y轴底部
                    if ($.inArray(pos, [7, 8, 9])) {
                        style.top = 'initial';
                        style.bottom = '0';
                    }
                    //全屏
                    if (pos == '00') {
                        style.top = '0';
                        style.bottom = '0';
                        style['margin-left'] = '-100%';
                    }
                    //如果定位不是既定位置 则认为是一个选择器 自适应定位
                } else {
                    var trigger = $(pos),
                        teiggerW = trigger.width(true),
                        teiggerH = trigger.height(true),
                        layerW = this.layer.width(true),
                        layerH = this.layer.height(true);
                    style.left = trigger.offset().left;
                    style.top = trigger.offset().top + teiggerH;

                    var seH = trigger.offset().top - $(document).scrollTop() + teiggerH + layerH;
                    if (ELSize.W - (style.left + layerW) < 0) {
                        style.left = style.left - layerW + teiggerW;
                    }
                    //如果弹出层Y坐标与自身高度超出可视区 则定位到基点上方
                    if ($.H - seH < 0) {
                        style.top = trigger.offset().top - layerH;
                        _this.obj.pos = 2;
                    } else {
                        _this.obj.pos = 8;
                    }
                }
                this.layer.css(style);
            },
            close : function(){
                this.autoCloseObj && clearTimeout(this.autoCloseObj);
                $.layerHide(this.ID);
            },
            //创建DOM
            createDom : function(){
                var _this = this;
                var id = $.ZINDEX ++;
                var dom = '';
                //关闭按钮
                if (option.closeBtn) {
                    dom += '<span class="ks-layer-close" icon="close"></span>';
                }
                //标题栏
                if (option.title) {
                    dom += '<div class="ks-layer-title">' + option.title + '</div>';
                }
                dom += '<div class="ks-layer-content"></div>';
                //按钮处理
                if (option.btn) {
                    var s = '';
                    if ($.isString(option.btn)) {
                        s += $.tag('ks-btn', {'data-btn-index' : 0}, option.btn);
                    } else {
                        $.loop(option.btn, function (val, k) {
                            val = val.split(':');
                            s += $.tag('ks-btn', {class : '_' + k, 'data-btn-index' : k, color : val[1], cap:$.isMobile}, val[0]);
                        });
                    }
                    dom += s ? '<div class="ks-layer-bottom">' + s + '</div>' : '';
                }

                var pos = $.isObject(option.pos) ? 0 : option.pos;
                dom = $.tag('div', {
                    class : ('ks-layer ' + option.class),
                    pos : pos,
                    id : 'ks-layer-' + id,
                    style : 'z-index:' + id,
                    key : id,
                    type : option.type
                }, dom);
                dom = $(dom);
                dom.find('.ks-layer-content').html(option.content);

                //创建当前layer对象到全局变量
                LayerObject[id] = this.obj = {
                    dom : dom[0],
                    coverDom : '',
                    id : id,
                    selector : '#ks-layer-'+id,
                    option : option,
                    width : 0,
                    height : 0,
                    cache : option.cache,
                    pos : pos,
                    resize : function(){
                        _this.pos();
                    },
                    close : function(){
                        _this.close();
                    },
                    show : function(){
                        _this.show();
                    }
                };

                _this.ID = id;
                _this.layer = dom;
                //添加layerID
                _this.layer.layerID = id;
                //DOM插入到前台
                $(EL).append(dom);

                //iframe body加当前ID
                if (option.iframe) {
                    dom.iframe = null;
                    dom.find('iframe')[0].onload = function () {
                        dom.iframe = $(this.contentWindow.document.body);
                        dom.iframe.attr('parentlayerid', id);
                        dom.find('.ks-loading').remove();
                    };
                }
                if (option.closeBtn) {
                    //关闭事件 右上角按钮
                    dom.find('.ks-layer-close').click(function () {
                        _this.close();
                    });
                }
                //底部按钮处理
                if (option.btn) {
                    dom.find('.ks-layer-bottom > ks-btn').click(function () {
                        var t = $(this);
                        if (!t.disabled() && (!option.btnFun || (typeof (option.btnFun) == 'function' && option.btnFun.call(_this, t.data('btn-index'), dom) !== false))) {
                            option.cancel = t.data('btn-index') ==='cancel';
                            _this.close();
                        }
                    }).filter('ks-btn:last-child:not([color])').attr('color', 'primary');
                }

                //遮罩层点击关闭事件
                if (option.cover) {
                    if(option.coverClass){
                        option.coverClass = ' '+option.coverClass;
                    }
                    var cover = $('<div class="ks-layer-cover'+(option.coverClass ? option.coverClass : '')+'" data-layer-key="' + id + '" style="z-index: ' + (id - 1) + '"></div>');
                    _this.obj.coverDom = cover[0];
                    cover.css($.arrayMerge({
                        top : 0,
                        right : 0,
                        bottom : 0,
                        left : 0
                    }, $.isObject(option.cover) ? option.cover : {}));
                    if(option.cover >1){
                        var coverEvent = ($.isMobile ? 'touchend' : option.cover == 3 ? 'dblclick' : option.cover == 2 ? 'click' : '');
                        //触发事件
                        coverEvent && cover.on(coverEvent, function () {
                                _this.close();
                        });
                    }
                    _this.layer.after(cover);
                }
                //重新计算尺寸
                dom.layer = _this;
                //初始化回调
                $.isFunction(option.init) && option.init(dom, id);
            },
            sizeInit : function () {
                var style = {};
                //内容区最大高度处理
                var cententMaxH = $.H;
                if (option.title) {
                    cententMaxH -= this.layer.children('.ks-layer-title').height(true, true);
                }
                if (option.btn) {
                    cententMaxH -= this.layer.children('.ks-layer-bottom').height(true, true);
                }

                if (option.height) {
                    style.height = option.height;
                    //百分比值支持
                    if ($.strpos(style.height, '%')) {
                        style.height = cententMaxH * $.floatval(style.height) / 100;
                    }
                }
                if (option.maxHeight) {
                    style['max-height'] = option.maxHeight;
                    //百分比值支持
                    if ($.isString(style['max-height']) && style['max-height'].indexOf('%')) {
                        style['max-height'] = cententMaxH * $.floatval(style['max-height']) / 100;
                    }
                }

                if (option.width) {
                    style.width = option.width;
                    //百分比值支持
                    if ($.isString(style.width) && style.width.indexOf('%')) {
                        style.width = $.floatval(style.width);
                        style.width = ELSize.W * style.width / 100;
                    }
                }
                this.layer.children('.ks-layer-content').css(style);
            },
            show : function() {
                var _this = this;

                var pos = _this.obj.pos,
                    id = _this.ID;

                if (!$.isset(option.bodyOver) || option.bodyOver) {
                    $(EL).addClass('ks-body-layer-overflow');
                }
                this.layer.removeClass('ks-anim-hide').show();
                $(this.obj.coverDom).removeClass('ks-anim-fadeout').show();
                //延迟show 防止回调函数中click 同步响应
                window.setTimeout(function () {
                    layerAnim[pos] && _this.layer.addClass(layerAnim[pos]);
                    _this.layer.active(true);
                    //后退事件监听
                    option.backEvent && $.BackEvent('KsaLayer' + id, '#ks-layer-' + id);



                    //N秒自动关闭
                    if (option.outTime > 0) {
                        _this.autoCloseObj = setTimeout(function () {
                            _this.close();
                        }, option.outTime * 1000 + 50);
                    }
                    _this.pos();
                    _this.pos();
                    window.setTimeout(function(){
                        _this.pos();
                        //show回调函数
                        $.isFunction(option.show) && option.show(_this.layer, id);
                    }, 200);


                });



                //按ESC键处理
                $(document).off('keydown.ks-layer').on('keydown.ks-layer', function (e) {
                    if (e.keyCode == 27) {
                        //关闭浮动窗口
                        var o = $('.ks-layer').last();
                        if (o.length) {
                            $.layerHide(o.attr('key'));
                        }
                    }
                });
                return _this.layer;
            },
            //计算当前layer宽高并写入obj
            countSize : function(){
                this.obj.width = this.layer.width(true);
                this.obj.height = this.layer.height(true);
            }
        };


        return R.init();
    };

    /**
     * 对话框操作 (基于layer层)
     * 参数介绍：
     * 普通        参数：    1=标题 2=内容 3=自动关闭时间 4=按钮文字 5=按钮回调函数 6=关闭回调函数
     * 成功|失败|警告    参数：    1=success|error|warning|info 2=标题 3=提示信息 4=关闭回调函数 5=按钮文字
     * 确认框    参数：    1=confirm 2=标题 3=内容 4=确认回调函数 5=按钮文字
     * 表单框    参数：    1=form 2=标题 3=数据 4=确认回调函数 5=按钮文字
     */
    $.Dialog = function (type) {
        var p = arguments;
        var op = {class : 'ks-Dialog ks-Dialog'};
        switch (true) {
            //成功|失败 参数：2=内容 3=关闭回调函数 4=按钮文字
            case $.inArray(type, ['success', 'error', 'warning', 'info']):
                const btnTxtMap = {
                    'success' : {success:'好的:green'},
                    'error' : {error:'确认:orange'},
                    'warning' : {warning:'确认:red'},
                    'info' : {info:'好的:blue'}
                };
                const conf = {
                    title : p[1],
                    msg : '',
                    close : null,
                    btn : null
                }

                if(p[2] && $.isString(p[2])){
                    conf.msg = p[2]

                }else if(p[2] && $.isFunction(p[2])){
                    conf.close = p[2];
                    conf.btn = p[3];
                }
                if(!conf.msg || (type == 'warning' || type == 'error')){
                    conf.msg += '<p>本次提示时间：'+$.times(null, 'Y-m-d H:i:s')+'</p>';
                }
                if(!conf.btn){
                    conf.btn = btnTxtMap[type];
                }
                op.content = '<div class="_sys_title">'+conf.title+'</div><div class="_sys_message">'+conf.msg+'</div>';
                op.close = conf.close;

                op.btn = conf.btn;
                op.class += '_' + type+' ks-Dialog-systemMsg';
                op.closeBtn = 0;
                //op.outTime = 3;
                op.cover = type =='warning' || type == 'error' ? 1 : 2;
                op.backEvent = false;
                if(type == 'warning'){
                    if($.player){
                        op.show = function(){
                            $.player.play('warning', -1);
                        };
                        op.close = function(){
                            $.player.stop('warning');
                        };
                    }
                    op.coverClass = '_warning';
                }
                if(type == 'error' && $.player){
                    op.show = function(){
                        $.player.play('warning2', 1);
                    };
                    op.close = function(){
                        $.player.stop('warning2');
                    };
                }
                break;

            //确认 参数： 2=标题 3=内容 4=确认回调函数 5=按钮文字
            case type == 'confirm':
                var btn = p[4], callFun = p[3];
                btn = btn && $.isString(btn) ? {'confirm' : btn} : (btn || {'cancel' : '取消', 'confirm' : '确认:primary'});
                op.title = p[1];
                op.content = p[2];
                op.close = null;
                op.btn = btn;
                op.outTime = 0;
                op.cover = 1;
                op.maxWidth = '80%';
                op.btnFun = function (a, layer) {
                    if (a == 'confirm' && typeof (callFun) == 'function') {
                        return callFun.apply(layer, [layer]);
                    }
                };
                op.class += '_' + type;
                op.closeBtn = 0;
                break;
            /**
             * 带输入框的确认框 参数
             * 1=prompt
             * 2=标题
             * 3=输入框提示文字
             * 4=输入框内容
             * 5=回调函数
             * 6=附加类型（0=默认text 1=textarea 2=textarea自动增高 3=两次确认密码框 4=带旧密码的两次确认输入框）
             *
             */
            case type =='prompt':
                var callFun = p[4];
                op.title = p[1];
                var tpes = ['text','textarea','textarea','password'];
                var p6 = p[5] || 0;
                var ty = tpes[p6];
                var isArea = $.inArray(p6, [1,2]);
                if(isArea){
                    op.content = $.tag(ty, {type:'ks-'+ty, placeholder:p[2], auto: p6 == 2 }, p[3]);
                }else{
                    op.content = '';

                    op.content += $.tag('input', {type:'ks-'+ty, placeholder:p[2], value:p[3]}, '', true);
                    if(p6 == 3){
                        op.content += $.tag('input', {type:'ks-'+ty, placeholder:'再次输入新密码', class:'ks-mt3'}, '', true);
                        op.content += $.tag('input', {type:'ks-'+ty, placeholder:'请输入旧密码', name:'old', value:'', class:'ks-mt3'}, '', true);
                    }

                }

                op.close = null;
                op.btn = {'cancel' : '取消', 'confirm' : '确认:primary'};
                op.outTime = 0;
                op.cover = 1;
                op.maxWidth = '80%';
                op.btnFun = function (a, d) {
                    if (a == 'confirm' && typeof (callFun) == 'function') {
                        var inpt = d.find(isArea ? 'textarea' : 'input');
                        var val = inpt.eq(0).val();
                        val = val ? val : '';
                        if(p6 == 3){
                            var in2val = inpt.eq(1).val();
                            if(!val || !in2val || val !== in2val){
                                $.toast('请输入密码，且两次须相同');
                                return false;
                            }
                            var oldval = inpt.eq(2).val();
                            if(!oldval){
                                $.toast('请输入旧密码');
                                return false;
                            }
                            return callFun.apply(this, [val, oldval, d]);
                        }
                        return callFun.apply(this, [val, d]);
                    }
                };
                op.class += '_' + type;
                op.closeBtn = 1;
                if($.isMobile){
                    op.pos = '8';
                }
                break;
            /*表单弹窗 第三个参数：
            [
                {name:'字段名', type:'展现类型select/radio/checkbox/switch/text', text:'表单标题名称', value:'默认值', option:[多个选项列表键名=值 键值=名称]},
                ...
            ]
        */
            case type == 'form':
                var H = $.createForm(p[2]);
                var submitConfirm = p[2].confirm;

                var callFun = p[3];
                op.title = p[1];
                op.content = H;
                op.close = null;
                op.btn = {'cancel' : '取消', 'confirm' : (p[4] ? p[4] : '确认')};
                op.outTime = 0;
                op.cover = 1;
                op.btnFun = function (a, layer) {
                    function callf(){
                        if(p[2].action){
                            layer.find('form').formSubmit(function(res, sdt){
                                var callR;
                                if(callFun) {
                                    callR = callFun.apply(layer, arguments);
                                }

                                if(callR !== false && sdt.success){
                                    $.layerHide(layer.layerID);
                                }
                            });
                            return false;
                        }else{
                            if(callFun){
                                return callFun.apply(layer, [layer.find('form').formData(), layer]);
                            }
                        }
                    }

                    if (a == 'confirm') {
                        if(submitConfirm){
                            submitConfirm = submitConfirm === true ? '确认要进行该操作吗？' : submitConfirm;
                            $.Dialog('confirm', submitConfirm,  '', function(){
                                callf();
                                return true;
                            });
                            return false;
                        }else{
                            return callf();
                        }
                    }
                };
                op.class += '_' + type;
                op.closeBtn = 1;
                op.maxHeight = '100%';
                op.show = function (layer) {
                    layer.find('form').submit(function (e) {
                        e.stop();
                        /*
                        var ts = this;
                        $(ts).formSubmit(function (d, sdt) {
                            callFun && callFun.apply(ts, arguments);
                            if (sdt.success) {
                                $.layerHide(layer.layerID);
                            }
                        });

                         */
                    });
                };
                op.pos = 5;
                if($.isMobile){
                    op.pos = 8;
                    op.width = '100%';
                }
                break;
            case type == 'smscode' :
                var param = p[2];
                op.title = '请输入短信验证码';
                op.content = '';
                if(p[1]){
                    op.content += '<div class="ks-mb">'+p[1]+'</div>';
                }
                op.content += '<div><ks-input-group><input type="ks-text" name="code" value="" placeholder="请输入"><ks-btn>重新发送</ks-btn></ks-input-group></div>';
                var callData = {};
                op.init = function(ly){
                    var btn = ly.find('.ks-layer-content ks-btn');
                    var input = ly.find('input[name=code]');
                    var _send = function(){
                        if(btn.disabled()){
                            return;
                        }

                        btn.disabled(true).text('发送中');
                        $.API(param.api, param.post, function(res){
                            if(res.success){
                                input.val('');
                                callData = res;
                                var sendTime = res.sendTime;
                                sendTime --;
                                btn.disabled(true).text('重新发送('+sendTime+'秒)');
                                ly.layer.pos();
                                var s =window.setInterval(function(){
                                    if(sendTime === 0 ){
                                        window.clearInterval(s);
                                        btn.disabled(false).text('重新发送');
                                        ly.layer.pos();
                                    }else{
                                        sendTime --;
                                        btn.disabled(true).text('重新发送('+sendTime+'秒)');
                                    }
                                }, 1000);
                            }else{
                                btn.disabled(false).text('重新发送');
                            }
                        }, function(){
                            btn.disabled(false).text('重新发送');
                        });
                    }
                    btn.click(_send);
                    _send();
                }
                var callFun = p[3];
                op.btn = {cancel:'取消', confirm:'确认'};
                op.btnFun = function(a, ly){
                    var input = ly.find('input[name=code]');
                    if (a == 'confirm' && typeof (callFun) == 'function') {
                        callData.code = input.val() || '';
                        if(!callData.code){
                            $.toast('请输入短信验证码');
                            return false;
                        }
                        return callFun.call(ly, callData);
                    }
                };
                op.cover = 1;
                break;
            //默认 参数： 1=标题 2=内容 3=自动关闭时间 4=按钮文字 5=按钮回调函数 6=关闭回调函数
            default:
                op.title = p[0];
                op.content = p[1];
                op.outTime = p[2];
                op.btn = p[3];
                op.btnFun = p[4];
                op.close = p[5];
                op.cover = 1;
                op.pos = 5;
                break;
        }
        return $.layer(op);
    };

    /**
     * mini提示框
     * @param {html} msg 提示内容
     * @param {success/error/info/warning} tps 状态 info=普通 success=成功 error=错误 warning=系统警告
     * @param {func} callFun 窗口关闭后回调函数
     * @param {number} outTime 关闭时间(秒) 0=一直显示
     * @returns {k.fn.init}
     */
    $.toast = function (msg, tps, callFun, outTime) {
        $.toastHide();
        outTime = typeof (outTime) == 'undefined' ? 2 : outTime;
        if(msg == 'loading' && !tps){
            tps == msg;
            msg = '请稍后...';
        }
        if (!tps) {
            tps = 'info';
        }
        if(tps == 'loading' || tps == 'warning'){
            outTime = 0;
        }
        return $.layer({
            content : msg,
            pos : 5,
            class : 'ks-Dialog_toast',
            type : tps,
            cover : tps == 'loading' ? 1 : 2,
            close : callFun,
            outTime : outTime,
            backEvent : false,
            bodyOver : false,
            cancel : false,
            show(dom){
                if(outTime == 0 && tps != 'loading'){
                    dom.click(function(){
                        dom.layer.close();
                    });
                }
            }
        });
    };
    $.toastHide = function(){
        //移除所有toast
        $('.ks-layer.ks-Dialog_toast + .ks-layer-cover').remove();
        $('.ks-layer.ks-Dialog_toast').remove();
    }

    /**
     * 创建一个新的全屏页面
     * @param option 参数同layer
     */
    $.openWindow = function (option) {
        var h = '<div class="ks-hdbar">';
        if (option.backBtn === null || option.backBtn !== false) {
            h += '<span icon="back" onclick="window.history.go(-1);"></span>';
        }
        h += '<div class="ks-hdbar-title">' + option.title + '</div>';
        h += '</div>';

        return this.layer($.arrayMerge(option, {
            title : h,
            content : option.content || '<div class="layer-loading"><i icon="loading"></i>加载中</div>',
            width : '100%',
            height : '100%',
            maxHeight : false,
            pos : '00',
            class : 'openWindow'
        }));
    };


    /**
     * 将各种日期/时间戳转换为对象
     * @param str 带格式的日期/时间戳
     * @param F 需要输出的格式(存在则输出日期，否则输出对象) Y-m-d H:i:s || Y年m月d日 H:i:s等
     * @returns {object} {Y: number, m: number, d: number, H: number, i: number, s: number}
     */
    $.times = function (str, F) {
        if ($.isNumber(str) && $.inArray($.strlen(str), [10, 13])) {
            if (str.length == 10) {
                str = str * 1000;
            }
            str = parseInt(str);
        }
        if (typeof (str) == 'string') {
            str = str.replace(/年|月/g, '-');
            str = str.replace(/时|分|点/g, ':');
            str = str.replace(/日|秒/g, '');
        }

        var date = str ? new Date(str) : new Date();
        var obj = {
            'Y' : date.getFullYear(),
            'm' : (date.getMonth() + 1),
            'd' : date.getDate(),
            'H' : date.getHours(),
            'i' : date.getMinutes(),
            's' : date.getSeconds(),
            'str' : '',
            'timestamp' : date.getTime()
        };
        obj.str = obj.Y + '-' + obj.m + '-' + obj.d + ' ' + obj.H + ':' + obj.i + ':' + obj.s;
        $.loop(obj, function (val, k) {
            obj[k] = val < 10 ? ('0' + val) : val;
            F && (F = F.replace(k, obj[k]));
        });
        return F ? F : obj;
    };

    //指定月份多少天
    $.days = function (y, m) {
        return new Date(y, m, 0).getDate();
    };

    //指定日期星期几
    $.week = function (y, m, d) {
        var w = new Date(y + '-' + m + '-' + d).getDay();
        return w == 0 ? 7 : w; //周日序号为7
    };

    /**
     * 将文件字节数转换为容量单位
     * @param bytes int 字节数
     * @param decimals 保留小数点
     * @returns {string}
     */
    $.byte2str = function(bytes, decimals = 0) {
        if (bytes === 0) return '0 字节';

        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['字节', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * 货币转换
     * @param value string 需要转换的数字
     * @param symbols string 追加的符号
     * @returns {string}
     */
    $.currency = function (value='', symbols='') {
      const parts = value.toString().split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return symbols + parts.join('.');
    }
    /**
     * 颜色处理 RGBA 转 HEX
     * @param rgba
     * @returns {string}
     */
    $.rgba2hex = function(rgba){
        // 将r、g、b、a映射到0-255的整数范围内
        let hex = [
            Math.round(rgba.r).toString(16),
            Math.round(rgba.g).toString(16),
            Math.round(rgba.b).toString(16)
        ];
        // 确保每个部分都是两位数
        hex.map(function(str, i) {
            if (str.length == 1) {
                hex[i] = '0' + str;
            }
        });

        // 如果透明度小于255，将其添加到颜色代码中
        if (rgba.a < 1) {
            // 将alpha通道映射到0-255的整数范围内
            let alpha = Math.round(rgba.a * 255).toString(16);
            hex.push(alpha);
        }
        return hex.join('');
    }
    /**
     * 颜色处理 将HEX解析为RGBA
     * @param hex
     * @returns {{a: number, r: number, b: number, g: number}}
     */
    $.hex2rgba = function (hex) {
        // 移除可能存在的 # 符号
        hex = hex.replace(/^#/, '');

        // 将颜色代码分解为r、g、b和alpha（如果存在）部分
        var r, g, b, a;

        if (hex.length === 3) {
            // 处理缩写的颜色代码（例如：#RGB）
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
            a = 1; // 默认alpha为1（不透明）
        } else if (hex.length === 6) {
            // 处理完整的颜色代码（例如：#RRGGBB）
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            a = 1; // 默认alpha为1（不透明）
        } else if (hex.length === 8) {
            // 处理包含alpha的颜色代码（例如：#RRGGBBAA）
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
            a = parseInt(hex.slice(6, 8), 16) / 255; // 将alpha转换为0-1范围
        } else {
            // 非法的颜色代码
            throw new Error('无效的颜色代码');
        }

        // 返回RGBA对象
        return { r, g, b, a };
    }
    /**
     * 颜色处理 将hex转为hsb
     * @param hex
     * @returns {{a: number, b: number, s: number, h: number}}
     */
    $.hex2hsb = function(hex){
        return this.rgba2hsb(this.hex2rgba(hex));
    }


    /**
     * 颜色处理 将RGBA颜色转换为HSB颜色
     * @param r
     * @param g
     * @param b
     * @param a
     * @returns {{a: number, b: number, s: number, h: number}}
     */
    $.rgba2hsb = function(rgba) {
        // 确保颜色分量在0-255范围内
        let r = Math.min(255, Math.max(0, rgba.r));
        let g = Math.min(255, Math.max(0, rgba.g));
        let b = Math.min(255, Math.max(0, rgba.b));
        let a = rgba.a >=0 ? rgba.a : 1;

        // 计算最大值和最小值
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);

        // 计算亮度（brightness）
        var brightness = (max / 255) * 100;

        var hue, saturation;

        if (max === 0) {
            // 如果最大值为0，则饱和度为0，色调无意义
            saturation = 0;
            hue = 0; // 任何值都可以
        } else {
            // 计算饱和度
            saturation = ((max - min) / max) * 100;

            // 计算色调
            if (max === r) {
                hue = (60 * ((g - b) / (max - min)) + 360) % 360;
            } else if (max === g) {
                hue = (60 * ((b - r) / (max - min)) + 120) % 360;
            } else {
                hue = (60 * ((r - g) / (max - min)) + 240) % 360;
            }
        }

        // 返回HSB颜色对象
        return { h: hue, s: saturation, b: brightness, a: a };
    };

    /**
     * 颜色处理 将HSB颜色转换为RGBA颜色
     * @param hsb
     * @returns {{a: number, r: number, b: number, g: number}}
     */
    $.hsb2rgba = function(hsb={}) {
        var rgba = {}; // 改为RGBA对象
        h = Math.round(hsb.h);
        s = Math.round(hsb.s * 255 / 100);
        b = Math.round(hsb.b * 255 / 100);
        a = hsb.a >= 0 ? hsb.a : 1; // 添加Alpha通道，默认为1

        if (s == 0) {
            rgba.r = rgba.g = rgba.b = b;
        } else {
            var t1 = b;
            var t2 = (255 - s) * b / 255;
            var t3 = (t1 - t2) * (h % 60) / 60;

            if (h == 360) h = 0;

            if (h < 60) {
                rgba.r = t1;
                rgba.b = t2;
                rgba.g = t2 + t3;
            } else if (h < 120) {
                rgba.g = t1;
                rgba.b = t2;
                rgba.r = t1 - t3;
            } else if (h < 180) {
                rgba.g = t1;
                rgba.r = t2;
                rgba.b = t2 + t3;
            } else if (h < 240) {
                rgba.b = t1;
                rgba.r = t2;
                rgba.g = t1 - t3;
            } else if (h < 300) {
                rgba.b = t1;
                rgba.g = t2;
                rgba.r = t2 + t3;
            } else if (h < 360) {
                rgba.r = t1;
                rgba.g = t2;
                rgba.b = t1 - t3;
            } else {
                rgba.r = 0;
                rgba.g = 0;
                rgba.b = 0;
            }
        }

        return { r: Math.round(rgba.r), g: Math.round(rgba.g), b: Math.round(rgba.b), a: a };
    };

    /**
     * 颜色处理 RGBA对象转字符串
     * @param rgba object 必须的格式 {r:0, g:0, b:0, a:1}
     * @returns {string}
     */
    $.rgba2str = function(rgba){
        return 'rgba(' + rgba.r + ',' + rgba.g + ',' + rgba.b + ',' + rgba.a + ')';
    }


    /**
     * AJAX请求
     * @param {url} url 请求地址（末尾自动追加ajax=1）
     * @param {json} postdata POST数据 json格式 不传则发起GET请求
     * @param {func} fun 回调函数(API必须返回result字段) 参数1=result值, 参数2=原始返回
     * @param {func} errfun 请求错误时的回调函数(通讯不畅、非标准API返回等底层级错误返回)
     * @param {string} datatype 请求结果数据格式 (默认json)
     * @param {type} isBflow 是否为数据流（上传文件）
     * @returns {Boolean}
     */
    $.API = function (url, postdata, fun, errfun, datatype, isBflow) {
        datatype = datatype ? datatype : 'json';
        url = $.urlAdd(url, {ajax:1});
        fun = fun ? fun : new Function();
        errfun = errfun ? errfun : new Function();
        var option = {
            type : postdata ? 'POST' : 'GET',
            url : url,
            dataType : datatype,
            data : postdata,
            success : function (s) {
                if (s && typeof (s) == 'object') {
                    //成功回调函数 只在API返回result字段时回调
                    if ($.isset(s.result)) {
                        if (s.result.KSAUI) {
                            if(s.result.KSAUI.type == 'Dialog'){

                                s.result.KSAUI.param.push(function(s){
                                    return fun ? fun(s) : true;
                                });

                                $.Dialog.apply('', s.result.KSAUI.param)
                            }else{
                                $[s.result.KSAUI.type].apply('', s.result.KSAUI.param)
                            }

                        }
                        if ($.isset(s.msg) && s.msg) {
                            if(s.confirm){
                                $.Dialog('confirm',  '提示信息', s.msg, function () {
                                    fun(s.result, s);
                                    if (s.success && s.locationUrl) {
                                        window.location.href = s.locationUrl;
                                    }
                                }, '确认');
                            }else{
                                if (s.success) {
                                    $.toast(s.msg, 'success', function () {

                                        if (s.success && s.locationUrl) {
                                            window.location.href = s.locationUrl;
                                        }
                                    });
                                } else {
                                    $.toast(s.msg, 'error');
                                }
                                fun(s.result, s);
                            }
                        }else{
                            fun(s.result, s);
                        }

                    } else {
                        console.log('%cKSAUI-AJAX-ERROR API异常返回！URL：' + url + "\n", 'background:#f00; color:#fff', s);//debug
                        errfun(s);
                    }



                } else {
                    $.toast('error', 'ajax远端系统错误');
                }
            },
            error : function (s) {
                console.log('%cKSAUI-AJAX-ERROR (Code:' + s.status + ')', 'background:#f00; color:#fff', 'URL:' + url);//debug
                $.toast('ajax远端系统错误', 'error');
                if (typeof (errfun) === 'function') {
                    errfun(s);
                }
            }
        };
        if (isBflow) {
            option.processData = false;
            option.contentType = false;
            if($.isFunction(isBflow)){
                option.progress = isBflow;
            }
        }
        $.ajax(option);
        return false;
    };

    /**
     * AJAX url 并弹出一个远端内容框
     * @param {type} tit
     * @param {type} url
     * @returns {undefined}
     */
    $.ajaxWin = function (tit, url) {
        return $.API(url, '', function (data) {
            $.layer({
                title : tit,
                content : data,
                cover : 1
            });
        });
    };

    /**
     * 表单AJAX提交
     * 实例化后使用
     * @param {type} callFun 回调函数
     * @returns {Boolean}
     */
    $.plugin.formSubmit = function (callFun) {
        var ths = this, obj = ths.eq(0);
        if(!obj.length){
            return false;
        }
        var confirmTxt = obj.attr('confirm');
        if(confirmTxt ===''){
            confirmTxt = '确认要提交该信息吗？';
        }
        var loadingLayerID;

        var _submit = function(){
                var btn = obj.find('button[type=submit], input[type=submit], ks-btn[submit]');
                var btnTxt = btn.html();
                btn.addClass('btn-load').disabled(true).text(btnTxt);
                var formData = obj.formData(true);
                if (obj.attr('id')) {
                    formData.append('FORMID', obj.attr('id'));
                }
                loadingLayerID = $.toast('请稍后','','','',0).id;
                $.API($.urlAdd(obj.attr('action'), 'formsubmit=true'), formData, function (dt, sdt) {
                    $.layerHide(loadingLayerID);
                    btn.removeClass('btn-load').disabled(false).html(btnTxt);
                    //如果回调函数返回false则直接跳出
                    if (callFun && callFun.apply(obj[0], arguments) === false) {
                        return false;
                    }
                    //如果当前是一个iframeLayer 则关闭当前layer
                    if($.isObject(dt) && sdt.success && $('body').attr('parentlayerid')){
                        $.layerHideF();
                        window.parent.$.layerHide(loadingLayerID);
                    }
                }, function () {
                    $.layerHide(loadingLayerID);
                    btn.removeClass('btn-load').disabled(false).html(btnTxt);
                }, 'json', 1);

                //30秒后解除提交按钮限制
                setTimeout(function () {
                    btn.removeClass('btn-load').disabled(false).html(btnTxt);
                    $.layerHide(loadingLayerID);
                }, 30 * 1000);
        }
        if(confirmTxt){
            $.Dialog('confirm', '操作提示', confirmTxt, _submit);
        }else{
            _submit();
        }


        return false;
    };

    /**
     * 快速上传函数
     * @param {string} name 传递给后端的表单名称
     * @param {document} files inputDOM 或 input.files对象
     * @param {url} url 上传地址
     * @param {func} callFun 上传后回调函数
     * @param {func} progressFunc 上传进度回调函数
     * @param {func} errFunc 上传错误回调函数
     */
    $.upload = function (name, files, url, callFun, progressFunc, errFunc) {
        name = name ? name : 'upload';
        var formData = new FormData();
        if(files instanceof Blob) {
            formData.append(name, files);
        }else{
            files = files.files;
            if (files.length > 1 && name.indexOf('[]') === -1) {
                name += '[]';
            }
            $.loop(files, function (val) {
                if (val.size && val.type) {
                    formData.append(name, val);
                }
            });
        }


        this.API(url, formData, function (data) {
            callFun(data);
        }, errFunc, 'json', progressFunc ? progressFunc : 1);
    };

    /**
     * html标签生成
     * 属性值不存在则不输出对应属性
     * @param {string} tp 标签名称 div/span/input
     * @param {json} dt 属性数据 {class:'test',type:'text'}
     * @param {html} txt 附加在标签中或者后面的html
     * @param {string} ed 是否不需要结尾 input等传入1
     * @returns {string} 返回一个标签html源码
     */
    $.tag = function (tp, dt, txt, ed) {
        var h = '<' + tp;
        $.loop(dt, function (v, k) {
            v = v === undefined ? null : v;
            v = v === true ? k : v;
            h += k && v != null ? (' ' + k + '="' + v + '"') : '';
        });
        h += '>' + (txt ? txt : '');
        if (!ed) {
            h += '</' + tp + '>';
        }
        return h;
    };


    /**
     * 初始化选择列表
     * dom结构 <ul class="ks-list"><li value="选项1-值" text="选项名称(可选)">选项1</li></ul>
     * 必须通过KSUI('xx')选择器调用
     * @param callFun 回调函数 参数1=当前值 参数2=当前文字 参数3=当前值数据 参数4=当前item对象 参数5=当前event
     */
    $.plugin.listSelect = function (callFun) {
        var $this = this;
        var isMultiple = $.isset($this.attr('multiple'));

        $this.find('ks-list-item').click(function (e) {
            if ($this.disabled()) {
                return;
            }
            var T = $(this);
            //如果当前已选择或禁用状态则不做任何响应
            if (T.hasClass('ks-select-optgroup-title') || T.disabled()) {
                return false;
            }

            //多选下拉菜单
            if (isMultiple) {
                if (T.selected()) {
                    T.selected(false);
                } else {
                    T.selected(true);
                }
            } else {
                T.selected(true).siblings().selected(false);
            }
            var txtM = {};
            $this.find('ks-list-item[selected]').each(function (_, l) {
                l = $(l);
                txtM[l.attr('value')] = T.attr('_text') || T.attr('text') || T.text();
            });
            //值回调
            $.isFunction(callFun) && callFun(T.attr('value'), (T.attr('_text') || T.attr('text') || T.text()), txtM, T, e);
            return false;
        });
        return this;
    };


    /**
     * 将select元素 或者 selectJSON 转为渲染后的html
     * @param element  select元素 或者 selectJSON
     * @param multiple 是否多选
     * @returns {[H|*|jQuery|HTMLElement, *, string]}
     */
    $.selectToHtml = function (element, multiple) {
        var data, defvalue, select, Nums = 0;
        //如果传入的是json数据
        if ($.isObjectPlain(element)) {
            data = element;
            defvalue = element.value;
            multiple = $.isset(multiple) ? multiple : element.multiple;
        } else if ($.isArray(element)) {
            data = element;
        } else {
            select = $(element);
            multiple = select.prop('multiple');
            defvalue = select.val();
            data = option2json(select);
        }

        function _isSelected(v) {
            return (($.isArray(defvalue) && $.inArray(v, defvalue)) || ($.isObjectPlain(defvalue) && $.isset(defvalue[v])) || v === defvalue);
        }

        //将select元素转为JSON数据
        function option2json(o) {
            var n = 0, dt = [];
            o.children().each(function (i, t) {
                t = $(t);
                var attr = t.attr();
                var v = {
                    value : attr.value || '',
                    title : attr.title || '',
                    text : t.text() || '',
                    showtitle : attr.showtitle || '',
                    selected : _isSelected(attr.value) ? true : '',
                    disabled : t.disabled() || '',
                    icon : attr.icon || '',
                    style : attr.style || '',
                    n : Nums
                };

                if (t[0].tagName == 'OPTGROUP') {
                    v.text = attr.label || '';
                    v.option = option2json(t);
                } else {
                    Nums++;
                }
                dt[n] = v;
                n++;
            });
            return dt;
        }

        //将JSON数据转换为HTML菜单列表
        function options(dt) {
            var h = '';
            $.loop(dt, function (value, key) {
                if (value.option) {
                    h += '<ks-list-item class="ks-select-optgroup-title"><strong>' + (value.text) + '</strong><ks-list class="ks-list-select" ' + (multiple ? ' multiple="multiple"' : '') + '>' + options(value.option) + '</ks-list></ks-list-item>';
                } else {
                    if (!$.isObject(value) && !$.isArray(value)) {
                        value = {value : key, text : value, selected : _isSelected(key)}
                    }
                    h += $.tag('ks-list-item', {
                        selected : value.selected ? 'selected' : '',
                        disabled : value.disabled,
                        icon : value.icon,
                        style : value.style,
                        title : value.title,
                        value : value.value,
                        n : value.n,
                        _text : value.showtitle || value.text
                    }, value.text);
                }
            });
            return h;
        }

        return [select, multiple, '<ks-list class="ks-list-select" ' + (multiple ? ' multiple="multiple"' : '') + '>' + options(data) + '</ks-list>'];
    };


//将JSON数据转换为HTML菜单列表
    function select_json_html(dt, defvalue, multiple) {
        var h = '';
        var dtArr = $.isArray(dt);
        var isSelected = false;
        $.loop(dt.option, function (value, key) {
            if (!value.option) {
                if(!multiple && value.selected){
                    defvalue = [value.value];
                    return true;
                }
            }
        });

        $.loop(dt.option, function (value, key) {
            if (value.option) {
                h += '<ks-list-item class="ks-select-optgroup-title"><strong>' + (value.label) + '</strong>' + select_json_html(value, defvalue, multiple) + '</ks-list-item>';
            } else {
                //不是对象 则认为值是字符串
                if (!$.isObject(value)) {
                    value = {value : dtArr ? value : key, label : value}
                }
                if (defvalue && $.inArray(value.value, defvalue)) {
                    value.selected = true;
                }
                if (!value.selected) {
                    value.selected = null;
                }
                var txt = $.isset(value.label) ? value.label : value.content;
                delete value.content;
                h += $.tag('ks-list-item', value, txt);
            }
        });
        return '<ks-list class="ks-list-select" ' + (multiple ? ' multiple="multiple"' : '') + '>' + h + '</ks-list>';
    };

    function select_html_json(select, defValue, Nums) {
        Nums = Nums || 0;
        select = $(select);

        defValue = Nums === 0 ? select.val() : defValue;
        var json = select.attr() || {};
        json.option = [];
        select.children().map(function (el) {
            var v;
            if (el.tagName == 'OPTGROUP') {
                v = select_html_json(el, defValue, Nums);
            } else {
                v = $(el).attr() || {};
                v.n = Nums;
                v.selected = !!el.selected;
                v.content = el.text;
                Nums++;
            }
            json.option.push(v);
        });
        return json;
    };

    /**
     * select下拉菜单模拟
     * 触发函数
     * @param {selector} btn 触发元素dom
     * @param {json/array} data：
     ------------ JSON格式 -------------
     {
	value : '默认值', // ['默认值1','默认值2']
	multiple : 1, //是否多选
	option : [ //列表数据
	  {
		  value   :   值 必须
		  label   :   选项名称 可选
		  selected:   是否选中 可选
		  disabled:   是否禁用 可选
		  icon    :   图标名称 可选
		  style   :   样式 可选
		  option    : { //子级(如果需要) 类似select的optgroup标签
			  值同上
		  }
	  },
	  第二组,
	  第三组,
	  ...
	]
}
     ------------ Array格式 -------------
     ['名称1','名称2']

     ------------ JSON简要格式 -------------
     {key:value, key2:value2, ...}

     * @param {func} callFun 每项点击后的回调函数 1=值 2=text 3=多选值列表
     * @param {boolean} multiple 是否多选(data=select时根据元素属性自动判断)
     * @param {json} layerOption layer配置参数
     */
    $.plugin.showSelect = function (data, callFun, multiple, layerOption) {
        var btn = $(this[0]), isBtnInput = this[0].tagName === 'INPUT';
        //触发按钮被禁用时不响应
        if (btn.disabled()) {
            return;
        }

        var layerID = btn.data('layer-id');

        function _close() {
            layerID && $.layerHide(layerID);
            btn.removeData('layer-id').active(false);
        }

        //如果选择窗口存在 则关闭
        if (layerID) {
            _close();
            return;
        }
        multiple = data.multiple;

        if (isBtnInput && !data.option) {
            data = {
                value : [btn.val()],
                option : data
            };
            //简要格式支持
        } else if (!data.option) {
            data = {option : data};
        }
        data.value = data.value && !$.isArray(data.value) ? [data.value] : data.value;
        layerOption = layerOption || {};
        layerOption = $.arrayMerge({
            title : data.label ? (data.title || data.label) : false, //弹窗标题
            pos : $.isMobile ? '8' : btn,
            cover : $.isMobile ? 2 : 0,
            content : select_json_html(data, data.value, data.multiple),
            closeBtn : 0,
            bodyOver : false, //body不需要裁切
            init : function (layer) {
                if (!layer.layerID) {
                    return;
                }
                layerID = layer.layerID;
                btn.data('layer-id', layerID).active(true);
                var d = layer.find('.ks-layer-content');
                //自动定位到已选择区域
                if (d.find('ks-list-item[selected]').length) {
                    d.scrollTop(d.find('ks-list-item[selected]').eq(0).offset().top - d.offset().top - d.find('ks-list-item').eq(0).height());
                }
                //选项点击事件
                $(d.find('.ks-list-select')).listSelect(function (val, txt, valdt, T, e) {
                    e.stopPropagation();//阻止冒泡
                    //多选下拉菜单
                    if (multiple) {
                        txt = '';
                        d.find('ks-list-item[selected]').each(function (i, l) {
                            txt += '<span>' + l.innerHTML + '</span>';
                        });
                        txt = txt ? txt : '请选择';
                    }

                    //触发按钮输出text
                    isBtnInput && btn.val(txt);
                    //选择后回调函数
                    callFun && callFun.call(T, val, txt, valdt, T, e);
                    //单选框选择后关闭pop层
                    if (!multiple) {
                        _close();
                    }
                });
            },
            show : function (layer) {
                layerID = layer.layerID;
                if(!$.isMobile){
                    //监听点击事件 自动关闭
                    $(document).on('click.KSAUI-select', function (e) {
                        //debug('关闭select', !$.inArray(e.target, [btn[0], layer[0]]), e);
                        if (!$.inArray(e.target, [btn[0], layer[0]])) {
                            $(document).off('click.KSAUI-select');
                            _close();
                        }
                    });
                }
            },
            hide : _close
        }, layerOption, {class : 'ks-layer-select'});
        $('.ks-layer-select').remove();
        var Lay = $.layer(layerOption);
        layerID = Lay.id;
        return Lay;
    };

    /**
     * 弹出一个日期输入框
     * @param target 触发表单
     * @param format 日期格式 必须为：YmdHis 区分大小写随意组合顺序
     * @param callFun 回调函数
     */
    $.showDate = function (target, format, callFun) {
        var $this = this;
        target = $(target);
        var input = target[0] && target[0].tagName == 'INPUT' ? target : null;
        if (target.data('layer-id')) {
            $.layerHide(target.data('layer-id'));
            return;
        }
        format = format ? format : (target.attr('format') || 'Y-m-d H:i');
        var defYmd = input ? input.val() : target.attr('value');
        //class名称
        var cl = {
            a : 'ks-calendar',
            b : 'ks-calendar-t',
            c : 'ks-calendar-ul',
            d : 'ks-calendar-b',
            e : 'ks-calendar-time',
        };
        //格式判断
        var isy = format.indexOf('Y') != -1, //是否需要年月日
            ismd = format.indexOf('m') != -1 && format.indexOf('d') != -1,
            isymd = isy && ismd,
            isHi = format.indexOf('H') != -1 && format.indexOf('i') != -1,
            isHis = isHi && format.indexOf('s') != -1;

        function monthHtml(str) {
            str = str && !ismd ? defYmd + ' ' + str : str;
            var dt = $this.times(str);
            if (!dt.Y || !dt.m) {
                return;
            }
            //上个月
            var Html = '',
                ly = dt.Y, //今年值
                lm = parseInt(dt.m) - 1; //上月值
            if (lm < 1) {
                lm = 12;
                ly--;
            }

            var lastDay = $this.days(ly, lm),
                week = $this.week(ly, lm, lastDay);

            //天数排列
            Html += '<em>一</em><em>二</em><em>三</em><em>四</em><em>五</em><em>六</em><em>日</em>';
            //上月处理
            var u = 0;
            for (var i = (lastDay - week + 1); i <= lastDay; i++) {
                Html += '<i class="_" data-value="' + ly + '-' + lm + '-' + i + '">' + i + '</i>';
                u++;
            }
            //当月天数
            for (var i = 1; i <= $this.days(dt.Y, dt.m); i++) {
                Html += '<i class="' + (i == dt.d ? ' a' : '') + '" data-value="' + dt.Y + '-' + dt.m + '-' + i + '">' + i + '</i>';
                u++;
            }
            //下月天数补偿 让日历始终显示6周 42天
            u = (42 - u);
            if (u > 0) {
                var ny = dt.Y, nm = dt.m;
                nm++;
                if (nm > 12) {
                    nm = 1;
                    ny++;
                }
                for (i = 1; i <= u; i++) {
                    Html += '<i class="_" data-value="' + ny + '-' + nm + '-' + i + '">' + i + '</i>';
                }
            }
            dt.html = Html;
            return dt;

        }


        var dt = monthHtml(defYmd);
        var TimeHtml = '';
        if (isHi) {
            TimeHtml = '<div class="' + cl.d + ' ks-clear">';
            TimeHtml += '<div class="' + cl.e + '">';
            TimeHtml += '<div><input type="ks-number" value="' + dt.H + '" min="0" max="23"></div>';
            TimeHtml += '<div>:</div>';
            TimeHtml += '<div><input type="ks-number" value="' + dt.i + '" min="0" max="59"></div>';
            if (isHis) {
                TimeHtml += '<div>:</div>';
                TimeHtml += '<div><input type="ks-number" value="' + dt.s + '" min="0" max="59"></div>';
            }

            TimeHtml += '</div>';
                TimeHtml += '<ks-btn color="primary">确认</ks-btn>';
            TimeHtml += '</div>';
        }

        var H = '<div class="' + cl.a + '" data-y="' + dt.Y + '" data-m="' + dt.m + '" data-d="' + dt.d + '">';
        if (isymd) {
            H += '<div class="' + cl.b + '"><i icon="arrow-left-s-fill"></i><i icon="arrow-left-s"></i><em>' + dt.Y + '年</em><em>' + dt.m + '月</em><i icon="arrow-right-s"></i><i icon="arrow-right-s-fill"></i></div><div class="' + cl.c + '">' + dt.html + '</div>';
        }
        H += TimeHtml;
        H += '</div>';

        $.layer({
            cover : !!$.isMobile,
            pos : $.isMobile ? 8 : target,
            width : $.isMobile ? '100%' : null,
            content : H,
            closeBtn : 0,
            bodyOver : false,
            show : function (layer) {
                target.data('layer-id', layer.layerID);
                //将dom pop对象转为子级日历
                var dom = layer.find('.' + cl.a);
                //阻止冒泡
                layer.click(function (e) {
                    e.stopPropagation();
                    return false;
                });
                if($.isMobile){
                    layer.find('.ks-layer-content').css('padding','0');
                    layer.find('.ks-calendar').css('width','100%');
                }

                //获取当前日历生成的时间并写入到触发对象中
                function sput() {
                    var v = defYmd;
                    if (format.indexOf('m') != -1) {
                        v = dom.find('.' + cl.c + ' i.a').data('value');
                    }
                    if (isHi) {
                        var b = dom.find('.' + cl.e + ' input');
                        if (b.length) {
                            v += ' ' + b.eq(0).val() + ':' + b.eq(1).val();
                            if (isHis) {
                                v += ':' + b.eq(2).val();
                            }
                        }
                    }
                    var h = $this.times(v);
                    v = format.replace('Y', h.Y).replace('m', h.m).replace('d', h.d).replace('H', h.H).replace('i', h.i).replace('s', h.s);
                    if(input) {
                        input.val(v);
                        input.trigger('input').trigger('change');
                    }
                    target.attr('value', v);
                    callFun && callFun(v);
                    return v;
                }

                //日 点击事件
                function ulevent() {
                    dom.find('.' + cl.c + ' i').click(function () {
                        $(this).addClass('a').siblings().removeClass('a');//当前高亮
                        !isHi && sput();//写值
                        //如果没有时分秒操作栏 则直接关闭当前窗口
                        if (!dom.find('.' + cl.d).length) {
                            $.layerHide(layer.layerID);
                        }
                        return false;
                    });
                }

                ulevent();
                //标题栏年月按钮事件
                dom.find('.' + cl.b + ' i').click(function () {
                    var N = $(this).index();
                    var y = parseInt(dom.data('y')), m = parseInt(dom.data('m')), d = parseInt(dom.data('d'));
                    //切换上一年
                    if (N == 0) {
                        y--;
                        //切换下一年
                    } else if (N == 5) {
                        y++;
                        //切换上月
                    } else if (N == 1) {
                        m--;
                        if (m < 1) {
                            m = 12;
                            y--;
                        }
                    } else if (N == 4) {//切换下月
                        m++;
                        if (m > 12) {
                            m = 1;
                            y++;
                        }
                    }
                    dom.data({y : y, m : m});
                    var em = $(this).siblings('em');
                    em.eq(0).text(y + '年');
                    em.eq(1).text(m + '月');
                    dom.find('.' + cl.c).html(monthHtml(y + '-' + m + '-' + d).html);
                    ulevent();
                    return false;
                });
                //确认按钮
                dom.find('ks-btn').click(function () {
                    sput();//写值
                    $.layerHide(layer.layerID);
                    return false;
                });

                layer.hover(function () {
                    target.attr('ks-date-show', 1);
                }, function () {
                    target.removeAttr('ks-date-show');
                });
                input && input.blur(function () {
                    !$(this).attr('ks-date-show') && $.layerHide(layer.layerID);
                });

                //监听点击事件 自动关闭
                $(document).on('click.KSAUI-showdate', function (e) {
                    if (!$.inArray(e.target, [target[0], layer[0]])) {
                        $(document).off('click.KSAUI-showdate');
                        $.layerHide(layer.layerID);

                    }
                });
            },
            close : function () {
                target.removeData('layer-id');

            }
        });
    };
    /**
     * 弹出菜单
     * @param {document} obj 触发元素
     * @param {html/document} content 菜单内容
     * @param {string} title 菜单名称
     */


    /**
     * 绑定下拉菜单
     * @param action 触发动作名称 hover/click/...
     * @param options 下拉菜单内容 html/json
     [
     {
			label : '设置',
			url : '', //链接
			icon : '', //icon
			style : '',//style
			event : '', //被点击触发的事件
		},
     ...
     ]
     */
    $.plugin.showMenu = function (action, options) {
        var btns = this;

        function _funShow() {
            if (btns.active()) {
                return;
            }
            btns.active(true);
            $.layer({
                pos : btns,
                cover : 0,
                content : content,
                closeBtn : 0,
                bodyOver : false, //body不需要裁切
                init : function (layer) {
                    layer.addClass('ks-layer-showmenu');
                    //监听点击事件 自动关闭
                    if (action === 'hover') {
                        var layerCloseEvn;
                        btns.push(layer).hover(function () {
                            layerCloseEvn && window.clearTimeout(layerCloseEvn);
                        }, function () {
                            layerCloseEvn = window.setTimeout(function () {
                                $.layerHide(layer.layerID);
                            }, 100);
                        });
                    }
                },
                show : function (layer) {
                    if (action !== 'hover') {
                        //监听点击事件 自动关闭
                        $(document).on('click.KSAUI-dropdown', function (e) {
                            if (e.target !== layer[0]) {
                                $.layerHide(layer.layerID);
                                $(document).off('click.KSAUI-dropdown');
                            }
                        });
                    }
                },
                close : function () {
                    btns.active(false);
                }
            });
        }

        var isHtml = $.isString(options);
        var content = '';
        if (isHtml) {
            content = options;
        } else {
            content = '';
            $.loop(options, function (val, key) {
                if ($.isString(val)) {
                    content += val;
                } else {
                    content += $.tag(val.url ? 'a' : 'p', {
                        style : val.style,
                        href : val.url,
                        icon : val.icon,
                        'dropdown-event-key' : key
                    }, val.label);
                }
            });
            content = $(content);
            content.filter('[dropdown-event-key]').map(function (ele) {
                ele = $(ele);
                var key = ele.attr('dropdown-event-key');
                var op = options[key];
                if (op) {
                    op.event && ele.click(op.event);
                }
            });
        }

        this.on(action === 'hover' ? 'mouseenter' : action, _funShow);
    };

    /**
     * 地区选择组件
     * @author cr180<cr180@cr180.com>
     * @summary 函数中所有地区level值 0=1省份 1=市区 2=区县 3=城镇
     * @param {string} tit 标题
     * @param {JSON} defDt 默认选中了的地区数据 - 格式如下：
     *      {
     *          level层级id :{id:地区ID, name:地区名称, upid:上级ID, level:地区层级},
     *          ...
     *      }
     *
     * @param {func} callFun 回调函数 - 每次选择都会回调
     *      {
     *          current:{}, //参考defDt格式
     *          data:{ //所有已选择地区数组对象，每个对象参数参考defDt
     *              0 : {参考defDt},
     *              1 : {...},
     *              ...
     *          }
     *      }
     * @param {int} maxLevel 最大层级 - 参考level解释
     * @param {url} apiUrl API接口地址 - 默认common/area，每组地区数据返回格式参考defDt介绍
     */
    $.plugin.area = function (tit, defDt, callFun, maxLevel, apiUrl) {
        var btn = $(this[0]);
        var layerID = 0;
        if (btn.data('layer-id')) {
            layerID = btn.data('layer-id');
            _close();
            return;
        }

        tit = tit ? tit : '设置地区信息';
        var _APIurl = apiUrl ? apiUrl : 'common/area';
        maxLevel = maxLevel >= 0 && maxLevel < 4 ? maxLevel : 4;
        var Ts = ['选择省份/地区', '选择城市', '选择区/县', '选择城镇', '选择街道'];
        var Fk = ['province', 'city', 'area', 'town'];
        var level = 0;

        var Dom;

        function _close(layerID) {
            $.layerHide(layerID);
            btn.removeData('layer-id').active(false);
        }

        //获取当前已选择地区数据并组合为JSON 回调给callFun
        function __callDt(currID, end) {
            var dt = {current : {}, data : {}, isEnd : end ? 1 : 0};
            Dom.find('.ks-area-layer-btn p').each(function (i, ele) {
                ele = $(ele);
                var f = ele.attr('field');
                if (ele.attr('val')) {
                    var v = {id : ele.attr('val'), name : ele.text(), level : i, field : f};
                    if (currID && currID == ele.attr('val')) {
                        dt.current = v;
                    }
                    dt.data[f] = v;
                }
            });
            $.isFunction(callFun) && callFun(dt);
        }


        //从API获取数据
        function g(upID, currID) {
            upID = upID ? upID : '';
            $.API(_APIurl, {id : upID, level : level}, function (data) {
                var H = '';
                $.loop(data, function (val) {
                    H += $.tag('ks-list-item', {
                        upid : upID,
                        val : val.id,
                        selected : (currID && currID == val.id ? 'selected' : null)
                    }, val.name);
                });
                //如果没有地区数据 则直接关闭
                if (!H) {
                    $.layerHide(layerID);
                    btn.removeData('layer-id').active(false);
                } else {
                    H = '<ks-list class="ks-list-select">' + H + '</ks-list>';
                    Dom.find('.ks-area-layer-c').html(H);
                    //计算地区列表区域的高度 以适应滚动窗口
                    (function () {
                        var h = Dom.height(true);
                        var o = Dom.find('.ks-area-layer-c');
                        o.height(h - Dom.find('.ks-area-layer-btn').height(true));

                        var p = o.find('ks-list-item[selected]');
                        if (p.length) {
                            o.scrollTop(p.index() * p.height(true));
                        } else {
                            o.scrollTop(0);
                        }
                    })();
                    //列表选项 点击事件
                    Dom.find('.ks-list-select').listSelect(function (val, txt, valdata, t, e) {
                        var id = t.attr('val');
                        t.selected(true).siblings().removeAttr('selected');
                        var bt = Dom.find('.ks-area-layer-btn').find('p').eq(level);
                        bt.text(txt).attr({upid : t.attr('upid'), 'val' : id, 'field' : Fk[level]}).show();
                        bt.next().attr('upid', id).html('<span class="ks-text-gray">' + Ts[level + 1] + '</span>').show();

                        //选择达到最后一级 关闭窗口
                        if (level == maxLevel - 1) {
                            $.layerHide(layerID);
                            btn.removeData('layer-id').active(true);
                            __callDt(id, 1);
                        } else if (level < maxLevel) {
                            g(id);
                            level++;
                            __callDt(id);
                        }
                    });
                }
            });
        }

        //底层弹出菜单
        $.layer({
            pos : $.isMobile ? 8 : btn,
            cover : $.isMobile ? 2 : 0,
            width : $.isMobile ? '100%' : '',
            height : $.isMobile ? '75%' : '',
            class : 'ks-area-layer',
            content : '<div class="ks-area-layer-btn"><p><span class="ks-text-gray">' + Ts[0] + '</span></p><p></p><p></p><p></p></div><div class="ks-area-layer-c">请稍后...</div>',
            closeBtn : false,
            bodyOver : false,
            init : function (layer, id) {
                Dom = layer;
                layerID = id;
                btn.data('layer-id', id).active(true);

                //阻止冒泡
                layer.click(function () {
                    return false;
                });

                //默认数据处理
                if (defDt) {
                    var p = layer.find('.ks-area-layer-btn p');
                    var defEnd = {};
                    var upid = 0;
                    $.loop(defDt, function (val, k) {
                        upid = k > 0 ? defDt[(k - 1)].id : 0;
                        p.eq(val.level).text(val.name).attr({
                            'upid' : upid,
                            'val' : val.id,
                            'field' : val.field
                        }).show();
                        if (level < val.level) {
                            level = val.level;
                            defEnd = val;
                        }
                    });
                    g(upid, defEnd.id);
                } else {
                    g();
                }

                //已选择地区增加点击事件 点击后选择下级地区
                layer.find('.ks-area-layer-btn p').click(function () {
                    var t = $(this);
                    level = t.index();
                    t.nextAll().text('').removeClass('a').attr('upid', '').attr('val', '').hide();
                    g(t.attr('upid'), t.attr('val'));
                    __callDt(t.attr('val'));
                });
            },
            show : function (layer) {
                //监听点击事件 自动关闭
                $(document).on('click.KSAUI-area', function (e) {
                    if (!$.inArray(e.target, [btn[0], layer[0], layer.next('[data-layer-key="' + layer.layerID + '"]')[0]])) {
                        $(document).off('click.KSAUI-area');
                        $.layerHide(layer.layerID);
                        btn.removeData('layer-id').active(false);
                    }
                });
            }
        });
    };

    //title提示文字处理
    $.showTip = function (obj, txt, click) {
        obj = $(obj);
        txt = txt ? txt : (obj.attr('title') || '');
        if (!txt) {
            return;
        }
        $.ZINDEX++;
        $('body').append('<div class="ks-ftip" style="z-index:' + this.ZINDEX + '">' + txt + '<span class="ks-ftip-x"></span></div>');
        var tip = $('.ks-ftip');
        tip.show();
        var ht = tip.height(true);

        let offset = obj.offset();
        var left = offset.left;


        let top = offset.top - ht;
        if(top < ht){
            top = offset.top + obj.height(true) + 5;
            tip.attr('pos', 'bottom');
        }else{
            top -= 5;
        }
        if (left + tip.width(true) > window.innerWidth) {
            left = window.innerWidth - tip.width(true);
        }
        tip.find('.ks-ftip-x').css({left: Math.max(offset.left - left, 3)});
        tip.css({left : left, top : top});
        var s;
        obj.hover(function () {
            s && clearTimeout(s);
        }, function () {
            s = setTimeout(function () {
                tip.remove();
            }, 10);
        });
        tip.hover(function () {
            s && clearTimeout(s);
        }, function () {
            s = setTimeout(function () {
                tip.remove();
            }, 10);
        });
    };
    /**
     * 幻灯轮播
     * @param options
     * @returns {$.plugin}
     */
    $.plugin.slide = function (options) {
        options = {
            auto : $.isset(options.auto) ? $.floatval(options.auto === '' ? 5 : options.auto) : 5,
            card : $.isset(options.card),
            control : $.isset(options.control),
            status : $.isset(options.status),
        };
        options.auto = options.auto ? ($.floatval(options.auto) * 1000) : 0;
        this.map(function (ele) {
            if (ele._KSAUI_slideRender) {
                return;
            }
            ele._KSAUI_slideRender = true;
            _Run(ele);

        });

        function _Run(ele) {
            ele = $(ele);
            //ele.children('.ks-slide-c').height(ele.height(true));
            var E = {
                id : $.objectID(ele[0]),
                width : ele.width(true),
                height : ele.height(true),
                item : ele.children(),
                itemC : '',
                MX : 0,
                num : 0,
                playIndex : 0, //当前播放索引值
                init : function () {
                    var ths = this;

                    ths.num = this.item.length - 1;
                    var widthC = 0;

                    ths.item.each(function(_, e){
                        e = $(e);
                        var mw = e.width(true, true);
                        var w = e.width(true);
                        e.addClass('ks-slide-item');
                        e.data('width', w).width(w);
                        widthC += mw;
                    });
                    var newDom = $('<div class="ks-slide-c" style="width:'+(widthC + 10)+'px; height:100%"></div>');
                    newDom.html(this.item);
                    ele.html(newDom);
                    ths.itemC = newDom;

                    //组件
                    var h = '';
                    //左右切换按钮 带属性：data-slide-btn
                    if (options.control) {
                        h += '<div class="ks-slide-control-prev" icon="arrow-left-s"></div><div class="ks-slide-control-next" icon="arrow-right-s"></div>';
                    }
                    //状态栏 带属性：data-slide-status
                    if (options.status) {
                        h += '<div class="ks-slide-status">';
                        $.loop(ths.num + 1, function () {
                            h += '<span></span>';
                        });
                        h += '</div>';
                    }
                    //进度条 带属性：data-slide-progress
                    if (options.progress) {
                        h += '<div class="ks-slide-progress"><span ' + (options.progress != 1 ? ' class="ks-bg-' + options.progress.trim() + '"' : '') + '></span></div>';
                    }
                    if (h) {
                        ele.append(h);
                    }
                    if (options.control) {
                        ele.find('.ks-slide-control-prev').click(function () {
                            E.play('prev');
                        });
                        ele.find('.ks-slide-control-next').click(function () {
                            E.play('next');
                        });
                    }
                    if (options.status) {
                        ele.find('.ks-slide-status span').click(function () {
                            var v = $(this).index();
                            if (v == ths.playIndex) {
                                return;
                            }
                            var tp = 'next';
                           if (v < ths.playIndex) {
                                tp = 'prev';
                            }
                            ths.play(tp, v);
                            $(this).addClass('a').siblings().removeClass('a');
                        });
                    }


                    ths.playIndex = ths.num;
                    ths.play('next', 0);

                    //触摸事件
                    var slideC = ths.itemC;
                    ele.touch(function () {
                        slideC.addClass('_a');
                    }, function (evn, touch) {
                        if (touch.action === 'left' || touch.action === 'right') {

                            slideC.css({
                                transform : 'translateX(' + (touch.moveX + ths.MX) + 'px) scale(1)',
                            });
                        }
                    }, function (evn, touch) {
                        slideC.removeClass('_a');
                        if( (touch.action ==='right' && ths.playIndex <=0) || (touch.action ==='left' && ths.playIndex >= ths.num) ){
                            ths.move(ths.playIndex);
                            return;
                        }
                        //横向移动距离超过10%才触发
                        if (touch.action == 'left') {
                            E.play('next');
                        } else if (touch.action == 'right') {

                            E.play('prev');
                        }
                    }, 'X');

                },
                move : function (i) {
                    var mX = 0-(this.item.eq(i).data('width') * i);
                    this.itemC.css({
                        transform : 'translateX('+mX+'px) scale(1)',
                    }).attr('index' , i);
                    this.MX = mX;
                },
                play : function (tp, index) {
                    var ths = this;
                    if ($.isset(index)) {
                        index = parseInt(index);
                    } else {
                        index = ths.playIndex;
                        if (tp == 'prev') {
                            index--;
                        } else if (tp == 'next') {
                            index++;
                        }
                    }
                    index = index < 0 ? 0 : (index > ths.num ? 0 : index);

                    ele.attr({'playerindex' : index, 'playeraction' : tp});
                    ths.move(index);
                    ths.playIndex = index;
                    if (options.auto) {
                        $.setTimeout('ksauiSlide' + ths.id, function () {
                            ths.play(tp);
                        }, options.auto);
                    }
                    options.status && ele.find('.ks-slide-status span').removeClass('a').eq(index).addClass('a');

                }
            };

            E.init();


        }

        return this;
    };

    /**
     * 上下滚动公告效果
     * 注：
     * 1、必须是由 3级dom组成 <a><b><p>每条新闻</p></b></a>
     * 2、只需要给a一个高度，否则可能不会滚动。
     * 3、每条p可以是任意高度，但不能超过a的高度
     * @param Timer 滚动切换时间
     * @returns {*}
     */
    $.plugin.announcement = function(Timer){
        Timer = Timer > 0 ? Timer : 10;
        this.each(function(){
            let ann = $(this);
            let subDom = ann.children().eq(0);
            let granDom = subDom.children();
            ann.css('overflow-y', 'hidden');
            subDom.addClass('ks-transition'); //加动画效果
            let len = granDom.length;
            let S;
            let runY = 0; //已经运行的高度
            let N = 0;
            function _run(){
                S = window.setInterval(function(){

                    runY += granDom.eq(N).height(true);
                    N ++;
                    if(runY > subDom.height(true) - ann.height(true)){
                        N = 0;
                        runY = 0;
                    }
                    subDom.css('margin-top', 0 - runY);
                }, Timer*1000);
            }
            _run();
            ann.hover(function(){
                window.clearInterval(S);
            }, function(){
                _run();
            });
        });
        return this;
    };

    /**
     * 创建内置组件 - form表单
     * @param {JSON} option 配置参数参考：
     {
			action : '', //form action （可选）
			field : [
				//一组一个表单
				{
					name:'sex', //字段名
					type:'select', //展现类型select/radio/checkbox/switch/text/date
					label:'性别', //表单标题名称
					value:'2', //表单值
					option:{ //多个选项列表 键名=值 键值=名称
						'0' : '不填写',
						'male' : '男',
						'female' : '女'
					}
				},
				...
				...
			]
		}
     * @returns {html}
     */
    $.createForm = function (option) {
        option = $.isArray(option) ? {action:'', field:option} : option;
        var H = $.tag('form', {action:option.action, class:option.class}, '', true);
        H += '<ks-form>';
        $.loop(option.field, function (value, key) {
            if (value && $.isObject(value)) {
                value.value = value.value ? value.value : '';
                value.name = value.name ? value.name : key;
                value.placeholder = value.placeholder ? value.placeholder : '请输入...';
                value.style = value.style ? ' style="' + value.style + '"' : '';
                if (value.type === 'hidden') {
                    H += $.tag('input', {type : 'hidden', name : value.name, value : value.value}, '', true);
                } else {
                    H += $.tag('ks-form-item', {label : value.label, required : value.required, extra: value.extra}, '', true);
                    if (value.after || value.before) {
                        H += '<ks-input-group>';
                        H += value.before ? value.before : '';
                    }
                    //数字 普通输入框 密码框
                    if ($.inArray(value.type, ['number', 'text', 'password', 'tel', 'color'])) {
                        value.type = !value.unit ? 'ks-'+value.type : value.type;
                        delete value.label;
                        if(value.unit){
                            H += '<ks-input-group>';
                        }
                        H += $.tag('input', value, '', 1);
                        if(value.unit){
                            H += '<i>'+value.unit+'</i>';
                            H += '</ks-input-group>';
                        }
                        //多行输入框
                    } else if ($.inArray(value.type, ['textarea'])) {
                        value.type = 'ks-'+value.type;
                        var v = value.value;
                        delete value.value;
                        H += $.tag('textarea', value, v);
                        //开关
                    } else if (value.type == 'switch') {
                        value.value = value.value ? value.value : '';
                        H += $.tag('input', {
                            type : 'ks-switch',
                            name : value.name,
                            value : value.value,
                            text : (value.text ? value.text : '是'),
                            style : value.style,
                            checked : (value.value == 1 ? ' checked' : null)
                        }, '', 1);
                        //单选框
                    } else if (value.type == 'radio') {
                        $.loop(value.option, function (v, k) {
                            H += $.tag('input', {
                                type : 'ks-radio',
                                name : value.name,
                                value : k,
                                text : v,
                                checked : (value.value == k ? ' checked' : null),
                                style : value.style
                            }, '', 1);
                        });
                        //多选框
                    } else if (value.type == 'checkbox') { //checkbox 字段名会自动追加[]
                        (function () {
                            function check_x(checklist) {
                                var ch = '';
                                $.loop(checklist, function (v, k) {
                                    if ($.isObject(v)) {
                                        ch += '<div class="ks-mb2"><p class="ks-fw3 ks-mb1">' + k + '</p>';
                                        ch += '<p>';
                                        ch += check_x(v);
                                        ch += '</p></div>';
                                    } else {
                                        ch += ' ' + $.tag('input', {
                                            type : 'ks-checkbox',
                                            name : value.name + '[]',
                                            value : k,
                                            text : v,
                                            checked : (value.value == k || $.inArray(k, value.value) ? ' checked' : null),
                                            style : value.style
                                        }, '', 1);
                                    }
                                });
                                return ch;
                            }

                            H += check_x(value.option);
                        })();

                        //下拉选择
                    } else if (value.type == 'select') {

                        var opth = '';
                        $.loop(value.option, function (v, k) {
                            if($.isObject(v)){
                                k = v.id;
                                v = v.value;
                            }
                            opth += $.tag('option', {value:k}, v);
                        });
                        value.type = 'ks-'+value.type;
                        delete value.option;
                        H += $.tag('select', value, opth);

                    //日期
                    } else if (value.type == 'date') {
                        H += $.tag('input', {
                            type : 'ks-date',
                            name : value.name,
                            value : value.value,
                            title : value.title,
                            placeholder : value.placeholder,
                            style : value.style,
                            format : value.format
                        }, '', 1);
                        //地区选择
                    } else if (value.type == 'area') {
                        H += $.tag('ks-area', {
                            'province' : value.value.province,
                            'city' : value.value.city,
                            'area' : value.value.area,
                            'town' : value.value.town,
                            'maxlevel' : value.value.maxlevel ? maxlevel : 4
                        }, '请选择');
                        if ($.isset(value.value.address)) {
                            H += '<input type="text" name="address"  value="' + value.value.address + '" placeholder="请输入街道地址" class="ks-input ks-mt1">';
                        }
                    }else if($.inArray(value.type, ['pic','file'])){
                        value.type = 'ks-'+value.type;
                        H += $.tag('input', value, '', 1);
                        //HTML
                    } else {
                        H += value.value;
                    }
                    if (value.after || value.before) {
                        H += value.after ? value.after : '';
                        H += '</ks-input-group>';
                    }
                    H += '</ks-form-item>';
                }
            } else if (value && $.isString(value)) {
                H += '<ks-form-title>' + value + '</ks-form-title>';
            }
        });
        H += '</ks-form></form>';
        return H;
    };

    $.imgZoom = function(file, maxWidth, maxHeight, callFun){
        file = file.files[0];
        var reader = new FileReader();
        reader.readAsDataURL(file);
        var img = new Image();
        reader.onload = function(e) {
            img.src = e.target.result
        }
        img.onload = function(e){
            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            var originWidth = this.width,
                originHeight = this.height,
                width = originWidth,
                height = originHeight;
            if (originWidth > maxWidth || originHeight > maxHeight) {
                if (originWidth / originHeight > 1) {
                    // 宽图片
                    width = maxWidth;
                    height = Math.round(maxWidth * (originHeight / originWidth));
                } else {
                    // 高图片
                    height = maxHeight;
                    width = Math.round(maxHeight * (originWidth / originHeight));
                }
            }
            canvas.width = width;
            canvas.height = height;
            context.clearRect(0, 0, width, height);
            // 图片绘制
            context.drawImage(img, 0, 0, width, height);
            canvas.toBlob(function(blob) {
                blob = new File([blob], file.name, file);
                callFun && callFun(blob);
            }, file.type, 1);
        }

    };

    /**
     * 元素拖拽
     * 同一个父级下所有一级子元素拖拽
     * 父元素回调事件：
     *      开始=dragStart
     *      确认=dragEnter
     *      离开=dragLeave
     *      结束=dragEnd
     *      所有回调事件请读取event._KSA_Drop_Arg_属性，得到开始和结束的元素
     * @param dom 父元素选择器
     */
    $.Drop = function(dom){
        dom = $(dom);
        let debug = dom.data('debug') ? true : false;
        var events = {
            Ele_start : null, //触发拖拽元素
            Ele_In : null, //目标元素
            Ele_Parent : null, //拖拽的父级
            //拖拽 开始
            dragstart(e, ele, parent){
                if(this.Ele_start){
                    return;
                }
                this.Ele_start = ele;
                this.Ele_Parent = parent;

                ele = $(ele);
                debug && console.log('拖拽开始', ele.text());

                ele.addClass('_drag');
                e._KSA_Drop_Arg_ = {start:this.Ele_start, end:null};
                dom.trigger('dragStart');
            },
            drag(e, ele, parent){
                //console.log('handleDrag', e)
            },
            dragend(e, ele, parent){
                debug && console.log('拖拽结束', e, this)
                this.Ele_start && $(this.Ele_start).removeClass('_drag');
                this.Ele_In && $(this.Ele_In).removeClass('_drag_in').css('margin-left', 0);
                if(this.Ele_start && this.Ele_In && this.Ele_start != this.Ele_In) {
                    debug && console.log('拖拽了', this.Ele_start, '放到', this.Ele_In);
                    e._KSA_Drop_Arg_ = {start:this.Ele_start, end:this.Ele_In};
                    dom.trigger('dragEnd');
                }
                this.Ele_start = null;
                this.Ele_In = null;
                this.Ele_Parent = null;
            },
            drop(e, ele, parent){
                debug && console.log('handleDrop', e.target);
            },
            //拖拽 确认目标
            dragenter(e, ele, parent){
                if(!this.Ele_start){
                    return;
                }
                if(this.Ele_In == ele){
                    return;
                }
                ele = $(ele);
                //不是同一个父级下
                if(parent != this.Ele_Parent){
                    debug && console.log('不是同一个父级')
                    return;
                }
                //如果拖拽到自己 或 目标是紧挨的下一个 则不处理
                if(this.Ele_start == ele[0] || ele.prev()[0] == this.Ele_start){
                    return;
                }

                if(this.Ele_In && this.Ele_In != ele[0]){
                    $(this.Ele_In).removeClass('_drag_in').css('margin-left', 0);
                    debug && console.log('拖拽释放', this.Ele_In.innerText);
                    e._KSA_Drop_Arg_ = {start:this.Ele_start, end:this.Ele_In};
                    dom.trigger('dragLeave');
                }
                debug && console.log('拖拽确认', ele.text());
            },
            //拖拽 经过目标
            dragover(e, ele, parent){
                if(!this.Ele_start){
                    return;
                }
                if(this.Ele_In == ele){
                    return;
                }
                ele = $(ele);
                //不是同一个父级下
                if(parent != this.Ele_Parent){
                    debug && console.log('不是同一个父级')
                    return;
                }
                //如果拖拽到自己 或 目标是紧挨的下一个 则不处理
                if(this.Ele_start == ele[0] || ele.prev()[0] == this.Ele_start){
                    return;
                }

                //释放之前被选中的
                if(this.Ele_In && this.Ele_In != ele[0]){
                    $(this.Ele_In).removeClass('_drag_in').css('margin-left', 0);
                    debug && console.log('拖拽释放', this.Ele_In.innerText);
                }

                debug && console.log('拖拽经过', ele.text());
                this.Ele_In = ele[0];
                ele.addClass('_drag_in').css('margin-left', $(this.Ele_start).width(true));
                e._KSA_Drop_Arg_ = {start:this.Ele_start, end:this.Ele_In};
                dom.trigger('dragEnter');
            },
            //拖拽 离开目标
            dragleave(e, ele, parent){
                if(!this.Ele_In){
                    return;
                }
            }
        }
        let eventName = 'dragstart drag dragend drop dragenter dragover dragleave';
        dom.find('> *').attr('draggable', 'true').on(eventName, function(e){
            events[e.type] && events[e.type](e, this, dom[0]);
        });
    }

    /**
     * 实现数字滚动动画效果
     * @param {number} currentValue - 当前数值
     * @param {number} targetValue - 目标数值
     * @param {number} animationDuration - 动画持续时间（毫秒）
     * @param {number} animationSteps - 动画步数
     * @param {function} callFunc - 回调函数，在每个动画步骤更新时调用
     */
    $.animateNumber = function(currentValue = 0, targetValue = 0, animationDuration = 1000, animationSteps = 60, callFunc) {
      // 计算每个步骤的增量
      const step = (targetValue - currentValue) / animationSteps;
      let stepCount = 0;

      // 设置定时器来执行动画步骤
      let animationInterval = setInterval(() => {
        // 如果达到了动画步数，则清除定时器
        if (stepCount >= animationSteps) {
          clearInterval(animationInterval);
          callFunc && callFunc('end');
        } else {
          // 更新当前数值
          currentValue += step;
          // 调用回调函数并传递更新后的数值
          callFunc && callFunc(Math.round(currentValue));
          stepCount++;
        }
      }, animationDuration / animationSteps);
      return animationInterval;
    }
    /**
     * 进度条动画
     * @param bar 进度条dom选择器
     * @param textEle 进度文字 dom选择器
     * @param value 新进度值
     * @param callFunc 动画完成后回调
     * @param stepFunc 每帧动画回调函数
     *
     */
    $.animateProgress = function (bar, textEle, value, callFunc, stepFunc){
        let oldValue = 0;
        textEle = $(textEle);
        bar = $(bar);

        if(bar.length){
            oldValue = parseFloat(bar.attr('animate_progress') || '0');
            let autoID = bar.attr('animate_progress_id');
            if(autoID){
                clearInterval(autoID);
                bar.removeAttr('animate_progress_id');
            }
        }
        let lastVal;
        let autoID = $.animateNumber(oldValue, value, 500, 30, function (val) {

            if(val === 'end'){
                bar.length && bar.removeAttr('animate_progress_id');

                if(value >= 100){
                    bar.removeAttr('animate_progress');
                }else{
                    bar.attr('animate_progress', value);
                }
                callFunc && callFunc();
            }else{
                if(lastVal != val){
                    if(textEle.length){
                        textEle.text(val);
                    }
                    stepFunc && stepFunc(val);
                }
                bar.length && bar.width(Math.max(val, 3)+'%');
                lastVal = val;
            }
        });
        bar.attr('animate_progress_id', autoID);
    }
    /**
     * 颜色选择器
     * @param opt
     */
    $.colorPicker = function(domEle, changeFunc) {
        const Picker = {
        loadInputColor(){
            this.input = this.ele.attr('value');
            if(!this.input){
                this.input = 'rgba(0, 0, 0, 1)';
            }
            var _this = this;
            let rgba = {r: 0, g: 0, b: 0, a: 1};
            if(this.input.indexOf('#') != -1 || (this.input.length >= 3 && this.input.length <=8)){
                rgba = $.hex2rgba(this.input);
                this.current_mode = 'hex'; // input框当前的模式
            }else if(this.input.indexOf('rgba') != -1){
                rgba = this.input.slice(5, -1).split(",");
                rgba = {
                    r : parseInt(rgba[0]),
                    g : parseInt(rgba[1]),
                    b : parseInt(rgba[2]),
                    a : parseInt(rgba[3]),
                };

                this.current_mode = 'rgba'; // input框当前的模式
            }

            if(rgba){
                this.rgba = {
                    r: rgba.r,
                    g: rgba.g,
                    b: rgba.b,
                    a: rgba.a
                };
            }else{
                this.rgba = {r: 0, g: 0, b: 0, a: 1};
            }
            this.hsb = $.rgba2hsb(this.rgba);
        },
        init(opt) {

            this.ele = $(domEle); // 绑定的外部元素
            this.changeFunc = changeFunc;
            this.elem_wrap = null; // 最外层容器
            this.elem_colorPancel = null; // 色彩面板
            this.elem_picker = null; // 拾色器色块按钮
            this.elem_barPicker1 = null; // 颜色条
            this.elem_showColor = null; // 显示当前颜色
            this.elem_inputWrap = null; // 输入框外层容器

            this.pancelLeft = 0;
            this.pancelTop = 0;

            this.downX = 0;
            this.downY = 0;
            this.moveX = 0;
            this.moveY = 0;

            this.pointLeft = 0;
            this.pointTop = 0;
            const _this = this;

            this.ele.click(function () {
                const ele = this;
                if(this.__KSA_bind_layer_id){
                    $.layerHide(this.__KSA_bind_layer_id);
                    delete this.__KSA_bind_layer_id;
                    return;
                }
                _this.loadInputColor();
                var div = document.createElement("div");
                div.innerHTML = _this.render();

                _this.layer = $.layer({
                    class : 'ks-layer-color',
                    pos : this,
                    closeBtn : 0,
                    content : div,
                    show(dom){
                        let offset = $(_this.layer.dom).offset();
                        _this.init_2(offset.left, offset.top, div);

                    },
                    close(){
                        if(ele.__KSA_bind_layer_id){
                            delete ele.__KSA_bind_layer_id;
                        }
                        _this.layer = null;
                    }
                });
                this.__KSA_bind_layer_id = _this.layer.id;
            });

            $(document).on('mousedown', function(e){
                if(_this.layer){
                    if(!$(e.target).parents('.ks-layer-color').length){
                        _this.layer.close();
                    }
                }
            });
        },
        init_2(layer_left, layer_top, div){
            const _this = this;
            this.elem_wrap = div;
            this.elem_colorPancel = div.getElementsByClassName("_pancel")[0];
            this.pancel_width = this.elem_colorPancel.offsetWidth;
            this.pancel_height = this.elem_colorPancel.offsetHeight;
            this.elem_picker = div.getElementsByClassName("_pickerBtn")[0];
            this.elem_showColor = div.getElementsByClassName("_preview_color")[0];
            this.elem_barPicker1 = div.getElementsByClassName("_color-picker")[0];
            this.elem_barPicker2 = div.getElementsByClassName("_alpha_picker")[0];
            this.elem_inputWrap = div.getElementsByClassName("_inputWrap")[0];

            this.pancelLeft = layer_left;
            this.pancelTop = layer_top;
            this.bindMove(this.elem_colorPancel, this.setPosition, true);
            this.bindMove(this.elem_barPicker1.parentNode, this.setBar, false);
            this.bindMove(this.elem_barPicker2.parentNode, this.setBar, false);

/*
            $(this.elem_wrap).input(function (e) {
                var target = e.target, value = target.value;
                _this.setColorByInput(value);
            });
            */
            (this.input != '' && this.setColorByInput(this.input));
        },
        render: function () {
            var tpl =
                `
            <div class="ks-layer-color-content">
                <div class="ks-layer-color-pancel">
                    <div class="_pancel" style="background:rgb(${this.rgba.r},${this.rgba.g},${this.rgba.b})">
                        <div class="_saturation-white">
                            <div class="_saturation-black">
                            </div>
                            <div class="_pickerBtn">
                                <div></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="ks-layer-color-tools" style="">
                    <div class="_flex" style="">
                        <div style="" class="_showcolor">
                            <div style="">
                                <div class="_preview_color" style=" background:rgb(${this.rgba.r},${this.rgba.g},${this.rgba.b}); "></div>
                            </div>
                        </div>
                        <div style="-webkit-box-flex: 1; flex: 1 1 0%;">
                            <div class="_select_color" style="">
                                <div style="">
                                    <div class="_color_selector" style="">
                                        <div  class="_color-picker _picker" style="">
                                            <div style="">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="_alpha_tools" style="">
                                <div class="_alpha_selector" style="">
                                    <div  class="_alpha_picker _picker" style="">
                                        <div style="">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="_flex" style="display: flex;">
                        <div class="_flex _inputWrap">
                                ${this.getInputTpl()}
                        </div>
                    </div>
                </div>
            </div>`;
            return tpl;
        },
        getInputTpl: function () {
            var hex = "#" + $.rgba2hex($.hsb2rgba(this.hsb));
            var current_mode_html = `
                        <div>
                            <div style="" class="_color-input">
                                <input value="${hex}" spellcheck="false" style="">
                                <span style="">hex</span>
                            </div>
                        </div>`;

                    for (var i = 0; i <= 3; i++) {
                        current_mode_html +=
                            `<div>
                            <div style="" class="_color-input">
                                <input value="${this.rgba['rgba'[i]]}" spellcheck="false" style="">
                                <span class="" style="">${'rgba'[i]}</span>
                            </div>
                        </div>`;
                    }
            return current_mode_html;
        },
        setPosition(x, y) {
            var LEFT = parseInt(x - this.pancelLeft),
                TOP = parseInt(y - this.pancelTop);

            this.pointLeft = Math.max(0, Math.min(LEFT, this.pancel_width));
            this.pointTop = Math.max(0, Math.min(TOP, this.pancel_height));

            $(this.elem_picker).css({
                left: this.pointLeft + "px",
                top: this.pointTop + "px"
            });
            this.hsb.s = parseInt(100 * this.pointLeft / this.pancel_width);
            this.hsb.b = parseInt(100 * (this.pancel_height - this.pointTop) / this.pancel_height);

            this.setShowColor();
            this.setValue(this.rgba);

        },
        setBar: function (elem, x) {
            var elem_bar = elem.getElementsByTagName("div")[0],
                rect = elem.getBoundingClientRect(),
                elem_width = elem.offsetWidth,
                X = Math.max(0, Math.min(x - rect.x, elem_width));

            if (elem_bar === this.elem_barPicker1) {
                $(elem_bar).css({
                    left: X + "px"
                });
                this.hsb.h = parseInt(360 * X / elem_width);
                this.setPancelColor(this.hsb.h);
            } else {
                $(elem_bar).css({
                    left: X + "px"
                });
                this.rgba.a = parseInt(X / elem_width * 100) / 100;
            }


            this.setShowColor();
            this.setValue(this.rgba);

        },
        setPancelColor: function (h) {
            $(this.elem_colorPancel).css({
                background: $.rgba2str($.hsb2rgba({h:h, s:100, b:100, a:1}))
            });
        },
        setShowColor: function () {
            var rgba = $.hsb2rgba(this.hsb);
            rgba.a = this.rgba.a;
            this.rgba.r = rgba.r;
            this.rgba.g = rgba.g;
            this.rgba.b = rgba.b;
            $(this.elem_showColor).css({
                background: $.rgba2str(rgba)
            });

        },
        setValue: function (rgb) {
            this.elem_inputWrap.innerHTML = this.getInputTpl();
            let value = '';
            if(rgb.a == 1){
                value = "#" + $.rgba2hex(rgb);
            }else{
                value = $.rgba2str(rgb);
            }
            this.changeFunc(value);
        },
        setColorByInput: function (value) {
            var _this = this;
            switch (this.current_mode) {
                case "hex":
                    value = value.slice(1);
                    if (value.length == 3) {
                        value = '#' + value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
                        this.hsb = $.hex2hsb(value);
                    } else if (value.length == 6) {
                        this.hsb = $.hex2hsb(value);
                    }
                    break;
                case 'rgba':
                    this.hsb = $.rgba2hsb(this.rgba);
            }
            this.changeViewByHsb();
        },
        changeViewByHsb: function () {
            this.pointLeft = parseInt(this.hsb.s * this.pancel_width / 100);
            this.pointTop = parseInt((100 - this.hsb.b) * this.pancel_height / 100);
            $(this.elem_picker).css({
                left: this.pointLeft + "px",
                top: this.pointTop + "px"
            });

            this.setPancelColor(this.hsb.h);
            this.setShowColor();
            $(this.elem_barPicker1).css({
                left: this.hsb.h / 360 * (this.elem_barPicker1.parentNode.offsetWidth) + "px"
            });
            $(this.elem_barPicker2).css({
                left: (this.hsb.a * this.elem_barPicker2.parentNode.offsetWidth) + "px"
            });
            let rgba = $.hsb2rgba(this.hsb);
            let value = '';
            if(rgba.a == 1){
                value = "#" + $.rgba2hex(rgba);
            }else{
                value = $.rgba2str(rgba);
            }
            this.changeFunc(value);
        },
        bindMove: function (elem, fn, bool) {
            const _this = this;
            elem.addEventListener("mousedown", function (e) {
                _this.downX = e.pageX;
                _this.downY = e.pageY;
                bool ? fn.call(_this, _this.downX, _this.downY) : fn.call(_this, elem, _this.downX, _this.downY);

                document.addEventListener("mousemove", mousemove, false);

                function mousemove(e) {
                    _this.moveX = e.pageX;
                    _this.moveY = e.pageY;
                    bool ? fn.call(_this, _this.moveX, _this.moveY) : fn.call(_this, elem, _this.moveX, _this.moveY);
                    e.preventDefault();
                }

                document.addEventListener("mouseup", mouseup, false);

                function mouseup(e) {

                    document.removeEventListener("mousemove", mousemove, false)
                    document.removeEventListener("mouseup", mouseup, false)
                }
            }, false);
        },
    }
        Picker.init();
    }

    function ks_input_group(ele){
        ele = $(ele);
        var attr = ele.attr();
        var dom = $(ele).wrap($.tag('ks-input-group',{class:attr.class, id:attr.id}));
        if(attr.icon){
            ele.before('<i>'+attr.icon+'</i>');
        }
        if(attr.label){
            ele.before('<i>'+attr.label+'</i>');
        }
        if(attr.unit){
            ele.after('<i>'+attr.unit+'</i>');
        }
        ele.attr({class:'', id:'', icon:''});
        return dom;
    }

    (function () {
        $.render('select[type="ks-select"]', function (ele, isAttrUp, update) {
            let t = $(ele), at = t.attr();
            if (t[0].tagName != 'SELECT') {
                return;
            }
            if(!isAttrUp){
                t.removeClass('ks-select').attr({'type': '', 'ks-render-type':'select'});
                //是否存在默认值
                if(!$.isset(at.value) && at['data-value']){
                    at.value = at['data-value'];
                }
                //如果在标签属性data-value给定选中值 则处理到内部
                $.isset(at.value) && t.val(at.value);
            }

            //如果控件为展开类型 元素存在open属性
            if ($.isset(at.open)) {
                if(isAttrUp) {
                    t.next().disabled(t.disabled());
                }else{
                    var json = select_html_json(t[0]);
                    let selectList = $('<div class="ks-select-list">' + select_json_html(json, json.value, json.multiple) + '</div>');
                    selectList.children().listSelect(function (value) {
                        $(t).val(Object.keys(arguments[2])).trigger('change');
                    });
                    t.after(selectList).hide();
                    selectList.prepend(t);
                    t.next().disabled(t.disabled());
                    //绑定一个内部事件 让select表单值改变后通知父级
                    t.DOMchange('val', function () {
                        var val = $(this).val();
                        selectList.find('ks-list-item').selected(false);
                        val = !$.isArray(val) ? [val] : val;
                        $.loop(val, function (v) {
                            selectList.find('ks-list-item[value="' + v + '"]').selected(true);
                        });
                    });
                }

            } else {
                //获取select已选中文本
                function _selectText() {
                    var text = '';
                    t.find('option:selected').each(function (_, e) {
                        text += e.text ? '<span>' + e.text + '</span>' : '';
                    });
                    return text ? text : (t.attr('deftext') || '请选择');
                }

                if(isAttrUp){
                    t.parent().children('.ks-select-title').html(_selectText());
                    t.parent().disabled(t.disabled());
                }else{
                    let tagAttr = {class:'ks-select', style : at.style};
                    if(t.disabled()){
                        tagAttr.disabled = true;
                    }
                    t.wrap($.tag('span',tagAttr));
                    t.after('<span class="ks-select-title">' + _selectText() + '</span>');
                    t.next().click(function () {
                        if (t.disabled()) {
                            return;
                        }
                        var optionJson = select_html_json(t[0]);
                        $(this).showSelect(optionJson, function (val, txt, valdt) {
                            t.val(Object.keys(valdt)).attr('value', val);
                            //t.next('.ks-select-title').html(_selectText());
                            //t.trigger('change'); //手动触发change事件
                        });
                    });
                    //绑定一个内部事件 让select表单值改变后通知父级
                    t.DOMchange('val', function () {
                        t.next('.ks-select-title').html(_selectText());
                        t.trigger('change'); //手动触发change事件
                    });
                }

            }


        },'attr.value attr.data-value attr.disabled, html');

        $.render('input[type="ks-radio"]', function (ele) {
            var t = $(ele), at = t.attr();
            var txt = at.text ? '<em>' + at.text + '</em>' : '';
            t.attr({'type': 'radio'});
            t.wrap($.tag('label',{type : 'radio', class : 'ks-radio', 'icon': at.icon, 'style':at.style, color:at.color}));
            t.after('<i>' + txt + '</i>');
            t.change(function () {
                $(this).trigger('KSADOMchange', ['attr.checked', this.checked]);
            });
        });

        $.render('input[type="ks-checkbox"]', function (ele) {
            var t = $(ele), at = t.attr();
            var txt = at.text ? '<em>' + at.text + '</em>' : '';
            t.attr({'type': 'checkbox'});
            t.wrap($.tag('label',{type : 'checkbox', class : 'ks-checkbox', 'icon': at.icon, 'style':at.style, color:at.color}));
            t.after('<i>' + txt + '</i>');
            //最大选择数量支持
            var area = t.parent().parent();
            if (area.length && area.attr('max')) {
                var max = parseInt(area.attr('max')) || 0;
                //最大选择数量限制
                if (max > 0) {
                    t.change(function () {
                        //域下相同类型的元素
                        var uN = 'input[type="checkbox"][name="' + t.attr('name') + '"]';
                        if (area.find(uN + ':checked').length == max && t.checked()) {
                            area.find(uN + ':not(:checked)').disabled(true);
                        } else {
                            area.find(uN + ':not(:checked)').disabled(false);
                        }
                    });
                }
            }
            //监听选中状态 并触发change事件
            t.DOMchange('attr.checked',function () {
                $(this).trigger('change');
            });
        });

        $.render('input[type="ks-checkbox-all"]', function (ele) {
            var t = $(ele), at = t.attr();
            var txt = at.text ? '<em>' + at.text + '</em>' : '';
            t.attr({'type': 'checkbox', 'ischeckall': 1});
            t.wrap($.tag('label',{type : 'checkbox', class : 'ks-checkbox', 'icon': at.icon, 'style':at.style, color:at.color}));
            t.after('<i>' + txt + '</i>');


            var name = t.attr('name');
            var selector = $(t.attr('selector') || t.parent()[0].form || t.parent().parent());
            var tParent = t.parent();
            let inputs = 'input[type="checkbox"]:not([ischeckall]):not([disabled])';
            if(name){
                inputs = 'input[type="checkbox"][name="' + name + '"]:not([ischeckall]):not([disabled])';
            }
            var indeterName = 'indeter';
            //全选事件绑定
            t.change(function () {
                //域下相同类型的元素
                selector.find(inputs).checked(this.checked);
            }).DOMchange('attr.checked',function () {
                selector.find(inputs).checked(this.checked);
            });
            t.on('changeALL', function(){
                var st = false;
                var selectedNum = selector.find(inputs + ':checked').length;
                if (selectedNum >= selector.find(inputs).length) {
                    st = true;
                    tParent.removeAttr(indeterName);
                } else if (selectedNum > 0) {
                    st = false;
                    tParent.attr(indeterName, true);
                } else if (!selectedNum) {
                    st = false;
                    tParent.removeAttr(indeterName);
                }
                t[0].checked = st;
            });

            //域下 所有的input绑定关联事件
            selector.on('change', inputs, function () {
                t.trigger('changeALL');
            })

        });

        $.render('input[type="ks-switch"]', function (ele) {
            var t = $(ele), at = t.attr();
            var val = t.checked() ? 1 : 0,
                txt = at.text || '',
                name = at.name ? ' name="' + at.name + '"' : '';

            if (txt) {
                txt = txt.split('|');
                txt = $.isset(txt[1]) ? '<em>' + txt[1] + '</em><em>' + txt[0] + '</em>' : '<em>' + txt[0] + '</em>';
            }
            t.attr('type', 'checkbox').removeAttr('name');

            t.wrap($.tag('label',{type : 'switch', class : 'ks-switch', 'icon': at.icon, 'style':at.style, color:at.color}));

            t.after('<i>' + txt + '</i><input type="hidden" ' + name + ' value="' + val + '">');

            //事件绑定
            t.change(function () {
                var cked = this.checked;
                $(this).trigger('KSADOMchange', ['attr.checked', cked]).nextAll('input[type=hidden]').val(cked ? 1 : 0)
            });
        });

        $.render('input[type="ks-number"]', function (ele) {
            ele = $(ele);
            var at = ele.attr();
            ele.attr('type', 'number').addClass('ks-input');
            ele.wrap($.tag('span',{type : 'number', class : 'ks-input ks-input-arrow', 'icon': at.icon, 'style':at.style}));

            ele.after('<span data-digit="down" icon="subtract"></span><span data-digit="up" icon="add"></span>');

            var attrs = ele.attr();
            ele.val() == '' && !attrs.placeholder && ele.val(attrs.min || 0);
            var ef = ele.parent();
            !ef.hasClass('ks-input-arrow') && ef.addClass('ks-input-arrow');
            var min = $.floatval(attrs.min) || 0, //input最小值
                max = $.floatval(attrs.max) || 0, //input最大值
                step = $.floatval(attrs.step) || 0, //input步进值
                n = step && step.toString().indexOf('.') != -1 ? step.toString().split('.')[1].length : 0; //step有多少小数位 踏马的js精度
            //计算 并写input  x[0=+ 1=-]
            function r(x) {
                var v =  ele.val();
                var isZ = v.length >1 && v.substr(0,1) === '0';
                v = $.floatval(v) || 0;
                if (x == 'up') {
                    if (step) {
                        v = v + step;
                    } else {
                        v++;
                    }
                } else {
                    if (step) {
                        v = v - step;
                    } else {
                        v--;
                    }
                }
                v = n > 0 ? v.toFixed(n) : v; //去踏马的精度问题 再骂一次加深印象
                v = v < min ? min : v; //最小值限制
                v = max && v > max ? max : v; //最大值限制
                v = v <=9 && isZ ? '0'+v : v;
                ele.val(v);
            }

            var S, S1;
            //鼠标按下处理
            var evn = $.isMobile ? 'touchstart touchend' : 'mousedown mouseup';
            ef.find('*[data-digit]').on(evn, function (e) {

                var i = $(this).data('digit'); //取i标签当前索引
                if ($.inArray(e.type, ['mousedown', 'touchstart'])) {
                    r(i); //按下 计算一次
                    //x时间内未松开鼠标 则一直计算
                    S = setTimeout(function () {
                        S1 = setInterval(function () {
                            r(i);
                        }, 60);
                    }, 250);

                    //鼠标松开后释放自动计算事件
                } else {
                    ele.change();
                    clearInterval(S1);
                    clearTimeout(S);
                }
            });
        });

        $.render('input[type="ks-date"]' , function (ele) {
            var t = $(ele), at = t.attr();
            t.attr('type', 'text');
            t.wrap($.tag('span',{type : 'date', class : 'ks-input', 'icon': at.icon, 'style':at.style}));
            if (!at.icon && !at.iconleft && !at.iconright) {
                at.iconright = 'calendar';
            }
            (at.icon || at.iconleft) && t.before('<left icon="' + (at.icon || at.iconleft) + '"></left>');
            at.iconright && t.before('<right icon="' + at.iconright + '"></right>');
            $.isMobile && t.after('<i class="ks-input-cover"></i>');
            //增加事件
            t.parent().click(function () {
                $.showDate(t);
            });
        });

        $.render('input[type="ks-color"]', function (ele) {
            var t = $(ele), at = t.attr();
            t.attr('type', at.type.substr(3));
            if(at.label){
                ks_input_group(t);
            }else{
                t.wrap($.tag('label',{type : 'color', class : 'ks-input-color', 'icon': at.icon, 'style':at.style}));
            }
        });

        $.render('input[type="ks-text"], input[type="ks-tel"]', function (ele) {
            var t = $(ele), at = t.attr();
            t.attr('type', at.type.substr(3));
            if(at.label || at.unit){
                ks_input_group(t);
            }else{
                t.wrap($.tag('label',{type : 'text', class : 'ks-input', 'icon': at.icon, 'style':at.style}));
            }


            (at.icon || at.iconleft) && t.before('<left icon="' + (at.icon || at.iconleft) + '"></left>');
            at.iconright && t.before('<right icon="' + at.iconright + '"></right>');
            if($.isset(at.clear)) {
                var clearbtn = $('<right class="ks-input-clear" icon="close-circle-fill" style="z-index:99"></right>');
                t.before(clearbtn);
                clearbtn.click(function () {
                    t.val('').focus();
                    clearbtn.active(false);
                });
                t.keyup(function () {
                    if (t.val().length > 0) {
                        clearbtn.active(true);
                    } else {
                        clearbtn.active(false);
                    }
                });
                t.parent().hover(function () {
                    $(this).find('input[type=text]').val().length > 0 && clearbtn.active(true);
                }, function () {
                    window.setTimeout(function () {
                        clearbtn.active(false);
                    }, 10)
                });
            }
            //下拉联想输入框
            if(at.api){
                var intxtS;
                var intxtLayerID;
                t.blur(function(){
                    intxtLayerID && $.layerHide(intxtLayerID);
                    intxtS && window.clearTimeout(intxtS);
                }).on('input focus', function () {
                    var inputVal = $(this).val();
                    intxtLayerID && $.layerHide(intxtLayerID);
                    intxtS && window.clearTimeout(intxtS);
                    if(inputVal.length >0){
                        intxtS = window.setTimeout(function(){
                            $.layer({
                                pos : t,
                                cover : 0,
                                content : '请稍后...',
                                closeBtn : 0,
                                bodyOver : false, //body不需要裁切
                                init : function (layer) {
                                    intxtLayerID = layer.layerID;
                                    $.API(at.api, {keyword:inputVal}, function(res){
                                        var h = '<div class="ks-input-smart">';
                                        $.loop(res.list, function(val){
                                            h += '<p value="'+val.value+'">'+val.title+'</p>';
                                        });
                                        h += '</div>';
                                        h = $(h);
                                        h.find('p').click(function(){
                                            t.val($(this).text());
                                            $.layerHide(intxtLayerID);
                                        });
                                        layer.find('.ks-layer-content').html(h);
                                    });
                                }
                            });
                        },300);
                    }
                });
            }
        });

        $.render('input[type="ks-password"]', function (ele) {
            var t = $(ele), at = t.attr();
            t.attr('type', 'password');
            t.wrap($.tag('span',{type : 'password', class : 'ks-input ks-password', 'style':at.style})).removeAttr('icon');

            t.before('<right icon="eye-off" active></right>');
            t.prevAll('right[active]').click(function () {
                var ths = $(this);
                var input = ths.nextAll('input');
                if (input.attr('type') == 'text') {
                    input.attr('type', 'password');
                    ths.addClass('ri-eye-off').removeClass('ri-eye-fill');
                } else {
                    input.attr('type', 'text');
                    ths.addClass('ri-eye-fill').removeClass('ri-eye-off');
                }
            });
        });

        $.render('input[type="ks-color"]', function (ele, isMonitor, monitorType) {
            var t = $(ele), at = t.attr();
            if(!isMonitor){
                t.attr('type', 'text');
                t.wrap($.tag('span',{type : 'password', class : 'ks-input ks-input-color', 'style':at.style, value:''}));

                t.before('<span></span>');
                let parent = t.parent();
                let color = t.val();
                if(color){
                    parent.find('span').css('background', color);
                    parent.attr('value', color);
                }
                $.colorPicker(parent, function (color) {
                    t.val(color).attr('value', color);
                    t.trigger('change');
                });

                t.change(function(){
                    let color = t.val();

                    parent.find('span').css('background', color);
                    parent.attr('value', color);
                });
            }

        });

        $.render('textarea[type="ks-textarea"]', function (ele) {
            var t = $(ele), at = t.attr();
            t.removeAttr('type');
            t.wrap('<span class="ks-input"></span>');
            t.wrap('<label class="ks-pos"></label>');

            var maxlength = parseInt(t.attr('maxlength'));
            if (maxlength) {
                t.after('<span class="ks-pos-4"> <i>' + t.val().length + '</i>/' + maxlength + '</span>');
                t.keyup(function () {
                    var n = t.val().length;
                    if (n > maxlength) {
                        t.val(t.val().substr(0, maxlength));
                    }
                    t.next('.ks-pos-4').children('i').text(t.val().length);
                });
            }
            //高度自适应
            if($.isset(at.auto)){
                t.height(t[0].scrollHeight);
                t.input(function(){
                    t.height(0);
                    t.height(t[0].scrollHeight);
                });
            }
        });

        $.render('input[type="ks-area"]' , function (t) {

            var Fd = ['province', 'city', 'area', 'town'];
            t = $(t);
            t.attr({
                'type' : 'hidden',
                'name' : ''
            }).wrap('<ks-area ' + (t.disabled() ? 'disabled' : '') + '></ks-area>');

            var attrs = t.attr();
            var maxlevel = 0;
            var h = '';
            var name = attrs.name;

            $.loop(Fd, function (val, k) {
                var v = attrs[val];
                var tname = name ? name + '[' + val + ']' : val;
                if (v) {
                    v = v.split(':');
                    h += '<span level="' + k + '">' +
                         '<input type="hidden" name="' + tname + '[id]" value="' + v[0] + '">' +
                         '<input type="hidden" name="' + tname + '[name]" value="' + v[1] + '">' +
                         v[1] +
                         '</span>';
                }
                if ($.isset(v)) {
                    maxlevel++;
                }
            });
            t.after(h);
            t.parent().click(function () {
                var obj = $(this);
                var input = obj.children('input[type="hidden"]');
                var attrs = input.attr();
                //禁用后不做任何操作
                if (attrs.disabled || obj.disabled()) {
                    return;
                }
                var defDt = {};

                $.loop(Fd, function (val, k) {
                    var v = attrs[val];
                    if (v) {
                        v = v.split(':');
                        defDt[k] = {id : v[0], name : v[1], level : k, field : val};
                    }
                });
                obj.area(attrs.title, defDt, function (dt) {
                    if (!dt.isEnd) {
                        return;
                    }
                    obj.removeAttr('province city area town');

                    var valueAttr = {};
                    $.loop(dt.data, function (val) {
                        var tname = name ? name + '[' + val.field + ']' : val.field;
                        valueAttr[val.field] = val.id + ':' + val.name;
                        obj.children('span[level="' + val.level + '"]').html(val.name + '<input type="hidden" name="' + tname + '[id]" value="' + val.id + '"><input type="hidden" name="' + tname + '[name]" value="' + val.name + '">');
                    });
                    input.attr(valueAttr);
                }, maxlevel, attrs.api);
            });

            //监听属性禁用变化事件
            t.DOMchange('attr.disabled', function () {
                t.parent().disabled($(this).disabled());
            });

        });

        $.render('input[type="ks-pic"]', function(t){
            var t = $(t), attrs = t.attr();
            t.attr({type:'file', 'name':'',  accept:'image/*', value:''});
            //多图片上传模式 name最后存在[]
            var isMultiple = /^.+\[\]$/g.test(attrs.name);
            var multipleMax = isMultiple ? parseInt(attrs.maxlength || 0) : 0;
            t.wrap('<ks-pic style="--progress:0%;"></ks-pic>').wrap('<label icon="image-add"></label>');
            let parentTag = t.parents('ks-pic');


            var picObj = t.parent().parent();
            if(attrs.value){
                try {
                    //多图模式
                    if(isMultiple){
                        //解析value值 必须传入(必须单引号) {'id'123, src:'图片地址'}
                        attrs.value = JSON.parse(attrs.value.replace(/'/g,'"'));
                        var addI = 0;
                        $.loop(attrs.value, function(val){
                            if(val.id){
                                t.parent().parent().before('<ks-pic><ks-pic-thumb>'+
                                                           '<img src="'+val.src+'">'+
                                                           '<span icon="delete-bin-2-fill" delapi="'+(attrs.delapi ? attrs.delapi : '')+'" data-id="'+val.id+'"></span>'+
                                                           '<input type="hidden" name="'+attrs.name+'" value="'+val.id+'">'+
                                                           '</ks-pic-thumb></ks-pic>');
                                addI ++;
                            }
                            if(multipleMax >0 && addI >= multipleMax){
                                picObj.hide();
                            }
                        });
                        //单图模式
                    }else{
                        t.parent().before('<ks-pic-thumb><img src="'+attrs.value+'"></ks-pic-thumb>');
                    }
                }catch (e) {
                }

            }

            function _inset(picList){
                var h = '';
                if(isMultiple){

                    $.loop(picList,function(value){
                        h += '<ks-pic><ks-pic-thumb>'+
                             '<img src="'+value.src+'">'+
                             '<input type="hidden" name="'+attrs.name+'" value="tmp:'+value.aid+'">'+
                             '<span icon="delete-bin-2-fill" delapi="'+attrs.api+'Del?aid='+value.aid+'" data-id="'+value.aid+'"></span>'+
                             '</ks-pic-thumb></ks-pic>';
                    });
                    picObj.before(h);
                    if(multipleMax >0 && picObj.prevAll('ks-pic').length == multipleMax){
                        picObj.hide();
                    }
                }else{
                    $.loop(picList,function(value){
                        h += '<ks-pic-thumb>'+
                             '<img src="'+value.src+'">'+
                             '<input type="hidden" name="'+attrs.name+'" value="'+value.aid+'">'+
                             '</ks-pic-thumb>';
                    });
                    var label = t.parent();
                    label.prev().remove();
                    label.before(h);
                }
                t.val('');
            }

            t.change(function(){
                //生成预览图
                const selectedFile = this.files[0];
                if (selectedFile) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const imageUrl = event.target.result;
                        if(!parentTag.find('span._preview').length){
                            parentTag.prepend('<span class="_preview"></span>');
                        }
                        parentTag.find('span._preview').html(`<img src="${imageUrl}">`);
                    };
                    reader.readAsDataURL(selectedFile);
                }
                if(attrs.api) {

                    //如果存在缩放属性时 则缩放后再上传
                    if (attrs.zoomhidth || attrs.zoomheight || attrs.zoom) {
                        parentTag.attr('uploading', true);
                        $.imgZoom(this, (attrs.zoomwidth || 1920), (attrs.zoomweight || 1080), function (blob) {
                            $.upload('upload', blob, attrs.api, function (dt) {
                                parentTag.removeAttr('uploading');
                                dt && $.isObject(dt) && dt.List && _inset(dt.List);
                            }, function(progress){
                                parentTag.css('--progress', progress+'%');
                            });
                        });
                    } else {
                        parentTag.attr('uploading', true);
                        $.upload('upload', t[0], attrs.api, function (dt) {
                            parentTag.removeAttr('uploading');
                            t.val('');
                            parentTag.css('--progress', '0%');
                            dt && $.isObject(dt) && dt.List && _inset(dt.List);
                        }, function(progress){
                            parentTag.css('--progress', progress+'%');
                        });
                    }
                }
            });

            t.DOMchange('val', function(val){
                !val && parentTag.find('span._preview').remove();
            });

        });

        $.render('input[type="ks-file"]', function(t, isMonitor){
            t = $(t);
            let attrs = t.attr();
            let isFiles = attrs.type.substring(3) == 'files';
            t.attr('type', 'file').css('display','none');
            isFiles && t.attr('multiple', true);
            let exts = '';
            let tit = attrs.text ? attrs.text : '选择文件';
            if(attrs.ext){
                exts = attrs.ext.replace(/\s+/g, ' ');
                exts = $.explode(' ', exts).map(function(v){
                    return '.'+v;
                });
                if(exts){
                    attrExt = $.implode(', ', exts);
                    exts = '('+$.implode(' ', exts)+')';
                    t.attr('accept', attrExt);
                    tit += ' '+exts;
                }
            }
            let maxlen = attrs.maxlength ? parseInt(attrs.maxlength) : 40;
            if(!attrs.style){
                attrs.style = {};
            }
            attrs.style['--progress'] = '0';

            t.wrap($.tag('label',{class:'ks-file', style : attrs.style}));
            t.after('<span class="ks-input-title" icon="upload-cloud-2">'+tit+'</span>');
            let parentTag = t.parents('.ks-file');
            t.change(function(){
                let name = this.files[0].name;
                if(name.length > maxlen){
                    name = '...'+name.substring(name.length - maxlen);
                }
                name += ' ('+$.byte2str(this.files[0].size)+')';
                if(this.files.length > 1){
                    name += ' 等'+this.files.length+'个';
                }
                t.next('span').text(name);

                if(attrs.api) {
                    parentTag.attr('uploading', true);
                    parentTag.attr('progress', '0');
                    $.upload('upload', t[0], attrs.api, function (dt) {
                        parentTag.removeAttr('uploading');
                        parentTag.removeAttr('progress');
                        t.val('');
                        parentTag.css('--progress', '0%');
                    }, function(progress){
                        parentTag.css('--progress', progress+'%');
                        parentTag.attr('progress', progress);
                    });
                }
            });
            t.DOMchange('val', function(val){
                !val && t.next('span').text(tit);
            });
        });

        //上传文件删除按钮绑定事件
        $(document).on('click', 'ks-pic-thumb > span[delapi]', function(){
            var ths = $(this), delApi = ths.attr('delapi');
            $.Dialog('confirm','操作提示','确认要删除该文件吗？',function(){
                if(delApi){
                    $.API(delApi, '', function(res){
                        ths.parent().parent().nextAll('ks-pic').show();
                        res.success && ths.parent().parent().remove();
                    });
                }else{
                    ths.parent().parent().nextAll('ks-pic').show();
                    ths.parent().parent().remove();
                }
            })
        });

        //星星评分显示
        $.render('ks-star', function(ele){
            ele = $(ele), attr = ele.attr(), value = parseInt(attr.value || 0);
            var h = '';
            $.loop(parseInt(attr.max || 5), function(i){
                h += '<i icon="star-fill" '+(value == i ? 'active' : '')+'></i>';
            });
            ele.html(h);

        }, 'attr.value');

        //轮播图
        $.render('.ks-slide', function (ele) {
            ele = $(ele);
            ele.slide(ele.attr());
        });

        //表格固定头部
        $.render('table.ks-table[fixed-height]', function (ele) {
            ele = $(ele);
            var fixedHeight = parseInt(ele.attr('fixed-height')) || 0;
            if (!fixedHeight) {
                return;
            }
            ele.attr('fixed-height', '');
            var thead = ele.children('thead');
            var allWidth = ele.width(true); //总宽度值
            var dom = $('<div class="ks-table-fixed-header"><div class="ks-table-header"></div><div class="ks-table-body" style="overflow-y: scroll; max-height:' + fixedHeight + 'px"></div></div>');

            var rowCols = ele.children().eq(0).children().children();
            var rowColsNum = rowCols.length - 1;

            var colgroup = '<colgroup>';
            rowCols.each(function (index, el) {
                if (index === rowColsNum) {
                    return;
                }
                var w = $(el).width(true) / allWidth * 100;
                colgroup += '<col style="width:' + w + '%; min-width: ' + w + '%">';
            });
            colgroup += '</colgroup>';
            ele.after(dom);
            dom.find('.ks-table-header').html('<table class="'+ele.attr('class')+'">' + colgroup + '</table>').find('table').append(thead);
            dom.find('.ks-table-body').append(ele[0]).find('table').prepend(colgroup);

            var scrollWidth = dom.find('.ks-table-body').width(true) - dom.find('.ks-table-body > table').width(true); //滚动条宽度
            var scrollTd = document.createElement('td');
            scrollTd.style.width = scrollWidth + 'px';
            scrollTd.className = 'ks-td-scroll';
            dom.find('.ks-table-header > table > thead > tr').append(scrollTd);

        });

        //自定义组件 表单结构
        $.render('ks-form', function (dom) {
            dom = $(dom);
            var domInline = $.isset(dom.attr('inline')),
                labelWidth = dom.attr('label-width');
            dom.find('ks-form-item').map(function (ele) {
                if (ele._ksa_render_ks_form_item) {
                    return;
                }
                ele._ksa_render_ks_form_item = 1;
                ele = $(ele);
                var attrs = ele.attr();
                //!domInline && ele.addClass('ks-clear');
                ele.wrapInner('<ks-form-content></ks-form-content>');
                attrs.label && ele.prepend('<ks-form-label ' + ($.isset(attrs.required) ? 'required' : '') + '>' + attrs.label + '</ks-form-label>');
                attrs.extra && ele.append('<ks-form-extra>' + attrs.extra + '</ks-form-extra>');
                ele.attr({label : '', extra : '', required : ''});

                if (labelWidth) {
                    labelWidth = $.isNumber(labelWidth) ? labelWidth + 'px' : labelWidth;
                    ele.find('ks-form-label').width(labelWidth);
                    ele.find('ks-form-content , ks-form-extra').width('calc(100% - ' + labelWidth + ')');
                }
            });
        });

        //自定义组件 提交按钮
        $.render('ks-btn[submit]', function (dom) {
            dom = $(dom);
            var submits = dom.attr('submit');
            var form = submits ? $(submits) : dom.parents('form');
            if (form.length) {
                dom.click(function () {
                    !dom.disabled() && form.submit();
                });
                //如果监听到确认键 直接提交
                form.keyup(function(e){
                    if(e.keyCode == 13){
                        form.submit();
                    }
                });
            }
        });

        //自定义组件 重置按钮
        $.render('ks-btn[reset]', function (dom) {
            dom = $(dom);
            var resets = dom.attr('reset');
            dom.attr('reset', '');
            var form = resets ? $(resets) : dom.parents('form');
            if (!form.length) {
                form = dom.parents('ks-form');
            }
            if (form.length) {
                dom.click(function () {
                    form.find('input:not([type="hidden"]), textarea').val('');
                    form.find('select').each(function(_, ele){
                        ele.selectedIndex = 0; // 将选择设置回初始状态
                        let el = $(ele);
                        el.val(el.children('option').eq(0).attr('value'));
                        el.trigger('change');
                    });
                });
            }
        });

        //自定义组件 折叠面板
        $.render('ks-collapse', function (ele) {
            $(ele).children().map(function (el) {
                el = $(el);
                var attr = el.attr();
                let title = el.children('ks-collapse-title');
                el.wrapInner('<ks-collapse-block></ks-collapse-block>').wrapInner('<ks-collapse-content></ks-collapse-content>');
                if(!title.length){
                    el.prepend('<ks-collapse-title>' + (attr.label || '') + '</ks-collapse-title>')
                    title = el.children('ks-collapse-title');
                }
                el.children('ks-collapse-content').before(title);


                var Pt = el.parent(), isAccordion = $.isset(Pt.attr('accordion'));
                var content = el.children('ks-collapse-content');
                let block = content.children('ks-collapse-block');
                //如果默认打开，必须赋予实际高度值以完成css3动画
                if (el.active()) {
                    content.height(content.children('ks-collapse-block').height(true, true));
                }
                if(attr['icon-right']){
                    title.addClass('ri-'+attr['icon-right']).attr('icon-right', true);
                }
                title.click(function () {
                    var maxH = block.height(true, true);
                    if (el.active()) {
                        content.height(0);
                        el.active(false);
                    } else {
                        content.height(maxH);
                        el.active(true);
                        var acList = isAccordion ? el.siblings() : !!0;//手风琴面板同辈
                        if (acList) {
                            acList.active(false);
                            acList.children('ks-collapse-content').height(0);
                        }
                    }
                });
            });
        });
        //自定义组件 价格标签
        $.render('ks-price', function (ele) {
            ele = $(ele);
            function _inup(v){

                var txtele = ele.contents();
                var txt = v ? v : txtele.eq(0).text().trim();
                txt = txt.toString();
                txtele.map(function(){
                    this.textContent = '';
                });
                txtele.nextAll('', 1).remove();
                txt = txt.replace(/([^\s0-9\.]+)/gi, '<unit>$1</unit>');
                txt = txt.replace(/(\.[0-9]+)/g, '<small>$1</small>');

                if ($.isset(ele.attr('split'))) {
                    txt = txt.replace(/([0-9]+)\.?/, function (v) {
                        return $.currency(v);
                    });
                }
                ele.append(txt);
            }
            var val = ele.text();
            var unit = ele.attr('unit');
            if(unit){
                val = unit+val;
            }
            _inup(val);
            ele.DOMchange('attr.value', function(str){
                _inup(str);
            });
        }, 'attr.value attr.unit');

        //自定义组件 卡片盒子
        $.render('ks-card', function (ele, isMonitor, monitorType) {
            ele = $(ele);
            var attrs = ele.attr();
            var title = ele.children('ks-card-title');
            var content = ele.children('ks-card-content');
            //如果没有定义content则包裹
            if (!content.length) {
                ele.wrapInner('<ks-card-content></ks-card-content>');
                content = ele.children('ks-card-content');
                title.length && ele.prepend(title);
            }
            //title存在 则附加title
            if(!isMonitor || monitorType == 'attr.label') {
                if (title.length) {
                    //二次监听渲染时处理
                    if (isMonitor) {
                        if (attrs.label) {
                            title.html(attrs.label);
                        } else {
                            title.remove();
                        }
                    }
                } else if (attrs.label) {
                    ele.prepend($.tag('ks-card-title', {icon: attrs.icon}, $.tag('div', {class: 'ks-fl'}, attrs.label)));
                    title = ele.children('ks-card-title');
                }
            }
            if(!isMonitor || monitorType == 'attr.size'){
                if(attrs.size){
                    content.removeClass('ks-p ks-p2 ks-p1');
                    if(attrs.size == 'small'){
                        content.removeClass('ks-p ks-p2 ks-p1').addClass('ks-p2');
                        title.length && title.attr('class', 'ks-ptb1 ks-plr2 ks-f2');
                    }else if(attrs.size == 'mini'){
                        content.removeClass('ks-p ks-p2 ks-p1').addClass('ks-p1');
                        title.length && title.attr('class', 'ks-p1  ks-f1');
                    }
                }else{
                    title.length && title.attr('class', 'ks-ptb2 ks-plr3 ks-f3');
                }
            }

        }, 'attr.label attr.size');

        //自定义组件 警示框渲染
        $.render('ks-alert', function (ele) {
            var ele = $(ele), attrs = ele.attr(), isClose = $.isset(attrs.close);
            var prehtml = '';
            if (attrs.title) {
                prehtml += '<ks-alert-title>' + attrs.title + '</ks-alert-title>';
            }
            if (isClose) {
                prehtml += '<ks-alert-close icon="close"></ks-alert-close>';
            }
            ele.prepend(prehtml);
            ele.attr('title', '');
            if (isClose) {
                ele.children('ks-alert-close').click(function () {
                    ele.css('opacity', '0');
                    window.setTimeout(function () {
                        ele.remove();
                    }, 300);
                });
            }
        });

        //自定义组件 头像组件
        $.render('ks-avatar', function (ele) {
            ele = $(ele);
            var attr = ele.attr();
            var code = '', label = attr.label && !attr.src ? attr.label : null;
            if (label) {
                code = label;
            } else if (attr.src) {
                code = ('<img src="' + attr.src + '">');
            } else {
                code = '<i icon="user"></i>';
            }
            ele.html(code);
        }, 'attr.label attr.src');

        //自定义组件 分页器渲染
        $.render('ks-page', function (ele) {
            function _pgTo(val, isInit) {
                if (ele.disabled() || val == ele[0].value) {
                    return;
                }
                if (val === 'prev') {
                    val = ele[0].value - 1;
                    val = val < 1 ? 1 : val;
                } else if (val === 'next') {
                    val = ele[0].value + 1;
                    val = val > total ? total : val;
                }
                val = parseInt(val);

                ele.children('ks-page-prev').disabled(val === 1);
                ele.children('ks-page-first').disabled(val < pageNum / 2);

                ele.children('ks-page-next').disabled(val === total);
                ele.children('ks-page-last').disabled(val > total - pageNum / 2);

                ele.attr('current', val);
                ele[0].value = val;
                var startPg = val - ((pageNum - 1) / 2);
                var endPg = total - pageNum + 1;
                startPg = startPg > endPg ? endPg : startPg;
                startPg = startPg < 1 ? 1 : startPg;
                ele.children('a').map(function (a) {
                    $(a).attr('value', startPg).text(startPg);
                    startPg++;
                });
                ele.children('a[value="' + val + '"]').active(true).siblings('a').active(false);
                ele.find('.ks-input-group > input').val(val);
                !isInit && ele.trigger('change');
            }

            ele = $(ele);
            var total = parseInt(ele.attr('total') || 0);
            if (!total) {
                return;
            }
            var current = parseInt(ele.attr('current') || 1);
            var pageNum = parseInt(ele.attr('numbers') || 5); //最多显示多少个页码

            var href = ele.attr('href');
            var pgcode = '';
            (function () {
                var start = Math.ceil(current - ((pageNum - 1) / 2));
                start = start < 1 ? 1 : start;

                var mx = Math.min(total + 1, start + pageNum);
                if (mx <= 2) {
                    return;
                }

                for (var i = start; i < mx; i++) {
                    pgcode += $.tag('a', {
                        active : current === i ? true : null,
                        value : i,
                        href : href ? href.replace('{{page}}', val) : null
                    }, i);
                }
            })();
            if (!pgcode) {
                return;
            }
            var H = '<ks-page-first icon="arrow-left" value="1"></ks-page-first><ks-page-prev icon="arrow-left-s" value="prev"></ks-page-prev>';
            H += pgcode;
            H += '<ks-page-next icon="arrow-right-s" value="next"></ks-page-next><ks-page-last icon="arrow-right" value="' + total + '"></ks-page-last>';
            if ($.isset(ele.attr('quick'))) {
                H += '<ks-input-group><i>转</i><input type="text" value="' + current + '"><i>页</i></ks-input-group>';
            }

            ele.html(H);
            _pgTo(current, true);
            ele.children('*:not(ks-input-group)').click(function () {
                var el = $(this);
                if (el.disabled()) {
                    return;
                }
                _pgTo(el.attr('value'));
            });
            ele.find('ks-input-group > input').keyup(function (e) {
                if (e.keyCode === 13) {
                    _pgTo(this.value);
                }
            }).focus(function () {
                $(this).select();
            });
        }, 'attr.total attr.current');

        //自定义组件 H5主框架
        $.render('ks', function (ele) {
            ele = $(ele);
            if (ele.children('ks-side').length) {
                ele.css('flex-direction', 'row');
            }


        });

        $.render('ks-navbar', function (ele) {
            ele = $(ele);
            var ks = ele.parent('ks');
            ks.attr('navbar', true);

                var navbarItem = ele.children('ks-navbar-item');
                var contents = ks.children('ks-content').children('ks-navbar-content');

                //显示底部导航对应的内容区
                function _navbarContentShow(el, key) {
                    contents.filter('[key="' + key + '"]').show().siblings().hide();
                }

                navbarItem.each(function (i, el) {
                    el = $(el);
                    var href = el.attr('href');

                    if(href){
                        el.click(function(){
                            window.location.href = href;
                        });
                    }
                    var skey = el.attr('key');
                    if (el.active()) {
                        _navbarContentShow(el, skey);
                    }
                    el.click(function () {
                        $(this).active(true);
                    }).DOMchange('attr.active', function () {
                        var el = $(this);
                        if (el.active()) {
                            //去掉同辈活动状态
                            el.siblings().active(false);
                            //更新content
                            _navbarContentShow(el, skey);
                        }
                    });
                });
        });

        //自定义组件 栅格
        $.render('ks-row', function (ele) {
            ele = $(ele);
            if (ele.children('ks-col').length) {
                ele.attr('flex', true);
            }
        });

        //自定义组件 tab
        $.render('ks-tab', function (ele) {
            ele = $(ele);

            function _titleStatus(N) {
                N = N >= 0 ? N : 0;
                title_item.eq(N).active(true).siblings().active(false);
            }

            var isTouch = $.isset(ele.attr('touch'));
            var title = ele.children('ks-tab-title');
            var title_item = title.children('ks-tab-title-item'); //子级标题
            var contentBox = ele.children('ks-tab-content'); //主内容框
            var content_item = ele.find('ks-tab-item');
            var itemLength = content_item.length;

            //如果标题栏不存在 则新建
            if(!title.length){
                title = $('<ks-tab-title></ks-tab-title>');
                content_item.each(function (i, el) {
                    el = $(el);
                    title.append($.tag('ks-tab-title-item', {active : el.active()}, (el.attr('label') || i) ));
                });
                ele.prepend(title);
                title_item = title.children('ks-tab-title-item');
            }

            //如果主内容框不存在 则创建
            if(!contentBox.length){
                content_item.wrapAll('<ks-tab-content></ks-tab-content>');
                contentBox = ele.children('ks-tab-content');
            }


            var currIndex = title_item.filter('[active]').index() || 0,
                moveX = 0,
                eleWidth = ele.width(true),
                touchMaxWidth = itemLength * eleWidth;


            contentBox.addClass('ks-clear');


            function  _play(N) {
                N = parseInt(N || 0);
                moveX = (0 - eleWidth * N);
                isTouch ? contentBox.removeClass('ks-no-transition').css({transform : 'translateX(' + moveX + 'px)'}) : content_item.eq(N).show().active(true).siblings().hide().active(false);
            }


            title_item.click(function () {
                if(!$(this).active()) {
                    _titleStatus($(this).index());
                }
            }).DOMchange('attr.active', function () {
                var ths = $(this);
                if(ths.active()){
                    var i = ths.index();
                    _play(i);
                    //ths.trigger('click'); //触发标题当前项click事件 暂时注释 会与tpl @事件冲突造成2次触发2021年1月23日 03:15:16
                }
            });

            if (isTouch) {
                contentBox.wrap('<ks-tab-touch-content></ks-tab-touch-content>')
                contentBox.width(touchMaxWidth);
                content_item.width(eleWidth);

                ele.children('ks-tab-touch-content').touch(function () {

                }, function (evn, touch) {
                    if (touch.action === 'left' || touch.action === 'right') {
                        var mx = (moveX + touch.moveX);
                        var max = 0 - (touchMaxWidth - eleWidth);
                        mx = mx > 0 ? 0 : (mx < max ?  max : mx);
                        contentBox.addClass('ks-no-transition').css({transform : 'translateX(' + mx + 'px)'})
                    }
                }, function (evn, touch) {
                    //横向移动距离超过10%才触发 x
                    if (currIndex < itemLength - 1 && touch.action == 'left') {
                        currIndex++;
                        //_play(currIndex);
                        title_item.eq(currIndex).trigger('click'); //触发标题当前项click事件
                    } else if (currIndex > 0 && touch.action == 'right') {
                        currIndex--;
                        //_play(currIndex);
                        title_item.eq(currIndex).trigger('click'); //触发标题当前项click事件
                    } else {
                        contentBox.removeClass('ks-no-transition').css({transform : 'translateX(' + moveX + 'px)'})
                    }
                }, 'X');
            }
            _play(currIndex);
            _titleStatus(currIndex);
        }, 'html');

        //自定义组件 tag标签关闭
        $.render('ks-tag[close], ks-tag[edit]', function (ele) {
            ele = $(ele);
            var attr = ele.attr();
            ele.wrapInner('<span></span>');
            if ($.isset(attr.edit)) {
                var input = $('<input type="hidden" value="' + ele.text() + '">');
                input.blur(function () {
                    var val = input.val();
                    input.attr('type', 'hidden');
                    input.prev().css('opacity', '').text(val);
                    $.callStrEvent.call(ele[0], attr.edit, val);
                }).click(function () {
                    return false;
                });
                ele.append(input);
                ele.click(function () {
                    input.prev().css('opacity', '0');
                    input.attr('type', 'text').focus().select();
                });
            }

            if ($.isset(attr.close)) {
                var btn = $('<i icon="close"></i>');
                btn.click(function (evn) {
                    var x;
                    attr.close && (x = $.callStrEvent.call(ele[0], attr.close, evn));
                    x !== false && ele.remove();
                    return false;//阻止冒泡
                });
                ele.append(btn);
            }
        });

        //title必须在最后渲染
        $.render('[title]', function (ele) {//title提示文字处理
            ele = $(ele);
            var tit = ele.attr('title');
            if (tit) {
                ele.hover(function () {
                    $.showTip(ele);
                    ele.attr('title', '');
                }, function () {
                    ele.attr('title', tit);
                });
            }
        });

        $.render('ks-progress', function (ele) {
            let el = $(ele);
            let value = el.attr('value');
            let span = el.find('span');
            if(!span.length){
                el.html('<span style="width: 0;"></span><i></i>');
                span = el.find('span');
            }

            el.find('i').text(value+'%');
            span.css('width', value+'%');

        }, 'attr.value');

        $.render('ks-announcement', function (ele) {
            let el = $(ele);
            let attr = el.attr();
            el.announcement(attr.time);
        });


        //图标转换
        $.render('[icon]', function (ele) {
            var icon = ele.attributes.icon.value;
            if (icon) {
                ele.className += ' ri-' + icon;
            }
        });


        /**
         * select联动触发
         * 当select 同时带 api 与 to 属性时
         * 选中后POST={value=值}到api指定url中，然后将url返回的列表数据填充到toselect
         * api要求返回：
         * [
         *    {id:值, value:'显示的名称'},
         *    ...
         * ]
         */
        $(document).on('change', '.ks-select > select[api]', function () {
            let ele = $(this);
            let url = ele.attr('api');
            let toselect = ele.attr('to');
            if(url && toselect){
                let val = ele.val();
                $.API(url, {value:val}, function (dt) {
                    if(dt){
                        let option = '';
                        $.loop(dt, function (v, k) {
                            option += '<option value="'+v.id+'">'+v.value+'</option>';
                        });
                        option = option ? option : '<option>暂无</option>';
                        $(toselect).html(option).trigger('change');
                    }
                });
            }
        });


    })();

    //开始渲染流程
    _KSArenderStart();
})(KSA);