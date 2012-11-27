#!/usr/bin/env node
/*************************************************************
  (c) 2012, Francisco Puentes (fran@puentescalvo.com)
*************************************************************/
var Util =require('util');
var Path =require('path');
var Fs   =require('fs');
vr  Dgram=require('dgram');

var NODE=process.argv[0];
var SELF=Path.resolve(process.argv[1]);
var CWD =Path.dirname(SELF);

var Tools =require(Path.join(CWD,'common/tools' ));
var Level5=require(Path.join(CWD,'common/level5'));

var conf=
    {
     announce: 60,
     networks:
       [
        { name:'localnet', address:'127.0.0.1', port:1234, peer:{ port:1233, broadcast:'127.255.255.255' } },
       ],
    };

//TODO: leer configuración de 'broker.conf.json'

//TODO: procesar argumentos

function onMessage(msg,peer)
{
 var data=Level5.get(this,peer.address,peer.port,msg);
 if(Tools.isset(data))
   {
    console.log('Message@'+this.network.name);
    //TODO: process 'data' :-)
   }
}

function onListening()
{
 this.setBroadcast(true);
 console.log('Listen@'+this.network.name);
}

function onClose()
{
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
       
       var server=Dgram.createSocket('udp4');
       server.announce=conf.announce;
       server.network=network;
       server.on('message', onMessage.  bind(server));
       server.on('listeing',onListening.bind(server));
       server.on('close',   onClose.    bind(server));
       server.on('error',   onError.    bind(server));
       server.sendTo =function(peer,port,data) { Level5.send(server,peer,port,data); }
       server.sendAll=function(     port,data) { Level5.send(server,null,port,data); }
       server.bind(network.port,network.address);
      }
  }

/////////////////////////////////////////////////////////// database //////////////////////////////////////////
//TODO: base de datos

/////////////////////////////////////////////////////////// web server ////////////////////////////////////////
//TODO: servidor web
