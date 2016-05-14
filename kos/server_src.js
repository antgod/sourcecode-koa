var koa=require('koa');
var app= koa();

app.listen(3001);

app.use(function  (){
    console.log(Object.keys(this));
    console.log(Object.keys(this.toJSON()));
    //this.onerror(new Error());
});


