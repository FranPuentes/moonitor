/**************************************************************************************************************
  graph oriented database

  objects::
    id: { type, name, ... }

  relations::
    id: { type, left, right, ... }

    relations are from the left to the right and with a type
    left and right are pointers (id) to objects
**************************************************************************************************************/
var Path= require("path");
var Tools=require(Path.resolve(__dirname,"../common/tools.js"));

var objects  =[];
var relations=[];

function searchRow(table,keys,from)
{
 for(var i=(Tools.isset(from)?from+1:0); i<table.length; i++)
    {
     var row=table[i];

     var all=true;
     for(var key in keys)
        {
         if(!Tools.isset(row[key]) || row[key]!==keys[key]) { all=false; break; }
        }

     if(all===true) return i;
    }
}

function insertRow(table,keys,data)
{
 var id=table.length;
 var row={};
 for(var key in keys) row[key]=keys[key];
 for(var key in data) row[key]=data[key];
 row.updated=new Date();
 //log("INSERT: "+Util.inspect(row,false,1));
 table[id]=row;
 return id;
}

function updateRow(table,keys,data)
{
 var id=searchRow(table,keys);

 if(Tools.isset(id))
   {
    var row=table[id];
    for(var key in data) row[key]=data[key];
    row.updated=new Date();
    //log("UPDATE: "+Util.inspect(row,false,1));
    return id;
   }
}

function updateOrInsertRow(table,keys,data)
{
 var id=updateRow(table,keys,data);

 if(Tools.isset(id)) return id;
 else                return insertRow(table,keys,data);
}

function retrieveRow(table,id)
{
 return table[id];
}

function retrieveRows(table,keys,allowNulls)
{
 var rows=[];

 for(var i=0; i<table.length; i++)
    {
     var row=table[i];

     var all=true;
     for(var key in keys)
        {
         if(Tools.isnset(allowNulls) || allowNulls===false)
           {
            if(!Tools.isset(row[key]) || row[key]!==keys[key]) { all=false; break; }
           }
         else
           {
            if(keys[key]!==null && keys[key]===null || (!Tools.isset(row[key]) || row[key]!==keys[key])) { all=false; break; }
           }
        }

     if(all===true) rows[i]=row;
    }

 return rows;
}

function retrieveIDs(table,keys,allowNulls)
{
 var ids=[];

 for(var i=0; i<table.length; i++)
    {
     var row=table[i];

     var all=true;
     for(var key in keys)
        {
         if(Tools.isnset(allowNulls) || allowNulls===false)
           {
            if(!Tools.isset(row[key]) || row[key]!==keys[key]) { all=false; break; }
           }
         else
           {
            if(keys[key]!==null && keys[key]===null || (!Tools.isset(row[key]) || row[key]!==keys[key])) { all=false; break; }
           }
        }

     if(all===true) ids.push(i);
    }

 return ids;
}

module.exports=
       {
        objects:           objects,
        relations:         relations,
        searchRow:         searchRow,
        insertRow:         insertRow,
        updateRow:         updateRow,
        updateOrInsertRow: updateOrInsertRow,
        retrieveRow:       retrieveRow,
        retrieveRows:      retrieveRows,
        retrieveIDs:       retrieveIDs,
       };
