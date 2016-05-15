var koa = require('koa');
var app = koa();

//context
app.use(function *(next){
    console.log(this.socket)
    this.body='abc';
});


app.listen(3001);