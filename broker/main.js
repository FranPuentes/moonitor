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
            if(Tools.isset(server))
              {
               server.close();
               console.log("Link closed");
              }
            if(Tools.isset(http))
              {
               http.close();
               console.log("Http closed");
              } 
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

process.title="moonitor::broker";

//TODO: crear el script KILL que mata elegantemente esta instancia

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
        bind:{ address:'127.0.0.1', port:8080 },
        pages:{ static:'web/static', nonstatic:'web/nonstatic' },
       }
    };

if(Fs.existsSync(CONF))
  {
   try
     {
      var tmp=Fs.readFileSync(CONF);
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

function existsKey(table,keys)
{
 for(var i=0; i<table.length; i++)
    {
     var row=table[i];

     var all=true;
     for(var key in keys)
        {
         if(!Tools.isset(row[key]) || row[key]!==keys[key]) { all=false; break; }
        }

     if(all===true) return i;
    }
 return 0;
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
      {// command:'iamalive', network:<name>, who:<hostname>, rol:'daemon'
       //
       if(Tools.isset(network))
         {
          if(data.rol==='daemon')
            {
             if(!existsKey(objects,{type:'host',name:data.who}))
               {
                Level5.send(this,peer.address,peer.port, { command:"ping", network:data.network, rol:"broker", who:Os.hostname() });
               }
             else
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
    else  
    if(data.command==='ping')
      {// command:'ping', network:<name>, rol:'daemon', who:<name>
       //
       if(Tools.isset(network) && rol==='daemon')
         {
          Level5.send(this,peer.address,peer.port, { command:"pong", network:data.network, rol:"broker", who:Os.hostname(), from:data.who });
         }
      }
    else  
    if(data.command==='pong')
      {// command:'pong', network:<name>, rol:'daemon', who:<name>, from:<name===Os.hostname()>
       //
       if(Tools.isset(network) && data.rol==='daemon' && data.from===Os.hostname())
         {
          var nid=insertOrUpdate(objects,{type:'network',name:data.network},{});
          var hid=insertOrUpdate(objects,{type:'host',   name:data.who},    {});
          
          insertOrUpdate(relations,{left:nid,right:hid,type:'contains'},{});
          insertOrUpdate(properties,{object:hid,property:'address'},{value:peer.address});
          insertOrUpdate(properties,{object:hid,property:'port'},{value:peer.port});

          Level5.send(this,peer.address,peer.port, { command:"plugins", network:data.network  });
         }
      }
    else  
    if(data.command==='plugins')
      {// => command:'plugins', network:<name>, who:<hostname>, plugins:[ { name:<string>, description:<text>, delivers:[...] } ... ]
       if(Tools.isset(network))
         {
          var nid=insertOrUpdate(objects,{type:'network',name:data.network},{});
          var hid=insertOrUpdate(objects,{type:'host',   name:data.who},    {});

          insertOrUpdate(relations,{left:nid,right:hid,type:'contains'},{});
          insertOrUpdate(properties,{object:hid,property:'address'},{value:peer.address});
          insertOrUpdate(properties,{object:hid,property:'port'},{value:peer.port});

          for(var i in data.plugins)
             {
              var plugin=data.plugins[i];
              var pid=insertOrUpdate(objects,{type:'plugin',name:plugin.name+'@'+data.who},{});
              insertOrUpdate(relations,{left:hid,right:pid,type:'contains'},{description:plugin.description});
              for(var key in plugin.delivers)
                 {
                  var deliver=plugin.delivers[key];
                  insertOrUpdate(properties,{object:pid,property:key},{deliver:deliver,value:null});
                 }
             }

          //console.log(Util.inspect(data));
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
function webRequest(request,response)
{
 //TODO: mostrar lo que haya ante cualquier petición
}

if(Tools.isset(conf.http))
  {
   var http=require('http').createServer();

   http.on('',function(){});

   http.on('request',webRequest);
   http.on('close',function(){});
   
   http.listen(conf.http.bind.port,conf.http.bind.address);
   console.log("HTTP listen on port "+conf.http.bind.port);
  }

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

