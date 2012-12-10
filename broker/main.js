#!/usr/bin/env node
/*************************************************************
  MOONITOR broker
  (c) 2012, Francisco Puentes (fran@puentescalvo.com)
*************************************************************/
var Util =require('util');
var Path =require('path');
var Fs   =require('fs');
var Os   =require('os');
var Dgram=require('dgram');

var NODE=process.argv[0];
var SELF=Path.resolve(process.argv[1]);
var CWD =Path.dirname(SELF);
var PID =Path.join(CWD,Path.basename(SELF,Path.extname(SELF))+'.pid');
var CONF=Path.join(CWD,Path.basename(SELF,Path.extname(SELF))+'.conf');
var LOG =Path.join(CWD,Path.basename(SELF,Path.extname(SELF))+'.log');

var Tools   =require(Path.join(CWD,"common/tools.js" ));
var Level5  =require(Path.join(CWD,"common/level5.js"));
var Demonize=require(Path.join(CWD,"common/demonize" ));

if(process.argv.length>=2)
  {
   switch(process.argv[2])
         {
          case 'help':
               Tools.printUsageAndExit(0);
               
          case 'status':
               if(Tools.existsOldInstance(PID))
                 {
                  console.log("There are other instance of moon-broker working hard");
                  process.exit(1);
                 }
               else
                 {
                  console.log("Moon-broker is down");
                  process.exit(0);
                 }
               
          case 'stop':
               Tools.killOldInstance(PID);
               process.exit(0);
               
          case 'start':
               //parameters:
               //  --conf <file>
               //  --nolog
               //
               for(var i=3; i<process.argv.length; i++)
                  {
                   var arg=process.argv[i];
                   
                   if(arg==='--nolog')
                     {
                      LOG=undefined;
                     }
                   else
                   if(arg==='--conf' && (i+1)<process.argv.length)
                     {
                      i+=1;
                      CONF=process.argv[i];
                     }
                   else
                   Tools.printUsageAndExit(1);
                  }
               if(Tools.existsOldInstance(PID))
                 {
                  console.log("The are other instance of moon-broker working");
                  Tools.printUsageAndExit(0);
                 }
               //following, the broker daemon ...
               break;
               
          default:
               Tools.printUsageAndExit(1);
         }
  }

console.log("Starting the broker daemon ...");
  
//////// DEAMON ///////////////////////////////////////////////////////////////////////////////////////////////
var dPID=Demonize.start();
Demonize.lock(PID);
Demonize.closeIO();

//////// default conf data ///////////////////////////////////
var conf=
    {
     //send 'iamalive' each 'announce' seconds (0 - disable)
     announce: 60,
     port:     1234,
     //networks
     networks:
       [
        { name:'localnet', broadcast:'127.255.255.255', port:1233 },
       ],
       
     http:
       {
        bind: { address:'127.0.0.1', port:8086 },
        site: { root:'web' },
       }
    };

process.title="moon::broker";

function log()
{
 if(Tools.isset(LOG))
 try
   {
    var text="";
    for(var i in arguments)
       {
        text+=arguments[i].toString()+"\n";
       } 
    Fs.appendFileSync(LOG,text,'utf8');
   }
 catch(err)  
   {
    Fs.appendFileSync(LOG,"ERROR: "+err);
   }
}

log("----- broker -----------------------------------------------------------------------");

log("BROKER BASICS:"+Util.inspect({ NODE:NODE, SELF:SELF, CWD :CWD, PID :PID, CONF:CONF, LOG :LOG, }));

process.on('exit',
           function()
           {
            log("Removing '"+PID+"' ...");
            Fs.unlinkSync(PID);
            log("Exit!");
           });

process.on('SIGINT',
           function()
           {
            log("INT signal!");
            if(Tools.isset(server))
              {
               log("Closing network link ...");
               try { server.close(); } catch(err){}
              }
            if(Tools.isset(http))
              {
               log("Closing HTTP link ...");
               try { http.close(); } catch(err){}
              }
            process.nextTick(function(){process.exit(0);});
           });

process.on('SIGUSR2',
           function()
           {
            log("USR2 signal!");
           });

process.on('uncaughtException',
           function(err)
           {
            log('Exception: '+err);
           });

