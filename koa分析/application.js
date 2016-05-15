
'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('koa:application');
var Emitter = require('events').EventEmitter;
var compose_es7 = require('composition');
var onFinished = require('on-finished');
var response = require('./response');
var compose = require('koa-compose');
var isJSON = require('koa-is-json');
var context = require('./context');
var request = require('./request');
var statuses = require('statuses');
var Cookies = require('cookies');
var accepts = require('accepts');
var assert = require('assert');
var Stream = require('stream');
var http = require('http');
var only = require('only');
var co = require('co');

/**
 * Application prototype.
 */

var app = Application.prototype;

/**
 * Expose `Application`.
 */

module.exports = Application;

/**
 * Initialize a new `Application`.
 *
 * @api public
 */

function Application() {
  if (!(this instanceof Application)) return new Application;      //如果this不是Application对象,也就是直接调用,那么重新实例化一份koa对象
  this.env = process.env.NODE_ENV || 'development';                //设置环境变量
  this.subdomainOffset = 2;                                        //默认为2，表示 .subdomains 所忽略的字符偏移量。
  this.middleware = [];                                            //中间件列表
  this.proxy = false;                                              //代理
  this.context = Object.create(context);                           //上下文对象
  this.request = Object.create(request);                           //请求对象
  this.response = Object.create(response);                         //响应对象
}

/**
 * Inherit from `Emitter.prototype`.
 */

Object.setPrototypeOf(Application.prototype, Emitter.prototype);

/**
 * Shorthand for:                                          //简写为
 *
 *    http.createServer(app.callback()).listen(...)
 *
 * @param {Mixed} ...
 * @return {Server}
 * @api public
 */

app.listen = function(){                                          //监听函数
  debug('listen');
  var server = http.createServer(this.callback());                //把当前回调当做requestListeners传入createServer
  return server.listen.apply(server, arguments);                  //调用server监听函数
};

/**
 * Return JSON representation.
 * We only bother showing settings.
 *
 * @return {Object}
 * @api public
 */

app.inspect =
app.toJSON = function(){                                           //toJSON后,只需要这些属性
  return only(this, [
    'subdomainOffset',
    'proxy',
    'env'
  ]);
};

/**
 * Use the given middleware `fn`.
 *
 * @param {GeneratorFunction} fn
 * @return {Application} self
 * @api public
 */

app.use = function(fn){
  if (!this.experimental) {                             //如果不是es7 async写法
    // es7 async functions are not allowed,
    // so we have to make sure that `fn` is a generator function
    //判断是否是GeneratorFunction
    assert(fn && 'GeneratorFunction' == fn.constructor.name, 'app.use() requires a generator function');
  }
  debug('use %s', fn._name || fn.name || '-');
  this.middleware.push(fn);                             //添加中间件
  return this;
};

/**
 * Return a request handler callback
 * for node's native http server.
 *
 * @return {Function}
 * @api public
 */

app.callback = function(){
  if (this.experimental) {                      //没有实现特性,没有es7函数特征
    console.error('Experimental ES7 Async Function support is deprecated. Please look into ' +
        'Koa v2 as the middleware signature has changed.')
  }
  var fn = this.experimental                    //返回中间件包装promise,具体见ecmascript/es7/co
    ? compose_es7(this.middleware)
    : co.wrap(compose(this.middleware));
  var self = this;

  if (!this.listeners('error').length) this.on('error', this.onerror);

  return function(req, res){                    //如果没有绑定事件
    res.statusCode = 404;                       //返回404
    var ctx = self.createContext(req, res);     //创建上下文对象
    onFinished(res, ctx.onerror);               //执行finished,关闭socket
    fn.call(ctx).then(function () {             //把当前作用域上下文传递给中间件,执行中间件
      respond.call(ctx);                        //执行respond回调
    }).catch(ctx.onerror);
  }
};

/**
 * Initialize a new context.
 *
 * @api private
 */

app.createContext = function(req, res){
  var context = Object.create(this.context);             //获得当前上下文对象
  var request = context.request = Object.create(this.request);
  var response = context.response = Object.create(this.response);
  //context={
  //  context.app = request.app = response.app = this;
  //  context.req = request.req = response.req = req;
  //  context.res = request.res = response.res = res;
  //  request.ctx = response.ctx = context;
  //  request.response = response;
  //  response.request = request;
  //}

  //this.app=request.app,this.request=request
  context.app = request.app = response.app = this;
  context.req = request.req = response.req = req;
  context.res = request.res = response.res = res;
  request.ctx = response.ctx = context;
  request.response = response;
  response.request = request;

  context.onerror = context.onerror.bind(context);        //执行错误回调
  context.originalUrl = request.originalUrl = req.url;    //原始url
  context.cookies = new Cookies(req, res, {               //获得cookies,赋值给context.cookies与res
    keys: this.keys,
    secure: request.secure
  });
  context.accept = request.accept = accepts(req);         //赋值请求允许mine类型,赋给context
  context.state = {};
  return context;
};

/**
 * Default error handler.
 *
 * @param {Error} err
 * @api private
 */

app.onerror = function(err){
  assert(err instanceof Error, 'non-error thrown: ' + err);  //如果有异常,必须是error实例

  if (404 == err.status || err.expose) return;               //如果404,直接return
  if (this.silent) return;
  // DEPRECATE env-specific logging in v2
  if ('test' == this.env) return;                            //如果是test环境,退出

  var msg = err.stack || err.toString();
  console.error();
  console.error(msg.replace(/^/gm, '  '));                   //缩进,打印堆栈信息
  console.error();
};

/**
 * Response helper.
 */

function respond() {
  // allow bypassing koa
  if (false === this.respond) return;                 //可以绕过koa执行函数

  var res = this.res;
  if (res.headersSent || !this.writable) return;      //如果只发送头部,或者不可写,退出

  var body = this.body;
  var code = this.status;

  // ignore body
  if (statuses.empty[code]) {                         //如果返回状态吗是204,205,304,退出
    // strip headers
    this.body = null;
    return res.end();
  }

  if ('HEAD' == this.method) {                        //如果类型是Head
    if (isJSON(body)) this.length = Buffer.byteLength(JSON.stringify(body));
    return res.end();
  }

  // status body
  if (null == body) {                                 //如果请求体是null
    this.type = 'text';
    body = this.message || String(code);              //打出状态码和请求体
    this.length = Buffer.byteLength(body);
    return res.end(body);
  }

  // responses
  if (Buffer.isBuffer(body)) return res.end(body);         //如果是二进制
  if ('string' == typeof body) return res.end(body);       //如果是文字
  if (body instanceof Stream) return body.pipe(res);       //如果是流,直接流入response

  // body: json
  body = JSON.stringify(body);                             //如果是json,返回string
  this.length = Buffer.byteLength(body);
  res.end(body);                                           //返回body
}