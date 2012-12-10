var Os=require('os');

function commandGet(what)
{
 switch(what)
       {
        case 'Hostname':       return { what:what, path:"{HOST}::value", value:Os.hostname()          };
        case 'OsType':         return { what:what, path:"{HOST}::value", value:Os.type()              };
        case 'OsPlatform':     return { what:what, path:"{HOST}::value", value:Os.platform()          };
        case 'OsArchitecture': return { what:what, path:"{HOST}::value", value:Os.arch()              };
        case 'OsRelease':      return { what:what, path:"{HOST}::value", value:Os.release()           };
        case 'OsUptime':       return { what:what, path:"{HOST}::value", value:Os.uptime()            };
        case 'LoadAvg':        return { what:what, path:"{HOST}::value", value:Os.loadavg()           };
        case 'TotalMemory':    return { what:what, path:"{HOST}::value", value:Os.totalmem()          };
        case 'FreeMemory':     return { what:what, path:"{HOST}::value", value:Os.freemem()           };
        case 'Cpus':           return { what:what, path:"{HOST}::value", value:Os.cpus()              };
        case 'Interfaces':     return { what:what, path:"{HOST}::value", value:Os.networkInterfaces() };
        
        case 'CWD':            return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.cwd()         };
        case 'Versions':       return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.versions      };
        case 'Config':         return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.config        };
        case 'PID':            return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.pid           };
        case 'Title':          return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.title         };
        case 'Architecture':   return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.arch          };
        case 'Platform':       return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.platform      };
        case 'MemoryUsage':    return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.memoryUsage() };
        case 'Uptime':         return { what:what, path:"{HOST}::['monitorized',{'process','moon-daemon'}]::value", value:process.uptime()      };
       }
}

/*********************************************************************************
 EXPORTS:

  description : text
  delivers    : list of pairs {key, values} with:
                - key:    name on the data that the plugin delivers
                - values: attributes:
                          - static: true if data can change,false if doesn't

*********************************************************************************/
module.exports=
       {
        description: "Estado general del sistema",
        delivers: {
                   'Hostname':       { static:true,  },
                   'OsType':         { static:true,  },
                   'OsPlatform':     { static:true,  },
                   'OsArchitecture': { static:true,  },
                   'OsRelease':      { static:true,  },
                   'OsUptime':       { static:false, },
                   'LoadAvg':        { static:false, },
                   'TotalMemory':    { static:false, },
                   'FreeMemory':     { static:false, },
                   'Cpus':           { static:true,  },
                   'Interfaces':     { static:false, },
                   'CWD':            { static:false, },
                   'Versions':       { static:true,  },
                   'Config':         { static:true,  },
                   'PID':            { static:false, },
                   'Title':          { static:true,  },
                   'Architecture':   { static:true,  },
                   'Platform':       { static:true,  },
                   'Uptime':         { static:false, },
                   'MemoryUsage':    { static:false, },
                  },

        get: commandGet,
        set: null,
        do:  null,
       }
