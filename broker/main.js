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
        pages:{ static:'web/static', nonstatic:'web/dynamic' },
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
               server.close();
              }
            if(Tools.isset(http))
              {
               log("Closing HTTP link ...");
               http.close();
              } 
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
// graph oriented database
//
// objects::
//   id: { type, name, ... }
//
// relations::
//   id: { type, left, right, ... }
//
//   relations are from the left to the right and with a type
//   left and right are pointers (id) to objects
//

var objects  =[];
var relations=[];

function searchRow(table,keys,from)
{
 for(var i=(Tools.isset(from)?from+1:0); i<table.length; i++)
    {
     var row=table[i];

     var all=true;
     for(var key in keys)
        {
         if(!Tools.isset(row[key]) || row[key]!==keys[key]) { all=false; break; }
        }
        
     if(all===true) return i;
    }
}

function insertRow(table,keys,data)
{
 var id=table.length;
 var row={};
 for(var key in keys) row[key]=keys[key];
 for(var key in data) row[key]=data[key];
 row.updated=new Date();
 //log("INSERT: "+Util.inspect(row,false,1));
 table[id]=row;
 return id;
}

function updateRow(table,keys,data)
{
 var id=searchRow(table,keys);
 
 if(Tools.isset(id))
   {
    var row=table[id];
    for(var key in data) row[key]=data[key];
    row.updated=new Date();
    //log("UPDATE: "+Util.inspect(row,false,1));
    return id;
   }
}

function updateOrInsertRow(table,keys,data)
{
 var id=updateRow(table,keys,data);
 
 if(Tools.isset(id)) return id;
 else                return insertRow(table,keys,data);
}

function retrieveRow(table,id)
{
 return table[id];
}

function retrieveRows(table,keys)
{
 var rows=[];
 
 for(var i=0; i<table.length; i++)
    {
     var row=table[i];

     var all=true;
     for(var key in keys)
        {
         if(!Tools.isset(row[key]) || row[key]!==keys[key]) { all=false; break; }
        }

     if(all===true) rows[i]=row;
    }
    
 return (rows.length>0?rows:null);
}

/////////////////////////////////////////////////////////// network link //////////////////////////////////////

for(var i=0; i<conf.networks.length; i++)
   {
    insertRow(objects,{type:"network",name:conf.networks[i].name},{});
   }

function onMessage(msg,peer)
{
 var data=Level5.get(this,peer.address,peer.port,msg);
 if(Tools.isset(data))
   {
    var nId=updateRow(objects,{type:"network",name:data.network},{});

    //log("BROKER: New message "+Util.inspect(data,false,1,''));
    
    if(data.command==='iamalive')
      {// command:'iamalive', network:<name>, who:<hostname>, rol:'daemon'
       //
       if(Tools.isset(nId) && data.rol==='daemon')
         {
          if(!searchRow(objects,{type:'host',name:data.who}))
            {
             Level5.send(this,peer.address,peer.port, { command:"ping", network:data.network, rol:"broker", who:Os.hostname() });
            }
          else
            {
             var hId=updateRow(objects,{type:'host',name:data.who},{address:peer.address,port:peer.port});
             updateOrInsertRow(relations,{left:nId,right:hId,type:'contains'},{});
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
          var hId=updateOrInsertRow(objects,{type:'host',name:data.who},{address:peer.address,port:peer.port});
          updateOrInsertRow(relations,{left:nId,right:hId,type:'contains'},{});

          Level5.send(this,peer.address,peer.port, { command:"plugins", network:data.network  });
         }
      }
    else  
    if(data.command==='plugins')
      {// => command:'plugins', network:<name>, who:<hostname>, plugins:[ { name:<string>, description:<text>, delivers:[...] } ... ]
       //
       if(Tools.isset(nId))
         {
          var hId=updateOrInsertRow(objects,{type:'host',name:data.who},{address:peer.address,port:peer.port});
          updateOrInsertRow(relations,{left:nId,right:hId,type:'contains'},{});
          
          for(var i in data.plugins)
             {
              var plugin=data.plugins[i];
              var pId=updateOrInsertRow(objects,{type:'plugin',name:plugin.name},{description:plugin.description});
              
              for(var deliver in plugin.delivers)
                 {
                  var options=plugin.delivers[deliver];
                  insertRow(relations,{left:hId,right:pId,type:'deliver'},{name:deliver, options:options});
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
          var hId=searchRow(objects,{type:'host',  name:data.who   });
          var pId=searchRow(objects,{type:'plugin',name:data.plugin});

          if(Tools.isset(hId) && Tools.isset(pId))
            {
             var rId=searchRow(relations,{type:'deliver',left:hId,right:pId,name:data.what});
             if(Tools.isset(rId))
               {
                var row=retrieveRow(relations,rId);
                row.value=data.value;
                row.updated=new Date();
                //log("response GET::"+data.plugin+"@"+data.who+" => "+data.what+" = "+Util.inspect(data.value,false,1));
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
function webRequest(request,response)
{
 var echo=response.write.bind(response);

 response.writeHead(200,{'Content-Type':'text/html'});
 echo("<!DOCTYPE html>");
 echo("<html>");
 echo("<head>");
 echo("<meta charset='utf-8'/>");
 echo("<title></title>");
 echo("</head>");
 echo("<body>");
 echo("  <table>");
 for(var id in objects)
    {
     var object=objects[id];
     
     echo("<tr>");
     echo("<td>");
     echo("<b>"+object.type+"</b>");
     echo("</td>");
     echo("<td colspan='2'>");
     echo("<i>"+object.name+"</i>");
     echo("</td>");
     echo("</tr>");

     for(key in object)
        {
         if(key!=='type' && key!=='name')
           {
            echo("<tr>");
            echo("<td>");
            echo("&nbsp;");
            echo("</td>");
            echo("<td>");
            echo(key);
            echo("</td>");
            echo("<td>");
            echo(Util.inspect(object[key]));
            echo("</td>");
            echo("</tr>");
           }
        }
    }
 echo("  </table>");
 echo("</body>");
 echo("</html>");
 response.end();
}

if(Tools.isset(conf.http) && Tools.isset(conf.http.bind))
  {
   var http=require('http').createServer(webRequest);
   http.on('close',function(){ log("HTTP server closed"); });  
   http.listen(conf.http.bind.port,conf.http.bind.address);
   log("HTTP listen on port "+conf.http.bind.port);
  }

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

