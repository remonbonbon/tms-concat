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
app.use(bodyParser.json());

app.get('/api/maps', function(req, res) {
  return res.json({
    maps: _.map(config.maps, function(m) {
      return {
        name: m.name,
        urls: m.urls
      };
    })
  });
});
app.post('/api/concat', function(req, res) {
  logger.debug(req.body);
  var map = _.find(config.maps, {name: req.body.map});
  if (!map) {
    return res.json({
      error: {message: 'Invalid map name'}
    });
  }

  // Create the all map-tile urls within required extent.
  var z = req.body.z;
  var x, y;
  var tileImages = [];
  for (x = req.body.x.min; x <= req.body.x.max; x += 1) {
    for (y = req.body.y.min; y <= req.body.y.max; y += 1) {
      tileImages.push({
        path: path.resolve(
          config.mapDirectory,
          map.directory,
          z.toString(),
          x.toString(),
          -y + '.png'),
        url: _.sample(map.urls)
          .replace('{z}', z)
          .replace('{x}', x)
          .replace('{y}', -y)
      });
    }
  }
  async.eachLimit(tileImages, config.downloadParallelLimit, function(img, next) {
    fs.exists(img.path, function (exists) {
      if (exists) {
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
    if (err) {
      logger.warn(err);
      return res.json({
        error: {message: 'Download failed'}
      });
    }
    else {
      logger.info('Download complete');
      var yMin = -req.body.y.min;
      var yMax = -req.body.y.max;
      if (yMax < yMin) {
        yMin = -req.body.y.max;
        yMax = -req.body.y.min;
      }
      var resultFilename = uuid.v4() + '.png';
      var resultUrl = path.join(config.resultUrlBase, resultFilename);
      var resultPath = path.resolve(path.join('./public', resultUrl));
      var cmd = [
        'python',
        'concat-tile-images.py',
        path.resolve(config.mapDirectory, map.directory),
        z,
        req.body.x.min, req.body.x.max,
        yMin, yMax,
        resultPath
      ].join(' ');
      logger.debug('Concating...');
      exec(cmd, function(err, stdout, stderr) {
        if (err) {
          logger.warn(err);
          return res.json({
            error: {message: 'Download failed'}
          });
        }
        logger.info('Concat complete');
        logger.debug(resultUrl);
        return res.json({
          path: resultUrl
        });
      });
    }
  });
});

app.listen(config.port, config.host, function() {
  logger.info('Listen %s:%s', config.host, config.port);
});
