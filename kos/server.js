var kos=require('./kos');
var outgoing=require('_http_outgoing').OutgoingMessage;
var app= kos();

app.listen(3000);

app.use(function(req,res){
   console.log(Object.keys(req.headers))
   console.log('中间件1');
});

app.use(function(req,res){
   console.log('中间件2');
});