if(Fs.existsSync(CONF))
  {
   try
     {
      log("Reading *.conf file: "+CONF);
      var tmp=Fs.readFileSync(CONF);
      var conf=JSON.parse(tmp);
      log("New configuration environment");
      log(Util.inspect(conf));
     }
   catch(err)  
     {
      log("Error: "+err);
      process.exit(1);
     }
  }

/////////////////////////////////////////////////////////// database //////////////////////////////////////////

var Godb  =require(Path.join(CWD,"modules/godb.js" ));
var XPaths=require(Path.join(CWD,"modules/xpaths.js" ));

/////////////////////////////////////////////////////////// network link //////////////////////////////////////

for(var i=0; i<conf.networks.length; i++)
   {
    Godb.insertRow(Godb.objects,{type:"network",name:conf.networks[i].name},{});
   }

function onMessage(msg,peer)
{
 var data=Level5.get(this,peer.address,peer.port,msg);
 if(Tools.isset(data))
   {
    var nId=Godb.updateRow(Godb.objects,{type:"network",name:data.network},{});

    //log("BROKER: New message "+Util.inspect(data,false,1,''));
    
    if(data.command==='iamalive')
      {// command:'iamalive', network:<name>, who:<hostname>, rol:'daemon'
       //
       if(Tools.isset(nId) && data.rol==='daemon')
         {
          if(!Godb.searchRow(Godb.objects,{type:'host',name:data.who}))
            {
             Level5.send(this,peer.address,peer.port, { command:"ping", network:data.network, rol:"broker", who:Os.hostname() });
            }
          else
            {
             var hId=Godb.updateRow(Godb.objects,{type:'host',name:data.who},{address:peer.address,port:peer.port});
             Godb.updateOrInsertRow(Godb.relations,{left:nId,right:hId,type:'contains'},{});
            }
         }
      }
    else  
    if(data.command==='ping')
      {// command:'ping', network:<name>, rol:'daemon', who:<name>
       //
       if(Tools.isset(nId) && rol==='daemon')
         {
          Level5.send(this,peer.address,peer.port, { command:"pong", network:data.network, rol:"broker", who:Os.hostname(), from:data.who });
         }
      }
    else
    if(data.command==='pong')
      {// command:'pong', network:<name>, rol:'daemon', who:<name>, from:<name===Os.hostname()>
       //
       if(Tools.isset(nId) && data.rol==='daemon' && data.from===Os.hostname())
         {
          var hId=Godb.updateOrInsertRow(Godb.objects,{type:'host',name:data.who},{address:peer.address,port:peer.port});
          Godb.updateOrInsertRow(Godb.relations,{left:nId,right:hId,type:'contains'},{});

          Level5.send(this,peer.address,peer.port, { command:"plugins", network:data.network  });
         }
      }
    else  
    if(data.command==='plugins')
      {// => command:'plugins', network:<name>, who:<hostname>, plugins:[ { name:<string>, description:<text>, delivers:[...] } ... ]
       //
       if(Tools.isset(nId))
         {
          var hId=Godb.updateOrInsertRow(Godb.objects,{type:'host',name:data.who},{address:peer.address,port:peer.port});
          Godb.updateOrInsertRow(Godb.relations,{left:nId,right:hId,type:'contains'},{});
          
          for(var i in data.plugins)
             {
              var plugin=data.plugins[i];
              var pId=Godb.updateOrInsertRow(Godb.objects,{type:'plugin',name:plugin.name},{description:plugin.description});
              
              for(var deliver in plugin.delivers)
                 {
                  var options=plugin.delivers[deliver];
                  Godb.insertRow(Godb.relations,{left:hId,right:pId,type:'deliver'},{name:deliver, options:options});
                  if(Tools.isset(options.static) && options.static===true)
                    {
                     Level5.send(this,peer.address,peer.port, { command:"get", network:data.network, plugin:plugin.name, what:deliver });
                    } 
                 }
             }
         }
      }
    else  
    if(data.command==='get')
      {// => command:'get', network:<name>, who:<hostname>, plugin:<name>, what:<name>, value:<value>
       //
       if(Tools.isset(nId))
         {
          var hId=Godb.searchRow(Godb.objects,{type:'host',  name:data.who   });
          var pId=Godb.searchRow(Godb.objects,{type:'plugin',name:data.plugin});

          if(Tools.isset(hId) && Tools.isset(pId))
            {
             var rId=Godb.searchRow(Godb.relations,{type:'deliver',left:hId,right:pId,name:data.what});
             if(Tools.isset(rId))
               {
                if(Tools.isset(data.value) && Tools.isset(data.value.path))
                  {
                   var path=data.value.path;
                   delete data.value.path;
                   var value=XPaths.resolve({NETWORK:nId,HOST:hId,PLUGIN:pId},Godb.objects,Godb.relations,path,data.value);
                   //log("response GET::"+data.plugin+"@"+data.who+" => "+data.what+" = "+Util.inspect(value,false,1)+" with path="+path+"");
                  }
                else
                  {
                   log("Invalid response 'value' format:");
                   log(Util.inspect(data.value,false,1));
                  }
               }
            }
         }
      }
    else
    if(data.command==='set')
      {// => command:'set',  network:<name>, plugin:<name>, what:<name>, ack:true|false
       //
       if(Tools.isset(nId))
         {
          //TODO ...
         }
      }
    else
    if(data.command==='do')
      {// => command:'do', network:<name>, plugin:<name>, what:<name>, ack:true|false
       //
       if(Tools.isset(nId))
         {
          //TODO ...
         }
      }
    else
      {
       if(Tools.isset(nId))
         {
          log("Unknow paquet:");
          log(Util.inspect(data,false,1));
         }
      }
   }
}

