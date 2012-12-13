/*****************************************************************************
  (c) 2012, Francisco Puentes (fran@puentescalvo.com)
 
  WebHandler
  ----------
  Handle the http request, support for:
  + Static pages (limited by extension: see 'contentType' function)
  + Node server pages (*.nsp, *.njs)
  + auth plugins by page (pagename.nsp -> pagename.auth)
  + sessions
  + ...

  LICENSE: 'moonitor' license
*****************************************************************************/
var Util   =require("util");
var Crypto =require("crypto");
var Path   =require("path");
var Fs     =require("fs");
var Url    =require("url");
var Http   =require("http");
var Vm     =require("vm");

var Tools  =require(Path.resolve(__dirname,"../common/tools.js"));

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
        case '.njs' : return "application/json";
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
     var tmp1=Path.join(full,list[i]);
     var tmp2=Path.join(relt,list[i]);
     if(Tools.isdirectory(tmp1))
       {
        full=tmp1;
        relt=tmp2;
       }
     else
     if(Tools.isfile(tmp1))
       {
        full=tmp1;
        relt=tmp2;
        
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

// propagateSessionCookie ////////////////////////////////////////////////////
//
function propagateSessionCookie(request,response,cookieKey)
{
 function processCookie(cookie)
   {
    if(cookie.indexOf('=')>0)
      {
       var name =cookie.split('=');
       var value=name[1];
       name=name[0];

       if(name===cookieKey)
         {
          var cookies=response.getHeader("Set-Cookie");
          
               if(!Tools.isset(cookies))       cookies=[        name+"="+value];
          else if((typeof cookies)==='string') cookies=[cookies,name+"="+value];
          else if(Util.isArray(cookies))       cookies.push(    name+"="+value);
          else                                 return false;

          response.setHeader("Set-Cookie",cookies);
          return value;
         }
      }
    return false;  
   }
   
 if(Tools.isset(request.headers["Cookie"]))
   {
    var cookie=request.headers["Cookie"];
    if(Util.isArray(cookie))
      {
       for(var i in cookie)
          {
           var r=processCookie(cookie[i]);
           if((typeof r)==='string') return r;
          }
      }
    else
    if((typeof cookie)==='string')
      {
       return processCookie(cookie);
      }
    return false;  
   }
}

// setSessionCookie //////////////////////////////////////////////////////////
//
function setSessionCookie(response,cookieKey,value,attrs)
{
 var cookies=response.getHeader("Set-Cookie");

 if(Tools.isset(value))
   {
         if(!Tools.isset(cookies))       cookies=[        cookieKey+"="+value];
    else if((typeof cookies)==='string') cookies=[cookies,cookieKey+"="+value];
    else if(Util.isArray(cookies))       cookies.push(    cookieKey+"="+value);
    else                                 return false;

    response.setHeader("Set-Cookie",cookies);
    return true;
   }
 else
   {
    if((typeof cookies)==='string')
      {
       if(cookies.split('=')[0]===cookieKey)
         {
          response.removeHeader("Set-Cookie");
          return true;
         }
      }
    else  
    if(Util.isArray(cookies))
      {
       for(var i in cookies)
          {
           var cookie=cookies[i];
           if(cookie.split('=')[0]===cookieKey)
             {
              delete cookies[i];
              response.setHeader("Set-Cookie",cookies);
              return true;
             }
          }
      }
   }
 return false;
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
        var l=0;
        for(var j=0; j<arg.length; j++)
           {
            if(arg[j]===-1)
              {
               var c=arg[j+1];
               l+=c;
               j+=3-1;
              }
            else
            l+=1;
           }
           
        var buffer=new Buffer(l);
        for(var j=0,b=0; j<arg.length; (b++,j++))
           {
            if(arg[j]===-1)
              {
               var c=arg[j+1];
               for(var k=0; k<c; k++)
                  {
                   buffer[b+k]=arg[j+2];
                  }
               j+=3-1;
               b+=c-1;
              }
            else
            buffer[b]=arg[j];
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

// whirler ///////////////////////////////////////////////////////////////////
//
function whirler(code, source)
{
 function normalizeString(str)
   {
    if(str.indexOf('\n')>=0 && (str[0]==='"' || str[0]==="'"))
      {
       var r='';
       for(var i=0; i<str.length; i++)
          {
           if(str[i]==='\n') r+='\\n';
           else              r+=str[i];
          }
       return r;
      }
    return str;
   }

 var $out  ='';
 var $s    =0;
 var $code ='';
 var $buff ='';
 var $r    =0;
 var $c    =0;
 var $store=false;

 switch(Path.extname(source))
   {
    case '.nsp': $s=0 ;
    case '.njs': $s=50;
    default    : $s=0 ;
   }

 function $send(chr)
      {
       if($store===false) $out +=chr;
       else               $code+=chr;
      }

 function $emit(code,cr)
      {
       if(Tools.isset(code))
         {
          if(cr===true) cr='\n';
          else          cr='';
          
          if(code.length>0)
            {
             for(var i=0; i<code.length; i++)
                {
                 if(code[i]===' ') $send(' ');
                 else              break;
                }

             if(code.indexOf("'")<0) $send("response.echo("+normalizeString("'"+code+"'")+");"+cr);
             else
             if(code.indexOf('"')<0) $send('response.echo('+normalizeString('"'+code+'"')+');'+cr);
             else
               {
                $send("response.echo([");
                for(var i=0; i<code.length; i++)
                   {
                    var c=0;
                    for(var j=i; j<code.length; j++)
                       {
                        if(code[j]===code[i]) c+=1;
                        else                  break;
                       }

                    if(c>3)
                      {
                       $send(""+(-1)+",");
                       $send(""+  c +",");
                       $send(String(code.charCodeAt(i)));
                       i+=c-1;
                      }
                    else
                      {
                       $send(String(code.charCodeAt(i)));
                      }
                    if((i+1)<code.length) $send(',');
                   }
                $send("]);"+cr);
                //$send(" // "+normalizeString(code).trim()+"\n")
               }
            }
         }
       return '';
      }

 function next(token)
      {
       switch($s)
             {
              //HTML, CSS, ...
              case 0:
                        if(token==='<' ) $s=1;
                   else if(token==='{')  { $r=0; $s=10;}
                   else if(token==='\n') { $code+=token;$code=$emit($code,true); }
                   else                  $code+=token;
                   break;

              case 1://<
                        if(token==='?') { $buff='';   $s=2;              }
                   else if(token==='{') { $r=1; $s=10;                   }
                   else                 { $code+='<'; $s=0; next(token); }
                   break;

              case 2://<?
                   if(!Tools.isspace(token)) $buff+=token;
                   else
                     {
                           if($buff===''    ) { $code=$emit($code,true); $s=50;             }
                      else if($buff==='js'  ) { $code=$emit($code,true); $s=50;             }
                      else if($buff==='node') { $code=$emit($code,true); $s=50;             }
                      else                    { $code+=("<?"+$buff);     $s=0; next(token); }
                     }
                   break;

              case 10:
                   if(token==='{') $s=11;
                   else            { $code+="{"; $s=$r; next(token); }
                   break;

              case 11:
                   if(token===':') { $code=$emit($code);$store=true;$s=20; }
                   else            { $code+="{"; $s=$r; next(token); }
                   break;

              //EMBEDDED code: {{code}}
              case 20:
                   if(token==='}') $s=21;
                   else            $send(token);
                   break;

              case 21:
                   if(token==='}') { $store=false; $send("response.echo("+$code.trim()+");"); $code=''; $s=$r; }
                   else            { $code+="}"; $s=20; next(token); }
                   break;

              //JAVASCRIPT
              case 50:
                        if(token==='?'         )                                                     $s=60 ;
                   else if(token==='/'         )                                                     $s=300;
                   else if(token==='"'         ) { $store=true;$code='';$send(token); $r=51; $c='"'; $s=100; }
                   else if(token==="'"         ) { $store=true;$code='';$send(token); $r=51; $c="'"; $s=100; }
                   else                                                 $send(token);
                   break;

              case 51:
                   $store=false;
                   $send($code);
                   $code='';
                   $s=50;
                   next(token);
                   break;

              case 60:
                   if(token==='>') { $send('\n');$s=0;               }
                   else            { $send('?'); $s=50; next(token); }
                   break;

              //CADENAS DE CARACTERES
              case 100:
                        if(token===$c)   { $send(token); $s=$r;  }
                   else if(token==='\\') { $send('\\' ); $s=101; }
                   else if(token==='\n') { $send('\\n');         }
                   else if(token==='\r') { $send('\\r');         }
                   else if(token==='\t') { $send('\\t');         }
                   else                    $send(token);
                   break;

              case 101:
                   $send(token);
                   $s=100;
                   break;

              //COMENTARIOS     
              case 300:
                        if(token==='/') { $send("// Line comment\n"); $s=310;  }
                   else if(token==='*') { $send("// Big comment\n");  $s=320;  }
                   else                 { $send('/'); $s=50; next(token);      }
                   break;

              //COMENTARIOS de una sóla línea
              case 310:
                   if(token==='\n') $s=50;
                   break;

              //COMENTARIOS multilínea
              case 320:
                        if(token==='*' ) $s=321;
                   else if(token==='\n') $send("// Big comment\n");
                   break;

              case 321:
                        if(token==='/')  $s=50;
                   else if(token==='*')  $s=321;
                   else if(token==='\n') $send("// Big comment\n");
                   else                  $s=320;
                   break;

              default:
                   throw new Error("Internal error: unknow state "+$s);
             }
      }

 var rt='';
 for(var i=0; i<code.length; i++)
    {
     next(code[i]);
    }
 $emit($code,true);
 rt+=$out;

 return ($s==0 || $s==1 || $s==2 || $s==50 || $s==310 ? rt : false );
}


/*********************************************************************
  conf
  .logfile      logfile or null (no log)
  .root		       site root
  .sessions     sessions folder
  .cache        cache folder
  .defaults	    page defaults
  .arena        objects to append to sandbox's arena
  .protocol     http or https
  .scookie      cookie key for sessions
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
       //moonid
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
                var code=Fs.readFileSync(Path.resolve(Path.dirname(myself.sandbox.fullname),fn),"utf8");
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
             var token=myself.sandbox.arena.module;
             try
               {
                myself.sandbox.arena.module={};
                var code=Fs.readFileSync(Path.resolve(Path.dirname(myself.sandbox.fullname),fn),"utf8");
                Vm.runInNewContext(code,myself.sandbox.arena,fn);
                var r=myself.sandbox.arena.module.exports;
                myself.sandbox.arena.module=token;
                return r;
               }
             catch(err)
               {
                log("ERR @ require('"+fn+"')");
                throw err;
               }
             finally
               {
                myself.sandbox.arena.module=token;
               }
            },
            
          request:
            {
             get method()   { return request.method;              },
             get version()  { return request.httpVersion;         },
             get href()     { return myself.sandbox.url.href;     },
             get protocol() { return myself.sandbox.url.protocol || (conf.protocol+":"); },
             get auth()     { return myself.sandbox.url.auth;     },
             get hostname() { return myself.sandbox.url.hostname; },
             get port()     { return myself.sandbox.url.port;     },
             get pathname() { return myself.sandbox.url.pathname; },
             get search()   { return myself.sandbox.url.search;   },
             get hash()     { return myself.sandbox.url.hash;     },
             get headers()  { return request.headers;             },
             get trailers() { return request.trailers;            },
            },
            
          script:
            {
             get href()     { return myself.sandbox.url.href;     },
             get filename() { return myself.sandbox.fullname;     },
             get pathname() { return myself.sandbox.reltname;     },
             get leftover() { return myself.sandbox.restname;     },
             get hash()     { return myself.sandbox.url.hash;     },
             get query()    { return myself.sandbox.url.query;    },
            },

          session:
            {
             get id() { return myself.sandbox.moonid; },
             
             open: function()
               {
                if(Tools.isset(conf.scookie))
                  {
                   var shasum=Crypto.createHash('sha1');
                   var seed=Math.round(Math.random()*(1000001-100)+100)+"::MOON-ID::"+new Date().getTime();
                   shasum.update(seed);
                   myself.sandbox.moonid=shasum.digest('hex');
                   //TODO: create session file
                   return setSessionCookie(response,conf.scookie,myself.sandbox.moonid,{});
                  }
               },
               
             close: function()
               {
                if(Tools.isset(conf.scookie))
                  {
                   setSessionCookie(response,conf.scookie,null,{});
                   //TODO: remove session file
                   myself.sandbox.moonid=false;
                   return true;
                  }
               },
               
             data:
               {
                //user data ...
               },
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
               
             echo: function(){ return $echo(myself.sandbox,arguments); },
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
    
    //log(Util.inspect(conf));
    //log(Util.inspect(url));
    //log(Util.inspect(req));
    
    if(req!=null)
      {
       if(Path.extname(req[0])==='.nsp' || Path.extname(req[0])==='.njs')
         {
          this.sandbox.url=url;
          this.sandbox.fullname=req[0];
          this.sandbox.reltname=req[1];
          this.sandbox.restname=req[2];

          this.sandbox.moonid=false;
          if(Tools.isset(conf.scookie))
            {
             var sid=propagateSessionCookie(request,response,conf.scookie);
             if((typeof sid)==='string')
               {
                this.sandbox.moonid=sid;
                //TODO: load session file
               }
            }

          var code;
          var hashname;
          var newest;
          var stat=Fs.statSync(req[0]);
          
          if(Tools.isset(conf.cache))
            {
             hashname=Path.join(conf.cache,Crypto.createHash('sha1').update(req[0]).digest('hex'));
             
             if(Tools.isfile(hashname)===true)
               {
                if(stat.mtime.getTime() < Fs.statSync(hashname).mtime.getTime())
                  {
                   newest=true;
                  }
               }
            }
            
          if(Tools.isset(conf.cache) && newest===true)
            {
             code=Fs.readFileSync(hashname,'utf8');
            }
          else
            {
             code=whirler(Fs.readFileSync(req[0],'utf8'),req[0]);
             if(Tools.isset(conf.cache))
               {
                Fs.writeFile(hashname,
                             code,
                             'utf8',
                             function()
                               {
                                log("---------> "+req[0]);
                                log("---------> "+hashname);
                                log("---------> "+Path.relative(req[0],hashname));
                                //Fs.symlink(req[0],hashname,"file");
                               });
               }
            }

          
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
