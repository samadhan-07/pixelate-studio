var fileInput = document.getElementById('fileInput');
var uploadZone = document.getElementById('uploadZone');
var pixelSizeSlider = document.getElementById('pixelSize');
var saturationSlider = document.getElementById('saturation');
var contrastSlider = document.getElementById('contrast');
var brightnessSlider = document.getElementById('brightness');
var btnPixelate = document.getElementById('btnPixelate');
var btnDownload = document.getElementById('btnDownload');
var hiddenCanvas = document.getElementById('hiddenCanvas');
var hiddenCtx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
var processingOverlay = document.getElementById('processingOverlay');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');
var statsText = document.getElementById('statsText');
var sourceInfo = document.getElementById('sourceInfo');
var outputInfo = document.getElementById('outputInfo');

var currentImage = null;
var outputCanvas = null;
var selectedPalette = 'original';
var selectedStyle = 'filled';

var palettes = {
  original: null,
  gameboy: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
  c64: [[0,0,0],[255,255,255],[136,0,0],[170,255,238],[204,68,204],[0,204,85],[0,0,170],[238,238,119],[221,136,85],[102,68,0],[255,119,119],[51,51,51],[119,119,119],[170,255,102],[0,136,255],[187,187,187]],
  nes: [[124,124,124],[0,0,252],[0,0,188],[68,40,188],[148,0,132],[168,0,32],[168,16,0],[136,20,0],[80,48,0],[0,120,0],[0,104,0],[0,88,0],[0,64,88],[0,0,0],[188,188,188],[0,120,248],[0,88,248],[104,68,252],[216,0,204],[228,0,88],[248,56,0],[228,92,16],[172,124,0],[0,184,0],[0,168,0],[0,168,68],[0,136,136],[248,248,248],[60,188,252],[104,136,252],[152,120,248],[248,120,248],[248,88,152],[248,120,88],[252,160,68],[248,184,0],[184,248,24],[88,216,84],[88,248,152],[0,232,216],[252,252,252],[164,228,252],[184,184,248],[216,184,248],[248,184,248],[248,164,192],[240,208,176],[252,224,168],[248,216,120],[216,248,120],[184,248,184],[184,248,216],[0,252,252]],
  grayscale: null,
  sepia: null
};

function findClosestColor(r, g, b, palette) {
  var closest = palette[0], minDist = Infinity;
  for (var i = 0; i < palette.length; i++) {
    var c = palette[i];
    var d = (r-c[0])*(r-c[0]) + (g-c[1])*(g-c[1]) + (b-c[2])*(b-c[2]);
    if (d < minDist) { minDist = d; closest = c; }
  }
  return closest;
}

function applyGrayscale(r, g, b) {
  var gray = Math.round(0.299*r + 0.587*g + 0.114*b);
  return [gray, gray, gray];
}

function applySepia(r, g, b) {
  return [
    Math.min(255, Math.round(r*0.393 + g*0.769 + b*0.189)),
    Math.min(255, Math.round(r*0.349 + g*0.686 + b*0.168)),
    Math.min(255, Math.round(r*0.272 + g*0.534 + b*0.131))
  ];
}

function setStatus(msg, processing) {
  statusText.textContent = msg;
  if (processing) { statusDot.classList.remove('active'); }
  else { statusDot.classList.add('active'); }
}

pixelSizeSlider.addEventListener('input', function() { document.getElementById('pixelSizeVal').textContent = pixelSizeSlider.value + 'px'; });
saturationSlider.addEventListener('input', function() { document.getElementById('saturationVal').textContent = saturationSlider.value + '%'; });
contrastSlider.addEventListener('input', function() { document.getElementById('contrastVal').textContent = contrastSlider.value + '%'; });
brightnessSlider.addEventListener('input', function() { document.getElementById('brightnessVal').textContent = brightnessSlider.value + '%'; });

document.getElementById('paletteGrid').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-palette]');
  if (!btn) return;
  document.querySelectorAll('.palette-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  selectedPalette = btn.dataset.palette;
});

document.getElementById('styleGroup').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-style]');
  if (!btn) return;
  document.querySelectorAll('.toggle-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  selectedStyle = btn.dataset.style;
});

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      currentImage = img;
      var sourceBody = document.getElementById('sourceBody');
      sourceBody.innerHTML = '';
      var preview = document.createElement('img');
      preview.src = e.target.result;
      preview.style.cssText = 'max-width:100%;max-height:240px;object-fit:contain;display:block;image-rendering:auto;';
      sourceBody.appendChild(preview);
      sourceInfo.textContent = img.width + 'x' + img.height + 'px - ' + (file.size/1024).toFixed(0) + 'KB';
      btnPixelate.disabled = false;
      setStatus('Image loaded // Ready to pixelate', false);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', function(e) { handleFile(e.target.files[0]); });
uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', function() { uploadZone.classList.remove('drag-over'); });
uploadZone.addEventListener('drop', function(e) {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  handleFile(e.dataTransfer.files[0]);
});

btnPixelate.addEventListener('click', function() {
  if (!currentImage) return;
  processingOverlay.classList.add('show');
  setStatus('Processing...', true);
  setTimeout(function() {
    var pixelSize = parseInt(pixelSizeSlider.value);
    var sat = parseInt(saturationSlider.value) / 100;
    var con = parseInt(contrastSlider.value) / 100;
    var bri = parseInt(brightnessSlider.value) / 100;
    var W = currentImage.naturalWidth;
    var H = currentImage.naturalHeight;
    hiddenCanvas.width = W;
    hiddenCanvas.height = H;
    hiddenCtx.filter = 'saturate(' + sat + ') contrast(' + con + ') brightness(' + bri + ')';
    hiddenCtx.drawImage(currentImage, 0, 0, W, H);
    hiddenCtx.filter = 'none';
    var srcData = hiddenCtx.getImageData(0, 0, W, H);
    var out = document.createElement('canvas');
    out.width = W; out.height = H;
    var outCtx = out.getContext('2d');
    var cols = Math.ceil(W / pixelSize);
    var rows = Math.ceil(H / pixelSize);
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var x = col * pixelSize, y = row * pixelSize;
        var pw = Math.min(pixelSize, W - x), ph = Math.min(pixelSize, H - y);
        var rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (var py = y; py < y + ph; py++) {
          for (var px = x; px < x + pw; px++) {
            var idx = (py * W + px) * 4;
            rSum += srcData.data[idx];
            gSum += srcData.data[idx+1];
            bSum += srcData.data[idx+2];
            count++;
          }
        }
        var r = Math.round(rSum/count), g = Math.round(gSum/count), b = Math.round(bSum/count);
        var res;
        if (selectedPalette === 'grayscale') { res = applyGrayscale(r,g,b); r=res[0]; g=res[1]; b=res[2]; }
        else if (selectedPalette === 'sepia') { res = applySepia(r,g,b); r=res[0]; g=res[1]; b=res[2]; }
        else if (palettes[selectedPalette]) { res = findClosestColor(r,g,b,palettes[selectedPalette]); r=res[0]; g=res[1]; b=res[2]; }
        var color = 'rgb(' + r + ',' + g + ',' + b + ')';
        if (selectedStyle === 'filled') {
          outCtx.fillStyle = color; outCtx.fillRect(x, y, pw, ph);
        } else if (selectedStyle === 'outlined') {
          outCtx.fillStyle = color; outCtx.fillRect(x, y, pw, ph);
          outCtx.strokeStyle = 'rgba(0,0,0,0.25)'; outCtx.lineWidth = 0.5;
          outCtx.strokeRect(x+0.5, y+0.5, pw-1, ph-1);
        } else if (selectedStyle === 'dots') {
          outCtx.fillStyle = '#0a0a0f'; outCtx.fillRect(x, y, pw, ph);
          outCtx.fillStyle = color;
          var r2 = Math.min(pw, ph) * 0.42;
          outCtx.beginPath(); outCtx.arc(x+pw/2, y+ph/2, r2, 0, Math.PI*2); outCtx.fill();
        }
      }
    }
    var outputBody = document.getElementById('outputBody');
    outputBody.innerHTML = '';
    out.style.cssText = 'max-width:100%;max-height:600px;image-rendering:pixelated;display:block;';
    outputBody.appendChild(out);
    outputCanvas = out;
    outputInfo.textContent = cols + 'x' + rows + ' blocks - ' + pixelSize + 'px grid';
    statsText.textContent = cols * rows + ' pixels rendered';
    btnDownload.style.display = 'block';
    processingOverlay.classList.remove('show');
    setStatus('Done // ' + cols + 'x' + rows + ' grid - palette: ' + selectedPalette, false);
  }, 60);
});

btnDownload.addEventListener('click', function() {
  if (!outputCanvas) return;
  var link = document.createElement('a');
  link.download = 'pixelated-portrait.png';
  link.href = outputCanvas.toDataURL('image/png');
  link.click();
});