function onListening()
{
 var iamalive=function(server)
     {
      if(Tools.isset(conf.networks))
        {
         for(var i in conf.networks)
            {
             var network=conf.networks[i];
             Level5.send(server, network.broadcast, network.port, { command:"iamalive", network:network.name, who:Os.hostname(), rol:"broker" });
            }
       }
     }

 log('UDP listening ...');
 this.setBroadcast(true);
 iamalive(this);
 if(Tools.isset(conf.announce) && conf.announce>0)
   {
    this.announceId=setInterval(iamalive,conf.announce*1000,this);
   }
}

function onClose()
{
 if(Tools.isset(this.announceId))
   {
    clearInterval(this.announceId);
    delete this.announceId;
   }
 log("UDP server closed");  
}

function onError(err)
{
 log('Error: '+err);
}

if(Tools.isset(conf.port))
  {
   var server=Dgram.createSocket('udp4');
   server.on('message',  onMessage.  bind(server));
   server.on('listening',onListening.bind(server));
   server.on('close',    onClose.    bind(server));
   server.on('error',    onError.    bind(server));
   server.bind(conf.port);
   log('Server created');
  }

/////////////////////////////////////////////////////////// web server ////////////////////////////////////////
var Http   =require('http');
var Url    =require('url' );
var Vm     =require('vm'  );
var Whirler=require(Path.join(CWD,"modules/whirler.js" )).Whirler;

var HttpError=function(code,text)
{
 Error.captureStackTrace(this,this);
 this.statusCode=code;
 this.message = text || Http.STATUS_CODES[code];
}

Util.inherits(HttpError, Error);
HttpError.prototype.name = "HTTP Error";

function isFile(filename)      { try { var stat=Fs.statSync(filename); return stat.isFile();      } catch(err) { return null; } }
function isDirectory(filename) { try { var stat=Fs.statSync(filename); return stat.isDirectory(); } catch(err) { return null; } }

function translateUrl2Path(url,root)
{
 var path=url.pathname.split('/');
 var tmp=root;
 var relt='/';
 var rest='/';
 for(var i=0; i<path.length; i++)
    {
     if(isDirectory(Path.join(tmp,path[i])))
       {
        tmp =Path.join(tmp, path[i]);
        relt=Path.join(relt,path[i]);
       }
     else
     if(isFile(Path.join(tmp,path[i])))
       {
        tmp =Path.join(tmp, path[i]);
        relt=Path.join(relt,path[i]);
        for(var j=i+1; j<path.length; j++)
           {
            rest=Path.join(rest,path[j]);
           }
        break;
       }
     else
     return null;
    }
 return [tmp,relt,rest];
}

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

