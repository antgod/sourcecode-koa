var koa = require('koa');
var app = koa();

var request1=function(){
    return new Promise(function(resolve,reject){
        setTimeout(function(){
            resolve('第一次请求');
        },500);
    })
};

var request2=function(){
    return new Promise(function(resolve,reject){
         setTimeout(function(){
             resolve('第二次请求');
         },500);
    })
};
var request3=function(){
    return new Promise(function(resolve,reject){
        setTimeout(function(){
            resolve('第三次请求');
        },500);
    })
};

app.use(function *(next){
    console.log('before error:',this.status,this.error);
    yield next;
    console.log('after error:',this.status,this.error);
});


//before
app.use(function *(next){
    var start = new Date;
    var res=yield request1();
    this.body=res;
    yield next;
    var ms = new Date - start;
    console.log('before',ms);
    //console.log(Object.keys(this.res))
});

//context
app.use(function *(next){
    var res=yield request2();
    this.body +=res;
    console.log('context');
    yield next;
});

//after
app.use(function *(next){
    var res=yield request3();
    this.body +=res;
    yield next;
    console.log('after');
});

app.listen(3001);