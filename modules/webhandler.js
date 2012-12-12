var Util   =require("util");
var Path   =require("path");
var Fs     =require("fs");
var Url    =require("url");
var Vm     =require("vm");
var Tools  =require(Path.resolve(__dirname,"../common/tools.js"));
var Whirler=require(Path.resolve(__dirname,"../modules/whirler.js" )).Whirler;

// HttpError /////////////////////////////////////////////////////////////////
//
var HttpError=function(code,text)
{
 Error.captureStackTrace(this,this);
 this.statusCode=code;
 this.message = text || Http.STATUS_CODES[code];
}

Util.inherits(HttpError, Error);
HttpError.prototype.name = "HTTP Error";

// contentType ///////////////////////////////////////////////////////////////
//
function contentType(filename)
{
 switch(Path.extname(filename))
       {
        case '.html': return "text/html";
        case '.css' : return "text/css";
        case '.jpg' : return "image/jpeg";
        case '.png' : return "image/png";
        case '.gif' : return "image/gif";
        case '.ico' : return "image/x-icon";
        case '.js'  : return "application/javascript";
        case '.nsp' : return "text/html";
        default     : throw new Error("Unknow extension: "+Path.extname(filename));
       }
}                                                                                     

// translateUrl //////////////////////////////////////////////////////////////
//
function translateUrl(pathname,siteroot,defaults)
{
 var full=siteroot;
 var relt='/';
 var rest=null;

 var list=pathname.split('/');
 for(var i=0; i<list.length; i++)
    {
     if(Tools.isdirectory(Path.join(full,list[i])))
       {
        full=Path.join(full,list[i]);
        relt=Path.join(relt,list[i]);
       }
     else
     if(Tools.isfile(Path.join(full,list[i])))
       {
        full=Path.join(full,list[i]);
        relt=Path.join(relt,list[i]);   
        rest='/';
        for(var j=i+1; j<list.length; j++)
           {
            rest=Path.join(rest,list[j]);
           }
        break;
       }
     else
     return null;
    }

 if(Tools.isdirectory(full))
   {
    if(Tools.isset(defaults))
      {
       for(var i in defaults)
          {
           var bydef=defaults[i];
           
           if(Tools.isfile(Path.join(full,bydef)))
             {
              full=Path.join(full,bydef);
              relt=Path.join(relt,bydef);
              return [full,relt,rest];
             }
          }
       return null;   
      }
   }
 return [full,relt,rest];
}

// $echo /////////////////////////////////////////////////////////////////////
//
function $echo(sandbox,args)
{
 for(var i in args)
    {
     var arg=args[i];
     if((arg instanceof Buffer))
       {
        sandbox.response.write(arg);
       }
     else
     if(Util.isArray(arg))
       {
        var buffer=new Buffer(arg.length);
        for(var j in arg)
           {
            buffer[j]=arg[j];
           }
        sandbox.response.write(buffer);
       }
     else
     if((typeof arg)==="string")
       {
        sandbox.response.write(arg,'utf8');
       }
    }
}

/*********************************************************************
  conf
  .logfile	logfile or null (no log)
  .root		site root
  .defaults	page defaults
  .arena        objects to append to sandbox's arena
  .protocol     http or https
*********************************************************************/
var Handler=function(request,response,conf)
{
 function log(text)
   {
    Tools.log(conf.logfile,text);
   }

 var myself=this;
 
 this.sandbox=
      {
       request:request,
       response:response,
       //url
       //fullname
       //reltname
       //restname
       arena:
         {
          //conf.arena.*
          
          Util:
            {
             isset:Tools.isset,
             isDate:Util.isDate,
             isArray:Util.isArray,
             inspect:Util.inspect,
            },

          include: function(fn)
            {
             try
               {
                var code=Fs.readFileSync(Path.resolve(Path.dirname(myself.fullname),fn),"utf8");
                return eval(code);
               }
             catch(err)
               {
                log("ERR @ include('"+fn+"')");
                throw err;
               }
            },
            
          require: function(fn)
            {
             try
               {
                var code=Fs.readFileSync(Path.resolve(Path.dirname(myself.fullname),fn),"utf8");
                myself.arena.module={};
                Vm.runInNewContext(code,myself.arena,fn);
                var r=myself.arena.module.exports;
                delete myself.arena.module;
                return r;
               }
             catch(err)
               {
                log("ERR @ require('"+fn+"')");
                throw err;
               }
            },
            
          request:
            {
             get method()   { return request.method;      },
             get href()     { return myself.url.href;     },
             get protocol() { return myself.url.protocol; },
             get auth()     { return myself.url.auth;     },
             get hostname() { return myself.url.hostname; },
             get port()     { return myself.url.port;     },
             get pathname() { return myself.url.pathname; },
             get search()   { return myself.url.search;   },
             get hash()     { return myself.url.hash;     },
             get version()  { return request.httpVersion; },
             get headers()  { return request.headers;     },
             get trailers() { return request.trailers;    },
            },
            
          script:
            {
             get href()     { return myself.url.href;     },
             get filename() { return myself.fullname;     },
             get pathname() { return myself.reltname;     },
             get leftover() { return myself.restname;     },
             get hash()     { return myself.url.hash;     },
             get query()    { return myself.url.query;    },
            },  
            
          response:
            {
             get status()    { return response.statusCode; },
             set status(sc)  { response.statusCode=sc; },
             
             headers:
               {
                get: function(key)      { return response.getHeader(key); },
                set: function(key,data) { response.setHeader(key,data);   },
                rmv: function(key)      { response.removeHeader(key);     },
               },
               
             trailers: function(headers) { response.addTrailers(headers); },
               
             echo: function(){ return $echo(myself,arguments); },
            },
         }
      };
      
 if(Tools.isset(conf.arena))
   {
    for(var key in conf.arena)
       {
        this.sandbox.arena[key]=conf.arena[key];
       }
   }
 
 try
   {
    var url=Url.parse(request.url,true);
    var req=translateUrl(url.pathname,conf.root,conf.defaults);    
    
    log(Util.inspect(url));
    
    if(req!=null)
      {
       this.sandbox.url=url;
       this.sandbox.fullname=req[0];
       this.sandbox.reltname=req[1];
       this.sandbox.restname=req[2];
       
       if(Path.extname(req[0])==='.nsp')
         {
          var code=new Whirler().doit(Fs.readFileSync(req[0],'utf8'),{source:req[0],target:null});
          var date=new Date();
          response.setHeader("Date",date.toUTCString());
          response.setHeader("Content-Type",contentType(req[0]));
          response.setHeader("Last-Modified",date.toUTCString());
          response.statusCode=200;
          Vm.runInNewContext(code,this.sandbox.arena,req[0]);
         }
       else
         {
          var stat=Fs.statSync(req[0]);
          response.setHeader("Date",new Date().toUTCString());
          response.setHeader("Content-Type",contentType(req[0]));
          response.setHeader("Content-Length",stat.size);
          response.setHeader("Last-Modified",stat.mtime.toUTCString());
          response.writeHead(200);
          response.write(Fs.readFileSync(req[0]));
         }
      }
    else
    throw new HttpError(404);
   }
 catch(err)  
   {
    if(err instanceof HttpError)
      {
       log("["+err.name+"]: "+err.message+" ("+err.statusCode+")");
       response.statusCode=err.statusCode;
      } 
    else
      {
       log("["+err.name+"]: "+err.message);
       response.statusCode=500;//Internal Server Error
      }
   }
 finally
   {
    response.end();
   }
}

module.exports=
  {
   Handler:Handler,
  };
