"use strict";
let http=require('http');

function  Application(){
    if(!(this instanceof Application)) return new Application();

    this.middleware=[];
}

let app = Application.prototype;

app.listen = function(){
    let server = http.createServer(this.callback());
    return server.listen.apply(server, arguments);
};

app.callback = function(){
    let fns=this.middleware;
    let self=this;
    return function(req,res){
        for(let fn of fns){
           fn.apply(this,arguments)
        }

        res.writeHead(200,{'Content-Type':'text/html;charset=utf8'});

        res.end('返回');
    }
};

app.use=function(callback){
    this.middleware.push(callback);
};

module.exports = Application;