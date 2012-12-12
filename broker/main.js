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

// default conf data
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
        site: { root:'web', sessions:'sessions', cache:'cache' },
       }
    };

// DEAMON ////////////////////////////////////////////////////////////////////
//
var dPID=Demonize.start();
Demonize.lock(PID);
Demonize.closeIO();

process.title="moon::broker";

function log()
{
 if(Tools.isset(LOG))
   {
    var args=[].slice.call(arguments,0);
    args.unshift(LOG);
    Tools.log.apply(this,args);
   }
}

log("----- broker -----------------------------------------------------------------------");

log("BROKER BASICS:\n"+Util.inspect({ NODE:NODE, SELF:SELF, CWD :CWD, PID :PID, CONF:CONF, LOG :LOG, }));

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
            Tools.removeAllIntervals();
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

// database //////////////////////////////////////////////////////////////////
//
var Godb  =require(Path.join(CWD,"modules/godb.js" ));
var XPaths=require(Path.join(CWD,"modules/xpaths.js" ));

var dbArena=
    {
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
       },
    };

Object.freeze(dbArena.db.fx);
Object.freeze(dbArena.db);
Object.freeze(dbArena);
    
// web server ////////////////////////////////////////////////////////////////
//
if(Tools.isset(conf.http) && Tools.isset(conf.http.bind) && Tools.isset(conf.http.site))
  {
   var WebHandler=require(Path.join(CWD,"modules/webhandler.js" )).Handler;
   
   var http=require('http')
            .createServer(function(request,response)
                          {
                           new WebHandler(request,
                                          response,
                                          {
                                           logfile:LOG,
                                           root:Path.resolve(CWD,conf.http.site.root),
                                           sessions:(Tools.isset(conf.http.site.sessions)?Path.resolve(CWD,conf.http.site.sessions):null),
                                           cache:(Tools.isset(conf.http.site.cache)?Path.resolve(CWD,conf.http.site.cache):null),
                                           defaults:['default.html','index.html','default.nsp'],
                                           protocol:'http',
                                           arena:dbArena,
                                           scookie:"MOONID",
                                          });
                          });
            
   http.on('close',function(){ log("HTTP server closed"); });
   http.listen(conf.http.bind.port,conf.http.bind.address);
   log("HTTP listen on port "+conf.http.bind.port);
  }

// network link //////////////////////////////////////////////////////////////
//
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
                  Level5.send(this,peer.address,peer.port, { command:"get", network:data.network, plugin:plugin.name, what:deliver });
                  if(Tools.isset(options.static) && options.static===false)
                    {
                     /*
                     if(Tools.isset(options.updates))
                       {
                        var update=options.updates.update;
                        var times =options.updates.times ;

                        if(Tools.isset(update))
                          {
                           var key=data.who+"::"+deliver;
                           if(Util.isArray(update) && update.length===2)
                             {
                              update=Math.round(Math.floor(Math.random()*(update[1]-update[0]+1))+update[0]);
                              log("request each "+update+" seconds for "+key);
                              Tools.installInterval(key,updates,times,function()
                                {
                                 Level5.send(this,peer.address,peer.port, { command:"get", network:data.network, plugin:plugin.name, what:deliver });
                                });
                             }
                           else  
                           if((typeof update)==='number')
                             {
                              log("request each "+update+" seconds for "+key);
                              Tools.installInterval(key,updates,times,function()
                                {
                                 Level5.send(this,peer.address,peer.port, { command:"get", network:data.network, plugin:plugin.name, what:deliver });
                                });
                             }
                          }
                       }
                     */  
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

