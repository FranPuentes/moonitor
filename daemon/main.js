#!/usr/bin/env node
/*************************************************************
  MOONITOR daemon
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
var KILL=Path.join(CWD,Path.basename(SELF,Path.extname(SELF))+'.kill');
var CONF=Path.join(CWD,Path.basename(SELF,Path.extname(SELF))+'.conf');

var Tools =require(Path.join(CWD,'common/tools.js' ));
var Level5=require(Path.join(CWD,'common/level5.js'));

var log=console.log;

if(Fs.existsSync(PID))
  {
   try
     {
      var oldPid=parseInt(Fs.readFileSync(PID),10);
      try
        {
         process.kill(oldPid,'SIGUSR2');
         console.log("There are other instance of me working hard :-)");
         process.exit(0);
        }
      catch(err)
        {
         Fs.unlinkSync(PID);
        }
     }
   catch(err)
     {
      console.err(err);
      console.err("Failed to load and parse '"+PID+"'");
      process.exit(1);
     }
  }

Fs.writeFileSync(PID,process.pid,'utf8');

process.on('exit',
           function()
           {
            console.log("Ending ...");
            removeInterval('iamalive');
            Fs.unlinkSync(PID);
           });

process.on('SIGINT',
           function()
           {
            console.log("INT signal!");
            process.exit(0);
           });

process.on('SIGUSR2',
           function()
           {
            console.log("USR2 signal!");
           });

process.title="moonitor::daemon";

//TODO: crear el script KILL que mata elegantemente esta instancia

var conf=
    {
     //send 'iamalive' each 'announce' seconds (0 - disable)
     announce: 60,
     //bind to this port
     port:     1233,
     //network
     network:  { name:'localnet', port:1234, broadcast:'127.255.255.255' },
     //plugins directory
     plugins:  './plugins',
    };

if(Fs.existsSync(CONF))
  {
   try
     {
      var tmp=Fs.readFileSync(CONF);
      conf=JSON.parse(tmp);
     }
   catch(err)  
     {
      console.err("Error: "+err);
      process.exit(1);
     }
  }

for(var i=2; i<process.argv.length; i++)
   {
    var arg=process.argv[i];
    //TODO: procesar argumentos
   }

/////////////////////////////////////////////////////////// server ////////////////////////////////////////////
//
// commands:
//   iamalive *
//   ping/pong *
//   plugins *
//   get *
//   set
//   do
//

var broker={ address:undefined, port:undefined, lastUpdate:undefined };

var timeouts ={};
var intervals={};

function removeInterval(key)
{
 if(Tools.isset(intervals[key]))
   {
    clearInterval(intervals[key]);
    delete intervals[key];
   }
}

function installInterval(key,repeat,times,callback/*...*/)
{
 removeInterval(key);
 if(repeat>0)
   {
    var args=[].slice.call(arguments,4);
    intervals[key]=setInterval(function(args)
                                 {
                                  if(times===null) callback.apply(this,args);
                                  else
                                  if((typeof times)==='number')
                                    {
                                     if(times>0) callback.apply(this,args);
                                     else        removeInterval(key);
                                     times-=1;
                                    }
                                 },
                               repeat*1000,
                               args);
   }
}

