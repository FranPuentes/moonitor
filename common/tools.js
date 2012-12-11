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

//Array: remove duplicates (works with integers and strings)
function listDedup(list)
{
 var result = [];
 var object = {};
 list.forEach(function(item) { object[item] = null; });
 result = Object.keys(object);
 return result;
}

///////////////////////////////////////////////////////////
var intervals={};

function removeAllIntervals()
{
 for(var key in intervals)
    {
     var iid=intervals[key];
     if((typeof iid)!=='undefined' && iid!==null)
       {
        clearInterval(iid);
        delete intervals[key];
       }
    }
}

function removeInterval(key)
{
 var iid=intervals[key];
 if((typeof iid)!=='undefined' && iid!==null)
   {
    clearInterval(iid);
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

/// exports ///////////////////////////////////////////////////////////////////////////////////////////////////

module.exports=
  {
   isset:function(v)
     {
      return ((typeof v)!=='undefined' && v!==null);
     },

   isnset:function(v)
     {
      return ((typeof v)==='undefined' || v===null);
     },

   printUsageAndExit: printUsageAndExit,
   existsOldInstance: existsOldInstance,
   killOldInstance:   killOldInstance,
   
   listDedup:         listDedup,

   removeAllIntervals:removeAllIntervals,
   removeInterval:    removeInterval,
   installInterval:   installInterval,
   
  }
  
  
  
