var koa = require('koa');
var koaBody   = require('koa-body');

var app = koa();
app.use(koaBody({formidable:{uploadDir: __dirname}}));

//context
app.use(function *(next){

    //this.body=new Buffer("你好");

    //this.body={a:1};

    //this.body="<body>a</body>"

    this.body="abc"
});

app.listen(3001);