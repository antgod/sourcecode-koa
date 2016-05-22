var koa = require('koa');
var app = koa();

//context
app.use(function *(next){
    this.res.setHeader('Access-Control-Allow-Origin', this.req.headers.origin);//注意这里不能使用 *
    this.status=403;
});

app.listen(3001);