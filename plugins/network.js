var Os=require('os');

function retrieveDevices()
{
 var r={};
 var proc='/proc/net/dev';
 var lines=Fs.readFileSync(proc).split('\n');
 
 for(var i=2; i<lines.length; i++)
    {
     var line=lines[i];
     var tmp=line.split(':');
     var par=tmp[1];
     r[tmp[0].trim()]=par.trim();
    }
 return r;   
}


function commandGet(what)
{
 switch(what)
       {
        case 'Interfaces':  return { what:what, path:"{HOST}::value", value:Os.networkInterfaces() };
        case 'Devices':     return { what:what, path:"{HOST}::value", value:retrieveDevices() };
       }
}

module.exports=
       {
        description: "Subsistema de red",
        delivers: {
                   'Interfaces': { static:false, updates:{ update:[1*60,2*60], times:0 }, },
                   'Devices':    { static:false, updates:{ update:[1*60,2*60], times:0 }, },
                  },

        get: commandGet,
        set: null,
        do:  null,
       }

