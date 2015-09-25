#!/usr/bin/env node
'use strict';

var config = require('config');
var logger = require('log4js').getLogger();
var express = require('express');
var compression = require('compression');
var bodyParser = require('body-parser');
var app = express();

app.use(compression());
app.use('/', express.static('public', {maxAge: '1d'}));
app.use(bodyParser.json());

app.get('/api/maps', function(req, res) {
  return res.json({
    maps: config.maps
  });
});
app.post('/api/concat', function(req, res) {
  logger.debug(req.body);
  return res.json({
  });
});

app.listen(config.port, config.host, function() {
  logger.info('Listen %s:%s', config.host, config.port);
});
