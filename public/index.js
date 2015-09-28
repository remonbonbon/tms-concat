(function() {
  'use strict';

  var $mapSelector = $('#mapSelector');
  var $minLng = $('#minLng');
  var $minLat = $('#minLat');
  var $maxLng = $('#maxLng');
  var $maxLat = $('#maxLat');
  var $zoom = $('#zoom');
  var $zoomLock = $('#zoomLock');
  var $totalTiles = $('#totalTiles');
  var $download = $('#download');
  var $downloadList = $('#downloadList');

  // ---------------- Fetch available maps ----------------
  // Configuration of available maps
  var maps = [];

  $.getJSON('/api/maps').done(function(json) {
    maps = json.maps;

    _.each(maps, function(m, index) {
      var $option = $('<option>').attr('value', index).text(m.name);
      $mapSelector.append($option);

      m.layer = new ol.layer.Tile({
        source: new ol.source.XYZ({
          attributions: [
            new ol.Attribution({
              html: m.attribution
            })
          ],
          urls: m.urls,
          wrapX: false
        })
      });
    });
    changeBaseMap(0);
  });

  // ---------------- map ----------------
  var map = new ol.Map({
    target: 'map',
    controls: ol.control.defaults({
      attributionOptions: {collapsible: false}
    }),
    loadTilesWhileAnimating: true,
    loadTilesWhileInteracting: true,
    layers: [],
    view: new ol.View({
      center: ol.proj.transform([107.604153, -6.920580], 'EPSG:4326', 'EPSG:3857'),
      zoom: 14,
      minZoom: 0,
      maxZoom: 18,
    })
  });

  // ---------------- Tile border layer ----------------
  var tileBorderLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: '/tile-border.png',
      wrapX: false
    }),
  });

  // ---------------- Selector box ----------------
  var drawingLayer = new ol.layer.Vector({
    source: new ol.source.Vector({wrapX: false}),
  });
  var drawInteraction = new ol.interaction.Draw({
    source: drawingLayer.getSource(),
    type: 'LineString',
    maxPoints: 2,
    geometryFunction: function(coordinates, geometry) {
      if (!geometry) {
        geometry = new ol.geom.Polygon(null);
      }
      var start = coordinates[0];
      var end = coordinates[1];
      geometry.setCoordinates([
        [start, [start[0], end[1]], end, [end[0], start[1]], start]
      ]);
      return geometry;
    },
  });
  map.addInteraction(drawInteraction);
  drawInteraction.on('drawstart', function(e) {
    drawingLayer.getSource().clear();
  });
  drawInteraction.on('drawend', function(e) {
    var extent = ol.proj.transformExtent(e.feature.getGeometry().getExtent(), 'EPSG:3857', 'EPSG:4326');
    $minLng.val(extent[0].toFixed(6));
    $minLat.val(extent[1].toFixed(6));
    $maxLng.val(extent[2].toFixed(6));
    $maxLat.val(extent[3].toFixed(6));
    updateTotalTileCount();
  });

  // ---------------- Zooming ----------------
  map.getView().on('change:resolution', function(e) {
    if (!$zoomLock.prop('checked')) {
      $zoom.val(map.getView().getZoom());
      updateTotalTileCount();
    }
  });
  $zoom.val(map.getView().getZoom()); // Set initial values
  $zoom.on('change', function() {
    updateTotalTileCount();
  });
  $zoomLock.on('change', function() {
    $zoom.prop('disabled', $zoomLock.prop('checked'));
  });

  // ---------------- Base map selector ----------------
  $mapSelector.on('change', function() {
    changeBaseMap($mapSelector.val());
  });

  // Change base map
  function changeBaseMap(index) {
    map.getLayers().clear();
    map.addLayer(maps[index].layer);
    map.addLayer(tileBorderLayer);
    map.addLayer(drawingLayer);
  }

  // ---------------- Grid tiles ----------------
  // Returns selected extent by grid tile coord.
  function getSelectedTileExtent() {
    var extent = [
      parseFloat($minLng.val()),
      parseFloat($minLat.val()),
      parseFloat($maxLng.val()),
      parseFloat($maxLat.val()),
    ];
    extent = ol.proj.transformExtent(extent, 'EPSG:4326', 'EPSG:3857');
    var zoom = parseInt($zoom.val(), 10);
    var grid = map.getLayers().item(0).getSource().getTileGrid();
    var min = grid.getTileCoordForCoordAndZ([extent[0], extent[1]], zoom);
    var max = grid.getTileCoordForCoordAndZ([extent[2], extent[3]], zoom);
    if (!_.all(min, _.isFinite) || !_.all(max, _.isFinite)) {
      return undefined;
    }
    return {
      min: min,
      max: max
    };
  }

  // Update the indication of total tile count
  function updateTotalTileCount() {
    var extent = getSelectedTileExtent();
    if (!extent) {
      $totalTiles.text('-');
    } else {
      var gridWidth = Math.abs(extent.max[1] - extent.min[1]);
      var gridHeight = Math.abs(extent.max[2] - extent.min[2]);
      var tiles = (gridWidth + 1) * (gridHeight + 1);
      $totalTiles.text(tiles);
    }
  }

  // ---------------- Download ----------------
  $download.click(function() {
    var extent = getSelectedTileExtent();
    if (!extent) return;
    var req = {
      map: maps[$mapSelector.val()].key,
      z: extent.min[0],
      x: {
        min: extent.min[1],
        max: extent.max[1]
      },
      y: {
        // Flip y-coord
        min: -(extent.max[2] + 1),
        max: -(extent.min[2] + 1)
      }
    };
    $.ajax({
      method: 'POST',
      url: '/api/concat',
      data: JSON.stringify(req),
      contentType : 'application/json',
    }).done(function(json) {
      var $downloadLink = $('<a class="downloadList__link" target="_blank">')
        .attr('href', json.path)
        .text(json.filename);
      $downloadList.prepend($downloadLink);
    });
  });
})();
