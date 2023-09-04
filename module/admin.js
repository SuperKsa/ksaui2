if(typeof KSA =='undefined'){
    throw new Error("KSA组件缺失 admin.js");
}
$.layerHideBackEvent = false;
$.AddTags = ['ks-date','ks-datetime','ks-button','ks-menu','ks-window','ks-input'];

/**
 * 返回iframe访问的后台地址
 * @param {url} url
 * @returns {url}
 */
$.adminUrl = function(url){
    url = $.urlAdd(url, {_adminiframe_:1});
    return url;
};

$.adminiframeWin = function(title, url, fun){
    $.layer({
        title : title,
        iframe : this.adminUrl(url),
        width : '90%',
        height : '90%',
        maxHeight : false,
        close : function (layer) {
            typeof(fun) =='function' && fun(layer);
        }
    });
};

/**
 * 后台子框架表单提交 自动关闭当前iframe
 * onsubmit="return $.ajaxSubmit(this);"
 * @param obj
 * @returns {Boolean}
 */
$.adminAjaxSubmit = function(obj){
    return $.ajaxSubmit(obj, function(d){
        if(d.success){
            setTimeout($.layerHideF, 1600);
        }
    });
};

/**
 * 后台主框架逻辑
 */
$.KSAadminIframe = function(homeUrl){
    var R = {
        dom : $('#content'),
        taskBar : $('.ks-admin-taskbar'),
        bar : '',
        menu : $('.ks-sidebar_box'),
        navaction : $('ks-navaction'),
        home : $('.ks-admin-taskbar-home'),
        homeUrl : homeUrl,
        isArrow : false, //是否需要左右箭头
        taskBarContentWidth : 0, //任务栏标签占用宽度
        taskBarWidth : 0, //任务栏标签区域宽度
        taskBarLeft : 0, //任务栏标签区 X坐标
        currentUrl : '',
        data : {},
        run : function(){
            var ths = this;
            ths.bar = ths.taskBar.children('.ks-admin-taskbar-c');
            ths.homeUrl = ths.homeUrl ? ths.homeUrl : ths.home.data('url');
            ths.initTaskBarParam();


            ths.home.click(function(){
                ths.change('home');
            });

            $('.ks-sidebar_box dl').each(function(i,ele){
                ele = $(ele);
                ele.find('.ks-sidebar_title').click(function(){
                    var t = $(this),
                        f = t.parent();
                    if(f.active()){
                        f.active(false);
                    }else{
                        f.active(true);
                    }
                });
                ele.find('[data-url]').click(function(){
                    var t = $(this);
                    //debug(t, t.attr(), t.data());
                    ths.open(t.data('url'), 1, t.text());
                    ths.taskbarMove();
                });
            });
            var cache = ths.cache();
            if($.count(cache)){
                $.loop(cache, function(v){
                    v && v.url && v.title && ths.open(v.url, v.isOpen, v.title);
                });
            }else{
                ths.open(ths.homeUrl, 1, 'home');
            }

            $('.ks-admin-taskbar-next').mousedown(function(){
                ths.taskbarMove('left');
                this._ksa_taskbarMove = window.setInterval(function(){
                    ths.taskbarMove('left');
                },200);
            }).mouseup(function(){
                window.clearInterval(this._ksa_taskbarMove);
                delete this._ksa_taskbarMove;
            }).showMenu('hover',[
                {
                    label : '关闭当前标签',
                    event : function(){
                        ths.close(ths.bar.find('li[active]').data('url'));
                    }
                },
                {
                    label : '关闭所有标签',
                    event : function(){
                        ths.closeAll();
                    }
                }
            ]);

            $('.ks-admin-taskbar-prev').mousedown(function(){
                ths.taskbarMove('right');
                //0.3秒后快速移动标签
                this._ksa_taskbarMove = window.setInterval(function(){
                    ths.taskbarMove('right');
                },200);
            }).mouseup(function(){
                window.clearInterval(this._ksa_taskbarMove);
                delete this._ksa_taskbarMove;
            });
            ths.taskbarMove();
            ths.createIframe(ths.currentUrl);
            ths.change(ths.currentUrl);
            return ths;
        },
        initTaskBarParam : function(){
            this.taskBarWidth = this.bar.width(true);
            this.taskBarLeft = this.bar.offset().left;
        },
        //移动任务栏 当前标签校准
        taskbarMove : function(action){
            var ths = this;
            var showBar;
            var left = parseFloat(ths.bar.children('ul').css('left')) || 0;
            var moveX = null;

            //往右边移动
            if(action ==='right'){
                ths.bar.find('li').each(function(i, ele){
                    var x = ths.getTaskItemLeft(ele);
                    if(x < 0){
                        showBar = ele;
                    }
                });

            }else if(action ==='left'){
                ths.bar.find('li').each(function(i, ele){
                    var x = ths.getTaskItemLeft(ele) + $(ele).width(true);
                    if(!showBar && x > ths.taskBarWidth){
                        showBar = ele;
                    }
                });

            }else {
                if(ths.currentUrl === ths.homeUrl){
                    return;
                }
                showBar = ths.data[ths.currentUrl].taskBar;
            }
            if(showBar) {
                showBar = $(showBar);
                var liLeft = ths.getTaskItemLeft(showBar);
                if (liLeft < 0) {
                    moveX = left - liLeft;
                } else if (liLeft + showBar.width(true) > ths.taskBarWidth) {
                    moveX = left - (liLeft + showBar.width(true) -  ths.taskBarWidth);
                }

                if (!$.isNull(moveX)) {

                    var moveXmax = -(ths.taskBarContentWidth - ths.taskBarWidth);
                    moveX = moveX <0 && moveX < moveXmax ? moveXmax : moveX;
                    moveX = moveX > 0 ? 0 : moveX;
                    ths.bar.children('ul').css('left', moveX + 'px');
                }
            }
        },
        //获得指定标签在任务栏中的相对left值
        getTaskItemLeft : function(li){
            return $(li).offset().left - this.taskBarLeft;
        },
        //窗口切换
        change : function(url, param){
            var ths = this;
            ths.currentUrl = url;
            if(url === ths.homeUrl || url ==='home'){
                ths.home.active(true);
                ths.bar.find('li').active(false);
                url = ths.homeUrl;
            }else{
                ths.home.active(false);
            }
            //切换iframe为活动状态
            var dt = ths.data[url];
            if(dt){
                if(!dt.content || dt.param != param){
                    ths.createIframe(url, param); //切换前可能还没有创建内容框架
                }

                $(dt.content).active(true).siblings().active(false);
                $(dt.taskBar).active(true).siblings().active(false);
                this.currentIframe =  $(dt.content).find('iframe');
                ths.cache(url, dt.title);
                $.loop(ths.data,function(v, k){
                    ths.data[k].isShow = false;
                });
                ths.data[url].isShow = true;
            }
            ths.muChange(url);
        },
        //左侧菜单切换
        muChange : function(url){
            var ths = this;
            var mu = ths.menu.find('[data-url="'+url+'"]');
            ths.menu.find('dl, dd, dt, li, li > p').active(false);
            mu.active(true);
            mu.parents('dl').active(true);
            mu.parent().parents('li').active(true);
            var homeNav = $('<a href="javascript:;">首页</a>');
            homeNav.click(function(){
                ths.open(ths.homeUrl, 1, 'home');
            });
            ths.navaction.empty().append(homeNav);
            mu.parents('dl').find('[active] > .ks-sidebar_title').push(mu).map(function(e){
                ths.navaction.append('<span>'+$(e).text()+'</span>');
            });
        },
        cache : function(url, title){
            //写缓存
            var cache = $.Cache('adminframe') || {};
            if(url) {
                if(title === ''){
                    cache = $.unset(cache, url);
                }else{
                    $.loop(cache,function(v, k){
                        cache[k].isOpen = 0;
                    });
                    if (cache[url]) {
                        cache[url].isOpen = 1;
                    }else{
                        cache[url] = {title: title, url: url, isOpen: 1};
                    }
                }
                $.Cache('adminframe', cache);
            }
            return cache;
        },
        createIframe : function(url, param){
            var ths = this;
            let iframeUrl = url;
            if(param && $.isObject(param)){
                iframeUrl = $.urlAdd(url, param);
            }
            if(ths.data[url] && ths.data[url].content){
                let iframes = $(ths.data[url].content).find('iframe');
                if(param && iframes.attr('src') != iframeUrl){
                    iframes.attr('src', $.adminUrl(iframeUrl))
                }
                return ths.data[url].content;
            }
            var iframe = $('<div class="ks-admin-iframe" data-url="'+url+'"><iframe src="'+$.adminUrl(iframeUrl)+'" width="100%" height="100%"></iframe></div>');
            ths.data[url].content =  iframe[0];
            this.dom.append(iframe);
            this.currentIframe = iframe.find('iframe');
            return iframe;
        },
        createTaskbar : function(title, url){
            var ths = this;

            if(ths.data[url] && ths.data[url].taskBar){
                return ths.data[url].taskBar;
            }
            if(url === ths.homeUrl){
                ths.data[url].taskBar = ths.home[0];
                return ths.home;
            }
            var li = $($.tag('li',{class:'ks-admin-taskbar-li','data-title':title,'data-url':url},title+'<i icon="close"></i>'));
            //切换到当前链接
            li.click(function(){
                ths.change($(this).data('url'));
                ths.taskbarMove(this);
            });

            //删除当前链接
            li.find('i').click(function(){
                ths.close($(this).parent().data('url'));
                return false;
            });
            //状态栏双击刷新
            li.dblclick(function(){
                ths.currentIframe[0].contentWindow.location.reload(true);
            });
            ths.bar.children('ul').append(li);

            ths.taskBarContentWidth += li.width(true,true);
            //显示左右切换更多按钮
            if(!ths.isArrow && ths.taskBarContentWidth > ths.taskBarWidth){
                ths.isArrow = true;
                ths.taskBar.attr('more', true);
                ths.initTaskBarParam();
            }
            ths.data[url].taskBar = li[0];

            return li;
        },
        /**
         * 打开一个窗口
         * @param url 需要打开的url (必须是左侧菜单的url)
         * @param isShow 是否立即显示
         * @param title 窗口标题 （首次打开必须传入）
         * @param param url需要附加的参数
         */
        open : function(url, isShow, title, param){

            var ths = this;
            if(!title){
                title = ths.menu.find('[data-url="'+url+'"]').text();
            }

            if(!ths.data[url]) {
                ths.data[url] = {
                    title: title,
                    isShow: isShow,
                    taskBar: '',
                    content: '',
                };
            }
            ths.createTaskbar(title, url);
            isShow && ths.change(url, param);
        },
        //关闭窗口
        close : function(url, isForce){
            var ths = this;
            var dt = ths.data[url];
            if(!dt){
                return;
            }
            var t = $(dt.taskBar);
            var content = $(dt.content);

            //普通关闭 如果内容中存在layer弹窗时 给出关闭警告
            if(!isForce && content.length && $(content.children('iframe')[0].contentWindow.document.body).find('.ks-layer:not([pos="0"])').length){
                $.Dialog('confirm', '窗口关闭提示','确认要关闭'+dt.title+'吗？', function(){
                    ths.close(url, true);
                });
                return;
            }
            ths.taskBarContentWidth -= t.width(true,true);
            var next = t.next();
            if(!next.length){
                next = t.prev();
            }
            //如果当前是活动窗口 则需要显示当前下一个窗口
            if(t.active()){
                ths.change(next.length ? next.data('url') : 'home');
            }
            //隐藏左右切换更多按钮
            if(ths.isArrow && ths.taskBarContentWidth < ths.taskBarWidth){
                ths.isArrow = false;
                ths.taskBar.attr('more', '');
                ths.initTaskBarParam();
            }
            t.remove();
            content.length && content.remove();
            ths.cache(url,'');
            delete ths.data[url];
            ths.initTaskBarParam();
        },
        closeAll : function(){
            var ths = this;
            ths.bar.find('li').each(function(i, ele){
                ele = $(ele);
                var url = ele.data('url');

                ths.data[url].content && $(ths.data[url].content).remove();
                ele.remove();
                ths.cache(url,'');
                delete ths.data[url];
            });
            ths.taskBar.attr('more','');
            ths.change('home');
            ths.isArrow = false;
            ths.taskBarContentWidth = 0;
        }
    };

    return R.run();

}
