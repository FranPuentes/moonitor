var Util      =require("util");
var Fs        =require("fs");
var Path      =require("path");

var Tools=require(Path.resolve(__dirname,"../common/tools.js"));
/*
function log()
{
 var LOG=Path.resolve(__dirname,"../moon-broker.log");
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
*/
var isspace=function(chr) { return (chr==' ' || chr=='\n' || chr=='\r' || chr=='\t');  }
var isdigit=function(chr) { return (chr>='0' && chr<='9');                             }
var isalpha=function(chr) { return ((chr>='a' && chr<='z') || (chr>='A' && chr<='Z')); }

function initialState(path)
{
      if(Path.extname(path)===".nsp") return 0;  //javascript embedded into alien code
 else if(Path.extname(path)===".njs") return 50; //javascript with embedded alien code
 else if(Path.extname(path)===".js" ) return 50; //javascript with embedded alien code
 else                                 return 0;  //javascript embedded (default)
}

function normalizeString(str)
{
 if(str.indexOf('\n')>=0 && (str[0]==='"' || str[0]==="'"))
   {
    var s=0;
    var r='';
    for(var i=0; i<str.length; i++)
       {
        if(s===0)
          {
           if(!isspace(str[i])) { s=1;i-=1;continue; }
          }
        else
          {
           if(str[i]==='\n') { r+='\\n';s=0; }
           else                r+=str[i];
          }
       }
    return r;
   }
 return str;
}

function Whirler()
{
 var $out='';
 
 var $s    =0;
 var $code ='';
 var $buff ='';
 var $r    =0;
 var $c    =0;
 var $store=false;
 var $pos  =[1,0];

 function $send(chr)
      {
       if($store===false) $out +=chr;
       else               $code+=chr;
      }

 //emit code
 function $emit(code)
      {
       if(code.length>0)
         {
          $send("response.echo([");
          for(var i=0; i<code.length; i++)
             {
              $send(String(code.charCodeAt(i)));
              if((i+1)<code.length) $send(',');
             }
          $send("]);");
          $send(" // "+normalizeString(code.trim())+"\n")
         }
       return '';
      }

 function next(token)
      {
       switch($s)
             {
              //HTML, CSS, ...
              case 0:
                        if(token==='<' ) $s=1;
                   else if(token==='\n') { $code+=token;$code=$emit($code); }
                   else                  $code+=token;
                   break;

              case 1://<
                   if(token==='?') { $buff='';   $s=2;              }
                   else            { $code+='<'; $s=0; next(token); }
                   break;

              case 2://<?
                   if(!isspace(token)) $buff+=token;
                   else
                     {
                           if($buff===''    ) { $code=$emit($code);      $s=50;             }
                      else if($buff==='js'  ) { $code=$emit($code);      $s=50;             }
                      else if($buff==='node') { $code=$emit($code);      $s=50;             }
                      else                    { $code+=("<?"+$buff);     $s=0; next(token); }
                     }
                   break;

              //JAVASCRIPT
              case 50:
                        if(token==='?'         )                                                     $s= 60;
                   else if(token==='/'         )                                                     $s=300;
                   else if(token==='"'         ) { $store=true;$code='';$send(token); $r=51; $c='"'; $s=100; }
                   else if(token==="'"         ) { $store=true;$code='';$send(token); $r=51; $c="'"; $s=100; }
                   else if(isspace(token)      )                                                     $s=200;
                   else                                                 $send(token);
                   break;

              case 51:
                   $store=false;
                   $send(normalizeString($code));
                   $code='';
                   $s=50;
                   next(token);
                   break;

              case 60:
                   if(token==='>') { $send('\n');$s=0;               }
                   else            { $send('?'); $s=50; next(token); }
                   break;

              //CADENAS DE CARACTERES
              //TODO: si la cadena es multilínea eliminar espacios el principio y al final y posiblemente indentando...
              case 100:
                        if(token===$c)   { $send(token); $s=$r;  }
                   else if(token==='\\') { $send('\\' ); $s=101; }
                 //else if(token==='\n') { $send('\\n');         }
                   else if(token==='\r') { $send('\\r');         }
                   else if(token==='\t') { $send('\\t');         }
                   else                    $send(token);
                   break;

              case 101:
                   $send(token);
                   $s=100;
                   break;

              //ESPACIOS EN BLANCO
              case 200://añadiendo un ws
                   if(!isspace(token)) { $send(' '); $s=50; next(token); }
                   break;

              case 201://sin añadir un ws
                   if(!isspace(token)) { $s=50; next(token); }
                   break;

              //COMENTARIOS TODO: o expresiones regulares /.../
              case 300:///
                        if(token==='/')   $s=310;
                   else if(token==='*')   $s=320;
                   else                 { $send('/'); $s=50; next(token); }
                   break;

              //COMENTARIOS de una sóla línea
              case 310:
                   if(token==='\n') $s=350;
                   break;

              //COMENTARIOS multilínea
              case 320:
                   if(token==='*') $s=321;
                   break;

              case 321:
                        if(token==='/') $s=350;
                   else if(token==='*') $s=321;
                   else                 $s=320;
                   break;

              case 350:
                   if(!isspace(token)) { $s=50; next(token); }
                   break;

              default:
                   throw new Error("Internal error: unknow state "+$s);
             }
      }

 this.doit=function(code,opts)
      {
       var tmini=process.hrtime()[1];

       source=opts.source;
       target=opts.target;

       $out='';

       $s=initialState(source);
       $code ='';
       $buff ='';
       $r    =0;
       $c    =0;
       $store=false;
       $pos  =[1,0];

       var rt='';
       rt+="// WHIRLER for node.js\n";
       rt+="// (c) 2012 Francisco Puentes, fran@puentescalvo.com\n";
       rt+="\n";
       rt+="// "+new Date()+"\n";
       rt+="// source:"+source+"\n";
       rt+="// target:"+target+"\n";
       rt+="\n";
       rt+="// Please, don't use inline regexp syntax /.../ for the time being\n";
       rt+="\n";
       for(var i=0; i<code.length; i++)
          {
           var scode=code[i];
           if(scode==='\n') { $pos[1]=0; $pos[0]+=1; }
           else               $pos[1]+=1;
           next(scode);
          }
       $emit($code);
       rt+=$out;
       rt+="\n";
       rt+="//It took "+Math.round(((process.hrtime()[1])-tmini)/1000000.0)+" msecs\n";

       return ($s==0 || $s==1 || $s==2 || $s==50 || $s==200 || $s==201 || $s==310 || $s==350 ? rt : false );
      } 
}

module.exports=
{
 Whirler: Whirler,
}
