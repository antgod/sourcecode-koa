
'use strict';

/**
 * Module dependencies.
 */

var contentDisposition = require('content-disposition');
var ensureErrorHandler = require('error-inject');
var getType = require('mime-types').contentType;
var onFinish = require('on-finished');
var isJSON = require('koa-is-json');
var escape = require('escape-html');
var typeis = require('type-is').is;
var statuses = require('statuses');
var destroy = require('destroy');
var assert = require('assert');
var path = require('path');
var vary = require('vary');
var extname = path.extname;

/**
 * Prototype.
 */

module.exports = {

  /**
   * Return the request socket.
   *
   * @return {Connection}
   * @api public
   */

  get socket() {                                       //获得返回套接字
    return this.ctx.req.socket;
  },

  /**
   * Return response header.
   *
   * @return {Object}
   * @api public
   */

  get header() {                                        //获得返回header
    return this.res._headers || {};
  },

  /**
   * Return response header, alias as response.header
   *
   * @return {Object}
   * @api public
   */

  get headers() {                                        //同上
    return this.header;
  },

  /**
   * Get response status code.
   *
   * @return {Number}
   * @api public
   */

  get status() {                                         //获得返回状态码
    return this.res.statusCode;
  },

  /**
   * Set response status code.
   *
   * @param {Number} code
   * @api public
   */

  set status(code) {                                      //设置状态
    assert('number' == typeof code, 'status code must be a number');
    assert(statuses[code], 'invalid status code: ' + code);
    this._explicitStatus = true;                          //设置明确状态码
    this.res.statusCode = code;
    this.res.statusMessage = statuses[code];
    if (this.body && statuses.empty[code]) this.body = null;  //如果没有正确的设置状态码,返回体为null
  },

  /**
   * Get response status message
   *
   * @return {String}
   * @api public
   */

  get message() {                                        //获得异常信息
    return this.res.statusMessage || statuses[this.status];
  },

  /**
   * Set response status message
   *
   * @param {String} msg
   * @api public
   */

  set message(msg) {                                      //设置异常信息
    this.res.statusMessage = msg;
  },

  /**
   * Get response body.
   *
   * @return {Mixed}
   * @api public
   */

  get body() {                                            //获得返回体
    return this._body;
  },

  /**
   * Set response body.
   *
   * @param {String|Buffer|Object|Stream} val
   * @api public
   */

  set body(val) {
    var original = this._body;
    this._body = val;               //设置_body

    // no content
    if (null == val) {              //如果没有内容null,undefined,返回204,移除Content-Type,Content-Length,Transfer-Encoding
      if (!statuses.empty[this.status]) this.status = 204;
      this.remove('Content-Type');
      this.remove('Content-Length');
      this.remove('Transfer-Encoding');
      return;
    }

    // set the status
    if (!this._explicitStatus) this.status = 200;    //如果没有明确返回码,返回200

    // set the content-type only if not yet set
    var setType = !this.header['content-type'];      //如果没有设置content-type

    // string
    if ('string' == typeof val) {                    //如果返回字符串
      if (setType) this.type = /^\s*</.test(val) ? 'html' : 'text';           //如果有</,返回html,所以返回的内容如果没有</,一定要手动设置type为text/html
      this.length = Buffer.byteLength(val);
      return;
    }

    // buffer
    if (Buffer.isBuffer(val)) {                      //如果返回buffer
      if (setType) this.type = 'bin';                //设置type=bin(二进制)
      this.length = val.length;
      return;
    }

    // stream
    if ('function' == typeof val.pipe) {             //如果返回流
      onFinish(this.res, destroy.bind(null, val));
      ensureErrorHandler(val, this.ctx.onerror);

      // overwriting
      if (null != original && original != val) this.remove('Content-Length');   //覆盖原来设置的流信息

      if (setType) this.type = 'bin';                //二进制
      return;
    }

    // json                                          //json
    this.remove('Content-Length');
    this.type = 'json';
  },

  /**
   * Set Content-Length field to `n`.
   *
   * @param {Number} n
   * @api public
   */

  set length(n) {                                        //设置返回长度
    this.set('Content-Length', n);
  },

  /**
   * Return parsed response Content-Length when present.
   *
   * @return {Number}
   * @api public
   */

  get length() {                                        //获得返回长度
    var len = this.header['content-length'];
    var body = this.body;

    if (null == len) {                 //如果返回头没有content-length
      if (!body) return;
      //分别处理几种不同的返回类型的返回长度
      if ('string' == typeof body) return Buffer.byteLength(body);
      if (Buffer.isBuffer(body)) return body.length;
      if (isJSON(body)) return Buffer.byteLength(JSON.stringify(body));
      return;
    }

    return ~~len;
  },

  /**
   * Check if a header has been written to the socket.
   *
   * @return {Boolean}
   * @api public
   */

  get headerSent() {                                 //检查 response header 是否已经发送，用于在发生错误时检查客户端是否被通知。
    return this.res.headersSent;
  },

  /**
   * Vary on `field`.
   *
   * @param {String} field
   * @api public
   */

  vary: function(field){                              //相当于执行res.append('Vary', field)。
    vary(this.res, field);
  },

  /**
   * Perform a 302 redirect to `url`.
   *
   * The string "back" is special-cased
   * to provide Referrer support, when Referrer
   * is not present `alt` or "/" is used.
   *
   * Examples:
   *
   *    this.redirect('back');
   *    this.redirect('back', '/index.html');
   *    this.redirect('/login');
   *    this.redirect('http://google.com');
   *
   * @param {String} url
   * @param {String} [alt]
   * @api public
   */

  redirect: function(url, alt){
    // location
    if ('back' == url) url = this.ctx.get('Referrer') || alt || '/';        //如果url带有back,返回referrer页面
    this.set('Location', url);                                              //设置location=url

    // status
    if (!statuses.redirect[this.status]) this.status = 302;                  //设置重定向状态码302

    // html
    if (this.ctx.accepts('html')) {                                          //如果允许html
      url = escape(url);
      this.type = 'text/html; charset=utf-8';
      this.body = 'Redirecting to <a href="' + url + '">' + url + '</a>.';   //返回重定向html页面
      return;
    }

    // text
    this.type = 'text/plain; charset=utf-8';
    this.body = 'Redirecting to ' + url + '.';
  },

  /**
   * Set Content-Disposition header to "attachment" with optional `filename`.
   *
   * @param {String} filename
   * @api public
   */

  attachment: function(filename){                    //客户端下载
    if (filename) this.type = extname(filename);
    this.set('Content-Disposition', contentDisposition(filename));
  },

  /**
   * Set Content-Type response header with `type` through `mime.lookup()`
   * when it does not contain a charset.
   *
   * Examples:
   *
   *     this.type = '.html';
   *     this.type = 'html';
   *     this.type = 'json';
   *     this.type = 'application/json';
   *     this.type = 'png';
   *
   * @param {String} type
   * @api public
   */

  set type(type) {                        //设置类型,如果有,设置,如果没有对应类型,移除
    type = getType(type) || false;
    if (type) {
      this.set('Content-Type', type);
    } else {
      this.remove('Content-Type');
    }
  },

  /**
   * Set the Last-Modified date using a string or a Date.
   *
   *     this.response.lastModified = new Date();
   *     this.response.lastModified = '2013-09-13';
   *
   * @param {String|Date} type
   * @api public
   */

  set lastModified(val) {                //设置Last-Modifie
    if ('string' == typeof val) val = new Date(val);
    this.set('Last-Modified', val.toUTCString());
  },

  /**
   * Get the Last-Modified date in Date form, if it exists.
   *
   * @return {Date}
   * @api public
   */

  get lastModified() {
    var date = this.get('last-modified');
    if (date) return new Date(date);
  },

  /**
   * Set the ETag of a response.
   * This will normalize the quotes if necessary.
   *
   *     this.response.etag = 'md5hashsum';
   *     this.response.etag = '"md5hashsum"';
   *     this.response.etag = 'W/"123456789"';
   *
   * @param {String} etag
   * @api public
   */

  set etag(val) {                        //设置etag
    if (!/^(W\/)?"/.test(val)) val = '"' + val + '"';
    this.set('ETag', val);
  },

  /**
   * Get the ETag of a response.
   *
   * @return {String}
   * @api public
   */

  get etag() {                            //获取缓存etag
    return this.get('ETag');
  },

  /**
   * Return the response mime type void of
   * parameters such as "charset".
   *
   * @return {String}
   * @api public
   */

  get type() {
    var type = this.get('Content-Type');
    if (!type) return '';
    return type.split(';')[0];
  },

  /**
   * Check whether the response is one of the listed types.
   * Pretty much the same as `this.request.is()`.
   *
   * @param {String|Array} types...
   * @return {String|false}
   * @api public
   */

  is: function(types){                //检查返回类型是否在types中
    var type = this.type;
    if (!types) return type || false;
    if (!Array.isArray(types)) types = [].slice.call(arguments);
    return typeis(type, types);
  },

  /**
   * Return response header.
   *
   * Examples:
   *
   *     this.get('Content-Type');
   *     // => "text/plain"
   *
   *     this.get('content-type');
   *     // => "text/plain"
   *
   * @param {String} field
   * @return {String}
   * @api public
   */

  get: function(field){
    return this.header[field.toLowerCase()] || '';
  },

  /**
   * Set header `field` to `val`, or pass
   * an object of header fields.
   *
   * Examples:
   *
   *    this.set('Foo', ['bar', 'baz']);
   *    this.set('Accept', 'application/json');
   *    this.set({ Accept: 'text/plain', 'X-API-Key': 'tobi' });
   *
   * @param {String|Object|Array} field
   * @param {String} val
   * @api public
   */

  set: function(field, val){            //设置头部信息
    if (2 == arguments.length) {        //
      if (Array.isArray(val)) val = val.map(String);
      else val = String(val);
      this.res.setHeader(field, val);
    } else {                            //如果传入是json
      for (var key in field) {
        this.set(key, field[key]);
      }
    }
  },

  /**
   * Append additional header `field` with value `val`.
   *
   * Examples:
   *
   *    this.append('Link', ['<http://localhost/>', '<http://localhost:3000/>']);
   *    this.append('Set-Cookie', 'foo=bar; Path=/; HttpOnly');
   *    this.append('Warning', '199 Miscellaneous warning');
   *
   * @param {String} field
   * @param {String|Array} val
   * @api public
   */

  append: function(field, val){     //调用设置方法,追加设置头部
    var prev = this.get(field);

    if (prev) {
      val = Array.isArray(prev)
        ? prev.concat(val)
        : [prev].concat(val);
    }

    return this.set(field, val);
  },

  /**
   * Remove header `field`.
   *
   * @param {String} name
   * @api public
   */

  remove: function(field){     //移除头部
    this.res.removeHeader(field);
  },

  /**
   * Checks if the request is writable.
   * Tests for the existence of the socket
   * as node sometimes does not set it.
   *
   * @return {Boolean}
   * @api private
   */

  get writable() {             //如果套接字可写,返回true
    var socket = this.res.socket;
    if (!socket) return false;
    return socket.writable;
  },

  /**
   * Inspect implementation.
   *
   * @return {Object}
   * @api public
   */

  inspect: function(){
    if (!this.res) return;
    var o = this.toJSON();
    o.body = this.body;
    return o;
  },

  /**
   * Return JSON representation.
   *
   * @return {Object}
   * @api public
   */

  toJSON: function(){
    return {
      status: this.status,
      message: this.message,
      header: this.header
    };
  }
};
