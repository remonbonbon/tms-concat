#!/usr/bin/env python
from PIL import Image   # pip install pillow
import sys
import os.path

if not len(sys.argv) != 7:
  raise SystemExit("Usage: %s srcDir z xMin xMax yimn yMax destFile" % sys.argv[0])
# ./tmp/mapquest-osm 15 26175 26182 17013 17019 ./output.png

srcDir = sys.argv[1]
z = int(sys.argv[2])
xMin = int(sys.argv[3])
xMax = int(sys.argv[4])
yMin = int(sys.argv[5])
yMax = int(sys.argv[6])
destFile = sys.argv[7]

BASE_WIDTH = 256
BASE_HEIGHT = 256

width = BASE_WIDTH * (xMax - xMin + 1)
height = BASE_HEIGHT * (yMax - yMin + 1)
result = Image.new("RGB", (width, height))

posX = 0
for x in range(xMin, xMax + 1):
  posY = 0
  for y in range(yMin, yMax + 1):
    path = os.path.join(srcDir, str(z), str(x), str(y)) + '.png'
    try:
      tile = Image.open(path)
    except IOError:
      print 'Could not open ' + path
      continue
    result.paste(tile, (posX, posY))
    posY += BASE_HEIGHT
  posX += BASE_WIDTH

result.save(destFile)
