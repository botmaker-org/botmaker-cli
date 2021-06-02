#!/usr/bin/env node

var main = require('../src/index.js');
// Delete the 0 and 1 argument (node and script.js)
var args = process.argv.splice(process.execArgv.length + 2);

main(args)