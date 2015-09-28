#!/usr/bin/env python
from PIL import Image, ImageDraw, ImageFont
import sys
import os.path

if not len(sys.argv) != 8:
  raise SystemExit("Usage: %s srcDir z xMin xMax yimn yMax destFile attribution" % sys.argv[0])
# ./tmp/mapquest-osm 15 26175 26182 17013 17019 ./output.png "(c) OpenStreetMap contributors"

srcDir = sys.argv[1]
z = int(sys.argv[2])
xMin = int(sys.argv[3])
xMax = int(sys.argv[4])
yMin = int(sys.argv[5])
yMax = int(sys.argv[6])
destFile = sys.argv[7]
attribution = sys.argv[8]

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

font = ImageFont.truetype('./fonts/ipaexg.ttf', 12)
draw = ImageDraw.Draw(result)
textsize = draw.textsize(attribution, font=font)
textMargin = 8
textPadding = 3
textX = width - textsize[0] - textMargin - textPadding
textY = height - textsize[1] - textMargin - textPadding
# Draw text background
draw.rectangle([
  textX - textPadding,
  textY - textPadding,
  textX + textsize[0] + textPadding,
  textY + textsize[1] + textPadding], fill='#fff')
# Draw attribution text
draw.text((textX, textY), attribution, font=font, fill='#000')

result.save(destFile)
