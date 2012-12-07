var Os=require('os');

function commandGet(what)
{
 switch(what)
       {
        case 'Hostname':       return Os.hostname();
        case 'OsType':         return Os.type();
        case 'OsPlatform':     return Os.platform();
        case 'OsArchitecture': return Os.arch();
        case 'OsRelease':      return Os.release();
        case 'OsUptime':       return Os.uptime();
        case 'LoadAvg':        return Os.loadavg();
        case 'TotalMemory':    return Os.totalmem();
        case 'FreeMemory':     return Os.freemem();
        case 'Cpus':           return Os.cpus();
        case 'Interfaces':     return Os.networkInterfaces();
        
        case 'CWD':            return process.cwd();
        case 'Versions':       return process.versions;
        case 'Config':         return process.config;
        case 'PID':            return process.pid;
        case 'Title':          return process.title;
        case 'Architecture':   return process.arch;
        case 'Platform':       return process.platform;
        case 'MemoryUsage':    return process.memoryUsage();
        case 'Uptime':         return process.uptime();
       }
}

////////////////////////////////////////////////////////////////////////////////
// EXPORTS:
//
//    description : text
//    delivers    : list of pairs {key, values} with:
//                  - key:    name on the data that the plugin delivers
//                  - values: attributes:
//                            - static: true if data can change,false if doesn't
//                            - schema: string/path that describes the data in relation with other data
//
//                                      PATH     ::= <item> | <item> . <PATH>
//                                      item     ::= <object> | <relation> | <leaf>
//                                      object   ::= { <UpperCaseWord> } | { <key> } | { <key> :: <key> }
//                                      key      ::= <LowerCaseWord> | 'string'
//                                      relation ::= [ <key> ] | [ <key> :: { <key> } ] | [ <key> :: { <key> :: <key> } ]
//                                      leaf     ::= * | <LowerCaseWord> | <list>
//                                      list     ::= <LowerCaseWord> | <LowerCaseWord> , <list>
//
//                                      {NETWORK}  - current network
//                                      {HOST}     - current host
//
//                                      EXAMPLES:
//                                        {HOST}.* => *
//                                        {host}.value => { host:'xxx', value:'yyy' }
//                                        {host}.['login'::{user}].name => { host:'xxx', user:'uuu', name:'yyy' }
//                                        {user}.['execute'::{process}].name,command,pid => { user:'uuu', process,'ppp', name:'ddd', command:'ddd', pid:'ddd' }
//
module.exports=
       {
        description: "Estado general del sistema",
        delivers: {
                   'Hostname':       { static:true,  schema:"{HOST}.*", },
                   'OsType':         { static:true,  schema:"{HOST}.*", },
                   'OsPlatform':     { static:true,  schema:"{HOST}.*", },
                   'OsArchitecture': { static:true,  schema:"{HOST}.*", },
                   'OsRelease':      { static:true,  schema:"{HOST}.*", },
                   'OsUptime':       { static:false, schema:"{HOST}.*", },
                   'LoadAvg':        { static:false, schema:"{HOST}.*", },
                   'TotalMemory':    { static:false, schema:"{HOST}.*", },
                   'FreeMemory':     { static:false, schema:"{HOST}.*", },
                   'Cpus':           { static:true,  schema:"{HOST}.*", },
                   'Interfaces':     { static:false, schema:"{HOST}.*", },
                   'CWD':            { static:false, schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'Versions':       { static:true,  schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'Config':         { static:true,  schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'PID':            { static:false, schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'Title':          { static:true,  schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'Architecture':   { static:true,  schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'Platform':       { static:true,  schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'MemoryUsage':    { static:false, schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                   'Uptime':         { static:false, schema:"{HOST}.['executing'::{'process'::'moon-daemon'}].*", },
                  },

        get: commandGet,
        do:  null,
       }
