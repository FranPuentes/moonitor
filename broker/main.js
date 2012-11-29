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
     announce: 60,
     //networks
     networks:
       [
        { name:'localnet', address:'127.0.0.1', port:1234, peer:{ port:1233, broadcast:'127.255.255.255' } },
       ],
    };

if(Fs.existsSync(Path.join(CWD,'broker.conf.json')))
  {
   try
     {
      var tmp=Fs.readFileSync(Path.join(CWD,'broker.conf.json'));
      var obj=JSON.parse(tmp);
      //TODO: integrar 'obj' en 'conf'
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

/////////////////////////////////////////////////////////// database //////////////////////////////////////////

//TODO: base de datos

/////////////////////////////////////////////////////////// server ////////////////////////////////////////////

function onMessage(msg,peer)
{
 var data=Level5.get(this,peer.address,peer.port,msg);
 if(Tools.isset(data))
   {
    console.log('Message@'+this.network.name+' from '+peer.address+':'+peer.port);
    //TODO: process 'data' :-)
   }
}

function onListening()
{
 var iamalive=function(server)
     {
      Level5.send(server,
                  server.network.peer.broadcast,
                  server.network.peer.port,
                  { command:"iamalive", network:server.network.name, rol:"broker" });
     }

 console.log('Listen@'+this.network.name);
 this.setBroadcast(true);
 iamalive(this);
 if(Tools.isset(this.announce) && this.announce>0)
   {
    this.announceId=setInterval(iamalive,this.announce,this);
   }
}

function onClose()
{
 if(Tools.isset(this.announceId))
   {
    clearInterval(this.announceId);
   } 
 console.log('Close@'+this.network.name);
}

function onError(err)
{
 console.log('Error@'+this.network.name+': '+err);
}

if(Tools.isset(conf.networks))
  {
   for(var i in conf.networks)
      {
       var network=conf.networks[i];
       
       console.log('Setting up '+network.name+' ...');
       var server=Dgram.createSocket('udp4');
       server.announce=conf.announce;
       server.network=network;
       server.on('message',  onMessage.  bind(server));
       server.on('listening',onListening.bind(server));
       server.on('close',    onClose.    bind(server));
       server.on('error',    onError.    bind(server));
       server.sendTo =function(peer,port,data) { Level5.send(server,peer,port,data); }
       server.sendAll=function(     port,data) { Level5.send(server,null,port,data); }
       server.bind(network.port,network.address);
      }
  }

console.log('Servers created');

/////////////////////////////////////////////////////////// web server ////////////////////////////////////////

//TODO: servidor web
