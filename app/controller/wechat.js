//微信相关
var config_wechat = AppConfig.site.wechat;
var domain = config_wechat.domain;
var app_id = config_wechat.app_id;
var app_secret = config_wechat.app_secret;

// 微信授权和回调
var OAuth = require('wechat-oauth');
var client = new OAuth(app_id, app_secret);
var request = require('request');

var weChat = {
    //获取微信code
    toWechat: function (req, res, next) {
        var url = client.getAuthorizeURL('http://' + domain + '/weixin/callback', '', 'snsapi_base');
        console.log("wechat url:" + url);
        res.redirect(url)
    },
    //微信获取openid回调
    wechatCallBack: function (req, res, next) {
        console.log('----weixin callback -----')
        var code = req.query.code;
        client.getAccessToken(code, function (err, result) {
            var accessToken = result.data.access_token;
            var openid = result.data.openid;
            console.log('token=' + accessToken);
            console.log('openid=' + openid);
            //根据openid查找用户是否注册，如果注册就自动登录，如果未注册，就跳转到手机号码绑定页面
            res.redirect("/");
        });
    },
    //微信授权
    auth: function (req, res, next) {
        var isWeChat = /micromessenger/gi.test(req.header("user-agent")),
            openId = req.cookies && req.cookies['openId'],
            token = req.cookies && req.cookies['token'];

        //console.info('[cookies]====', req.cookies)
        log.info('[校验微信授权]：url==', req.originalUrl, '，session_id==', req.cookies['session_id']);
        //if(req.query.debug) return next();

        if (isWeChat) {
            if (token) {
                //已登录
                log.info("[已登录]：有token--->", token);
                log.info("cookie---->", JSON.stringify(req.cookies));
                var crypto = require('../utils/crypto');
                var user_session = {
                    id: crypto.decipher(req.cookies['memberId']),
                    token: crypto.decipher(req.cookies['token']),
                    nickname: crypto.decipher(req.cookies['nick']),
                    avatar: crypto.decipher(req.cookies['head'])
                };
                log.info("user_session--->", JSON.stringify(user_session));
                req.session.user = user_session;//设置当前用户到session
                next();
            } else {
                //微信授权并尝试登录
                if (!openId) {
                    log.info("[未授权，进行授权操作]：无token，无openId");
                    //未授权或者已授权但未绑定，这个地方得保证微信授权后到绑定页面成功在client设置cookie
                    var originalUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
                    var apiURL = AppConfig.site.wechat.apiURL; //apiURL
                    var redirect_uri = encodeURIComponent(apiURL + 'V1/weixin/oauth/callback.htm?resource=1' + '&go=' + originalUrl);
                    var authUrl = 'https://open.weixin.qq.com/connect/oauth2/authorize?appid=' + AppConfig.site.wechat.app_id + '&redirect_uri=' + redirect_uri + '&response_type=code&scope=snsapi_base&state=12345465#wechat_redirect';
                    return res.redirect(authUrl);
                } else {
                    log.info("[已授权但未绑定，到绑定页面]：无token，有openId--->", openId);
                    next();
                }
            }

        } else {
            next();
        }
    }
};

module.exports = weChat;

