window.KSAUI = {UI__: {title: '凯撒UI2.0_cr',progress: 0,progressText: ''}};
function KSAUI_frame_init() {
    //最小化 最大化 关闭按钮
    const hd = $('header');
    if(!hd.length){
        return setTimeout(KSAUI_frame_init, 500);
    }
    console.info('主框架初始化完成');
    let param = {
        mode: '',
        moveStatus: false,
        moveData: {x: 0,y: 0},
    };
    //移动窗口
    function Move(e) {
        e = e || window.event;
        ac = e.type;
        if (ac == 'mousedown') {
            param.moveStatus = true;
            param.moveData.x = e.pageX;
            param.moveData.y = e.pageY;
        } else if (ac == 'mousemove' && param.moveStatus) {
            let mx = (e.pageX - param.moveData.x);
            let my = (e.pageY - param.moveData.y);
            pywebview.api.windowMove(mx, my);
        } else if ((ac == 'mouseout' || ac == 'mouseup') && param.moveStatus) {
            param.moveStatus = false;
            param.moveData.x = 0;
            param.moveData.y = 0;
        }
    }

    function winAction(mode){
        if (param.mode == 'fullscreen' && mode == 'fullscreen') {
            mode = 'fullscreen-exit'
        }
        param.mode = mode;
        pywebview.api.windowAction(mode);
        let btn = $('.ui-frame-hdbtn-fullscreen');
        if(mode == 'fullscreen'){
            btn.removeClass('ri-aspect-ratio ri-fullscreen-exit').addClass('ri-fullscreen-exit');
        }else if(mode == 'fullscreen-exit'){
            btn.removeClass('ri-aspect-ratio ri-fullscreen-exit').addClass('ri-aspect-ratio');
        }
    }


    hd.mousedown(Move).mouseup(Move).mouseout(Move).mousemove(Move);

    hd.dblclick(function () {
        winAction('fullscreen');
    });
    hd.find('.win_header_btn > span').click(function(){
        winAction($(this).data('type'));
    });
}
KSAUI_frame_init();