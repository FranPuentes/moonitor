#!/usr/bin/env node
/*************************************************************
  (c) 2012, Francisco Puentes (fran@puentescalvo.com)
*************************************************************/
var Util=require('util');
var Path=require('path');
var Fs  =require('fs');

var NODE=process.argv[0];
var SELF=Path.resolve(process.argv[1]);
var CWD =Path.dirname(SELF);

var Tools=require(Path.join(CWD,'common/tools'));

