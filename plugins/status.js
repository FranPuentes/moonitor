var Os=require('os');

function commandGet(what)
{
 switch(what)
       {
        case 'CWD':            return process.cwd();
        case 'Versions':       return process.versions;
        case 'Config':         return process.config;
        case 'PID':            return process.pid;
        case 'Title':          return process.title;
        case 'Architecture':   return process.arch;
        case 'Platform':       return process.platform;
        case 'MemoryUsage':    return process.memoryUsage();
        case 'Uptime':         return process.uptime();
        case 'Hostname':       return Os.hostname();
        case 'Os.Type':        return Os.type();
        case 'Os.Platform':    return Os.platform();
        case 'Os.Architecture':return Os.arch();
        case 'Os.Release':     return Os.release();
        case 'Os.Uptime':      return Os.uptime();
        case 'LoadAvg':        return Os.loadavg();
        case 'TotalMemory':    return Os.totalmem();
        case 'FreeMemory':     return Os.freemem();
        case 'Cpus':           return Os.cpus();
        case 'Interfaces':     return Os.networkInterfaces();
       }
}

module.exports=
       {
        description: "Estado general del sistema",
        delivers: {
                   'CWD':            { static:false, },
                   'Versions':       { static:true,  },
                   'Config':         { static:true,  },
                   'PID':            { static:false, },
                   'Title':          { static:true,  },
                   'Architecture':   { static:true,  },
                   'Platform':       { static:true,  },
                   'MemoryUsage':    { static:false, },
                   'Uptime':         { static:false, },
                   'Hostname':       { static:true,  },
                   'Os.Type':        { static:true,  },
                   'Os.Platform':    { static:true,  },
                   'Os.Architecture':{ static:true,  },
                   'Os.Release':     { static:true,  },
                   'Os.Uptime':      { static:false, },
                   'LoadAvg':        { static:false, },
                   'TotalMemory':    { static:false, },
                   'FreeMemory':     { static:false, },
                   'Cpus':           { static:true,  },
                   'Interfaces':     { static:false, },
                  },

        get: commandGet,
        do:  null,
       }
