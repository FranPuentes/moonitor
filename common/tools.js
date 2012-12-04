var Fs  =require("fs");
var Path=require("path");

function printUsageAndExit(code)
{
 var log=(code===0?(console.log):(console.error));
 log("USAGE: "+Path.basename(process.argv[0])+" "+Path.basename(process.argv[1])+" [help|stop|status|start [options]]");
 log("       options:");
 log("         --nolog          disabled log");
 log("         --conf <file>    takes <file> into account");
 process.exit(code);
}
   
function existsOldInstance(lockfile)
{   
 try
   {
    var oldPid=parseInt(Fs.readFileSync(lockfile),10);
    process.kill(oldPid,'SIGUSR2');
    return oldPid;
   }
 catch(err)
   {
   }
 return 0;
}

function killOldInstance(lockfile)
{
 try
   {
    var oldPid=parseInt(Fs.readFileSync(lockfile),10);
    process.kill(oldPid,'SIGINT');
    return oldPid;
   }
 catch(err)
   {
   }
 return 0;
}

/// exports ///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports=
  {
   isset:function(v)
     {
      return ((typeof v)!=='undefined' && v!==null);
     },

   printUsageAndExit: printUsageAndExit,
   existsOldInstance: existsOldInstance,
   killOldInstance:   killOldInstance,
  }
  
  
  