function $echo(request,response,args)
{
 for(var i in args)
    {
     var arg=args[i];
     if((arg instanceof Buffer))
       {
        response.write(arg);
       }
     else
     if(Util.isArray(arg))
       {
        var buffer=new Buffer(arg.length);
        for(var j in arg)
           {
            buffer[j]=arg[j];
           }
        response.write(buffer);
       }
     else
     if((typeof arg)==="string")
       {
        response.write(arg,'utf8');
       }
    }
}

function webRequest(request,response)
{
 log(Util.inspect(request.url));
 
 try
   {
    if(Tools.isset(conf.http.site.root))
      {
       var url =Url.parse(request.url,true);
       var tmp=translateUrl2Path(url,Path.resolve(CWD,conf.http.site.root));

       if(Tools.isset(tmp))
         {
          var filename=tmp[0];
          var relt=    tmp[1];
          var rest=    tmp[2];

          if(isDirectory(filename))
            {
             if(Fs.existsSync(Path.join(filename,'index.html'))) filename=Path.join(filename,'index.html');
             else
             if(Fs.existsSync(Path.join(filename,'default.html'))) filename=Path.join(filename,'default.html');
             else
             if(Fs.existsSync(Path.join(filename,'default.nsp'))) filename=Path.join(filename,'default.nsp');
             else
             throw new HttpError(404);
            }

          if(Path.extname(filename)==='.nsp')
            {
             var whirler=new Whirler();
             var code   =whirler.doit(Fs.readFileSync(filename,'utf8'),{source:filename,target:null});

             // Environment:
             //   response.statusCode
             //   response.contentType
             //   response.echo(...)
             //   db.objects
             //   db.relations
             //   db.fx.searchRow
             //   db.fx.insertRow
             //   db.fx.updateRow
             //   db.fx.updateOrInsertRow
             //   db.fx.retrieveRow
             //   db.fx.retrieveRows
             //   db.fx.retrieveIDs
             var sandbox=
                 {
                  Util:
                    {
                     isset:   Tools.isset,
                     isDate:  Util.isDate,
                     isArray: Util.isArray,
                     inspect: Util.inspect,
                    },
                    
                  response:
                    {
                     get statusCode()    { return response.statusCode; },
                     set statusCode(sc)  { response.statusCode=sc; },

                     get contentType()   { return response.getHeader("Content-Type"); },
                     set contentType(ct) { response.setHeader("Content-Type",ct); },

                     echo: function(){ $echo(request,response,arguments); },
                    },
                  
                  db:
                    {
                     get objects()   { return Godb.objects;   },
                     get relations() { return Godb.relations; },
                     fx:
                       {
                        searchRow:         Godb.searchRow,
                        insertRow:         Godb.insertRow,
                        updateRow:         Godb.updateRow,
                        updateOrInsertRow: Godb.updateOrInsertRow,
                        retrieveRow:       Godb.retrieveRow,
                        retrieveRows:      Godb.retrieveRows,
                        retrieveIDs:       Godb.retrieveIDs,
                       },
                    }
                 };

             response.setHeader("Date",(new Date()).toUTCString());
             response.setHeader("Content-Type",contentType(filename));
             response.setHeader("Last-Modified",(new Date()).toUTCString());
             response.statusCode=200;
             Vm.runInNewContext(code,sandbox,filename);
            }
          else
            {
             var stat=Fs.statSync(filename);
             response.setHeader("Date",(new Date()).toUTCString());
             response.setHeader("Content-Type",contentType(filename));
             response.setHeader("Content-Length",stat.size);
             response.setHeader("Last-Modified",stat.mtime.toUTCString());
             response.writeHead(200);
             response.write(Fs.readFileSync(filename));
            }
         }
       else
       throw new HttpError(503/*Service Unavailable*/);
      }
    else
    throw new Error("Wrong conf::http.site.root");
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

if(Tools.isset(conf.http) && Tools.isset(conf.http.bind))
  {
   var http=require('http').createServer(webRequest);
   http.on('close',function(){ log("HTTP server closed"); });  
   http.listen(conf.http.bind.port,conf.http.bind.address);
   log("HTTP listen on port "+conf.http.bind.port);
  }

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

