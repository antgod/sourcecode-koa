var koa = require('koa');
var app = koa();



app.use(function *(next){

    this.type='applacation/plain';
    this.body="abc";
    this.response.attachment('abc.txt');
    yield next;
});


app.listen(3001);