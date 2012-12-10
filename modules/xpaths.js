/***************************************************************************************************************************

  PATH     ::= <item> | <item> :: <PATH>
  item     ::= <object> | <relation> | <leaf>
  object   ::= { <UpperCaseWord> } | { <key> } | { <key> , <key> }
  key      ::= <LowerCaseWord> | 'string'
  relation ::= [ <key> ] | [ <key> :: { <key> } ] | [ <key> :: { <key> :: <key> } ]
  leaf     ::= <LowerCaseWord> | <LowerCaseWord> , <leftt>
 
  ::              separador (no usar en el resto del path!)
  
  {HOST}          Objeto (host actual), debe existir, equivale al OID del objeto
  
  {NETWORK}       Objeto (red actual), debe existir, equivale al OID del objeto
  
  {PLUGIN}        Objeto (plugin actual), debe existir, equivale al OID del objeto
  
  {xxx,*}         Objetos, xxx es o un identificador o una cadena entre ''
                  equivale a la lista de OIDs de los objetos con type=xxx
                  debe haber al menos uno

  {*,yyy}         Objetos, yyy es o un identificador o una cadena entre ''
                  equivale a la lista de OIDs de los objetos con name=yyy
                  debe haber al menos uno

  {xxx,yyy}       Objeto, xxx e yyy son o identificadores o cadenas entre ''
                  equivale al OID del objeto con type=xxx y name=yyy
                  si no existe se crea
                  
  [rrr]           Relación del tipo rrr (identificador o cadena)
                  debe existir al menos una relación con ese tipo
                  devuelve un conjunto de RID
  
  [rrr,{object}]  Relación del tipo rrr con -left- apuntando a los objetos indicados
                  la relación podría crearse si no existe (mira lo siguiente)
                  el objeto -left- podría crearse si es del tipo {xxx,yyy}
                  devuelve una lista de RID
                  
  ccc             identificador o lista de identificadores separados por ','


  {xxx,*}::[rrr]  obtiene una lista de objetos con type=xxx
                  para cada uno de esos objetos (ooo) se seleccionan las relaciones que tengan como right=ooo y type=rrr
                  devuelve una lista de esas relaciones
                  todo debe existir

  {xxx,*}::[rrr,{ttt,nnn}] obtiene una lista de objetos con type=xxx
                           para cada uno de esos objetos (ooo) se seleccionan las relaciones que tangas a right=ooo y type=rrr y left sea el objeto {ttt,nnn}
                           devuelve una lista de esas relaciones
                           debe existir todo excepto {ttt,nnn} que podría ser creado al vuelo
                           
  {xxx,*}::[rrr]:{ttt,nnn} obtiene una lista de objetos con type=xxx
                           para cada uno de esos objetos (ooo) se seleccionan las relaciones que tangas a right=ooo y type=rrr
                           para cada una de esas relaciones se escoge aquellas que apunten a {ttt,nnn}
                           devuelve una lista de objetos (con uno solo)
                           debe existir todo
    
***************************************************************************************************************************/
var Util= require("util");
var Fs=   require("fs");
var Path= require("path");
var Godb= require("./godb.js");
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

function resolveIdent(ident,data)
{
 if(ident==="*")
   {
    return null;
   }
 else  
 if(ident[0]==="'" && ident[ident.length-1]==="'")
   {
    return ident.substr(1,ident.length-2);
   }
 else
 if(ident[0]==='"' && ident[ident.length-1]==='"')
   {
    return ident.substr(1,ident.length-2);
   }
 else
   {
    if(ident in data)
      {
       return data[ident];
      }
    else
    throw new Error("Unable to find '"+ident+"' indentifier");
   }
}

function getOrCreateObject(objects,item,data)
{
 if(item[0]==='{' && item[item.length-1]==='}')
   {
    item=item.substr(1,item.length-2).trim();

    if(item.indexOf(',')>=0)
      {
       var tmp=item.split(',');
       if(tmp.length===2)
         {
          var type=resolveIdent(tmp[0].trim(),data);
          var name=resolveIdent(tmp[1].trim(),data);

          var rows=Godb.retrieveRows(objects,{type:type,name:name},true);
          
          if(rows.length>0) return Object.keys(rows);
          else
            {
             if(type!==null && name!==null)
               {
                var oid=Godb.insertRow(objects,{type:type,name:name},{});
                return [oid];
               }
             else
             return [];
            } 
         }
       else
       throw new error("Invalid object reference length: {"+item+"}");
      }
    else  
    throw new error("Wrong object reference format: {"+item+"}");
   }
 else
 throw new error("Invalid object reference format: "+item);
}

