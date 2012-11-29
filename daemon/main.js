#!/usr/bin/env node
/*************************************************************
  (c) 2012, Francisco Puentes (fran@puentescalvo.com)
*************************************************************/
var Util =require('util');
var Path =require('path');
var Fs   =require('fs');
var Dgram=require('dgram');

var NODE=process.argv[0];
var SELF=Path.resolve(process.argv[1]);
var CWD =Path.dirname(SELF);

var Tools =require(Path.join(CWD,'common/tools.js' ));
var Level5=require(Path.join(CWD,'common/level5.js'));

var conf=
    {
     //send 'iamalive' each 'announce' seconds (0 - disable)
     announce: 10,
     //bind to this port
     port:     1233,
     //network
     network:  { name:'localnet', port:1234, broadcast:'127.255.255.255' },
     //plugins 
     plugins:  'plugins',
    };

if(Fs.existsSync(Path.join(CWD,'daemon.conf.json')))
  {
   try
     {
      var tmp=Fs.readFileSync(Path.join(CWD,'daemon.conf.json'));
      conf=JSON.parse(tmp);
     }
   catch(err)  
     {
      console.log("Error: "+err);
      process.exit(1);
     }
  }

for(var i=2; i<process.argv.length; i++)
   {
    var arg=process.argv[i];
    //TODO: procesar argumentos
   }

/////////////////////////////////////////////////////////// plugins ///////////////////////////////////////////

var PLUGINS=Path.resolve.(CWD,conf.plugins);
var plugins={};

if(Fs.existsSync(PLUGINS))
  {
   var list=Fs.readdirSync(PLUGINS);
   for(var i in list)
      {
       var entry=list[i];
       var stat=Fs.statSync(entry);
       if(stat.isFile())
         {
         }
       else
       if(stat.isDirectory())
         {
         }
      }
  }

/////////////////////////////////////////////////////////// server ////////////////////////////////////////////

function onMessage(msg,peer)
{
 var data=Level5.get(this,peer.address,peer.port,msg);
 if(Tools.isset(data))
   {
    console.log('Message from '+peer.address+':'+peer.port);
    //TODO: process 'data' :-)
   }
}

function onListening()
{
 var iamalive=function(server)
     {
      if(Tools.isset(conf.network))
        {
         Level5.send(server, conf.network.broadcast, conf.network.port, { command:"iamalive", network:conf.network.name, rol:"daemon" });
        }
     }
 
 console.log('Now listening ...');
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
 console.log('Close');
}

function onError(err)
{
 console.log('Error: '+err);
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
