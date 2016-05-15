
'use strict';

/**
 * Module dependencies.
 */

var createError = require('http-errors');
var httpAssert = require('http-assert');
var delegate = require('delegates');
var statuses = require('statuses');

/**
 * Context prototype.
 */

var proto = module.exports = {

  /**
   * util.inspect() implementation, which
   * just returns the JSON output.
   *
   * @return {Object}
   * @api public
   */

  inspect: function(){
    return this.toJSON();  //返回request.response.app,req,res,url,socket
  },

  /**
   * Return JSON representation.
   *
   * Here we explicitly invoke .toJSON() on each
   * object, as iteration will otherwise fail due
   * to the getters and cause utilities such as
   * clone() to fail.
   *
   * @return {Object}
   * @api public
   */

  toJSON: function(){
    return {                             //序列化调用时候,返回这些参数
      request: this.request.toJSON(),
      response: this.response.toJSON(),
      app: this.app.toJSON(),
      originalUrl: this.originalUrl,     //url
      req: '<original node req>',        //原生node req
      res: '<original node res>',
      socket: '<original node socket>'
    }
  },

  /**
   * Similar to .throw(), adds assertion.
   *
   *    this.assert(this.user, 401, 'Please login!');
   *
   * See: https://github.com/jshttp/http-assert
   *
   * @param {Mixed} test
   * @param {Number} status
   * @param {String} message
   * @api public
   */

  assert: httpAssert,                   //断言

  /**
   * Throw an error with `msg` and optional `status`
   * defaulting to 500. Note that these are user-level
   * errors, and the message may be exposed to the client.
   *
   *    this.throw(403)
   *    this.throw('name required', 400)
   *    this.throw(400, 'name required')
   *    this.throw('something exploded')
   *    this.throw(new Error('invalid'), 400);
   *    this.throw(400, new Error('invalid'));
   *
   * See: https://github.com/jshttp/http-errors
   *
   * @param {String|Number|Error} err, msg or status
   * @param {String|Number|Error} [err, msg or status]
   * @param {Object} [props]
   * @api public
   */

  throw: function(){                 //抛出异常
    throw createError.apply(null, arguments);
  },

  /**
   * Default error handling.
   *
   * @param {Error} err
   * @api private
   */

  onerror: function(err){            //错误处理
    // don't do anything if there is no error.
    // this allows you to pass `this.onerror`
    // to node-style callbacks.
    if (null == err) return;          //如果没有错误不做任何事

    //如果传入类型不是Error,抛出一个新异常
    if (!(err instanceof Error)) err = new Error('non-error thrown: ' + err);

    // delegate
    this.app.emit('error', err, this);  //调用application的onerror方法发射error事件

    // nothing we can do here other
    // than delegate to the app-level
    // handler and log.
    if (this.headerSent || !this.writable) {     //这里我们可以处理app级别处理和日志
      err.headerSent = true;
      return;
    }

    // unset all headers, and set those specified  //如果没有设置headers,则指定设置
    this.res._headers = {};
    this.set(err.headers);

    // force text/plain
    this.type = 'text';                            //强制设置返回文本

    // ENOENT support
    if ('ENOENT' == err.code) err.status = 404;    //如果错误码是 ENOENT,返回404状态

    // default to 500
    //如果没有异常码,返回500
    if ('number' != typeof err.status || !statuses[err.status]) err.status = 500;

    // respond
    var code = statuses[err.status];              //返回状态码
    var msg = err.expose ? err.message : code;    //设置返回信息
    this.status = err.status;                     //设置异常码
    this.length = Buffer.byteLength(msg);         //设置返回信息长度
    this.res.end(msg);                            //返回异常,打印到页面
  }
};

/**
 * Response delegation.
 */

delegate(proto, 'response')            //response上面的方法赋给context
  .method('attachment')
  .method('redirect')
  .method('remove')
  .method('vary')
  .method('set')
  .method('append')
  .access('status')
  .access('message')
  .access('body')
  .access('length')
  .access('type')
  .access('lastModified')
  .access('etag')
  .getter('headerSent')
  .getter('writable');

/**
 * Request delegation.
 */

delegate(proto, 'request')             //request上面的方法赋给context
  .method('acceptsLanguages')
  .method('acceptsEncodings')
  .method('acceptsCharsets')
  .method('accepts')
  .method('get')
  .method('is')
  .access('querystring')
  .access('idempotent')
  .access('socket')
  .access('search')
  .access('method')
  .access('query')
  .access('path')
  .access('url')
  .getter('origin')
  .getter('href')
  .getter('subdomains')
  .getter('protocol')
  .getter('host')
  .getter('hostname')
  .getter('header')
  .getter('headers')
  .getter('secure')
  .getter('stale')
  .getter('fresh')
  .getter('ips')
  .getter('ip');
