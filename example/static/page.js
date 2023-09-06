$(document).on('click', '.demo-sidebar ks-collapse-block > *[to]', function () {
    let el = $(this);
    el.active(true).siblings().active(false);
    let to = $($(this).attr('to'));
    let top = to.offset().top;
    $('html').scrollTop(top, 200);
});



//初始化预览代码
$(document).ready(function () {
    //html转实体
    function html2Escape(sHtml) {
         return sHtml.replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];});
    }
    //缩进代码
    function adjustIndentation(code) {
      // 获取第一行代码的空格数量
      const firstLine = code.split('\n')[0];
      const spacesCount = firstLine.search(/\S|$/);

      // 将每一行的空格减去第一行的空格数量
      const adjustedCode = code
        .split('\n')
        .map((line) => line.slice(spacesCount))
        .join('\n');

      return adjustedCode;
    }
    //代码处理为预览模式
    $('script.code').each(function (_, ele) {
        ele = $(ele);
        let code = ele.html();
        code = $.trim(code, "\n");
        code = adjustIndentation(code);
        ele.after(`<div class="doc-examplebox">
        <div class="doc-preview">${code}</div>
        <pre class="doc-code"><code class="language-html">${html2Escape(code)}</code></pre>
        </div>`);
        ele.remove();
    });
});