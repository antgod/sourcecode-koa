var koa = require('koa');
var koaBody   = require('koa-body');

var app = koa();
app.use(koaBody({formidable:{uploadDir: __dirname}}));

//context
app.use(function *(next){

    this.type='application/json';

    console.log('type',this.response.get('Content-Type'));
    this.body="{'a':1}";

    console.log('reqheader',Object.keys(this.header));
    console.log('resheader',Object.keys(this.response.header));
    //this.response.attachment('a.json');

    //this.status=23434;

    //this.redirect('http://www.baidu.com');

    this.response.set('Location','http://www.baidu.com')
});

app.listen(3001);