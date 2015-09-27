#!/usr/bin/env node
'use strict';

var config = require('config');
var logger = require('log4js').getLogger();
var express = require('express');
var compression = require('compression');
var bodyParser = require('body-parser');
var _ = require('lodash');
var path = require('path');
var async = require('async');
var fs = require('fs');
var http = require('http');
var mkdirp = require('mkdirp');
var uuid = require('uuid');
var exec = require('child_process').exec;
var app = express();

app.use(compression());
app.use('/', express.static('public', {maxAge: '1d'}));
app.use(config.resultUrlBase, express.static(config.resultDirectory, {maxAge: '1d'}));
app.use(bodyParser.json());

app.get('/api/maps', function(req, res) {
  return res.json({
    maps: config.maps
  });
});
app.post('/api/concat', function(req, res) {
  logger.debug(req.body);
  var map = _.find(config.maps, {key: req.body.map});
  if (!map) {
    return res.json({
      error: {message: 'Invalid map'}
    });
  }
  var z = req.body.z;
  var xMin = req.body.x.min;
  var xMax = req.body.x.max;
  var yMin = req.body.y.min;
  var yMax = req.body.y.max;
  var resultFilename = [
    map.key,
    z,
    xMin, xMax,
    yMin, yMax,
  ].join('_') + '.png';
  var resultUrl = path.join(config.resultUrlBase, resultFilename);
  var resultPath = path.resolve(config.resultDirectory, resultFilename);

  fs.access(resultPath, function (accessErr) {
    async.waterfall(!!accessErr ? [
      function(callback) {
        // Create the all map-tile urls within required extent.
        var x, y;
        var tileImages = [];
        for (x = xMin; x <= xMax; x += 1) {
          for (y = yMin; y <= yMax; y += 1) {
            tileImages.push({
              path: path.resolve(
                config.mapDirectory,
                map.key,
                z.toString(),
                x.toString(),
                y + '.png'),
              url: _.sample(map.urls)
                .replace('{z}', z)
                .replace('{x}', x)
                .replace('{y}', y)
            });
          }
        }
        callback(null, tileImages);
      },
      function(tileImages, callback) {
        async.eachLimit(tileImages, config.downloadParallelLimit, function(img, next) {
          fs.access(img.path, function (accessErr) {
            if (!accessErr) {
              logger.trace('Exists:', img.path);
              return next(null);
            }
            mkdirp(path.dirname(img.path), function(mkdirErr) {
              if (mkdirErr) return next(mkdirErr);
              var request = http.get(img.url, function(response) {
                response.pipe(fs.createWriteStream(img.path));
                logger.debug('Download:', img.url);
                next(null);
              }).on('error', function(getErr) {
                next(getErr);
              });
            });
          });
        }, function(err){
          callback(err);
        });
      },
      function(callback) {
        mkdirp(config.resultDirectory, function(mkdirErr) {
          callback(mkdirErr);
        });
      },
      function(callback) {
        logger.debug('Concating...');
        var cmd = [
          'python',
          'concat-tile-images.py',
          path.resolve(config.mapDirectory, map.key),
          z,
          xMin, xMax,
          yMin, yMax,
          resultPath
        ].join(' ');
        logger.trace('exec:', cmd);
        exec(cmd, function(err, stdout, stderr) {
          callback(err);
        });
      },
    ] : [
      // Exists result path. NOP
    ], function(err) {
      if (err) {
        logger.warn(err);
        return res.status(500).json({
          error: {message: 'Concating failed'}
        });
      }
      logger.info('Concat complete');
      logger.debug(resultUrl);
      return res.json({
        path: resultUrl,
        filename: resultFilename
      });
    });
  });
});

app.listen(config.port, config.host, function() {
  logger.info('Listen %s:%s', config.host, config.port);
});
