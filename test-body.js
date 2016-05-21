var koa = require('koa');
var koaBody   = require('koa-body');

var app = koa();
app.use(koaBody({formidable:{uploadDir: __dirname}}));

//context
app.use(function *(next){
    console.log('body',this.request.body);
    this.body='abc';
});

app.listen(3001);