var Util      =require("util");
var Fs        =require("fs");
var Path      =require("path");

var Tools=require(Path.resolve(__dirname,"../common/tools.js"));

function $initialState(path)
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
           if(!Tools.isspace(str[i])) { s=1;i-=1;continue; }
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
 var source=null;
 var target=null;

 var $out='';
 
 var $s    =0;
 var $code ='';
 var $buff ='';
 var $r    =0;
 var $c    =0;
 var $store=false;
 var $pos  =[1,0];

 var $langs={};//lista de cadenas registradas
 var $langc=0; //contador de cadenas anónimas

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
          $send("__ECHO([");
          for(var i=0; i<code.length; i++)
             {
              $send(String(code.charCodeAt(i)));
              if((i+1)<code.length) $send(',');
             }
          $send("]);");
         }
       return '';
      }

 function next(token)
      {
       switch($s)
             {
              //HTML, CSS, ...
              case 0:
                   if(token==='<') $s=1;
                   else            $code+=token;
                   break;

              case 1://<
                   if(token==='?') { $buff='';   $s=2;              }
                   else            { $code+='<'; $s=0; next(token); }
                   break;

              case 2://<?
                   if(!Tools.isspace(token)) $buff+=token;
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
                   else if(token==='@'         )                                                     $s=500;
                   else if(token==='"'         ) { $store=true;$code='';$send(token); $r=51; $c='"'; $s=100; }
                   else if(token==="'"         ) { $store=true;$code='';$send(token); $r=51; $c="'"; $s=100; }
                   else if(Tools.isspace(token))                                                     $s=200;
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
                   if(token==='>')               $s=0;
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
                   if(!Tools.isspace(token)) { $send(' '); $s=50; next(token); }
                   break;

              case 201://sin añadir un ws
                   if(!Tools.isspace(token)) { $s=50; next(token); }
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
                   if(!Tools.isspace(token)) { $s=50; next(token); }
                   break;

              //@ ...
              case 500:
                        if(token===':'         ) { $buff='';   $s=502; }
                   else if(token==='_'         ) { $buff=token;$s=501; }
                   else if(token==='$'         ) { $buff=token;$s=501; }
                   else if(Tools.isalpha(token)) { $buff=token;$s=501; }
                   else                            throw new Error("Syntax error: illegal character '@'");
                   break;

              case 501:
                        if(token===':'         ) { $s=502;       }
                   else if(token==='_'         ) { $buff+=token; }
                   else if(token==='$'         ) { $buff+=token; }
                   else if(Tools.isalpha(token)) { $buff+=token; }
                   else if(Tools.isdigit(token)) { $buff+=token; }
                   else                            throw new Error("Syntax error: illegal identifier after '@'");
                   break;

              case 502:
                        if(token==='"') { $store=true;$code='';$send(token);$c='"'; $r=510; $s=100; }
                   else if(token==="'") { $store=true;$code='';$send(token);$c="'"; $r=510; $s=100; }
                   else                 throw new Error("Syntax error: illegal characters after '@"+$buff+":'");
                   break;

              case 510:
                   var key=null;
                   if($buff==='') { key="ID$"+$langc;$langc+=1; }
                   else             key=$buff;
                   $langs[key]=Tools.unquoteString(normalizeString($code));
                   $store=false;
                   $send("__SLID('"+key+"')");
                   $buff='';
                   $code='';
                   $s=50;
                   next(token);
                   break;
              default:
                   throw new Error("Internal error: unknow state "+$s);
             }
      }

 this.langs=function()
      {
       return $langs;
      }
 
 this.doit=function(code,opts)
      {
       var tmini=process.hrtime()[1];

       source=opts.source;
       target=opts.target;

       $out='';

       $s=$initialState(source);
       $code ='';
       $buff ='';
       $r    =0;
       $c    =0;
       $store=false;
       $pos  =[1,0];

       $langs={};//lista de cadenas registradas
       $langc=0; //contador de cadenas anónimas
       
       var rt='';
       rt+="// WHIRLER for node.js\n";
       rt+="// (c) 2012 Francisco Puentes, fran@puentescalvo.com\n";
       rt+="\n";
       rt+="// "+new Date()+"\n";
       rt+="// source:"+source+"\n";
       rt+="// target:"+target+"\n";
       rt+="\n";
       rt+="// Please, don't use inline regexp syntax /.../ (to do)'\n";
       rt+="\n";
       rt+="var __ECHO=$script.echo;\n";
       rt+="var __SLID=$script.language.$;\n";
       for(var i=0; i<code.length; i++)
          {
           //var ncode=code[i];
           var scode=String.fromCharCode(code[i]);
           if(scode==='\n') { $pos[1]=0; $pos[0]+=1; }
           else               $pos[1]+=1;
           //log("$s="+$s+" token="+(ncode<32?ncode:"'"+String.fromCharCode(ncode)+"'"));
           next(scode);
          }
       $emit($code);
       rt+=$out;
       rt+="\n";
       rt+="//It took "+Math.round(((process.hrtime()[1])-tmini)/1000000.0)+" msecs\n";

       //log("Whirler: Final state="+$s);
       return ($s==0 || $s==1 || $s==2 || $s==50 || $s==200 || $s==201 || $s==310 || $s==350 ? rt : false );
      } 
}

module.exports=
{
 Whirler: Whirler,
}
