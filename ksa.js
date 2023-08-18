/**
 * KSA前端底层驱动 V2.0
 *
 * 目前版本还处于开发中，请勿保存并用于生产环境！
 *
 * ---------------------------------------
 * 待正式发布版本后，源代码将会公开开源
 *
 * Author : ksaos.com && cr180.com(Mr Wu -  ChenJun)
 * Update : 2020年7月29日
 */
function debug(data) {
    console.log.apply(this, arguments);//debug
}

var consoleGroupN = {};

function debugTime(key) {
    consoleGroupN[key] = consoleGroupN[key] >= 0 ? consoleGroupN[key] + 1 : 0;
    key = key + '-' + consoleGroupN[key];
    console.time(key);
    return function () {
        console.timeEnd(key);
    };
}

(function (document, undefined, K) {
    "use strict";
    //on绑定事件时的索引
    var bindEventData = {};

    /**
     * 给事件对象统一加上阻止冒泡事件
     * @param events
     * @returns {*}
     */
    function eventAddstopPropagation(events) {
        if (events) {
            events.isStop = false;
            events.stop = function () {
                this.stopPropagation();
                this.preventDefault();
                this.isStop = true;
            }
        }
        return events;
    }

    //浏览器不会单独解析table某个标签，它们必须有规则的在一起
    //所以需要针对table做单独的处理
    var wrapMap = {
        thead : [1, "<table>", "</table>"],
        col : [2, "<table><colgroup>", "</colgroup></table>"],
        tr : [2, "<table><tbody>", "</tbody></table>"],
        td : [3, "<table><tbody><tr>", "</tr></tbody></table>"],
        _default : [0, "", ""]
    };
    wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
    wrapMap.th = wrapMap.td;
    var rtagName = (/<([a-z][^\/>\x20\t\r\n\f]*)/i);

    /**
     * 字符串转虚拟dom
     * @param code
     * @returns {ActiveX.IXMLDOMNodeList | NodeListOf<ChildNode>}
     */
    function createDom(code, isEle) {
        var fragment = document.createDocumentFragment();
        var tag = (rtagName.exec(code) || ["", ""])[1].toLowerCase();
        var wrap = wrapMap[tag] || wrapMap._default;
        //创建虚拟dom并写入字符串
        //var dom = document.createRange().createContextualFragment(code);
        var dom = fragment.appendChild(document.createElement("div"));
        dom.innerHTML = wrap[1] + code + wrap[2];
        var j = wrap[0];
        while (j--) {
            dom = dom.lastChild;
        }
        //script的处理
        var globalScriptEvent = {}, //等待上一次script标签完成加载后需要执行的code
            scriptLoadCallback = {}, //存在src属性的script标签 队列，load成功后自动删除
            scriptSrcLast, scriptSrcLastID; //上一次存在src属性的script标签标记
        $(dom).find('script').map(function (ele) {
            var script = document.createElement('script');
            $.loop($.attrs(ele), function (v, k) {
                script[k] = v;
            });
            var scriptID = $.objectID(script);
            if (ele.src) {
                scriptLoadCallback[scriptID] = ele;
                script.onload = function () {
                    delete scriptLoadCallback[scriptID];
                    //如果队列为空
                    if ($.isEmpty(scriptLoadCallback)) {
                        $.loop(globalScriptEvent[scriptID], function (elArr) {
                            elArr[0].text = elArr[1];
                        });
                    }
                };
                scriptSrcLast = script;
                scriptSrcLastID = scriptID;
            }
            if (scriptSrcLastID) {
                if (ele.text) {
                    globalScriptEvent[scriptSrcLastID] = globalScriptEvent[scriptSrcLastID] ? globalScriptEvent[scriptSrcLastID] : [];
                    globalScriptEvent[scriptSrcLastID].push([script, ele.text]);
                }
            } else {
                script.text = ele.text;
            }
            $(ele).after(script).remove();
        });


        var eles = [];
        $.loop(dom.childNodes, function (e) {
            if (!isEle || (e.nodeType !== 3 && e.nodeType !== 8)) {
                eles.push(e);
            }
        });
        return eles;
    }

    $.getScript = function(url, callFun){
        var script = document.createElement('script');
        script.src = url;
        script.onload = function () {
            callFun && callFun();
        };
        $('head').append(script);
    }

    $.getCSS = function(url, callFun){
        var script = document.createElement('link');
        script.rel = 'stylesheet';
        script.type = 'text/css';
        script.href = url;
        script.onload = function () {
            callFun && callFun();
        };
        $('head').append(script);
    }


    /**
     * 创建临时dom并回调
     * @param {html|Node} code html或节点
     * @param {function} callback 回调函数
     * @param {boolean} reOrder 是否倒序回调
     * @returns {tempDom}
     */
    function tempDom(code, callback, reOrder) {
        var dom;
        var isFunc = $.isFunction(code);
        if (code instanceof $) {
            dom = code;
        } else if ($.isDomAll(code)) {
            dom = code instanceof NodeList ? code : [code];
        } else if ($.isArray(code)) {
            dom = code;
            //创建一个虚拟dom
        } else if ($.isString(code)) {
            dom = createDom(code);
        }
        //将传入的html或dom对象添加到虚拟dom中
        var length = this.length;
        $.loop(this, function (ele, index) {
            var isClone = index !== length - 1;
            if (isFunc) {
                dom = code.call(ele, index, ele.innerHTML);
                if ($.isString(dom)) {
                    dom = createDom(dom);
                    isClone = 0;
                }
                if (dom instanceof $) {
                    dom = [dom[0]];
                    isClone = 0;
                } else if (dom instanceof HTMLElement || dom instanceof Node) {
                    isClone = 0;
                }
                dom = $.toArray(dom);
            }
            var n = !reOrder ? dom.length : 0;
            var i = reOrder ? dom.length - 1 : 0;
            while (reOrder ? i >= 0 : i < n) {
                var eles = dom[i];
                eles = !isClone ? eles : $(eles).clone(true, true)[0];
                callback.call(ele, ele, eles);
                reOrder ? i-- : i++;
            }
        });
        return this;
    }

    /**
     * 检查指定元素是否被选择器选择
     * @param ele 需要检查的元素
     * @param selector 选择器
     * @returns {boolean|number|*}
     */
    function isSelectDom(ele, selector) {
        if (!selector || !ele || ele.nodeType !== 1) {
            return false
        }
        var matchesSelector = ele.matches || ele.matchesSelector || ele.webkitMatchesSelector || ele.mozMatchesSelector || ele.msMatchesSelector || ele.oMatchesSelector;
        try {
            return matchesSelector.call(ele, selectorStr(selector));
        } catch (e) {
            console.error(new Error('选择器语法可能有错误：' + selector));
        }
    }

    /**
     * 递归遍历DOM节点
     * @param element 需遍历的dom
     * @param key 需遍历的节点
     * @param selector 选择器
     * @returns {[]}
     */
    function dir(element, key, selector) {
        var rdom = [];
        $.loop(element, function (el) {
            while ((el = el[key])) {
                if (!selector || isSelectDom(el, selector)) {
                    rdom.push(el);
                }
            }
        });
        return rdom;
    }

    function selectorStr(selector) {
        if (selector) {
            selector = selector.trim();
            selector = selector.replace(/(:selected)/g, ':checked');//option需要使用checked选中
        }
        return selector;
    }

    function selectorAll(dom, selector) {
        selector = selectorStr(selector);
        if(selector.substr(0,1) =='>'){
            selector = ':scope '+selector;
        }
        var ele = dom.querySelectorAll(selector);
        //如果选择器没有找到 尝试查找ks-selector属性
        if (!ele.length && selector.indexOf('[') === -1) {
            ele = dom.querySelectorAll('[ks-selector="' + selector + '"]');
        }
        return ele;
    }

    function $(selector) {
        var dt = new K_S_A(selector);
        dt.__proto__ = K;
        return dt;
    }

    function K_S_A(selector) {
        if (selector) {
            if (selector instanceof $) {
                return selector;
            } else if ($.isWindow(selector) || $.isDomAll(selector)) {
                selector = [selector];

            } else if ($.isString(selector)) {
                selector = selectorStr(selector);
                //选择器存在左尖括号并且大于3个字符 则认为是html源码 = 创建虚拟dom
                if (selector.indexOf('<') === 0 && selector.length >= 3) {
                    selector = createDom(selector, true);
                } else {
                    selector = [].slice.call(selectorAll(document, selector));
                }

            } else if ($.isFunction(selector)) {
                $.ready(selector);
                return;
            }
            var length = selector.length;
            var obj = {};
            $.loop(selector, function (ele, key) {
                obj[key] = ele;
            });
            selector = obj;
            selector.length = length;
        } else {
            selector = {length : 0};
        }

        if (selector.length) {
            $.arrayMerge(this, selector);
            this.length = selector.length;
        }
        return this;
    }

    K_S_A.prototype = $.prototype = K = {};

    /**
     * 文档加载完成后执行代码
     * 与jQuery用法相同
     * @param callback
     * @returns {*}
     */
    var DocumentReadyFunction = [];
    K.ready = function (callback) {
        this.map(function (ele) {
            //如果是document与window的事件 则送到队列中 防止多次触发
            if (ele === document || ele === window) {
                DocumentReadyFunction.push(function () {
                    callback.call(ele)
                });
            } else {
                ele.addEventListener('DOMContentLoaded', function () {
                    callback.call(ele);
                }, false);
            }
        });
        return this;
    }


    /**
     * 监听dom变化（仅在KSA语法中有效）
     */
    K.DOMchange = function (action, Callback) {
        this.map(function (ele) {
            var isBindEvent = ele.KSADOMchangeEvent ? true : false;
            if (!ele.KSADOMchangeEvent) {
                ele.KSADOMchangeEvent = {};
            }
            $.loop($.explode(' ', action, ''), function (ac) {
                ac = ac.toLowerCase();
                if (!ele.KSADOMchangeEvent[ac]) {
                    ele.KSADOMchangeEvent[ac] = [];
                }
                ele.KSADOMchangeEvent[ac].push(Callback);
            });
            //如果已经绑定过事件，则不再绑定
            if (isBindEvent) {
                return;
            }
            $(ele).on('KSADOMchange', function (e) {
                var ths = this, Arg = e.KSAcallbackArgs;
                Arg[0] = Arg[0].toLowerCase();
                //Arg参数 1=动作 2=新值 3=旧值
                if (!this.KSADOMchangeEvent || !this.KSADOMchangeEvent[Arg[0]]) {
                    return;
                }
                $.loop(this.KSADOMchangeEvent[Arg[0]], function (fun) {
                    fun.apply(ths, [Arg[1], Arg[2]]);
                });
            });
        });
        return this;
    }

    /**
     * 克隆一个元素
     * 与jQuery用法相同
     * @param {boolean} withs 是否需要克隆子元素
     * @param {boolean} deepWith 是否需要克隆事件
     * @returns {*|jQuery|HTMLElement}
     */
    K.clone = function (withs, deepWith) {
        var newObj = $();
        this.each(function (index, ele) {
            var eleID = $.objectID(ele);
            var events = bindEventData[eleID];
            var newEle = ele.cloneNode(withs);
            $.objectID(newEle, '');
            //复制事件
            if (deepWith && events) {
                var $newEle = $(newEle);
                $.loop(events, function (evn, evnName) {
                    $.loop(evn, function (ev) {
                        $newEle.on(evnName, ev.selector, ev.callback);
                    })
                });
            }
            newObj.push(newEle);
        });
        return newObj;
    }


// ====================== 创建虚拟DOM ====================== //
    $.dom = function (code) {
        var dom = createDom(code);
        return dom.length === 1 ? dom[0] : dom;
    }

// ====================== 文档操作 ====================== //

    /**
     * 更新元素的class值
     * @param ele 元素对象
     * @param inClass 需要处理的class 多个以空格分割
     * @param isDel 是否为删除
     * @param ms 是否需要延迟 毫秒
     */
    function eleUpdateClass(ele, inClass, isDel, ms) {
        if (!inClass) {
            return;
        }

        function _clsrun() {
            var className = ele.getAttribute('class') || '';
            var newClass = {};
            $.loop($.explode(' ', (className + ' ' + inClass), ''), function (val) {
                val = val.trim();
                if (val) {
                    newClass[val] = 1;
                }
            });

            if (isDel) {
                inClass = $.explode(' ', inClass, '');
                $.loop(newClass, function (val, key) {
                    if ($.inArray(key, inClass)) {
                        delete newClass[key];
                    }
                });
            }
            newClass = $.implode(' ', Object.keys(newClass));

            if (newClass && newClass != className) {
                ele.className = newClass;
            } else if (!newClass) {
                ele.removeAttribute('class');
            }
        }

        if (ms > 0) {
            window.setTimeout(_clsrun, ms);
        } else {
            _clsrun();
        }
    }

    /**
     * 添加class
     * 最后更新 : 2020年6月19日 20:01:50
     * 与jQuery用法相同
     * @param name 需要添加的class值，多个以空格分割
     * @param ms 延迟多少毫秒后添加
     * @returns {$}
     */
    K.addClass = function (name, ms) {
        if (name) {
            var msArr = ms && $.isArray(ms) ? ms : null;
            this.each(function (index, ele) {
                var inms = msArr ? msArr[index] : ms;
                eleUpdateClass(ele, name, false, inms);
            });
        }
        return this;
    }

    /**
     * 删除class
     * 最后更新 : 2020年6月19日 20:01:50
     * 与jQuery用法相同
     * @param name 需要删除的class值，多个以空格分割
     * @param ms 多少毫秒后删除
     * @returns {$}
     */
    K.removeClass = function (name, ms) {
        if (name) {
            var msArr = ms && $.isArray(ms) ? ms : null;

            this.each(function (index, ele) {
                var inms = msArr ? msArr[index] : ms;
                eleUpdateClass(ele, name, true, inms);
            });
        }
        return this;
    }

    /**
     * 检查被选元素集合中是否存在指定class
     * 与jQuery用法相同
     * @param cls
     * @returns {boolean}
     */
    K.hasClass = function (cls) {
        var ele, i = 0;
        while ((ele = this[i++])) {
            if (ele.nodeType === 1) {
                var cl = ele.getAttribute('class');
                if (cl && cl.length && $.inArray(cls, $.explode(' ', cl, ''))) {
                    return true;
                }
            }
        }

        return false;
    }


    K.prop = function (key, value) {
        key = $.explode(' ', key, '');
        //删除或更新
        if ($.isset(value)) {
            value = value === '' ? null : value;
            this.map(function (ele) {
                $.loop(key, function (k) {
                    //移除模式
                    if (value === null) {
                        delete ele[k];
                        //更改模式
                    } else if ($.isset(value)) {
                        var old = ele[k];
                        if (old !== value) {
                            ele[k] = value;
                            $(ele).trigger('KSADOMchange', ['attr.' + k, value, old]);
                        }
                    }
                });
            });
            return this;
            //读取模式
        } else {
            var ele = this[0];
            if (!ele) {
                return;
            }
            var dt = {};
            $.loop(key, function (k) {
                dt[key] = ele[key];
            });
            if (key.length === 1) {
                return dt[key[0]];
            } else {
                return dt;
            }
        }
    };


    var ElementAttrBooleanArr = ['active', 'checked', 'selected', 'async', 'autofocus', 'autoplay', 'controls', 'defer', 'disabled', 'hidden', 'ismap', 'loop', 'multiple', 'open', 'readonly', 'required', 'scoped'];

    /**
     * 读取指定元素所有attr属性值
     * @param {*} ele
     */
    $.attrs = function (ele) {
        if (!ele || !ele.attributes) {
            return;
        }
        var attrs = {};
        $.loop(ele.attributes, function (val) {
            var v = val.value;
            if ($.inArray(val.name, ElementAttrBooleanArr)) {
                v = $.inArray(val.name, ['checked', 'selected']) ? ele[val.name] : v;
                v = v === '' ? true : !!v;
            }
            attrs[val.name] = v;
        });
        return attrs;
    }

    /**
     * 设置元素原生属性与标签属性
     * @param key 属性名
     * @param value 属性值
     * @param isCustom 是否为自定义属性
     * @returns {EleAttrPropUped|boolean}
     * @constructor
     */
    function EleAttrPropUped(key, value, isCustom) {
        var isValue = $.isset(value);
        value = !!value;
        if (!isValue) {
            var ele = this[0];
            if (!ele) {
                return;
            }
            if (ele.tagName === 'INPUT' && $.inArray(key, ['checked'])) {
                return ele[key];
            }
            var val = ele.getAttribute(key);
            if ($.isNull(val)) {
                val = ele[key];
            }
            val = val === '' ? true : val;
            return $.inArray(val, ['false', 'undefined', 'null']) ? false : !!val;
        } else if ($.isset(value)) {
            this.map(function (ele) {
                var old = ele[key];
                if (old === value) {
                    return;
                }
                if (value) {
                    ele[key] = value;
                    ele.setAttribute(key, key);
                } else {
                    if (isCustom) {
                        delete ele[key];
                    } else {
                        ele[key] = false;
                    }
                    ele.removeAttribute(key);
                }
                $(ele).trigger('KSADOMchange', ['attr.' + key, value, old]);
            });
            return this;
        }
    }

    K.checked = function (value) {
        return EleAttrPropUped.call(this, 'checked', value);
    }

    K.selected = function (value) {
        return EleAttrPropUped.call(this, 'selected', value);
    }

    K.disabled = function (value) {
        return EleAttrPropUped.call(this, 'disabled', value);
    }
    K.active = function (value) {
        return EleAttrPropUped.call(this, 'active', value, 1);
    }


    /**
     * attr操作
     * 与jQuery用法相同
     * key与value都不传值时表示读取所有属性 以object方式返回
     * 如选择器有多个节点，则根据节点序号以数组方式返回
     * @param {string|object} key 属性名支持单个值、多个值(空格分开)、对象（写入模式，键名=属性名 键值=属性值）
     * @param value 属性值 不传入=读取模式 null|空值=删除模式
     * @returns {K|[]}
     */
    K.attr = function (key, value) {
        value = value === '' ? null : value;
        var valueIsNull = value === null;
        var isKey = $.isset(key);
        var keyIsobj = $.isObject(key);
        var isvalue = $.isset(value);
        var md = '';
        if (keyIsobj || (isKey && isvalue && !valueIsNull)) {
            md = 'set';
        } else if (isKey && valueIsNull) {
            md = 'del';
        } else if ((!isKey || !keyIsobj) && !isvalue) {
            md = 'get';
        }

        if (!keyIsobj) {
            key = $.explode(' ', key, '');
        }
        var dataAttr = {};//需要变更的-data属性
        if (md == 'get') {
            var ele = this[0];
            if (!ele) {
                return;
            }
            var attrs = {};
            //读取所有标签属性
            if (!isvalue && !isKey) {
                attrs = $.attrs(ele);
            } else {
                $.loop(key, function (k) {
                    var attrV = ele.getAttribute(k);
                    if (!$.isNull(attrV)) {
                        attrs[k] = attrV;
                    }
                });
            }
            if (key.length === 1) {
                return attrs[key[0]];
            } else {
                return attrs;
            }
            //写入模式
        } else if (md == 'set') {
            var sets;
            if (keyIsobj) {
                sets = key;
            } else {
                sets = {};
                $.loop(key, function (k) {
                    sets[k] = value;
                });
            }
            if (sets) {
                this.map(function (ele) {
                    var oldAttrs = $.attrs(ele);
                    var isUpdate;
                    $.loop(sets, function (val, k) {
                        var odV = oldAttrs[k] === '' ? true : oldAttrs[k];//如果旧值是空值 则以true表示

                        //新旧值不同才更新
                        if (!odV || val !== odV) {
                            val === '' || $.isNull(val) ? ele.removeAttribute(k) : ele.setAttribute(k, (val === true ? '' : val));
                            $(ele).trigger('KSADOMchange', ['attr.' + k, val, odV]);
                            if (k.indexOf('data-') === 0) {
                                dataAttr[k.substr(5)] = val;
                            }
                            isUpdate = 1;
                        }
                    });
                    //触发ele的属性变更事件
                    isUpdate && $(ele).trigger('KSADOMchange', ['attr']);
                });
            }
            if (!$.isEmpty(dataAttr)) {
                this.data(dataAttr);
            }
            return this;

        } else if (md == 'del') {

            this.map(function (ele) {
                var attrs = $.attrs(ele);
                $.loop(key, function (k) {
                    if (k.indexOf('data-') === 0) {
                        dataAttr[k.substr(5)] = null;
                    }
                    ele.removeAttribute(k);
                    $.isset(attrs[k]) && $(ele).trigger('KSADOMchange', ['attr.' + k]);
                });
            });
            if (!$.isEmpty(dataAttr)) {
                this.data(dataAttr);
            }
            return this;
        }
    }

    /**
     * 移除元素属性
     * 与jQuery用法相同
     * @param key
     * @returns {*}
     */
    K.removeAttr = function (key) {
        if (key) {
            this.attr(key, null);
        }
        return this;
    }

    /**
     * 设置或返回元素data-属性值
     * 与jQuery用法相同
     * @param key
     * @param value
     * @returns {{}|*}
     */
    K.data = function (key, value) {
        value = value === '' ? null : value;
        var valueIsNull = value === null;
        var isKey = $.isset(key);
        var keyIsobj = $.isObject(key);
        var isvalue = $.isset(value);
        var md = '';
        if (keyIsobj || (isKey && isvalue && !valueIsNull)) {
            md = 'set';
        } else if (isKey && valueIsNull) {
            md = 'del';
        } else if ((!isKey || !keyIsobj) && !isvalue) {
            md = 'get';
        }

        key = key && !keyIsobj ? $.explode(' ', key, '') : key;

        if (md == 'set') {
            this.map(function (ele) {
                if (!ele._KSAOS_COM_ELE_DATA) {
                    ele._KSAOS_COM_ELE_DATA = {};
                }
                var _Attrs = ele._KSAOS_COM_ELE_DATA;
                var setData = {};
                if (keyIsobj) {
                    setData = key;
                } else {
                    $.loop(key, function (k) {
                        setData[k] = value;
                    });
                }
                $.loop(setData, function (v, k) {
                    v = v === '' ? null : v;
                    var sk = 'data-' + k;
                    if (!$.isObject(v)) {
                        //值为null则删除
                        if ($.isNull(v)) {
                            ele.removeAttribute(sk);
                            $.isset(_Attrs[k]) && delete _Attrs[k];
                            $(ele).trigger('KSADOMchange', ['data.' + k]);
                            //值不同才更新
                        } else if (_Attrs[k] !== v) {
                            ele.setAttribute(sk, v);
                            $(ele).trigger('KSADOMchange', ['data.' + k, v, _Attrs[k]]);
                            _Attrs[k] = v;
                        }
                    } else {
                        _Attrs[k] = v;
                    }
                });
            });
            return this;

        } else if (md == 'get') {
            var ele = this[0];
            if (!ele) {
                return;
            }
            if (!ele._KSAOS_COM_ELE_DATA) {
                ele._KSAOS_COM_ELE_DATA = {};
            }
            if (key) {
                var getdt = {};

                $.loop(key, function (k) {
                    var v = ele._KSAOS_COM_ELE_DATA[k];
                    if (!$.isset(v)) {
                        v = ele.getAttribute('data-' + k);
                    }
                    if (!$.isNull(v)) {
                        getdt[k] = v;
                    }
                });
                if (key.length === 1) {
                    return getdt[key[0]];
                } else {
                    return getdt;
                }
            } else {
                var getdt = ele._KSAOS_COM_ELE_DATA || {};
                $.loop(this.attr(), function (val, k) {
                    if (k.indexOf('data-') === 0) {
                        getdt[k.substr(5)] = val;
                    }
                });
                if (!$.isEmpty(getdt)) {
                    return getdt;
                }
            }
        } else if (md === 'del') {
            this.map(function (ele) {
                var _Attrs = ele._KSAOS_COM_ELE_DATA;
                if (_Attrs) {
                    $.loop(key, function (k) {
                        if ($.isset(_Attrs[k])) {
                            $(ele).trigger('KSADOMchange', ['data.' + k, undefined, _Attrs[k]]);
                            ele.removeAttribute('data-' + k);
                            delete _Attrs[k];
                        }

                    });
                }
            });
            return this;
        }

    }

    /**
     * 移除data-属性
     * 与jQuery用法相同
     * @param key
     * @returns {*}
     */
    K.removeData = function (key) {
        if (key) {
            this.data(key, null);
        }
        return this;
    }

    /**
     * 清空节点
     * 与jQuery用法相同
     */
    K.empty = function () {
        this.map(function (ele) {
            var h = ele.innerHTML;
            ele.innerHTML = '';
            $(ele).trigger('KSADOMchange', ['html', '', h]);
        });
        return this;
    }

    /**
     * 表单值的读写
     * 与jQuery用法相同
     * @param value
     * @returns {K|[]}
     */
    K.val = function (value) {
        //写入值
        if ($.isset(value) && value !== null) {
            this.map(function (ele, index) {
                if ($.inArray(ele.tagName, ['INPUT', 'SELECT', 'TEXTAREA'])) {
                    if ($.isFunction(value)) {
                        var oldvalue = ele.value;
                        if (ele.tagName == 'SELECT' && ele.multiple) {
                            oldvalue = [];
                            $.loop(ele.options, function (e) {
                                e.selected && oldvalue.push(e.value);
                            });
                        }
                        value = value.call(ele, index, oldvalue);
                    }
                    //所有选中状态必须经过attr函数 否则无法完成变更事件触发
                    switch (ele.tagName) {
                        case 'INPUT':
                            var tp = ele.getAttribute('type');
                            tp = tp.indexOf('ks-') === 0 ? tp.substr(3) : tp;

                            if (tp === 'checkbox') {
                                var val = $(ele).attr('value');
                                if ($.isset(val)) {
                                    $(ele).checked($.isArray(value) ? $.inArray(val, value) : val == value);
                                } else {
                                    $(ele).checked($.isObject(value) ? $.isEmpty(value) : !!value);
                                }

                            } else if (tp === 'radio') {
                                $(ele).checked($(ele).attr('value') == value);
                            } else {
                                ele.value = value;
                            }
                            break;
                        case 'SELECT':
                            value = $.isArray(value) ? value : [value];
                            if (ele.options) {
                                if(value.length == 1){
                                    ele.value = value[0];

                                }else{
                                    $.loop(ele.options, function (e) {
                                        var r = $.inArray(e.value, value);
                                        if (r != e.selected) {
                                            e.selected = r;
                                            $(e).attr('selected', 'selected');
                                        }
                                    });
                                }
                            }
                            $(ele).trigger('ksachange');//触发内部事件
                            break;
                        case 'TEXTAREA':
                            ele.value = value;
                            break;
                        default:
                    }
                    $(ele).trigger('KSADOMchange', ['val', value]);
                }
            });
            return this;

            //获取值，如果有多个对象，则按数组顺序返回对应值
        } else {
            var t = [];
            var ele = this[0];
            if (!ele || ele.disabled) {
                return;
            }

            var tg = ele.tagName;
            switch (tg) {
                case 'INPUT':
                    var tp = ele.getAttribute('type');
                    tp = tp.indexOf('ks-') === 0 ? tp.substr(3) : tp;
                    if ($.inArray(tp, ['checkbox', 'radio'])) {
                        ele.checked && t.push(ele.value);
                    } else {
                        t.push(ele.value);
                    }

                    break;
                case 'SELECT':
                    $(ele).find('option:selected').map(function (e) {
                        t.push(e.value);
                    });
                    break;
                case 'TEXTAREA':
                    t.push(ele.value);
                    break;
                default:
            }
            if (t.length === 1) {
                return t[0];
            } else {
                return t;
            }
        }
    }

    /**
     * 写入或读取文本
     * 与jQuery用法相同
     * @param {html|Node} value 传值表示写入
     * @returns {string|$}
     */
    K.text = function (value) {
        if ($.isset(value)) {
            this.map(function (ele, index) {
                if (ele.nodeType === 1 || ele.nodeType === 11 || ele.nodeType === 9) {
                    var oldtxt = ele.textContent;
                    if (oldtxt != value) {
                        ele.textContent = $.isFunction(value) ? value.call(ele, index, oldtxt) : value;
                        $(ele).trigger('KSADOMchange', ['html', value, oldtxt]);
                    }
                } else if (ele.nodeType === 3) {
                    var oldtxt = ele.textContent;
                    ele.textContent = $.isFunction(value) ? value.call(ele, index, oldtxt) : value;
                    $(ele).trigger('KSADOMchange', ['html', value, oldtxt]);
                }
            });
            return this;
        } else {
            var t = [];
            this.map(function (ele) {
                t.push(ele.textContent || '');
            });
            return t.join("\n");
        }
    };

    /**
     * 遍历所有直接子节点（包含文本节点）
     * 与jQuery用法相同
     * @returns {string|K}
     */
    K.contents = function () {
        var newObj = $();
        this.map(function (ele) {
            $.loop(ele.childNodes, function (e) {
                newObj.push(e);
            });
        });
        return newObj;
    };

    /**
     * 写入或读取HTML源码
     * 与jQuery用法相同
     * @param {html|Node} value 传值表示写入
     * @returns {string|$}
     */
    K.html = function (value) {
        if ($.isset(value)) {
            this.map(function (ele, index) {
                $(ele).empty().append($.isFunction(value) ? value.call(ele, index, ele.innerHTML) : value);
                $(ele).trigger('KSADOMchange', ['html', value]);
            });
            return this;
        } else {
            var t = [];
            this.map(function (ele) {
                t.push(ele.innerHTML || ele.textContent);
            });
            return t.join("");
        }
    };
    K.outerHtml = function () {
        var t = [];
        this.map(function (ele) {
            t.push(ele.outerHTML || ele.textContent);
        });
        return t.join("");
    };

    /**
     * 获取指定域中的表单数据
     * 必须通过$选择器触发
     * @param isFormData 是否返回FormData对象
     * @returns {{}}
     */
    K.formData = function (isFormData) {
        var formData = {};
        var ele = this[0];
        if (isFormData) {
            formData = new FormData(ele);
        } else {
            $(ele).find('input, textarea, select').each(function (i, el) {
                el = $(el);
                var name = el.attr('name');
                name = name ? name.trim() : '';
                if (name) {
                    var val = el.val();
                    var type = el.attr('type');
                    let isArr = /\[\]$/.test(name);
                    if(isArr){
                        name = name.replace(/(.*?)\[\]&/ig, '$1');
                    }
                    if(isArr){
                        if(!formData[name]){
                            formData[name] = [];
                        }
                        if (type === 'file') {
                            formData[name].push(el[0].files.length ? el[0].files[0] : '');
                        } else if ($.inArray(type, ['radio', 'checkbox'])) {
                            if (el.checked()) {
                                formData[name].push(val);
                            }
                        } else {
                            if ($.isArray(val)) {
                                $.loop(val, function (v) {
                                    formData[name].push(v);
                                })
                            } else {
                                formData[name].push(val);
                            }
                        }
                    }else{
                        if (type === 'file') {
                            formData[name] = el[0].files.length ? el[0].files[0] : '';
                        } else if ($.inArray(type, ['radio', 'checkbox'])) {
                            if (el.checked()) {
                                formData[name] = val;
                            }
                        } else {
                            formData[name] = val;
                        }
                    }
                }
            });
        }

        return formData;
    }

    /**
     * 获得一个form的表单数据
     * 与jQuery用法相同
     * @returns {*}
     */
    K.serialize = function () {
        var dt = this.formData();
        return $.urlGetString(dt, true);
    }


    /**
     * 移除节点
     * 与jQuery用法相同
     * @returns {$}
     */
    K.remove = function () {
        this.map(function (ele) {
            if (ele.parentNode) {
                ele.parentNode.removeChild(ele);
                $(ele).trigger('KSADOMchange', ['remove']);
                //通知父级HTML变更
                $(ele.parentNode).trigger('KSADOMchange', ['html']);
            }
        });
        return this;
    }

    /**
     * 在节点之后添加
     * 与jQuery用法相同
     * @param {html|Node} html
     * @returns {this}
     */
    K.after = function (html) {
        return tempDom.call(this, html, function (ele, node) {
            if (ele.parentNode) {
                ele.parentNode.insertBefore(node, ele.nextSibling);
                $(ele).trigger('KSADOMchange', ['after', html]);
                //通知父级HTML变更
                $(ele.parentNode).trigger('KSADOMchange', ['html']);
            }
        }, true);
    }

    /**
     * 在节点之前添加
     * 与jQuery用法相同
     * @param {html|Node} html
     * @returns {this}
     */
    K.before = function (html) {
        return tempDom.call(this, html, function (ele, node) {
            if (ele.parentNode) {
                ele.parentNode.insertBefore(node, ele);
                $(ele).trigger('KSADOMchange', ['before', html]);
            }
        });
    }

    /**
     * 在节点内部最后添加
     * 与jQuery用法相同
     * @param {html|Node} html
     * @returns {this}
     */
    K.append = function (html) {
        return tempDom.call(this, html, function (ele, node) {
            if (!node) {
                return;
            }
            ele.appendChild(node);
            $(ele).trigger('KSADOMchange', ['append', html]);
        });
    }

    /**
     * 在节点内部最前面添加
     * 与jQuery用法相同
     * @param {html|Node} html
     * @returns {this}
     */
    K.prepend = function (html) {
        return tempDom.call(this, html, function (ele, node) {
            ele.insertBefore(node, ele.firstChild);
            $(ele).trigger('KSADOMchange', ['prepend', html]);
        }, true);
    }

    /**
     * 用指定dom包裹集合中的每个元素
     * 与jQuery用法相同
     * @param html
     * @returns {*}
     */
    K.wrap = function (html) {
        this.map(function (e, index) {
            var dom = $.dom($.isFunction(html) ? html.call(e, index) : html);
            $(e).after(dom);
            $(dom).html(e);
        });

        return this;
    }

    /**
     * 将集合中所有元素包裹在一个节点中（第一个顺序位置）
     * 与jQuery用法相同
     * @param html
     * @returns {*}
     */
    K.wrapAll = function (html) {
        var dom = $($.isFunction(html) ? html.call(e, index) : html);
        $(this[0]).before(dom);
        dom.html(this);
        return this;
    }

    /**
     * 将集合元素内部用指定节点包裹
     * 与jQuery用法相同
     * @param html
     * @returns {*}
     */
    K.wrapInner = function (html) {
        this.map(function (e) {
            e = $(e);
            var dom = $($.isFunction(html) ? html.call(e, index) : html);
            dom.html(e.contents());
            e.html(dom);
        });
        return this;
    }
// ====================== 尺寸 、位置 ====================== //

    /**
     * 设置返回元素高度
     * @param {boolean/number} val true=返回包含padding+border
     * @param isMargin true = 返回包含margin
     * @returns {number}
     */
    K.height = function (val, isMargin) {
        if (!$.isset(val) || val === true) {
            var dom = this[0];
            if (!dom) {
                return;
            }
            if (dom === window || dom === document) {
                return document.documentElement.clientHeight || document.body.clientHeight;
            } else {
                var size = dom.offsetHeight;
                var css = $.intval(this.css('paddingBottom paddingTop borderBottomWidth borderTopWidth marginBottom marginTop'));
                //真实尺寸
                if (val !== true) {
                    size -= (css.paddingBottom + css.paddingTop + css.borderBottomWidth + css.borderTopWidth);
                }
                if (isMargin === true) {
                    size += (css.marginBottom + css.marginTop);
                }
                return size;
            }
        } else {
            this.css('height', $.isNumber(val) ? val + 'px' : val);
            return this;
        }
    }

    /**
     * 设置返回元素宽度
     * @param {boolean/number} val true=返回包含padding+border
     * @param isMargin true = 返回包含margin
     * @returns {number}
     */
    K.width = function (val, isMargin) {
        if (!$.isset(val) || val === true) {
            var dom = this[0];
            if (dom === window || dom === document) {
                return document.documentElement.clientWidth || document.body.clientWidth;
            } else {
                var size = dom.offsetWidth;
                var css = $.intval(this.css('paddingLeft paddingRight borderLeftWidth borderRightWidth marginLeft marginRight'));
                //真实尺寸
                if (val !== true) {
                    size -= (css.paddingLeft + css.paddingRight + css.borderLeftWidth + css.borderRightWidth);
                }
                if (isMargin === true) {
                    size += (css.marginLeft + css.marginRight);
                }
                return size;
            }

        } else {
            this.css('width', $.isNumber(val) ? val + 'px' : val);
            return this;
        }
    }

    /**
     * 返回元素坐标
     * 用法与jQuery相同
     * @returns {{top: number, left: number}}
     */
    K.offset = function () {
        var ele = this[0];
        if (!ele) {
            return;
        }
        if (!ele.getClientRects().length) {
            return {
                top : 0,
                left : 0
            };
        }

        var rect = ele.getBoundingClientRect();
        var win = ele.ownerDocument.defaultView;
        return {
            top : rect.top + win.pageYOffset,
            left : rect.left + win.pageXOffset
        };
    }

    /**
     * 显示一个元素
     * 不支持任何参数
     * @returns {*}
     */
    K.show = function () {
        this.map(function (e) {

            e.style.display = '';
            var isnone = document.defaultView.getComputedStyle(e, null).display === 'none';
            e.style.display = isnone ? "block" : '';
            $(e).trigger('KSADOMchange', ['show']);
        });
        return this;
    }

    /**
     * 隐藏一个元素
     * 不支持任何参数
     * @returns {*}
     */
    K.hide = function () {
        this.map(function (e) {
            e.style.display = "none";
            $(e).trigger('KSADOMchange', ['hide']);
        });
        return this;
    }

    /**
     * 执行一个动画
     * @param {int/arrat} numbers 需要动画的数值 数字 或 数字数组
     * @param Atimes 动画时间 （毫秒）
     * @param callFunc 每帧动画回调函数
     *                参数1 = 根据numbers参数回调当前帧下的动画偏移值
     *                参数2 = 当前帧顺序值
     *                参数3 = 距离上一次的时间间隔（毫秒）
     * @returns {{}}
     * @constructor
     */
    $.AnimationFrame = function (numbers, Atimes, callFunc) {
        if (!$.AnimationFrameCache) {
            $.AnimationFrameCache = {_index : 0};
        }
        if (!numbers) {
            return;
        }
        Atimes = parseInt(Atimes || 0) || 2000;
        var id = $.AnimationFrameCache._index++;
        var start;
        var aObj = $.AnimationFrameCache[id] = {};
        var _Atime = 0;//每帧间隔时间
        var _Aindex = 0; //帧顺序
        var numbersIsArr = $.isArray(numbers);

        //计算步进值 = 总值 / 每帧时间间隔 * 当前帧值
        function _stepVal(val, time) {
            time = parseFloat(time).toFixed(0);
            var rate = Math.min((time / Atimes).toFixed(2), 1);
            //debug('完成度：'+(rate *100)+'%');
            return parseInt(val * rate);
        }

        var lastTime;  //最后一次触发时间
        function _thisRun(timestamp) {
            if (!aObj.start) {
                aObj.start = timestamp;
            }
            start = aObj.start;
            //距离第一次的时间间隔
            var progress = timestamp - start;
            //记录与上一次动画的间隔时间
            if (!_Atime) {
                _Atime = timestamp - lastTime;
            }
            var callResult;
            if (_Atime > 0 && progress <= Atimes) {
                _Aindex++;
                if (numbersIsArr) {
                    var callNumber = [];
                    $.loop(numbersIsArr, function (value) {
                        callNumber.push(_stepVal(value, progress));
                    });
                } else {
                    callNumber = _stepVal(numbers, progress);
                }
                callResult = callFunc.call('', callNumber, _Aindex, _Atime);
            }
            //如果回调函数执行结果为false 或 执行时间超过限定时 终止动画
            if (callResult === false || progress >= Atimes) {
                window.cancelAnimationFrame(aObj.AnimationID);
                delete $.AnimationFrameCache[id];
            } else {
                window.cancelAnimationFrame(aObj.AnimationID);
                aObj.AnimationID = window.requestAnimationFrame(_thisRun);
            }
            lastTime = timestamp;//记录最后一次触发时间
        }

        aObj.AnimationID = window.requestAnimationFrame(_thisRun);
        return aObj;
    }


    /**
     * 设定被选元素滚动条垂直坐标
     * @param val 需要设置的坐标值
     * @param AnimationTime 动画时间（毫秒）
     * @returns {*}
     */
    K.scrollTop = function (val, AnimationTime) {
        if (!$.isset(val)) {
            var dom = this[0];
            if (dom === document) {
                dom = dom.scrollingElement;
            }
            return dom ? dom.scrollTop : 0;
        } else {
            this.map(function (e) {
                var top = e.scrollTop;
                var distance = val - top; //需要滚动的距离
                //5px内不需要动画
                if (AnimationTime && distance >= -5 && distance <= 5) {
                    AnimationTime = false;
                }
                if (AnimationTime) {
                    AnimationTime = AnimationTime === true ? 500 : AnimationTime;
                    $.AnimationFrame(distance, AnimationTime, function (callVal) {
                        if (Math.abs(callVal) > Math.abs(distance)) {
                            return false;
                        }

                        e.scrollTop = top + callVal;
                    });
                } else {
                    e.scrollTop = top + distance;
                }
            });
            return this;
        }
    }

    /**
     * 滚动到底部触发回调
     * @param callFun 回调函数
     * @param Nus 触底多少距离触发 px 默认50
     */
    K.reachBottom = function(callFun, Nus){
        Nus = Nus ? Nus : 50; //触底距离多少开始回调
        this.map(function(ele){
            var isDom = ele === document;
            var isCall;
            var S;
            $(ele).scroll(function(){
                var ths =$(this);
                var scrollTop =ths.scrollTop();//滚动高度
                var viewH = ths.height(true); //可见高度
                var contentH = isDom ? $('html')[0].scrollHeight : this.scrollHeight;//内容高度
                var scY = Math.abs(scrollTop - (contentH - viewH));

                if(!isCall && scY < Nus){ //到达底部100px时,加载新内容
                    callFun.call(ele, ele);
                    isCall = true;
                }else if(scY > Nus){
                    S && window.clearTimeout(S);
                    S = window.setTimeout(function(){
                        isCall = false;
                    }, 300); //延迟解锁 消除抖动
                }
            });
        });
    }

    /**
     * 设定被选元素滚动条纵向坐标
     * @param val 需要设置的坐标值
     * @param AnimationTime 动画时间（毫秒）
     * @returns {*}
     */
    K.scrollLeft = function (val, AnimationTime) {
        if (!$.isset(val)) {
            return this[0] ? this[0].scrollLeft : 0;
        } else {
            this.map(function (e) {
                e.scrollLeft = parseFloat(val);

                var left = e.scrollLeft;
                var distance = val - left; //需要滚动的距离
                //5px内不需要动画
                if (AnimationTime && distance >= -5 && distance <= 5) {
                    AnimationTime = false;
                }
                if (AnimationTime) {
                    AnimationTime = AnimationTime === true ? 500 : AnimationTime;
                    $.AnimationFrame(distance, AnimationTime, function (callVal) {
                        if (Math.abs(callVal) > Math.abs(distance)) {
                            return false;
                        }
                        e.scrollLeft = left + callVal;
                    });
                } else {
                    e.scrollLeft = left + distance;
                }

            });
            return this;
        }
    }

    /**
     * 设置或返回一个元素的css样式
     * 用法与jQuery相同
     * @param key css名称
     * @param value css值
     * @returns {{}|unknown}
     */
    K.css = function (key, value) {
        var cssNumber = [
            'animationIterationCount', 'columnCount', 'fillOpacity', 'flexGrow', 'flexShrink', 'fontWeight', 'gridArea', 'gridColumn', 'gridColumnEnd', 'gridColumnStart', 'gridRow', 'gridRowEnd', 'gridRowStart', 'lineHeight', 'opacity', 'order', 'orphans', 'widows', 'zIndex', 'zoom'];
        value = value === '' ? null : value;
        var sets, gets = {}, keyIsObj = $.isObject(key), isValue = $.isset(value);
        if (key) {
            if (!isValue && keyIsObj) {
                sets = key;
            } else if (isValue) {
                sets = {};
                sets[key] = value;
            }
            var style = [];
            $.loop(sets, function (value, key) {
                var soukey = key.replace(/^(-moz-|-ms-|-webkit-|-o-|\+|_|\*)/ig, '');
                if (!$.inArray(soukey, cssNumber) && $.isNumber(value)) {
                    value = value + 'px';
                }
                sets[key] = value;
                style.push(key + ':' + value);
            });
            style = style.length ? $.implode('; ', style) : '';
            if (sets) {
                this.map(function (e) {
                    var isEdit;
                    $.loop(sets, function (v, k) {
                        if (e.style[k] != v) {
                            var oldv = e.style[k];
                            e.style.setProperty(k, v);
                            $(e).trigger('KSADOMchange', ['css.' + k, v, oldv]);
                            isEdit = 1;
                        }
                    });
                    isEdit && $(e).trigger('KSADOMchange', ['css']);
                });
                return this;
            } else {
                if (this[0]) {
                    var getkeys = $.explode(' ', key, '');
                    var sty = window.getComputedStyle(this[0], null);
                    $.loop(getkeys, function (val) {
                        gets[val] = sty[val];
                    });
                    if (getkeys.length === 1) {
                        return gets[getkeys[0]];
                    } else {
                        return gets;
                    }
                }
            }
        }
    }

// ====================== 遍历 ====================== //

    /**
     * 循环函数
     * @param {object/array/NodeList/Number} dt
     * @param {function} fun 每次循环函数(value, key, index)
     * @param {string} actions 取值动作 first=只取第一个 last=只取最后一个
     * @returns {*}
     */
    $.loop = function (dt, fun, actions) {
        if (!dt) {
            return;
        }
        if (dt instanceof $ || $.isArrayLike(dt)) {
            var length = dt.length;
            if (!length) {
                return;
            }
            for (i = 0; i < dt.length; i++) {
                var val = dt[i];
                if ((actions && (actions === 'first' || (actions === 'last' && i === length - 1))) || fun(val, i, i) === true) {
                    return val;
                }
            }

        } else if ($.isNumber(dt)) {
            for (i = 1; i <= dt; i++) {
                if ((actions && (actions === 'first' || (actions === 'last' && i === dt - 1))) || fun(i, i - 1, i - 1) === true) {
                    return i;
                }
            }
        } else if ($.isObject(dt)) {
            var keys = Object.keys(dt),
                i = 0,
                len = keys.length,
                key, val;
            if (len) {
                for (key in keys) {
                    var k = keys[key];
                    val = dt[k];
                    if ((actions && (actions === 'first' || (actions === 'last' && i === len - 1))) || fun(val, k, i) === true) {
                        return val;
                    }
                    i++;
                }
            }
        }
    }

    /**
     * 循环遍历
     * @param obj
     * @param callback
     * @returns {*}
     */
    K.each = function (callback) {
        $.loop(this, function (ele, index) {
            callback && callback.call(ele, index, ele);
        });
        return this;
    }

    /**
     * 数组map方法实现
     * @param elements
     * @param callback
     * @returns {[]}
     */
    $.map = K.map = function (elements, callback) {
        var isThis = false;
        if (!callback && $.isFunction(elements)) {
            callback = elements;
            elements = this;
            isThis = true;
        }
        var newArr = [], i = 0;
        $.loop(elements, function (val, k) {
            var r = callback.call(isThis ? val : window, val, k, i);
            if (r !== null && $.isset(r)) {
                newArr.push(r);
            }
            i++;
        });
        if (isThis) {
            newArr = $(newArr);
        }
        return newArr;
    }

    /**
     * 取集合范围
     * @returns {*[]}
     */
    $.slice = K.slice = function () {
        var arr = $();
        $.loop([].slice.apply(this, arguments), function (e) {
            arr.push(e);
        });
        return arr;
    }

    /**
     * 在当前选择器集合中添加一个新的
     * @param ele
     */
    K.push = function (ele) {
        var ths = this;
        var length = ths.length ? ths.length : 0;
        if (ele instanceof $) {
            ele.each(function (_, e) {
                ths[length] = e;
                length++;
            });
        } else if ($.isArray(ele)) {
            $.loop(ele, function (e) {
                ths[length] = e;
                length++;
            });
        } else {
            ths[length] = ele;
            length++;
        }
        if (length) {
            ths.length = length;
        }
        return ths;
    }

    /**
     * 取匹配集合 顺序为n的节点
     * 支持以数字数组方式取
     * 与jquery用法相同
     * @param {number/array} n
     * @returns {*}
     */
    K.eq = function (n) {
        var isArr = $.isArray(n);

        var obj = $();
        this.map(function (e, i) {
            if ((isArr && $.inArray(i, n)) || (!isArr && i == n)) {
                obj.push(e);
            }
        });
        return obj;
    }

    /**
     * 获取指定元素在父级下的索引顺序值
     * 该方法不接受任何参数
     * @returns {number}
     */
    K.index = function () {
        var ele = this[0];
        var index = -1;
        if (ele) {
            $(ele).parent().children().each(function (i, e) {
                if (e == ele) {
                    index = i;
                }
            });
        }
        return index;
    }

    /**
     * 取匹配集合第一个
     * 与jquery用法相同
     * @returns {any}
     */
    K.first = function () {
        return $(this[0]);
    }

    /**
     * 取匹配集合最后一个
     * 与jquery用法相同
     * @returns {any}
     */
    K.last = function () {
        var n = this.length > 1 ? this.length - 1 : 0;
        return $(this[n]);
    }

    /**
     * 检查集合中是否存在选择器范围
     * 与jquery用法相同
     * @param selector
     * @returns {boolean} 返回 false | true
     */
    K.is = function (selector) {
        var s = false;
        this.map(function (ele) {

            if (isSelectDom(ele, selector)) {
                s = true;
            }
        });
        return s;
    }

    /**
     * 子孙遍历
     * 与jquery用法相同
     * @param selector
     * @returns
     */
    K.find = function (selector) {
        selector = selector || '*';
        var rdom = $();
        this.map(function (ele) {
            $.loop(selectorAll(ele, selector), function (el) {
                rdom.push(el);
            });
        });
        return rdom;
    }

    /**
     * 集合内部遍历并生成新集合
     * @param selector
     * @returns {*[]|Uint8Array|BigInt64Array|Float64Array|Int8Array|Float32Array|Int32Array|Uint32Array|Uint8ClampedArray|BigUint64Array|Int16Array|Uint16Array}
     */
    K.filter = function (selector) {
        selector = selector || '*';
        return this.map(function (ele) {
            if (isSelectDom(ele, selector)) {
                return ele;
            }
        });
    }

    /**
     * 直接子级遍历
     * 与jquery用法相同
     * @param selector
     */
    K.children = function (selector) {
        selector = selector || '*';
        var rdom = $(), ri = 0;
        this.map(function (ele) {
            $.loop(ele.childNodes, function (el) {
                if (isSelectDom(el, selector)) {
                    rdom[ri] = el;
                    ri++;
                }
            });
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 遍历所有子级（包括文本节点）
     */
    K.childAll = function () {
        var rdom = $(), ri = 0;
        this.map(function (ele) {
            $.loop(ele.childNodes, function (el) {
                rdom[ri] = el;
                ri++;
            });
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 所有同辈
     * 与jquery用法相同
     * @param selector
     * @returns {*}
     */
    K.siblings = function (selector) {
        selector = selector || '*';
        var rdom = $(), ri = 0;
        this.map(function (ele) {
            //同父级下所有直接子级（不包含自己）
            $.loop(ele.parentNode.childNodes, function (el) {
                if (el != ele && isSelectDom(el, selector)) {
                    rdom[ri] = el;
                    ri++;
                }
            });
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 父级
     * 与jquery用法相同
     * @param selector
     * @returns {*}
     */
    K.parent = function (selector) {
        selector = selector || '*';
        var rdom = $(), ri = 0;
        this.map(function (ele) {
            var el = ele.parentNode;
            if (el != ele && isSelectDom(el, selector)) {
                rdom[ri] = el;
                ri++;
            }
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 祖先(直到匹配选择器)
     * 与jquery用法相同
     * @param selector
     * @returns {*}
     */
    K.parents = function (selector) {
        var rdom = $(), ri = 0;
        $.loop(dir(this, 'parentNode', selector), function (el) {
            rdom[ri] = el;
            ri++;
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 前一个元素
     * 与jquery用法相同
     * @param selector
     * @returns {*}
     */
    K.prev = function (selector) {
        selector = selector || '*';
        var rdom = $(), ri = 0;
        this.map(function (ele, i) {
            if (isSelectDom(ele.previousElementSibling, selector)) {
                rdom[ri] = ele.previousElementSibling;
                ri++;
            }
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 往前所有元素
     * @param selector
     * @returns {*}
     */
    K.prevAll = function (selector, isAll) {
        var rdom = $(), ri = 0;
        $.loop(dir(this, (isAll ? 'previousSibling' : 'previousElementSibling'), selector), function (el) {
            rdom[ri] = el;
            ri++;
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 下一个元素
     * 与jquery用法相同
     * @param selector
     * @returns {*}
     */
    K.next = function (selector) {
        selector = selector || '*';
        var rdom = $(), ri = 0;
        this.map(function (ele) {
            if (isSelectDom(ele.nextElementSibling, selector)) {
                rdom[ri] = ele.nextElementSibling;
                ri++;
            }
        });
        rdom.length = ri;
        return rdom;
    }

    /**
     * 之后所有元素
     * @param selector
     * @returns {*}
     */
    K.nextAll = function (selector, isAll) {
        var rdom = $(), ri = 0;
        this.map(dir(this, (isAll ? 'nextSibling' : 'nextElementSibling'), selector), function (ele) {
            rdom[ri] = ele;
            ri++;
        }, isAll);
        rdom.length = ri;
        return rdom;
    }


// ====================== 事件处理 ====================== //
    //分割事件的命名空间
    function eventParse(event) {
        event = (''+event).split('.');
        return {evn : event[0], scope : event[1] || ''}
    }

    /**
     * 绑定事件
     * @param event 事件名称, 每个事件以空格分开，每个事件支持命名空间click.xx
     * @param selector
     * @param callback
     * @returns {$}
     */
    K.on = function (event, selector, callback) {
        if ($.isFunction(selector) && !callback) {
            callback = selector;
            selector = null;
        }
        callback = callback ? callback : function () {
            return false
        };
        event = event.split(/\s/);
        return this.each(function (_, ele) {
            var kid = $.objectID(ele);
            bindEventData[kid] = bindEventData[kid] || {};

            $.loop(event, function (evn) {

                if (evn == 'ready') {
                    return $(document).ready(callback);
                }
                var useCapture = false;
                //得到事件对象
                var handler = eventParse(evn);
                handler.fun = callback;
                handler.selector = selector;
                //触发事件函数
                handler.call = function(e){
                    //注册冒泡事件 e.stop
                    eventAddstopPropagation(e);
                    let target = e.target
                    //e.path属性重构
                    if((!e.path || !e.path.length) && target.parentNode){
                        e.path = []
                        while (target.parentNode !== null) {
                            e.path.push(target)
                            target = target.parentNode
                        }
                        e.path.push(document, window);
                    }

                    if(e.isStop || (e.target.nodeName ==='KS-BTN' && $(e.target).disabled())){
                        return false;
                    }
                    var args = arguments;
                    //如果存在选择器则遍历所有触发路径
                    if(selector){
                        var els = selectorAll(ele, selector);
                        $.loop(e.path, function(val){
                            if($.inArray(val, els)){
                                if (callback.apply(val, args) === false) {
                                    e.stop();
                                }
                            }
                        });
                    }else{
                        if (callback.apply(ele, args) === false) {
                            e.stop();
                        }
                    }
                };
                if(!bindEventData[kid][evn]){
                    bindEventData[kid][evn] = [];
                }
                bindEventData[kid][evn].push({
                    callback : callback,
                    selector : selector,
                    useCapture : useCapture,
                    handler : handler
                });
                /*
				addEventListener
				参数1 = 事件名称
				参数2 = 回调函数
				参数3 = true = 事件句柄在捕获阶段执行 false = 默认。事件句柄在冒泡阶段执行
				 */
                var realEvn = evn.replace(/\..*/, '');
                ele.addEventListener(realEvn, handler.call, useCapture);
            })
        });
    };
    /**
     * 解除绑定事件
     * @param event 事件名称 on绑定的事件名称
     * @param callback
     * @returns {$}
     */
    K.off = function (event, callback) {
        var isCall = callback ? 1 : 0;
        callback = callback ? callback : function () {
            return false
        };
        event = $.explode(' ', event, '');
        this.map(function (ele) {
            var kid = $.objectID(ele);
            $.loop(event, function (evn) {
                var evnDt = bindEventData[kid] && bindEventData[kid][evn] ? bindEventData[kid][evn] : null;
                evn = evn.replace(/\..*/, '');
                if (evnDt) {
                    //如果没有指定 需删除的事件 则遍历删除所有
                    var delN = 0;
                    $.loop(evnDt, function (val, i) {
                        if (val && (!isCall || val.callback === callback)) {
                            ele.removeEventListener(evn, val.handler.call, val.useCapture);
                            evnDt[i] = null;
                            delN++;
                        }
                    });
                    if (evnDt.length === delN) {
                        delete bindEventData[kid][evn];
                    }
                } else {
                    ele.removeEventListener(evn, callback, false);
                    ele.removeEventListener(evn, callback, true);
                }
            })
            $.isset(bindEventData[kid]) && $.isEmpty(bindEventData[kid]) && delete bindEventData[kid];

        });
        return this;
    };
    /**
     * hover事件
     * @param a
     * @param b
     * @returns {*}
     */
    K.hover = function (a, b) {
        return this.mouseenter(a).mouseleave(b || a);
    }

    /**
     * 文本框文字选中事件
     * @param func
     */
    K.select = function (func) {
        if ($.isset(func)) {
            if (!$.isFunction(func)) {
                return;
            }
            this.on('select', function (evn) {

                var txt = window.getSelection ? window.getSelection().toString() : document.selection.createRange().text;
                func.call(this, evn, txt);
            });
        } else {
            this.map(function (ele) {
                if ($.isFunction(ele.select)) {
                    ele.select();
                }
            });
        }
    }

    /**
     * 长按事件（移动端）
     * Author: cr180.com <cr180@cr180.com>
     */
    K.touchlong = function (fun, moveFun, endFun) {
        var S, x = 0, y = 0;
        var lastX = 0, lastY = 0;
        this.on('touchstart touchmove touchend mousedown mouseup mouseout mouseleave', function (e) {

            if ($.inArray(e.type, ['touchstart', 'mousedown'])) {
                if (e.type == 'touchstart') {
                    x = (e.targetTouches ? e.targetTouches[0].pageX : e.pageX) || 0;
                    y = (e.targetTouches ? e.targetTouches[0].pageY : e.pageY) || 0;
                }
                e.stop();
                S = setTimeout(function () {
                    e.ksaX = x;
                    e.ksaY = y;
                    fun.call(e.target, e);
                    //移动事件
                    $(document).on('touchmove.touchlong mouseleave.touchlong', function (me) {
                        lastX = (me.targetTouches ? me.targetTouches[0].pageX : me.pageX) || 0;
                        lastY = (me.targetTouches ? me.targetTouches[0].pageY : me.pageY) || 0;
                        me.ksaX = lastX;
                        me.ksaY = lastY;
                        moveFun && moveFun.call(e.target, me); //this指向触发元素 回调参数为当前坐标最顶层DOM
                    });

                    //结束
                    $(document).on('touchend.touchlong mouseup.touchlong', function (de) {

                        var _dom = document.elementFromPoint(lastX, lastY);
                        de.ksaX = lastX;
                        de.ksaY = lastY;
                        endFun && endFun.call(e.target, de); //this指向触发元素 回调参数为当前坐标最顶层DOM
                        $(document).off('touchmove.touchlong mouseleave.touchlong touchend.touchlong mouseup.touchlong');
                    });
                }, 400);
            } else if ($.inArray(e.type, ['touchmove', 'mouseleave'])) {
                var x1 = (e.changedTouches ? e.changedTouches[0].pageX : e.pageX) || 0;
                var y1 = (e.changedTouches ? e.changedTouches[0].pageY : e.pageY) || 0;
                if (Math.abs(x1 - x) > 25 || Math.abs(y1 - y) > 25) {
                    clearTimeout(S);
                }
            } else {
                clearTimeout(S);
            }
        });
        return this;
    }

    /**
     * 触摸过程回调
     * @param startFun 触摸开始回调函数
     * @param moveFun 触摸过程回调函数
     * @param endFun 触摸结束回调函数
     * @param path 触摸方向控制 X=仅横向 Y=仅纵向 null=不控制
     * @returns {*}
     */
    K.touch = function (startFun, moveFun, endFun, path) {
        var X = 0, Y = 0, action, isRun, moveTime;
        var touchNames = 'ontouchstart' in document.documentElement ? 'touchstart touchmove touchend' : 'mousedown mousemove mouseup';
        var startEvent;
        this.on(touchNames, function (e) {
            startEvent = e;
            var ex = 0, ey = 0, cx = 0, cy = 0;
            //鼠标或手指按下
            if ($.inArray(e.type, ['touchstart', 'mousedown'])) {
                X = ex = (e.targetTouches ? e.targetTouches[0].pageX : e.pageX) || 0;
                Y = ey = (e.targetTouches ? e.targetTouches[0].pageY : e.pageY) || 0;
                startFun && startFun.call('', e, {currentX : ex, currentY : ey, startX : X, startY : Y});
                isRun = true;
                moveTime = e.timeStamp;
                //鼠标或手指在元素上移动
            } else if (isRun && $.inArray(e.type, ['touchmove', 'mousemove'])) {
                ex = (e.targetTouches ? e.targetTouches[0].pageX : e.pageX) || 0;
                ey = (e.targetTouches ? e.targetTouches[0].pageY : e.pageY) || 0;


                cx = ex - X;
                cy = ey - Y; //得到xy终点坐标
                //滑动距离必须超过10个像素时才触发
                if (!action && (Math.abs(cx) > 8 || Math.abs(cy) > 8)) {
                    var ages = $.rightTriangleAge(cx, cy);
                    //滑动角度判断 15度以内为左右滑动
                    if (ages.scale < 15) {
                        action = cx > 0 ? 'right' : 'left';
                    } else {
                        action = cy > 0 ? 'down' : 'up';
                    }
                }
                //动作存在 回调
                if (action) {
                    moveFun && moveFun.call('', e, {
                        action : action,
                        moveX : cx,
                        moveY : cy,
                        currentX : ex,
                        currentY : ey,
                        startX : X,
                        startY : Y
                    });
                }
                //阻止冒泡
                if (!path || (path === 'X' && $.inArray(action, ['left', 'right'])) || path === 'Y' && $.inArray(action, ['up', 'down'])) {
                    return false;
                }

                //鼠标或手指在元素上释放（离开）
            } else if (isRun) {
                ex = (e.changedTouches ? e.changedTouches[0].pageX : e.pageX) || 0;
                ey = (e.changedTouches ? e.changedTouches[0].pageY : e.pageY) || 0;
                cx = ex - X;
                cy = ey - Y; //得到xy终点坐标
                var mTime = e.timeStamp - moveTime;//整个触摸过程的时间
                var isX = $.inArray(action, ['left', 'right']),
                    isY = $.inArray(action, ['up', 'down']);
                var scaleX = (Math.abs(cx) / $(this).width(true) * 100), //横向移动比例
                    scaleY = (Math.abs(cy) / $(this).height(true) * 100); //纵向移动比例
                //如果触摸时间超过800ms 移动比例必须超过50%才算一个动作
                if (mTime >= 800 && ((isX && scaleX < 50) || (isY && scaleY < 50))) {
                    action = '';
                }
                if (!path || (path === 'X' && isX) || path === 'Y' && isY) {
                    endFun && endFun.call('', e, {
                        action : action,
                        moveX : cx,
                        moveY : cy,
                        currentX : ex,
                        currentY : ey,
                        startX : X,
                        startY : Y,
                        scaleX : scaleX,
                        scaleY : scaleY
                    });
                }


                X = 0;
                Y = 0;
                action = null;
                isRun = null;

            }
        });
        return this;
    }

    /**
     * 创建一个自定义事件
     * @param name
     * @constructor
     */
    $.Event = function (name) {
        var events
        try {
            events = new Event(name, {bubbles : true, cancelable : true});
        } catch (e) {
            events = document.createEvent('Events');
            events.initEvent(name, true, true);
        }
        eventAddstopPropagation(events);
        return events;
    }

    /**
     * 给指定元素绑定一个自定义事件
     * @param name 事件名称
     * @param func 回调函数
     * @param useCapture  addEventListener第三个参数
     * @param isRun 是否立即执行
     * @param runDel 立即执行后是否删除
     */
    K.addEvent = function (name, func, useCapture, isRun, runDel) {
        this.map(function (ele) {
            var eEvn = $.Event(name);
            ele.addEventListener(name, func, useCapture);
            if (isRun) {
                ele.dispatchEvent(eEvn);
            }
            if (runDel) {
                $(ele).removeEvent(name, func, useCapture);
            }
        });
        return this;
    }

    /**
     * 移除一个事件
     * @param ele 绑定时对应的元素
     * @param name 绑定时使用的事件名称
     * @param func 绑定时的触发函数
     * @param useCapture addEventListener第三个参数
     */
    K.removeEvent = function (name, func, useCapture) {
        this.map(function (ele) {
            ele.removeEventListener(name, func, useCapture);
        });
    }

    /**
     * 触发事件
     * @param evn
     */
    K.trigger = function (event, args) {
        this.map(function (ele) {
            if ($.isFunction(ele[event.type])) {
                ele[event.type]();
            } else {
                var e = $.Event(event);
                e.KSAcallbackArgs = args;
                ele.dispatchEvent(e);
            }
        });
        return this;
    }

    /**
     * 表单submit事件
     */
    K.submit = function (callFun) {
        if (callFun) {
            return this.on('submit', callFun);
        } else {
            return this.trigger('submit');
        }
    }

    /**
     * 根据两个直角边长推测三角度数
     * 必须是直角
     * @param a A边长
     * @param b B边长
     * return {object}
     */
    $.rightTriangleAge = function (a, b) {
        //已知四个坐标组成直角四边形 根据勾股定理推测出直角三角形后得到每个角的角度
        a = Math.abs(a); //取绝对值
        b = Math.abs(b); // 取绝对值
        var c = Math.sqrt(a * a + b * b); //求c边长
        //余弦定理 求bc的弧度
        var bc = Math.acos((a * a + c * c - b * b) / (2.0 * a * c));
        //bc弧度转角度 得到结束坐标端三角度数
        bc = parseInt((bc / Math.PI * 180) * 10000) / 10000;
        //ac角度 = 90 - bc角度
        var ac = 90 - bc;
        return {scale : bc, a : a, b : b, c : c, age : {ab : 90, ac : ac, bc : bc}};
    }
// ====================== 当前或指定url格式化为对象 ====================== //
    $.url = function (url, param) {
        var u = [];
        if (url) {
            u = url.match(/^((\w+:)?\/\/)?(.+\.\w+)?(:\d+)?([^?#]+)([^#]*)(#.*)?$/i);
        }
        var P = {
            url : url ? url : location.href,
            origin : url ? (u[1] || '') : location.origin,
            https : url ? (u[2] && u[2] === 'https' ? true : false) : location.protocol,
            host : url ? (u[3] || '') : location.hostname,
            port : url ? (u[4] ? u[4].substr(1) : '') : location.port,
            pathname : url ? (u[5] || '') : location.pathname,
            search : url ? (u[6] || '') : location.search,
            paths : [],
            get : {},
            hash : url ? (u[7] ? u[7] : '') : location.hash
        };
        P.get = $.urlGetObject(P.search);
        var isParam = false;
        if (param && !$.isEmpty(param)) {
            param = $.isString(param) ? $.urlGetObject(param) : param;
            isParam = true;
        }
        if (isParam) {
            P.get = $.arrayMerge(P.get, param);
            P.search = !$.isEmpty(P.get) ? ('?' + $.urlGetString(P.get)) : '';
        }

        if (P.pathname) {
            var pn = P.pathname;
            //去掉前后/
            $.loop(pn.split("/"), function (val, k) {
                if (val !== '') {
                    P.paths.push(val);
                }
            });
        }

        if (isParam) {
            P.url = P.origin + P.host + (P.port ? (':' + P.port) : '') + P.pathname + P.search + P.hash;
        }
        return P;
    }

    /**
     * 在url中添加一个参数
     * @param url 需要添加的url
     * @param query 参数：xxx=value
     * @returns {string}
     */
    $.urlAdd = function (url, query) {
        return $.url(url, query).url;
    }

    /**
     * URL GET条件转对象
     * @param url
     * @returns {{}}
     */
    $.urlGetObject = function (url) {
        var param = {};
        if ($.isString(url)) {
            if (url.substr(0, 1) == '?') {
                url = url.substr(1);
            }
            $.loop(url.split("&"), function (val) {
                val = val.split('=');
                if (val['1']) {
                    val['1'] = decodeURIComponent(val['1']);
                    param[val['0']] = val['1'];
                }
            });
        }
        return param;
    }

    /**
     * 对象转为url GET条件
     * @param url
     * @param isEncode 是否需要urlencode
     * @returns {string}
     */
    $.urlGetString = function (url, isEncode) {
        var str = '';
        if ($.isObject(url)) {
            var u = [];
            $.loop(url, function (value, key) {
                if (value === undefined) {
                    value = '';
                }
                if (isEncode) {
                    value = encodeURIComponent(value);
                }
                key && value && u.push(key + "=" + value);
            });
            str = $.implode('&', u);
        }
        return str;
    }

// ====================== AJAX ====================== //
    var jsonpID = 1;
    /**
     * ajax方法与jQuery基本一致
     * 注：data值不再做任何二次处理，直接放入FormData提交，所以POST时支持文件与参数同时传递，无需其他设置
     * @param option
     */
    $.ajax = function (option) {
        var getType = option.type ? option.type.toUpperCase() : 'GET',
            headers = option.header || {},
            dataType = option.dataType ? option.dataType.toLowerCase() : 'html',
            jsonpCallback = option.jsonpCallback || '',
            jsonp = option.jsonp,
            responseData;
        option.data = option.data ? option.data : {};
        option.data.KAJAX = true;
        option.async = option.async === undefined ? true : option.async;
        option.progress = option.progress ? option.progress : null; //上传进度回调函数
        //JSONP直接创建script插入到dom后回调
        if (dataType == 'jsonp') {
            //复制回调函数名
            var copyCallback = $.isFunction(jsonpCallback) ? ('jsonpCallback' + (jsonpID++)) : jsonpCallback;

            window[copyCallback] = function () {
                responseData = arguments;
            }
            option.data.jsonpCallback = copyCallback;
            var script = document.createElement('script');
            script.src = $.urlAdd(option.url, option.data);
            script.type = 'text/javascript';
            $(script).on('load', function (e) {
                var result = responseData[0];
                $(this).remove();

                if (jsonpCallback == copyCallback) {
                    window[jsonpCallback] = window[jsonpCallback];
                }
                if (responseData && $.isFunction(jsonpCallback)) {
                    jsonpCallback.call(this, result);
                }

                if (e.type == 'error') {
                    $.isFunction(option.error) && option.error.call(this, result);
                } else {
                    $.isFunction(option.success) && option.success.call(this, result);
                }
                option.complete && option.complete.call(this, result); //请求完成执行回调
            });
            document.head.appendChild(script);
            copyCallback = responseData = null;

            //其他ajax请求采用XMLHttp
        } else {

            if (getType == 'POST') {
                if (!(option.data instanceof FormData)) {
                    var _data = new FormData();
                    $.loop(option.data, function (val, key) {
                        if ($.isObject(val)) {
                            $.loop(val, function (v, k) {
                                _data.append(key + '[' + k + ']', v);
                            });
                        } else {
                            _data.append(key, val);
                        }
                    });
                    option.data = _data;
                    _data = '';
                }
            } else if (getType == 'GET') {
                option.url = $.urlAdd(option.url, option.data);
            }

            var A = new XMLHttpRequest();
            if(A.upload){
                A.upload.addEventListener('progress', function(event) {
                  const percent = Math.round((event.loaded / event.total) * 100, 2);
                  option.progress && option.progress(percent);
                });
            }

            A.open(getType, option.url, option.async);

            $.loop(headers, function (val, k) {
                A.setRequestHeader(k, val);
            });
            
            A.send(option.data);

            A.onreadystatechange = function () {
                if (A.readyState === 4) {
                    var result = A.responseText;
                    if (A.status === 200) {
                        if (dataType === 'script') {
                            (1, eval)(result);
                        } else if (dataType === 'xml') {
                            result = A.responseXML;
                        } else if (dataType === 'json') {
                            result = /^\s*$/.test(result) ? null : JSON.parse(result);
                        }
                        $.isFunction(option.success) && option.success.call(this, result);
                    } else {
                        $.isFunction(option.error) && option.error.call(this, result, A.status);
                    }
                    option.complete && option.complete.call(this, result, A.status); //请求完成执行回调
                }
            }
            //如果是同步请求
            if(option.async === false && A.readyState === 4){
                $.isFunction(option.success) && option.success(A.responseText);
            }
            //超时处理
            var EvnTimeout;
            if (option.timeout > 0) {
                EvnTimeout = setTimeout(function () {
                    A.onreadystatechange = function () {
                    }
                    A.abort()
                    $.isFunction(option.error) && option.error.call(this, result, A.status);
                    option.complete && option.complete.call(this, result, A.status); //请求完成执行回调
                }, option.timeout)
            }
        }
    }
// ====================== 元素监听 ====================== //


    /**
     * 获取调用此函数的参数名与参数值
     * @param Args
     */
    $.getIncludeFunc = function (Args) {
        var argsNames = Args.callee.toString().match(/^function(\s[^(]+)?\(([^)]+)?\){/);
        if (argsNames && argsNames[2]) {
            var dt = {};
            argsNames = $.explode(',', argsNames[2], '');
            $.loop(argsNames, function (v, k) {
                v = v.trim();
                dt[v] = Args[k];
            });
            return dt;
        }
    }

    /***
     * setTimeout防重复
     * @param skey 唯一标示，作为防重复依据
     * @param func 回调函数
     * @param time 时间
     */
    $.setTimeout = function (skey, func, time) {
        if (!this.setTimeoutMap) {
            this.setTimeoutMap = {};
        }
        if (this.setTimeoutMap[skey]) {
            window.clearTimeout(this.setTimeoutMap[skey]);
            delete this.setTimeoutMap[skey];
        }
        this.setTimeoutMap[skey] = window.setTimeout(func, time);
    }

    var autoIDMap = {};
    /**
     * 根据key获得一个自增ID
     * @param key
     * @returns {number}
     */
    $.autoID = function (key) {
        if (!autoIDMap[key]) {
            autoIDMap[key] = 0;
        }
        return autoIDMap[key]++;
    };

    /**
     * 对象的唯一ID累加变量
     */
    var _KSAobjectIDIndex = 1;

    /**
     * 获取一个对象的唯一ID
     * 支持 对象、数组、函数
     * @param obj
     * @returns {number}
     */
    $.objectID = function (obj, newID) {
        var keyName = '_uniqueID_';
        var isValue = $.isset(newID);
        var isdel = newID === '';
        if (obj instanceof HTMLElement) {
            if (isdel) {
                $.isset(obj[keyName]) && delete obj[keyName];
            } else if (isValue) {
                obj[keyName] = newID;
            } else {
                if (!obj[keyName]) {
                    obj[keyName] = _KSAobjectIDIndex++;
                }
            }
            return obj[keyName];
        } else if ($.isWindow(obj)) {
            return 0;
        } else if ($.isObject(obj)) {
            if (isdel) {
                $.isset(obj[keyName]) && delete obj[keyName];
            } else if (isValue) {
                $.objectID(obj);
                Object.defineProperty(obj, keyName, {
                    value : newID,
                    enumerable : false,
                    writable : true
                });
                return newID;
            } else {
                if (!$.isset(obj[keyName])) {
                    Object.defineProperty(obj, '_uniqueIDFunc_', {
                        value : function () {
                            if (!$.isset(this[keyName])) {
                                Object.defineProperty(this, keyName, {
                                    value : _KSAobjectIDIndex++,
                                    enumerable : false,
                                    writable : true
                                });
                            }
                            return this[keyName];
                        },
                        enumerable : false,
                        writable : false
                    });
                    obj._uniqueIDFunc_();
                }
                return obj[keyName];
            }
        } else if ($.isFunction(obj)) {
            if (isdel) {
                $.isset(obj.prototype[keyName]) && delete obj.prototype[keyName];
            } else if (isValue) {
                obj.prototype[keyName] = newID;
            } else {
                if (!obj.prototype[keyName]) {
                    obj.prototype[keyName] = _KSAobjectIDIndex++;
                }
                return obj.prototype[keyName];
            }

        }
    }
// ====================== TPL模板语法 ====================== //
    $.tplSet = function(){
        Vue.set.apply(Vue, arguments);
    }
    $.tplDelete = function(){
        Vue.delete.apply(Vue, arguments);
    }
    $.tpl = function(Config){
        var originalEL; //原始节点
        var eleIsSript;
        if (Config.el) {
            originalEL = $(Config.el);
            eleIsSript = originalEL[0].tagName ==='SCRIPT';
            if(!Config.tpl){
                Config.tpl = originalEL.html();
            }
        }
        Config.methods = Config.methods ? Config.methods : {};
        var renderFunc = Config.render;
        delete Config.render;
        var _Rn = {
            Template : Config.tpl.trim(),
            el : '',
            init : function(){
                var ts = this;
                ts.formatHTML();
                Config.mounted = function(){

                    Config.methods.$data = Config.data;

                    this.methods = Config.methods;

                    Config.init && Config.init.apply(this, [Config, originalEL]);

                    Config.el = originalEL;

                    this.$nextTick(function () {
                        var eles = [].slice.call(this.$el.childNodes);
                        $(this.$el).after(eles).remove(); //渲染完成
                        renderFunc && renderFunc.call(Config, originalEL);
                    });
                }
                Config.el = this.el;
                return new Vue(Config);
            },
            formatHTML : function () {
                var code = '<div>'+this.Template+'</div>';
                //规整语法 去掉{{}}里面的空白字符
                code = code.replace(/{{(.*?)}}/g, function () {
                    var str = arguments[1].trim();
                    str = str.replace('&lt;', '<');
                    str = str.replace('&gt;', '>');
                    str = str.replace('&amp;', '&');
                    str = str.replace('&quot;', '"');
                    str = str.replace('&nbsp;', ' ');
                    return '{{' + str + '}}';
                });


                code = code.replace(/{{(((if|loop)(\s+.*?))|(\/(if|loop)))}}/g, function () {
                    var arg = arguments;
                    if (arg[1].substr(0, 1) === '/') {
                        return '</template>';
                    } else {
                        arg[4] = arg[4].trim();
                        if(arg[3] === 'loop'){
                            var st = arg[4].split(' ');
                            if(st[2]){
                                return '<template v-for="('+st[2]+', '+st[1]+') in '+st[0]+'">';
                            }else{
                                return '<template v-for="'+st[1]+' in '+st[0]+'">';
                            }
                        }else{
                            return '<template v-if="'+arg[4]+'">';
                        }
                    }
                });
                code = code.replace(/{{elseif\s(.*?)}}/g, function () {
                    return '</template><template v-else-if="' + arguments[1] + '">';
                });
                code = code.replace(/{{else}}/g, function () {
                    return '</template><template v-else>';
                });

                var el = document.createRange().createContextualFragment(code);
                this.el = el.childNodes[0];
                this.el.style.display = 'none';
                if(eleIsSript){
                    originalEL.after(this.el).remove();
                    originalEL = this.el;
                }else{
                    originalEL.html(this.el);
                }
            }
        };
        return _Rn.init();
    }

// ====================== 判断与重写函数类 ====================== //

    $.isWindow = function isWindow(obj) {
        return $.isObject(obj) && obj === obj.window;
    };

    $.isDocument = function (obj) {
        return $.isObject(obj) && obj.nodeType == obj.DOCUMENT_NODE;
    }

    $.isArray = function (v) {
        return $.isObject(v) && v.constructor == Array;
    }

    /**
     * 模拟php isset
     * @param key
     * @param str 指定需要检测的字符串 可选
     * @returns {boolean}
     */
    $.isset = function (key, str) {
        if (str !== undefined) {
            return key.indexOf(str) === -1;
        } else {
            return typeof (key) !== 'undefined';
        }
    }
    $.isTrue = function (v) {
        return v === true;
    }
    $.isFalse = function (v) {
        return v === false;
    }
    $.isArrayLike = function (obj) {

        if ($.isFunction(obj) || $.isWindow(obj) || $.isString(obj) || $.isNumber(obj)) {
            return false;
        }

        var length = !!obj && "length" in obj && obj.length, type = typeof (obj);
        return type === "array" || length === 0 || (typeof length === "number" && length > 0 && (length - 1) in obj);
    };

    $.isLoop = function (obj) {
        var length = !!obj && "length" in obj && obj.length, type = typeof (obj);
        return type === "array" || length === 0 || (typeof length === "number" && length > 0 && (length - 1) in obj);
    };

    $.isNumber = function (v) {
        var tp = typeof (v);
        return (tp === 'string' || tp === 'number') && !isNaN(v);
    }

    $.isBool = function (v) {
        return typeof (v) === 'boolean';
    }

    $.isObject = function (v) {
        return v && typeof (v) === 'object';
    }

    $.isObjectPlain = function (v) {
        return $.isObject(v) && !$.isWindow(v) && Object.getPrototypeOf(v) === Object.prototype;
    }

    $.isString = function (v) {
        return typeof (v) === 'string';
    }
    $.isFunction = function (v) {
        return v && typeof (v) === 'function';
    }


    $.isEmpty = function (v) {
        if ($.isObject(v)) {
            return Object.keys(v).length === 0;
        } else {
            return v === '' || v === undefined;
        }
    }

    /**
     * 判断是否是一个元素节点
     * @param dom
     * @returns {boolean}
     */
    $.isDomAll = function (dom) {
        if (!dom || $.isString(dom)) {
            return;
        }
        return dom instanceof HTMLElement ||
               dom instanceof Node ||
               dom instanceof NodeList ||
               ($.isObject(dom) && dom.nodeType && $.isString(dom.nodeName))
    }

    /**
     * 判断元素节点是否在当前document中
     * @param e
     * @returns {*|boolean}
     */
    $.isIndom = function (e) {
        return e && e instanceof HTMLElement && !$.inArray(document.compareDocumentPosition(e), [35, 37]);
    }

    $.isNull = function (v) {
        return v === null;
    }

    $.inArray = function (val, dt, rkey) {
        var S = false, valisArr = $.isArray(val);
        $.loop(dt, function (v, k) {
            if ((valisArr && $.inArray(v, val)) || (!valisArr && val == v)) {
                S = rkey ? k : true;
                return S;
            }
        });
        return S;
    }

    $.count = function (dt) {
        if ($.isObject(dt)) {
            var S = 0;
            $.loop(dt, function(){
                S++;
            });
            return S;
        };
        return 0;
    }

    $.arrayMerge = function () {
        var arr = arguments[0] || {};
        $.loop(arguments, function (value, key) {
            if (key > 0 && $.isObject(value)) {
                $.loop(value, function (val, k) {
                    arr[k] = val;
                });
            }
        });
        return arr;
    }

    /**
     * 将任何数据转为数组
     * @param dt
     */
    $.toArray = function (dt) {
        var tp = typeof (dt);
        if ($.isArray(dt)) {
            return dt;
        } else if (tp === 'object') {
            if (dt instanceof HTMLElement || dt instanceof Node) {
                return [dt];
            } else if (dt instanceof NodeList) {
                return [].slice.call(dt);
            } else if (dt instanceof $) {
                var newdt = [];
                dt.each(function (_, e) {
                    newdt.push(e);
                });
                return newdt;
            }
        } else {
            return [dt];
        }
    }

    /**
     * 字符串转数组
     * @param ft 分隔符
     * @param str 需要转换的字符串
     * @param notemp 需要排除的值
     * @returns {[]}
     */
    $.explode = function (ft, str, notemp) {
        str = ft && str ? str.toString().split(ft) : [];
        if (!str.length) {
            return [];
        }
        //如果需要排除空值
        if ($.isset(notemp)) {
            var news = [];
            $.loop(str, function (v) {
                if (v != notemp) {
                    news.push(v);
                }
            });
            str = news;
        }
        return str;
    }

    $.implode = function (n, arr) {
        var s = '', str = '';
        $.loop(arr, function (v) {
            str += s + v;
            s = n;
        });
        return str;
    }

    $.unset = function (dt, keys) {
        var at = $.isObject(dt) ? 'object' : ($.isArray(dt) ? 'array' : null);
        if (at) {
            keys = $.explode(' ', keys, '');

            $.loop(dt, function (v, k) {
                if ($.inArray(k, keys)) {
                    if (at == 'object') {
                        delete dt[k];
                    } else {
                        dt.splice(k, 1);
                    }
                }
            });
        }
        return dt;
    }

    $.trim = function (str, char) {
        str = str.toString();
        if (char) {
            str = str.replace(new RegExp('^\\' + char + '+', 'g'), '');
            str = str.replace(new RegExp('\\' + char + '+$', 'g'), '')
        } else {
            str = str.trim();
        }
        return str;
    }

    function _intval(value, isFloat) {
        if ($.isObject(value) || $.isArray(value)) {
            $.loop(value, function (v, k) {
                value[k] = _intval(v, isFloat);
            });
        } else {
            value = (isFloat ? parseFloat(value) : parseInt(value)) || 0;
        }
        return value;
    }

    $.intval = function (value) {
        return _intval(value);
    }

    $.floatval = function (value) {
        return _intval(value, true);
    }

    $.strpos = function (str, val, len) {
        str = str.toString();
        str = len > 0 ? str.substr(len) : str;

        if($.isArray(val)){
            var check = false;
            $.loop(val, function(v){
                if(str.indexOf(v) !== -1){
                    check = true;
                    return true;
                }
            });
            return check;
        }else{
            return str.indexOf(val) !== -1;
        }
    }

    $.strlen = function (value) {
        return value.toString().length;
    }

    $.copy = function(text){
        var textarea = $(document.createElement('textarea'));
        $('body').append(textarea);
        textarea.val(text);
        textarea[0].select();
        textarea.css({position: 'absolute'});
        document.execCommand("Copy");
        textarea.remove();
    }

    K.focus = function (fun) {
        if (fun) {
            this.on('focus', fun);
        } else {
            this[0] && this[0].focus();
        }
        return this;
    }

    /**
     * 触发一个JS字符串代码
     * 必须通过apply|call触发才能正确调整this指向
     *
     * @param code 需要触发的代码
     * @param param 传递的参数 支持数组
     * @returns {*}
     */
    $.callStrEvent = function (code, param) {
        code = code.trim();
        var fun = window[code] ? window[code] : new Function('return ' + code);
        return fun && $.isArray(param) ? fun.apply(this, param) : fun.call(this, param);
    }

    $.loop(('input blur focusin focusout resize scroll click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change keydown keypress keyup contextmenu touchstart touchmove touchend').split(' '), function (name) {
        K[name] = function (func, fn) {
            return arguments.length > 0 ? this.on(name, null, func, fn) : this.trigger(name);
        };
    });

    $(document).on('DOMContentLoaded.ksa', function () {
        $.loop(DocumentReadyFunction, function (func) {
            func();
        });
        DocumentReadyFunction = [];
        $(document).off('DOMContentLoaded.ksa');
    });
    $.extend = $.arrayMerge;
    K.innerWidth = function () {
        return this.width(true);
    }
    K.innerHeight = function () {
        return this.height(true);
    }
    K.outerWidth = function () {
        return this.width(true, true);
    }
    K.outerHeight = function () {
        return this.height(true, true);
    }

    //插件钩子 $.plugin.xxx = xxx;
    $.plugin = $.prototype;
    window.KSA = window.$ = $;

    var requireScript = document.currentScript ? document.currentScript : document.scripts[document.scripts.length - 1];
    var requireDir = requireScript.src.substr(0, requireScript.src.lastIndexOf('/') + 1);
    $.requireDir = requireDir;
    $.require = function (srcs) {
        if (!$.isArray(srcs)) {
            srcs = $.explode(' ', srcs, '');
        }
        $.loop(srcs, function (value) {
            if(!value){
                return;
            }
            var ext = value.substr(value.lastIndexOf('.'));
            ext = ext ? ext.toLowerCase() : ext;
            var isCSS = ext === '.css';
            value = 'module/' + value + (ext ? '' : '.js');
            var file = document.createElement(isCSS ? 'link' : 'script');
            if (isCSS) {
                file.href = requireDir + value;
                file.type = 'text/css';
                file.rel = 'stylesheet';
                $(requireScript).after(file);
            } else {
                $.ajax({
                    url : requireDir + value,
                    type : 'GET',
                    async:false,
                    dataType : 'script',
                    success : function(res){
                        file.text = res;
                        file.type = 'text/javascript';

                        $(requireScript).after(file);
                        $(file).remove();
                    }
                });
            }
        });
    }
    $.require(requireScript.getAttribute('module'));
    
    return $;
})(document);
