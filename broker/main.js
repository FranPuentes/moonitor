#!/usr/bin/env node
/*************************************************************
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

var Tools =require(Path.join(CWD,'common/tools.js' ));
var Level5=require(Path.join(CWD,'common/level5.js'));

var log=console.log;

//TODO: comprobar si existe un *.pid ejecutándose
//      si es así, abandonar esta instancia

//create a '*.pid' file into CWD, with our PID
Fs.writeFileSync(Path.join(CWD,Path.basename(SELF,Path.extname(SELF))+'.pid'),process.pid,'utf8');
//'ps' will report this name
process.title="moon-broker";

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
    };

if(Fs.existsSync(Path.join(CWD,'broker.conf.json')))
  {
   try
     {
      var tmp=Fs.readFileSync(Path.join(CWD,'broker.conf.json'));
      var conf=JSON.parse(tmp);
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

var objects=[];
var relations=[];
var properties=[];

function insertOrUpdate(table,keys,data)
{
 for(var i=0; i<table.length; i++)
    {
     var row=table[i];
     
     var all=true;
     for(var key in keys)
        {
         if(!Tools.isset(row[key]) || row[key]!==keys[key]) { all=false; break; }
        }
        
     if(all===true)
       {
        for(var key in data) row[key]=data[key];
        row.updated=new Date();
        log("UPDATE: "+Util.inspect(row));
        return i;
       }
    }

 var id=table.length;
 var row={};
 for(var key in keys) row[key]=keys[key];
 for(var key in data) row[key]=data[key];
 row.updated=new Date();
 log("INSERT: "+Util.inspect(row));
 table[id]=row;
 return id;
}

/////////////////////////////////////////////////////////// server ////////////////////////////////////////////

function onMessage(msg,peer)
{
 var data=Level5.get(this,peer.address,peer.port,msg);
 if(Tools.isset(data))
   {
    var network;
    
    if(Tools.isset(data.network))
      {
       for(var i=0; i<conf.networks.length; i++)
          {
           if(data.network === conf.networks[i].name)
             {
              network=conf.networks[i];
              break;
             }
          }
      }
    
    if(data.command==='iamalive')
      {// command:'iamalive', network:<name>, rol:'daemon'
       if(Tools.isset(network))
         {
          if(Tools.isset(data.rol) && data.rol==='daemon')
            {
             Level5.send(this,peer.address,peer.port, { command:"ping", network:data.network, rol:"broker", who:Os.hostname() });
            }
         }
      }
    else  
    if(data.command==='ping')
      {// command:'ping', network:<name>, rol:'daemon', who:<name>
       //
       // recibimos un 'ping' desde 'who' en el papel de 'rol'
       //
       if(Tools.isset(network) && rol==='daemon')
         {
          Level5.send(this,peer.address,peer.port, { command:"pong", network:data.network, rol:'broker', who:Os.hostname(), from:data.who });
         }
      }
    else  
    if(data.command==='pong')
      {// command:'pong', network:<name>, rol:'daemon', who:<name>, from:<name===Os.hostname()>
       //
       // recibimos un 'pong' desde 'who' en el papel de 'rol' y reclamado por 'from'
       //
       if(Tools.isset(network) && data.rol==='daemon' && data.from===Os.hostname())
         {
          var nid=insertOrUpdate(objects,{type:'network',name:data.network},{});
          var hid=insertOrUpdate(objects,{type:'host',   name:data.who},    {});
          
          insertOrUpdate(relations,{left:nid,right:hid,type:'contains'},{});
          insertOrUpdate(properties,{object:hid,property:'address'},{value:peer.address});
          insertOrUpdate(properties,{object:hid,property:'port'},{value:peer.port});
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
             Level5.send(server, network.broadcast, network.port, { command:"iamalive", network:network.name, rol:"broker" });
            }
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

/////////////////////////////////////////////////////////// web server ////////////////////////////////////////

//TODO: servidor web

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

process.on("SIGINT",
           function()
             {
              console.log("Ending ...");
              process.exit(0);
             });
