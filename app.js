#!/usr/bin/env node

var config = require('config');
var logger = require('log4js').getLogger();
var express = require('express');
var compression = require('compression')
var app = express();

app.use(compression());
app.use('/', express.static('public', {maxAge: '1d'}));

app.listen(config.port, config.host, function() {
  logger.info('Listen %s:%s', config.host, config.port);
});
