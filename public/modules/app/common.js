/*
 * common.js
 * by xqs 160613
 * */

define(function (require, exports, module) {


    /*
     * jquery扩展方法
     * $.fn.
     * */
    (function () {
        "use strict";

        /*节流*/
        $.throttle = function (fn, delay) {
            var timer = null;
            return function () {
                var context = this, args = arguments;
                clearTimeout(timer);
                timer = setTimeout(function () {
                    fn.apply(context, args);
                }, typeof delay !== 'number' ? delay : 200);
            };
        };

        /*监听动画结束事件*/
        $.fn.transitionEnd = function (callback) {
            var events = ['webkitTransitionEnd', 'transitionend', 'oTransitionEnd', 'MSTransitionEnd', 'msTransitionEnd'],
                i, dom = this;

            function fireCallBack(e) {
                if (e.target !== this) return;
                callback.call(this, e);
                for (i = 0; i < events.length; i++) {
                    dom.off(events[i], fireCallBack);
                }
            }

            if (callback) {
                for (i = 0; i < events.length; i++) {
                    dom.on(events[i], fireCallBack);
                }
            }
            return this;
        };


    })();


    /*
     * 其他常用方法封装
     * Date等
     * */
    (function () {
        //时间对象的格式化 Date.format("yyyy-MM-dd hh:mm:ss");
        Date.prototype.format = function (b) {
            var c = {
                "M+": this.getMonth() + 1,
                "d+": this.getDate(),
                "h+": this.getHours(),
                "m+": this.getMinutes(),
                "s+": this.getSeconds(),
                "q+": Math.floor((this.getMonth() + 3) / 3),
                S: this.getMilliseconds()
            };
            if (/(y+)/.test(b)) {
                b = b.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length))
            }
            for (var a in c) {
                if (new RegExp("(" + a + ")").test(b)) {
                    b = b.replace(RegExp.$1, RegExp.$1.length == 1 ? c[a] : ("00" + c[a]).substr(("" + c[a]).length))
                }
            }
            return b
        };

        //数组去重，支持数组内存储的是对象
        Array.prototype.unique = function () {
            var res = [], json = {}, len = this.length;
            for (var i = 0; i < len; i++) {
                var key = this[i];
                if (Object.prototype.toString.call(this[i]) == '[object Object]') {
                    key = JSON.stringify(this[i]);
                }
                if (!json[key]) {
                    res.push(this[i]);
                    json[key] = 1;
                }
            }
            return res;
        };
    })();


    ;
    /*
     * 妈妈好项目内部方法封装
     * Object: MMH
     * */
    (function () {
        var MMH = {
            config: {
                isAjax: {}, //正在ajax的api对象
                // api调用域，区分正式环境及测试环境;
                api: /mamahao.com/gi.test(location.host) ? "http://api.mamahao.com/" : "http://api.mamhao.com/mamahao-app-api/",
                isWeixin: /micromessenger/gi.test(navigator.userAgent)
            },
            init: function () {

                $(function () {
                    /*FastClick 解决click事件移动端300ms延迟的问题*/
                    FastClick.attach(document.body);
                    /*初始化回到顶部按钮*/
                    MMH.toTop.init();
                    // 全局微信自定义分享一次;
                    require.async('weixin', function (wx) {
                        //console.log("weixin----------------->", wx);
                        MMH.wx.share(wx);
                    });
                });
            },
            /*显示loading*/
            showLoading: function () {
                var $loading = $('.loading');
                if (!$loading[0]) {
                    $loading = $('<div class="loading"><span><s></s></span></div>').appendTo(document.body);
                }
                $loading.stop().fadeIn();
            },
            /*隐藏loading*/
            hideLoading: function () {
                var $loading = $('.loading');
                $loading[0] && $loading.stop().fadeOut();
            },
            /*ajax请求*/
            ajax: function (params) {
                var c = MMH.config;

                /*是否显示loading*/
                c.showLoading = typeof params.showLoading === 'boolean' ? params.showLoading : true;
                c.loadingDelay = typeof params.loadingDelay === 'number' ? params.loadingDelay : 10;

                /*超时显示loading*/
                if (c.isAjax[params.url]) return false;
                c.isAjax[params.url] = true;  //正在ajax请求
                var timer = setTimeout(function () {
                    clearTimeout(timer);
                    c.isAjax[params.url] && c.showLoading && MMH.showLoading();  //200ms之后显示loading遮罩
                }, c.loadingDelay);


                //是否需要地理位置
                if (params.location) {
                    $.when(getLocation()).always(doAjax);//Deferred
                } else {
                    doAjax();
                }


                //处理地理位置信息
                function getLocation() {
                    var dtd = $.Deferred();
                    require.async('app/location', function (fun) {
                        fun.getLocation({
                            success: function (res) {
                                dtd.resolve({location: $.param(res)});
                            },
                            fail: function () {
                                dtd.reject();
                            }
                        });
                    });
                    return dtd.promise();
                }

                /*do ajax*/
                function doAjax(data) {
                    var setting = {
                        type: params.type || "POST",
                        url: params.url || "/",
                        headers: $.extend({ajax: true}, data || {}),
                        data: params.data || {},
                        timeout: 2e4,  //20s
                        success: function (res) {
                            console.log('ajax-success-typeof', typeof res)
                            c.isAjax[params.url] = false;
                            if (res.error_code) {
                                var errorMsg = res.msg;
                                if (params.error) {
                                    return params.error.call(this, res);
                                }
                                if (/^(-1|1001)$/.test(res.error_code)) {
                                    //未登录
                                    return MMH.tips({
                                        body: "您还未登录，请登录后再试！",
                                        callback: function () {
                                            location.href = (c.isWeixin ? '/account/bind' : '/login') + '?origin=' + location.href;
                                        }
                                    });
                                }
                                return MMH.tips(errorMsg);
                            }
                            params.success && params.success.call(this, res);
                        },
                        error: function (res) {
                            console.log('error--->', res)
                            c.isAjax[params.url] = false;
                            if (params.error) {
                                params.error.call(this, res);
                            } else {
                                var errorMsg = res.msg || res.statusText;
                                console.log('xxx', res)
                                MMH.tips(errorMsg);
                            }
                        },
                        complete: function (res) {
                            //console.log('complete--->', res)
                            MMH.hideLoading();
                            params.complete && params.complete.call(this, res);
                        }
                    };

                    //额外配置
                    if (null !== params.dataType) {
                        //default: Intelligent Guess (xml, json, script, or html)
                        setting.dataType = params.dataType;
                    }
                    if (null !== params.cache) {
                        //默认: true, dataType为"script"和"jsonp"时默认为false
                        setting.cache = params.cache;
                    }
                    if (null !== params.processData) {
                        //默认: true
                        setting.processData = params.processData;
                    }
                    if (null !== params.contentType) {
                        //default: 'application/x-www-form-urlencoded; charset=UTF-8'
                        setting.contentType = params.contentType;
                    }

                    $.ajax(setting);
                }
            },
            /*tips提示框*/
            tips: function (args) {
                var fun = {
                    elements: {},
                    init: function () {
                        var o = fun.elements;

                        var tpl = ['<div class="ui-mask ui-mask-transparent ui-tips-mask"></div>', '<div class="ui-tips-wrap">', '<div class="ui-tips">', '<div class="ui-tips-bd"></div></div></div>'];
                        $(document.body).append(tpl.join(''));

                        o.mask = $('.ui-tips-mask');
                        o.wrapper = $('.ui-tips-wrap');
                        o.inner = $('.ui-tips');
                        o.bd = $('.ui-tips-bd');

                        var defaults = {
                            delay: 1500,
                            callback: null  //消失后的回调函数
                        };
                        if (Object.prototype.toString.call(args) !== '[object Object]') {
                            defaults.body = '' + args;
                            fun.params = defaults;
                        } else {
                            fun.params = $.extend({}, defaults, args || {});
                        }
                        var params = fun.params;
                        params.body && o.bd.html(params.body);
                        params.class && o.inner.addClass(params.class); // 附加class;  true / false 提示文字上面有对错图标;

                        fun.show();
                        var timer = setTimeout(function () {
                            clearTimeout(timer);
                            fun.hide();
                        }, params.delay);

                    },
                    show: function () {
                        var o = fun.elements;
                        o.mask.add(o.inner).addClass('visible');
                    },
                    hide: function () {
                        var o = fun.elements, params = fun.params;
                        o.mask.removeClass('visible').transitionEnd(function () {
                            o.mask.remove();
                        });
                        o.inner.removeClass('visible').transitionEnd(function () {
                            o.wrapper.remove();
                        });
                        params.callback && params.callback.call(this);
                    }
                };
                fun.init();
            },
            /*dialog对话框
             * 父级元素如果有transform属性，会导致子元素的fixed失效。
             * 故：移动端设计时避免使用fixed，或者二者不放在父子容器中。
             * */
            dialog: function (args) {
                var fun = {
                    elements: {},
                    init: function () {
                        var o = fun.elements;

                        var tpl = ['<div class="ui-mask ui-dialog-mask"></div>', '<div class="ui-dialog-wrap">', '<div class="ui-dialog-inner">', '<div class="ui-dialog-hd"></div>', '<div class="ui-dialog-bd"></div>', '<div class="ui-dialog-ft"></div>', '</div></div>'];
                        o.dialog = $(tpl.join('')).appendTo($('.spa')[0] ? $('.spa') : document.body);

                        o.mask = $('.ui-dialog-mask');
                        o.wrapper = $('.ui-dialog-wrap');
                        o.inner = $('.ui-dialog-inner');
                        o.hd = $('.ui-dialog-hd');
                        o.bd = $('.ui-dialog-bd');
                        o.ft = $('.ui-dialog-ft');

                        var defaults = {
                            body: '模态框内容',
                            buttons: [
                                {"text": "取消", "class": "", "onClick": null},
                                {"text": "确定", "class": "success", "onClick": null}
                            ]
                        };
                        Object.prototype.toString.call(args) !== '[object Object]' && (args = {body: args + ''});
                        var params = fun.params = $.extend({}, defaults, args || {});
                        o.bd.html(params.body);
                        params.className && o.inner.addClass(params.className);
                        params.title && o.hd.html(params.title);
                        o.ft.empty().append(function () {
                            return $.map(params.buttons, function (item, index) {
                                var btnClass = ['u-btn', item.class].join(' ');
                                return ['<button class="' + btnClass + '">' + item.text + '</button>'];
                            }).join('');
                        });

                        fun.show();
                    },
                    show: function () {
                        var o = fun.elements, params = fun.params;
                        o.mask.add(o.inner).show().addClass('visible');

                        /*bind events*/
                        o.ft.on('click', '.u-btn', function (e) {
                            var index = $(this).index();
                            var callback = params.buttons[index].onClick;
                            if (callback && $.isFunction(callback)) {
                                callback.call(fun, fun);
                            } else {
                                fun.hide();
                            }
                        });

                    },
                    hide: function () {
                        var o = fun.elements;
                        o.mask.removeClass('visible').transitionEnd(function () {
                            o.mask.remove();
                        });
                        o.inner.removeClass('visible').transitionEnd(function () {
                            o.wrapper.remove();
                        });
                        o.ft.find('.u-btn').off('click');
                    }
                };
                fun.init();
            },
            /*下拉刷新，上拉加载数据*/
            dropLoad: function (args) {
                var $target = $('.dropload');
                $target[0] && $target.pullToRefresh().on("pull-to-refresh", function () {
                    args.callback ? args.callback.call(this, $target) : (function () {
                        var timer = setTimeout(function () {
                            clearTimeout(timer);
                            $target.pullToRefreshDone();
                        }, 500);
                    })()
                });
            },
            calc: function () {
                /*
                 * 将浮点数去除小数点，返回整数和倍数。如 3.14 >> 314，倍数是 100
                 * @param n {number} 浮点数
                 * return {object}
                 * {num: 314, times: 100}
                 * */
                function toInt(n) {
                    var n = +n, res = {num: n, times: 1};
                    if (n !== (n | 0)) { //判断浮点数，n===parseInt(n)
                        var arr = ('' + n).split('.');
                        var len = arr[1].length; //小数长度
                        res.times = Math.pow(10, len); //需要乘的倍数=>10的指数
                        res.num = Math.round(n * res.times); //四舍五入取整
                    }
                    return res;
                }

                function operation(a, b, op) {
                    var result; //最终计算的值
                    var o1 = toInt(a), o2 = toInt(b);

                    var n1 = o1.num, t1 = o1.times;
                    var n2 = o2.num, t2 = o2.times;

                    var max = Math.max(t1, t2);

                    switch (op) {
                        case 'add':
                            if (t1 > t2) {
                                result = n1 + n2 * (t1 / t2);
                            } else {
                                result = n2 + n1 * (t2 / t1);
                            }
                            result = result / max;
                            break;
                        case 'subtract':
                            if (t1 > t2) {
                                result = n1 - n2 * (t1 / t2);
                            } else {
                                result = n1 * (t2 / t1) - n2;
                            }
                            result = result / max;
                            break;
                        case 'multiply':
                            result = (n1 * n2) / (t1 * t2);
                            return result;
                            break;
                        case 'divide':
                            result = (n1 / n2) * (t2 / t1);
                            return result;
                            break;

                    }
                    return result;
                }

                /*加*/
                function add(a, b) {
                    return operation(a, b, 'add');
                }

                /*减*/
                function subtract(a, b) {
                    return operation(a, b, 'subtract');
                }

                /*乘*/
                function multiply(a, b) {
                    return operation(a, b, 'multiply');
                }

                /*除*/
                function divide(a, b) {
                    return operation(a, b, 'divide');
                }

                //exports
                return {
                    add: add,
                    subtract: subtract,
                    multiply: multiply,
                    divide: divide
                }
            }(),
            /*一些页面组件*/
            toTop: function () {
                /*这种回到顶部按钮组件*/
                var fun = {
                    tools: {
                        isWebkit: /webkit/gi.test(navigator.userAgent)
                    },
                    init: function () {
                        /*回到顶部按钮*/
                        var $meta = $("meta[name=toTop]");
                        if ($meta[0]) {
                            var $area = $($meta.attr('content') || window), _flex = 60;
                            var $toTop = $("<div class='btn-to-top'></div>").appendTo(document.body);
                            $area.scrollTop() <= _flex && $toTop.fadeOut();
                            $(window).on("resize", $.throttle(function () {
                                if ($area.scrollTop() > _flex) $toTop.fadeIn();
                                else $toTop.fadeOut();
                            }));
                            $area.on("scroll touchmove", $.throttle(function () {
                                if ($area.scrollTop() > _flex) $toTop.fadeIn();
                                else $toTop.fadeOut();
                            }));

                            $toTop.on("click.top", function (e) {
                                e.stopPropagation();
                                var $target = $area || (fun.tools.isWebkit ? $('body') : $('html'));
                                $target.animate({scrollTop: 0}, 400);
                            });
                        }
                    }
                };
                return {
                    init: fun.init
                }
            }(),
            /*nav*/
            nav: function () {
                /*设置可滑动导航条组件
                 * 1.HTML 需要遵循以下结构
                 *  nav.nav.auto-scroll
                 *   ul.smooth
                 *    li.active
                 *     a(href='javascript:;') 首页
                 * 2.nav.nav.auto-scroll： 外容器添加class标识，不需要自动滚动时去掉auto-scroll
                 * 3.ul.smooth: 移动端平滑滚动
                 * */
                var util = {
                    elements: {},
                    config: {
                        placeholderHeader: '.placeholder-hd', //顶部固定使用的占位div
                        autoScroll: '.auto-scroll',  //点击可自动滑动居中nav对象
                        autoFix: '.auto-fix', //页面滚动可固定在顶部nav对象
                        fixTopClass: 'affix affix-top' //添加固定class
                    },
                    init: function (options) {
                        /*点击分类导航*/
                        var c = util.config, o = util.elements;
                        c.options = options || {};

                        o.body = $('body');
                        o.nav = $(c.autoScroll);
                        o.autoFixNav = $(c.autoFix);
                        o.placeholder_hd = $(c.placeholderHeader);

                        if (o.nav[0]) {
                            c.navTop = o.nav.offset().top; //nav距离顶部的距离
                            c.navHeight = o.nav.outerHeight(true); //nav的高度
                            o.nav.on('click', 'ul li', function () {
                                var _this = $(this), _index = o.nav.find('ul li').index(this);
                                _this.addClass('active').siblings('li').removeClass('active');
                                util.setNavCenter(_index); //设置该item居中显示
                            });
                        }

                        if (o.autoFixNav[0]) {
                            var $scrollArea = $(c.options.scrollArea) || o.body;
                            if (!o.placeholder_hd[0]) {
                                o.placeholder_hd = $('<div class="placeholder-hd"></div>').prependTo($scrollArea);
                            }
                            o.placeholder_hd.css({"height": c.navHeight, "display": "none"});

                            /*绑定touchmove和scroll事件*/
                            $scrollArea.on('scroll touchmove', function () {
                                util.fixNav();//固定导航
                            });
                        }
                    },
                    /*固定tab*/
                    fixNav: function () {
                        var c = util.config, o = util.elements;
                        var $scrollArea = $(c.options.scrollArea) || $("body");

                        if (o.nav[0]) {
                            var nav = o.nav,
                                holder = o.placeholder_hd,
                                scrollTop = $scrollArea.scrollTop();
                            if (scrollTop > c.navTop) {
                                holder.show();
                                nav.addClass(c.fixTopClass);
                            } else {
                                holder.hide();
                                nav.removeClass(c.fixTopClass);
                                //c.navTop = o.nav.offset().top; //nav距离顶部的距离
                            }
                        }
                    },
                    /*设置当前导航类目居中显示*/
                    setNavCenter: function (index) {
                        var c = util.config, o = util.elements;
                        var _this = o.nav.find('ul li').eq(index);
                        var minScrollLeft = 0, maxScrollLeft = getWidth(o.nav.find('ul li')) - getWidth(o.nav);
                        var scrollLeft = getWidth(_this.prevAll()) + getWidth(_this) / 2 - getWidth(o.nav) / 2;
                        scrollLeft < minScrollLeft && scrollLeft == minScrollLeft;
                        scrollLeft > maxScrollLeft && scrollLeft == maxScrollLeft;
                        o.nav.find('ul').stop().animate({scrollLeft: scrollLeft}, 200, function () {
                            _this.addClass('active').siblings().removeClass('active');
                        });

                        /*计算所有元素总宽*/
                        function getWidth(eles) {
                            var result = 0;
                            $.each(eles, function () {
                                result += $(this).outerWidth(true);
                            });
                            return result;
                        }
                    }
                };
                return {
                    init: util.init
                }
            }(),
            /*Swiper*/
            swipe: function () {
                var util = {
                    elements: {},
                    config: {
                        tab: '.ui-swipe-tab',  //tab
                        swipe: '.ui-swipe',  //swipe外容器
                        currClass: 'current'  //当前容器标识
                    },
                    init: function (opts) {
                        var c = util.config, o = util.elements;
                        o.swipe = $(c.swipe);
                        o.tab = $(c.tab);

                        var defaults = {
                            continuous: false,
                            callback: function (index, elem) {
                                var tab = $(elem).closest(c.swipe).data('tab') || c.tab;
                                $(tab).find('ul li').eq(index).addClass('active').siblings().removeClass('active');
                                $(elem).addClass(c.currClass).siblings().removeClass(c.currClass);   //添加当前表示
                            }
                        };

                        var options = $.extend({}, defaults, opts || {});
                        o.swipe.Swipe(options).data('Swipe');

                        /*绑定点击事件*/
                        o.tab.on('click', 'ul li', function () {
                            var _this = $(this), _index = _this.index();
                            var target = _this.closest(c.tab).data('target') || c.swipe;
                            var Swipe = $(target).data('Swipe');
                            Swipe.slide(_index);
                        });
                    }
                };
                return {
                    init: util.init
                }
            }(),
            /*懒加载插件*/
            lazyLoad: function () {
                var util = {
                    init: function (options) {
                        //懒加载
                        var defaults = {
                            container: $('.spa'),
                            threshold: 200,
                            effect: "fadeIn",
                            load: function (elements_left, settings) {
                                //移出节点上的图片源地址
                                $(this).removeAttr('data-' + settings.data_attribute);
                            }
                        };
                        var params = $.extend({}, defaults, options || {});
                        require.async('lazyload', function () {
                            $('[data-original]').lazyload(params);
                        });
                    }
                };
                return {
                    init: util.init
                };
            }(),
            /*处理url*/
            url: function () {

                //Parse url params to JSON
                function getParams(search) {
                    var obj = {};
                    if (search) {
                        var arr = search.split("&"), i = 0, l = arr.length;
                        for (; i < l; i++) {
                            var k = arr[i].split("=");
                            var a = arr[i].match(new RegExp(k[0] + "=([^\&]*)(\&?)", "i"))
                            obj[k[0]] = decodeURIComponent(a[1]);
                        }
                    }
                    return obj;
                    /*var result = search ? JSON.parse('{"' + search.replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g, '":"') + '"}') : {};
                     for(var i in result){
                     result[i] = decodeURIComponent(result[i]);
                     }
                     return result;*/
                }

                var util = {
                    /*
                     * Parse url params to JSON
                     * */
                    params: (function () {
                        var search = location.search.substring(1);
                        return getParams(search);
                    })(),
                    /*
                     * Query url params
                     * */
                    query: function (key) {
                        var value = location.search.match(new RegExp("[\?\&]" + key + "=([^\&]*)(\&?)", "i"));
                        return value ? decodeURIComponent(value[1]) : "";
                    }
                };
                return {
                    getParams: getParams,
                    params: util.params,
                    query: util.query
                };
            }(),
            /* 支付 */
            pay: function () {
                var util = {
                    config: {},
                    // 微信受权支付链接跳转;
                    order: function (orderNo) {
                        location.href = "/pay/?orderNo=" + orderNo;
                        /*if(M.config.isWeixin){
                         // 微信appi，区分正式环境及测试环境;
                         var appid = /mamahao.com/gi.test(location.host) ? "wxd62811cd601f0061" : "wx230909e739bb72fd";
                         location.href = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid='+ appid +'&redirect_uri='+ M.config.api +'pay/weixin/getOpenId.htm?orderNo=' + orderNo + '&response_type=code&scope=snsapi_base&state=123456#wechat_redirect';
                         }else{
                         location.href = "/pay/?orderNo=" + orderNo;
                         }*/
                    },
                    // 微信支付;
                    weixin: function (options) {
                        options.config && $.extend(options.config, this.config)
                        var params = options, self = this;
                        console.log("M-pay-weixin----->", JSON.stringify(params.data));
                        M.ajax({
                            url: '/api/wxPay',
                            data: params.data,
                            success: function (res) {
                                //console.log(WeixinJSBridge);
                                //调起微信支付控件
                                if (typeof(WeixinJSBridge) == "undefined") {
                                    if (document.addEventListener) {
                                        document.addEventListener('WeixinJSBridgeReady', function () {
                                            WeixinJSBridge.invoke(
                                                'getBrandWCPayRequest', {
                                                    "appId": res.appId,     //公众号名称，由商户传入
                                                    "timeStamp": res.timeStamp,         //时间戳，自1970年以来的秒数
                                                    "nonceStr": res.nonceStr, //随机串
                                                    "package": res.package,
                                                    "signType": "MD5",         //微信签名方式：
                                                    "paySign": res.paySign //微信签名
                                                },
                                                function (res) {
                                                    //alert("1"+res.err_msg);
                                                    if (res.err_msg == "get_brand_wcpay_request:ok") {
                                                        //alert('支付成功');
                                                        if (typeof params.callback == "string") {
                                                            location.href = params.callback;
                                                        } else {
                                                            params.callback && params.callback.call(this);
                                                        }
                                                    }     // 使用以上方式判断前端返回,微信团队郑重提示：res.err_msg将在用户支付成功后返回    ok，但并不保证它绝对可靠。

                                                }
                                            );
                                        }, false);
                                    } else if (document.attachEvent) {
                                        document.attachEvent('WeixinJSBridgeReady', function () {
                                            WeixinJSBridge.invoke(
                                                'getBrandWCPayRequest', {
                                                    "appId": res.appId,     //公众号名称，由商户传入
                                                    "timeStamp": res.timeStamp,         //时间戳，自1970年以来的秒数
                                                    "nonceStr": res.nonceStr, //随机串
                                                    "package": res.package,
                                                    "signType": "MD5",         //微信签名方式：
                                                    "paySign": res.paySign //微信签名
                                                },
                                                function (res) {
                                                    //alert("2"+res.err_msg);
                                                    if (res.err_msg == "get_brand_wcpay_request:ok") {
                                                        //alert('支付成功');
                                                        if (typeof params.callback == "string") {
                                                            location.href = params.callback;
                                                        } else {
                                                            params.callback && params.callback.call(this);
                                                        }
                                                    }     // 使用以上方式判断前端返回,微信团队郑重提示：res.err_msg将在用户支付成功后返回    ok，但并不保证它绝对可靠。

                                                }
                                            );
                                        });
                                        document.attachEvent('onWeixinJSBridgeReady', function () {
                                            WeixinJSBridge.invoke(
                                                'getBrandWCPayRequest', {
                                                    "appId": res.appId,     //公众号名称，由商户传入
                                                    "timeStamp": res.timeStamp,         //时间戳，自1970年以来的秒数
                                                    "nonceStr": res.nonceStr, //随机串
                                                    "package": res.package,
                                                    "signType": "MD5",         //微信签名方式：
                                                    "paySign": res.paySign //微信签名
                                                },
                                                function (res) {
                                                    //alert("3"+res.err_msg);
                                                    if (res.err_msg == "get_brand_wcpay_request:ok") {
                                                        //alert('支付成功');
                                                        if (typeof params.callback == "string") {
                                                            location.href = params.callback;
                                                        } else {
                                                            params.callback && params.callback.call(this);
                                                        }
                                                    }     // 使用以上方式判断前端返回,微信团队郑重提示：res.err_msg将在用户支付成功后返回    ok，但并不保证它绝对可靠。

                                                }
                                            );
                                        });
                                    }
                                } else {
                                    WeixinJSBridge.invoke(
                                        'getBrandWCPayRequest', {
                                            "appId": res.appId,     //公众号名称，由商户传入
                                            "timeStamp": res.timeStamp,         //时间戳，自1970年以来的秒数
                                            "nonceStr": res.nonceStr, //随机串
                                            "package": res.package,
                                            "signType": "MD5",         //微信签名方式：
                                            "paySign": res.paySign //微信签名
                                        },
                                        function (res) {
                                            if (res.err_msg == "get_brand_wcpay_request:ok") {
                                                //alert('支付成功');
                                                if (typeof params.callback == "string") {
                                                    location.href = params.callback;
                                                } else {
                                                    params.callback && params.callback.call(this);
                                                }
                                            }     // 使用以上方式判断前端返回,微信团队郑重提示：res.err_msg将在用户支付成功后返回    ok，但并不保证它绝对可靠。

                                        }
                                    );
                                }

                            }
                        });
                    },
                    // 支付宝支付;
                    alipay: function (options) {
                        options.config && $.extend(options.config, this.config)
                        var params = options, self = this;
                        console.log("M-pay-alipay----->", JSON.stringify(params.data));
                        M.ajax({
                            url: '/api/aliPay',
                            data: params.data,
                            success: function (res) {
                                var $form = $(res.data);
                                if (params.data.resource == 2) {
                                    var queryParam = '';
                                    $form.find("input").each(function () {
                                        var name = $(this).attr("name");
                                        var value = $(this).attr("value");
                                        //console.log(name+"  "+ value);
                                        queryParam += name + '=' + encodeURIComponent(value) + '&';
                                    });
                                    var gotoUrl = $form.attr('action') + queryParam;
                                    require.async('3rd/ap.js', function () {
                                        _AP.pay(gotoUrl);
                                    });
                                } else {
                                    // 支付宝支付成功后的跳转是由服务端api控制;
                                    $form.submit();
                                }
                            }
                        });
                    }
                };
                return {
                    order: util.order,
                    weixin: util.weixin,
                    alipay: util.alipay
                };
            }(),
            /* 微信 */
            wx: function () {
                var util = {
                    data: {
                        title: "妈妈好商城",
                        url: window.location.origin,
                        image: "http://s.mamhao.cn/common/images/icon-114.png",
                        desc: "好孩子集团旗下母婴电商平台，让每一件商品都是安全的！"
                    },
                    /*授权，初始化*/
                    init: function (wx, args) {
                        if (!args) args = {};
                        MMH.ajax({
                            data: {url: window.location.href, r: Math.random()},
                            dataType: "jsonp",
                            //url: M.config.api + "V1/basic/weixin/secret.htm",
                            url: M.config.api + "pay/weixin/config.htm",  //区分是否为测试环境
                            success: function (data) {
                                console.log(data);
                                wx.config({
                                    debug: false,
                                    appId: data.appId,
                                    timestamp: data.time,
                                    nonceStr: data.none,
                                    signature: data.sign,
                                    jsApiList: [
                                        'checkJsApi',
                                        'onMenuShareTimeline',
                                        'onMenuShareAppMessage',
                                        'onMenuShareQQ',
                                        'onMenuShareWeibo',
                                        'onMenuShareQZone',
                                        'hideMenuItems',
                                        'showMenuItems',
                                        'hideAllNonBaseMenuItem',
                                        'showAllNonBaseMenuItem',
                                        'translateVoice',
                                        'startRecord',
                                        'stopRecord',
                                        'onVoiceRecordEnd',
                                        'playVoice',
                                        'onVoicePlayEnd',
                                        'pauseVoice',
                                        'stopVoice',
                                        'uploadVoice',
                                        'downloadVoice',
                                        'chooseImage',
                                        'previewImage',
                                        'uploadImage',
                                        'downloadImage',
                                        'getNetworkType',
                                        'openLocation',
                                        'getLocation',
                                        'hideOptionMenu',
                                        'showOptionMenu',
                                        'closeWindow',
                                        'scanQRCode',
                                        'chooseWXPay',
                                        'openProductSpecificView',
                                        'addCard',
                                        'chooseCard',
                                        'openCard'
                                    ]
                                });

                                wx.ready(function () {
                                    console.info('[wechat config is ready]');
                                    args.ready && args.ready.call(this);
                                });

                                wx.error(function (res) {
                                    console.error('[wechat config error]', res.errMsg);
                                    args.error && args.error.call(this, res);
                                });

                            }
                        });
                    },
                    /*分享*/
                    share: function (wx, opts) {
                        var me = util, params = $.extend({}, me.data, opts || {});
                        console.log("share----------->", params);
                        //先初始化
                        util.init(wx, {
                            ready: function () {
                                var wxData = {
                                    title: params.title,
                                    link: encodeURI(params.url),
                                    imgUrl: encodeURI(params.image),
                                    desc: params.desc,
                                    success: function (e) {
                                        // 接口调用成功时执行的回调函数;
                                        params.success && params.success(e);
                                    },
                                    cancel: function () {
                                        // 用户点击取消时的回调函数，仅部分有用户取消操作的api才会用到
                                        params.cancel && params.cancel();
                                    }
                                };
                                var wxDataTimeline = {
                                    title: params.title,
                                    link: encodeURI(params.url),
                                    imgUrl: encodeURI(params.image),
                                    success: function (e) {
                                        // 接口调用成功时执行的回调函数;
                                        params.success && params.success(e);
                                    },
                                    cancel: function () {
                                        // 用户点击取消时的回调函数，仅部分有用户取消操作的api才会用到
                                        params.cancel && params.cancel();
                                    }
                                };
                                wx.onMenuShareTimeline(wxDataTimeline);
                                wx.onMenuShareAppMessage(wxData);
                                wx.onMenuShareQQ(wxData);
                                wx.onMenuShareWeibo(wxData);
                            }
                        });
                    }
                };

                return {
                    init: util.init,
                    share: util.share
                }
            }()
        };

        MMH.init(); //初始化

        /*重新alert和confirm方法*/
        window.alert = function (args) {
            MMH.tips(args);
        };
        window.confirm = function (text, callback) {
            var params = {
                body: '' + text,
                buttons: [
                    {"text": "取消", "class": "", "onClick": null},
                    {"text": "确定", "class": "success", "onClick": callback}
                ]
            };
            MMH.dialog(params)
        };


        window.M = MMH;
    })();


    /* ==============================================================================
     * mobile pagination.js v1.0
     * Description: 上拉到底部ajax请求分页数据
     * Params: @container 请求完数据后，列表容器  @api api接口，分页数据请求地址
     * Ps: 依赖common.js中的ajax方法,请求完成判断为无数据或最后一页，可在ele上data-locked:true,减少ajax请求
     * Author: xqs 2016/06/24
     *
     * * 使用示例
     * $.pagination({
     *  scrollBox: '.container',
     *  api: '/beans',
     *  container: '.container .floor-list',
     *  fnLoaded: function (res, ele) {
     *      console.log(JSON.stringify(res))
     *      ele.data('locked', true);
     *  }
     * });
     * ==============================================================================
     * */

    ;
    (function ($) {

        'use strict';

        $.page = {
            defaults: {
                "keys": {"page": "page", "count": "pageSize", "index": "index"}, //分页参数关键字
                "scrollBox": null,    //触发分页的滚动容器
                "flex": 40,     // 距离底部距离，加载分页数据
                "api": null,    //api接口，分页数据请求地址
                "container": ".pagination",    //分页列表填充容器
                "current": ".current",    //分页列表填充容器
                "fnLoading": null,   //加载中
                "fnSuccess": null,   //加载成功
                "fnFailed": null    //ajax请求后，回调函数res[请求参数和返回的data]、ele[当前容器]
            },
            init: function (options) {
                var me = this,
                    o = me.opts = $.extend(true, {}, me.defaults, options || {});    //参数

                /*初始化*/
                $(o.container).addClass('pagination');  //添加分页容器标识

                /*触发分页的滚动容器,如果是window，需要主动指定"scrollBox": window*/
                var scrollBox = o.scrollBox ? $(o.scrollBox) : $(o.container);
                scrollBox.on("scroll touchmove", function () {
                    me.scroll();
                });

                me.run(); //运行

            },
            run: function () {
                var me = this, o = me.opts;
                var $this = me.$ele = me.currContainer();

                //容器不存在或已被锁定
                if (!$this[0] || $this.data('locked')) return false;

                //容器内没有列表或不满一屏，初始化一次
                if (!$this.children()[0]) {
                    //主动发起请求
                    var ajax_info = $this.data('params');
                    me.ajax(ajax_info);
                    return false;
                }

            },
            /*滚动触发事件*/
            scroll: function () {
                var me = this, o = me.opts;
                var $this = me.$ele = me.currContainer();

                //容器不存在或已被锁定
                if (!$this[0] || $this.data('locked')) return false;

                /*滚动到底部*/
                var currScrollBox = o.scrollBox ? $(o.scrollBox) : me.currContainer();
                var scrollTop = currScrollBox.scrollTop(),
                    diff = currScrollBox[0].scrollHeight - (currScrollBox.height() + scrollTop);

                if (diff < o.flex) {
                    var ajax_info = $this.data('params') || {};
                    ajax_info[o.keys.page] = ($this.data('page') || 1) + 1;

                    me.ajax(ajax_info);
                }

            },
            /*获取当前分页容器*/
            currContainer: function () {
                var me = this, o = me.opts;
                return $(o.current).find('.pagination')[0] ? $(o.current).find('.pagination') : $(o.container + ':visible:eq(0)');
            },
            /*do ajax*/
            ajax: function (params) {
                var me = this, o = me.opts;
                //console.log(JSON.stringify(o))

                me.$ele.data('locked', true);   //锁定当前请求


                //默认参数
                var defaults = {
                    "ajax": true    //表明是分页ajax请求过来的
                };

                defaults[o.keys.page] = 1;
                defaults[o.keys.count] = params.count || 20;   //默认页数和条数
                defaults[o.keys.index] = me.$ele.children().length;   //索引值

                var ajax_info = $.extend(true, defaults, params || {}, me.opts.params || {});

                console.log('ajax_info--->', ajax_info);

                /*加载中*/
                if (!o.fnLoading) {
                    me.$ele.append('<div class="tc pagination-loading">正在加载中...</div>');
                } else {
                    o.fnLoading.call(this, me.$ele);
                }

                //do ajax
                M.ajax({
                    showLoading: false,
                    location: true,
                    url: ajax_info.url || o.api,
                    data: {data: JSON.stringify(ajax_info)},
                    success: function (res) {
                        var info = {
                            params: ajax_info,
                            data: res
                        };
                        me.$ele.data('page', ajax_info[o.keys.page]); //设置页数
                        me.$ele.data('locked', false);    //解除锁定

                        o.fnSuccess && o.fnSuccess.call(this, info, me.$ele);  //将结果返回
                    },
                    error: function (res) {
                        var info = {
                            params: ajax_info,
                            data: res
                        };
                        me.$ele.data('locked', true);    //锁定

                        if (o.fnFailed) {
                            o.fnFailed.call(this, info, me.$ele);  //将结果返回
                        } else {
                            var errorMsg = res.msg || res.statusText;
                            M.tips(errorMsg);
                        }
                    },
                    complete: function () {
                        $('.pagination-loading').remove(); //移除loading
                    }
                });


            }

        };

        /*
         * === 分页ajax加载插件 ===
         * */
        $.pagination = function (options) {
            $.page.init(options);  //初始化
        }

    })(window.jQuery);


    /*=================================
     * 数据加减控件
     * 使用方式： $('.u-quantity .number').spinner();
     * by xqs 160817
     *==================================
     * */
    ;
    (function ($) {
        $.fn.spinner = function (opts) {
            return this.each(function () {
                var defaults = {
                    value: 1,                       //默认值
                    min: 1,                         //最小值
                    num: '.number',                //数字对象
                    decrement: '.decrement',     //减按钮对象
                    increment: '.increment',     //加按钮对象
                    disabled: 'disabled',       //禁用按钮class
                };
                var options = $.extend({}, defaults, opts || {});

                var $this = $(this),
                    $decrement = $(this).siblings(options.decrement),
                    $increment = $(this).siblings(options.increment);

                //初始化
                calcInit();

                //初始化计数器
                function calcInit() {
                    //赋值
                    !$this.text() && $this.text(options.value);
                    var count = +$this.text(),
                        maxCount = $this.data('max'),
                        minCount = $this.data('min') || options.min;
                    if (minCount && count <= minCount) {
                        $decrement.addClass(options.disabled);
                        count = minCount;
                    } else {
                        $decrement.removeClass(options.disabled);
                    }

                    if (maxCount && count >= maxCount) {
                        count = maxCount;
                        $increment.addClass(options.disabled);
                    } else {
                        $increment.removeClass(options.disabled);
                    }
                    $this.text(count);

                    //绑定事件
                    $this.siblings(options.decrement + ',' + options.increment).off().on('click', calc);
                }

                //计算逻辑
                function calc() {
                    var $that = $(this), $num = $that.siblings(options.num);

                    if ($that.hasClass(options.disabled)) return false;

                    var count = +$num.text(),
                        maxCount = $num.data('max'),
                        minCount = $num.data('min') || options.min;

                    if ($that.is(options.decrement)) --count;
                    else  ++count;

                    if (minCount && count <= minCount) {
                        $decrement.addClass(options.disabled);
                        count = minCount;
                    } else {
                        $decrement.removeClass(options.disabled);
                    }

                    if (maxCount && count >= maxCount) {
                        count = maxCount;
                        $increment.addClass(options.disabled);
                    } else {
                        $increment.removeClass(options.disabled);
                    }

                    $num.text(count);

                }
            })
        };

    })(window.jQuery);

    /* ===========================================
     * 倒计时插件 - 设置时间与本机时间进行倒计时;
     * 示例：$(element).timeCountDown({second: 60, endDate:'', startDate: "", elements:{}, callback: function(){}});
     * ===========================================*/
    (function ($) {
        $.fn.timeCountDown = function (params) {
            var me = $(this);
            // console.log(me);
            var defaults = {
                endDate: '2088/08/08 08:08:08', //默认倒计时日期
                startDate: false,           // 结束时间;
                callback: false,			// 结束回调;
                callstart: false,			// 开始回调;
                callproces: false,			// 进行中回调;
                second: 0,                  // 时间差秒数;
                elements: {
                    second: me.find(".second"),
                    minute: me.find(".minute"),
                    hour: me.find(".hour"),
                    day: me.find(".day")
                },
                pms: {
                    second: "00",
                    minute: "00",
                    hour: "00",
                    day: "00"
                }
            };
            var options = $.extend({}, defaults, params || {}), s;
            return this.each(function () {
                var fun = {
                    zero: function (n) {
                        return n < 10 ? '0' + n : '' + n;
                    },
                    dv: function () {
                        //ar future = new Date(options.date), now = new Date();
                        //现在将来秒差值
                        //ar dur = Math.round((future.getTime() - now.getTime()) / 1000),
                        var dur = options.second, pms = options.pms;
                        if (dur > 0) {
                            pms.day = fun.zero(Math.floor(dur / (60 * 60 * 24))); //天
                            pms.hour = fun.zero(Math.floor(dur / (60 * 60)) - (pms.day * 24)); //小时
                            pms.minute = fun.zero(Math.floor(dur / 60) - (pms.day * 24 * 60) - (pms.hour * 60)); //分钟
                            pms.second = fun.zero(Math.floor(dur) - (pms.day * 24 * 60 * 60) - (pms.hour * 60 * 60) - (pms.minute * 60)); //秒
                        }
                        return pms;
                    },
                    ui: function () {
                        $.each(options.elements, function (o, v) {
                            v[0] && v.html(fun.dv()[o] || "00");
                        });
                        clearInterval(s);
                        // 进行中的回调;
                        $.isFunction(options.callproces) && options.callproces.call(options.callproces, options.second);
                        // 倒计时完回调;
                        if (options.second <= 0) {
                            $.isFunction(options.callback) && options.callback.call(options.callback);
                            return;
                        }
                        options.second--;
                        s = setTimeout(fun.ui, 1000);
                    }
                };
                if (options.second) {
                    // 如果已经传了时间差，那么直接进行倒计时;
                    fun.ui();
                } else {
                    // 为传时间差，计算传的时间与当前时间的时间差进行倒计时;
                    var future = new Date(options.endDate), now = options.startDate ? new Date(options.startDate) : new Date();
                    options.second = Math.round((future.getTime() - now.getTime()) / 1000);
                    fun.ui();
                }
            });
        };
    })(window.jQuery);
    /* ===========================================
     * 倒计时插件 - 秒数倒计时;
     * 示例：$(element).timing({second: 90, endcall :function(){}, startcall: function(){}, startcall: procescall(){}});
     * ===========================================*/
    (function ($) {
        var Timing = function (element, options) {
            this.config = {
                second: 89,
                endcall: false,				// 结束回调;
                startcall: false,			// 开始回调;
                procescall: false			// 进行中回调;
            };
            if (typeof options == "object") {
                $.extend(this.config, options);
            } else if (typeof options == "number") {
                this.config.second = options
            }
            this.elems = element;
        };
        Timing.prototype = {
            start: function () {
                var self = this, c = self.config;
                $.isFunction(c.startcall) && c.startcall.call(c.startcall, self);
                self.process();
                c.obj = setInterval(function () {
                    c.second--;
                    if (c.second < 0) return self.end();
                    self.process();
                }, 1000);
            },
            process: function () {
                var self = this, c = self.config;
                self.elems.html(c.second);
                $.isFunction(c.procescall) && c.procescall.call(c.procescall, self);
            },
            end: function () {
                var self = this, c = self.config;
                clearInterval(c.obj);
                $.isFunction(c.endcall) && c.endcall.call(c.endcall, self);
            }
        };
        $.fn.secondCountDown = function (op) {
            return this.each(function () {
                var data = new Timing($(this), op);
                data.start();
            });
        };
    })(window.jQuery);

});