function resolveItem(t,predefs,objects,relations,item,data,pre)
{
 //log("  "+(t===1?"relations":"objects"));
 //log("  PRE = "+Util.inspect(pre));
 
 if(item[0]==='{' && item[item.length-1]==='}')
   {// {PREDEF}, {*,yyy}, {xxx,*}, {xxx,yyy}
    item=item.substr(1,item.length-2);
    
    if(item.indexOf(',')>=0)
      {// *,yyy, xxx,*, xxx,yyy
       var type=resolveIdent(item.slice(0,item.indexOf(',')).trim(),data);
       var name=resolveIdent(item.slice(  item.indexOf(',')+1).trim(),data);
       
       if(pre.length===0)
         {
          pre=Godb.retrieveIDs(objects,{type:type, name:name},true);
         }
       else
         {
          var r=[];
          var rows=Godb.retrieveRows(objects,{type:type, name:name},true);
          for(var i in pre)
             {
              var rid=pre[i];
              if(Tools.isset(rid))
                {
                 var row=Godb.retrieveRow(relations,rid);
                 if(Tools.isset(row))
                   {
                    if(row.right in rows)
                      {
                       r.push(row.right);
                      }
                   }
                 else
                 throw new Error("Unable to find relations::"+rid+" id");
                }
             }
          pre=Tools.listDedup(r);
         }
      }
    else
      {// PREDEF
       if(Tools.isset(predefs[item]))
         {
          if(pre.length===0)
            {
             pre.push(predefs[item]);
            }
          else
            {
             var r=[];
             for(var i in pre)
                {
                 var rid=pre[i];
                 if(Tools.isset(rid))
                   {
                    var row=Godb.retrieveRow(relations,rid);
                    if(Tools.isset(row))
                      {
                       if(row.right===predefs[item])
                         {
                          r.push(predefs[item]);
                         }
                      }
                    else
                    throw new Error("Unable to find relations::"+rid+" id");
                   }
                }
             pre=Tools.listDedup(r);   
            }
         }
       else
       throw new Error("Invalid PREDEFINED object '"+item+"'");
      }
   }
 else  
 if(item[0]==='[' && item[item.length-1]===']')
   {//[rrr], [rrr,{OBJECT}]
    item=item.substr(1,item.length-2);

    var rows;
    if(item.indexOf(','))
      {//rrr,{OBJECT}
       var type =resolveIdent(item.slice(0,item.indexOf(',')).trim(),data);
       var right=getOrCreateObject(objects,item.slice(item.indexOf(',')+1).trim(),data);

       if(Tools.isset(right))
         {
          if((right instanceof Array))
            {
             if(right.length>0)
               {
                rows=[];
                for(var i in right)
                   {
                    var oid=right[i];
                    for(var i in pre)
                       {
                        Godb.updateOrInsertRow(relations,{left:pre[i],type:type,right:oid},{});
                       }
                    rows=rows.concat(Godb.retrieveRows(relations,{type:type,right:oid}));
                   }
               }
             else  
             throw new Error("Unable to find objects like: "+tmp[1].trim());
            }
          else  
          throw new Error("Internal error looking for this object: "+tmp[1].trim());
         }
       else
       throw new Error("Unable to find object: "+tmp[1].trim());
      }
    else
      {//rrr
       var type=item.trim();
       rows=Godb.retrieveRows(relations,{type:type});
      }

    var r=[];
    for(var i in rows)
       {
        var row=rows[i];
        if(Tools.isset(row))
          {
           var left=row.left;
           if(pre.indexOf(left)>=0)
             {
              r.push(i);
             }
          }
        else
        throw new Error("Unable to find relations::"+rid+" id");
       }
    pre=Tools.listDedup(r);
   }
 else
   {//identifier or list of identifiers
    var fields=[];
    
    if(item.indexOf(',')>=0) fields=item.split(',');
    else                     fields.push(item);

    for(var i in fields)
       {
        var field=fields[i];
        if(field in data)
          {
           var value=data[field];
           for(var j in pre)
              {
               var row=Godb.retrieveRow((t===1?objects:relations),pre[j]);
               if(Tools.isset(row))
                 {
                  if(Tools.isset(data.what)) row[data.what]=value;
                   else                      row[field]=value;
                  //log("  @"+pre[j]+": "+field+"="+Util.inspect(value));
                 }
               else
               throw new Error("Unable to find row '"+pre[j]+"' in "+(t===1?"objects":"relations"));
              }
          }
        else
        throw new Error("Invalid field reference '"+field+"' in data");
       }
   }
   
 //log("  POST = "+Util.inspect(pre));
 return pre;
}

function resolve(predefs,objects,relations,xpath,data)
{
 var r=true;
 if((typeof xpath)==='string')
   {
    if(Tools.isnset(objects) || Tools.isnset(relations)) throw new Exception("Invalid arguments: objects, relations");

    var items=xpath.split("::");
    var pre=[];
    //log("--- xpath ---------------------------------------------------");
    var c=0;
    for(var i in items)
       {
        var item=items[i].trim();

        //log(item);

        pre=resolveItem(c%2,predefs,objects,relations,item,data,pre);
        
             if((pre instanceof Boolean) && pre===false   ) { r=false; break; }
        else if((pre instanceof Array  ) && pre.length===0) { r=false; break; }

        c+=1;
       }
    //log("-------------------------------------------------------------");
   }
 else
 throw new Error("Invalid xpath type");
}

module.exports=
       {
        resolve:resolve,
       };