function onMessage(msg,peer)
{
 var data=Level5.get(this,peer.address,peer.port,msg);
 if(Tools.isset(data))
 try
   {
    var network;

    if(Tools.isset(data.network))
      {
       if(data.network === conf.network.name)
         {
          network=conf.network;
         }
      }

    if(data.command==='iamalive')
      {// command:'iamalive', network:<name>, who:<hostname>, rol:'broker'
       //
       if(Tools.isset(network) && data.rol==='broker')
         {
          broker.hostname=data.who;
          broker.address=peer.address;
          broker.port=peer.port;
          broker.lastUpdate=new Date();
         }
      }
    else     
    if(data.command==='ping')
      {// command:'ping', network:<name>, rol:'broker', who:<name>
       //
       if(Tools.isset(network) && data.rol==='broker')
         {
          broker.hostname=data.who;
          broker.address=peer.address;
          broker.port=peer.port;
          broker.lastUpdate=new Date();
          Level5.send(this,peer.address,peer.port, { command:"pong", network:data.network, rol:'daemon', who:Os.hostname(), from:data.who });
         }
      }
    else  
    if(data.command==='pong')
      {// command:'pong', network:<name>, rol:'broker', who:<name>, from:<name===Os.hostname()>
       //
       if(Tools.isset(network) && data.rol==='broker' && data.from===Os.hostname())
         {
          broker.hostname=data.who;
          broker.address=peer.address;
          broker.port=peer.port;
          broker.lastUpdate=new Date();
         }
      }
    else
    if(data.command==='plugins')
      {// => command:'plugins', network:<name> [,repeat:<seconds>] [,times:<integer>]
       // <= command:'plugins', network:<name>, who:<hostname>, plugins:[ { name:<string>, description:<text>, delivers:[...] } ... ]
       //
       if(Tools.isset(network) && peer.address===broker.address && peer.port===broker.port)
         {
          function plugins(server)
            {
             var plugins=[];
             var PLUGINS=Path.resolve(conf.plugins);
             var entries=Fs.readdirSync(PLUGINS);
             
             for(var i in entries)
                {
                 var short=entries[i];
                 var full =Path.join(PLUGINS,short);
                 var stat =Fs.statSync(full);
                 var name =null;
                 var main =null;
                 
                 if(stat.isDirectory())
                   {
                    if(Fs.existsSync(Path.join(full,'main.js')))
                      {
                       main=Path.join(full,'main.js');
                       name=short;
                      }
                   }
                 else
                 if(stat.isFile())
                   {
                    var re=new RegExp("^(.+)\.js$",'gi');
                    var r;
                    if((r=re.exec(short))!=null)
                      {
                       main=full;
                       name=r[1];
                      }
                   }

                 if(Tools.isset(main) && Tools.isset(name))
                   {
                    var plugin=require(main);
                    if(Tools.isset(plugin.description) && (typeof plugin.description)==='string')
                      {
                       plugins.push({ name:name, description:plugin.description, delivers:plugin.delivers });
                      }
                   }
                }
                
             Level5.send(server,broker.address,broker.port, { command:"plugins", network:data.network, who:Os.hostname(), plugins:plugins });
            }
             
          plugins(this);
          if(Tools.isset(data.repeat) && data.repeat>0)
            {
             var repeat=data.repeat;
             var times=(Tools.isset(data.times)?data.times:0);
             installInterval('plugins',repeat,times,plugins,this);
            }
         }
      }
    else
    if(data.command==='get')
      {// => command:'get',  network:<name>, plugin:<name>, what:<name> [,repeat:<seconds>] [,times:<integer>]
       // <= command:'get',  network:<name>, plugin:<name>, what:<name>, value:<value>, who:<hostname>
       // <= command:'error',network:<name>, who:<hostname>, description:<text>, data:<data>
       //
       if(Tools.isset(network) && peer.address===broker.address && peer.port===broker.port)
         {
          function doCommand(server,script,what)
            {
             var plugin=require(script);
             
             if(Tools.isset(plugin.get))
               {
                Level5.send(server,broker.address,broker.port, { command:"get", network:data.network, who:Os.hostname(), plugin:data.plugin, what:what, value:plugin.get(what) });
               }
             else
             throw new Error("unknow plugin command");
            }
            
          var PLUGINS =Path.resolve(conf.plugins);
          var fullname=Path.join(PLUGINS,data.plugin);
          
          if(Fs.existsSync(fullname))
            {
             script=Path.join(fullname,'main.js');
             doCommand(this,script,data.what);
             if(Tools.isset(data.repeat) && data.repeat>0)
               {
                var repeat=data.repeat;
                var times=(Tools.isset(data.times)?data.times:0);
                installInterval('get::'+data.plugin+'::'+data.what,repeat,times,doCommand,this,script,data.what);
               }
            }
          else
            {
             script=fullname+'.js';
             if(Fs.existsSync(script))
               {
                doCommand(this,script,data.what);
                if(Tools.isset(data.repeat) && data.repeat>0)
                  {
                   var repeat=data.repeat;
                   var times=(Tools.isset(data.times)?data.times:0);
                   installInterval('do::'+data.plugin+'::'+data.what,repeat,times,doCommand,this,script,data.what);
                  }
               }
             else
             throw new Error("unknow plugin");
            }
         }
      }
    else
    if(data.command==='set')
      {// => command:'set',  network:<name>, plugin:<name>, what:<name>, value:<value>, ack:true|false
       // <= command:'set',  network:<name>, plugin:<name>, what:<name>,                ack:true|false
       // <= command:'error',network:<name>, who:<hostname>, description:<text>, data:<data>
       //
       if(Tools.isset(network) && peer.address===broker.address && peer.port===broker.port)
         {
         }
      }
    else
    if(data.command==='do')
      {// => command:'do', network:<name>, plugin:<name>, what:<name>, action:<value>, ack:true|false
       // <= command:'do', network:<name>, plugin:<name>, what:<name>,                 ack:true|false
       //
       if(Tools.isset(network) && peer.address===broker.address && peer.port===broker.port)
         {
         }
      }
    ///////////////////////////////////////////////////////////////////////////////////////////////
   }
 catch(err)
   {
    Level5.send(this,peer.address,peer.port, { command:"error", network:conf.network.name, who:Os.hostname(), description:err, data:data });
   }
}

function onListening()
{
 var iamalive=function(server)
     {
      if(Tools.isset(conf.network))
        {
         Level5.send(server, conf.network.broadcast, conf.network.port, { command:"iamalive", network:conf.network.name, who:Os.hostname(), rol:"daemon" });
        }
     }
 
 console.log('Now listening ...');
 this.setBroadcast(true);
 iamalive(this);
 if(Tools.isset(conf.announce) && conf.announce>0)
   {
    installInterval('iamalive',conf.announce,null,iamalive,this);
   }
}

function onClose()
{
 removeInterval('iamalive');
 console.log('Close');
}

function onError(err)
{
 console.err('Error: '+err);
}

if(Tools.isset(conf.port))
  {
   var server=Dgram.createSocket('udp4');
   server.on('message',  onMessage.  bind(server));
   server.on('listening',onListening.bind(server));
   server.on('close',    onClose.    bind(server));
   server.on('error',    onError.    bind(server));
   server.bind(conf.port);
   console.log('Server created');
  }

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

process.on("SIGINT",
           function()
             {
              console.log("Ending ...");
              process.exit(0);
             });
