
//TODO: crypt the data (ssl)

module.exports=
  {
   send:function(server,peer,port,data)
     {
      try
        {
         var buff=new Buffer(JSON.stringify(data),'utf8');
         server.send(buff,0,buff.length,port,peer);
        }
      catch(err)
        {
         console.log('Error: '+err);
        }
     },
     
   get:function(server,peer,port,data)
     {
      try
        {
         return JSON.parse(data);
        }
      catch(err)
        {
         console.log('Error: '+err);
        }
     }
  }