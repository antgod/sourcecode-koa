var delegate = require('delegates');

var F=function(){}

var f=new F();

f.request=function(){};

f.request.accepts=function(){
    console.log('accepts');
};

delegate(f, 'request').method('accepts');

f.accepts();