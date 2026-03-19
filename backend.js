// -------------------------------------------------------------------------------
// NODEJS/SOCKETiO/ESP8266/UDP TEMPLATE
// Project: "SH LIGHTS"
// V1.0 FOR WEMOS D1 Mini / Philips WIZ
// By Victor Winters | 14.3.2026
//
// patched for WiZ color/state/toggle + persistent JSON lamp memory
// -------------------------------------------------------------------------------

// node v20.20.1
// X64/ARM architecture
// http://IP:8082

// -------------------------------------------------------------------------------
// SERVER
// -------------------------------------------------------------------------------

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const path = require('path');
const dgram = require('dgram');
const fs = require('fs');

// require('events').EventEmitter.prototype._maxListeners = 0;

app.use(express.static(path.join(__dirname, 'controller')));

app.get('/house', function(req, res) {
  res.sendFile('index.html', { root: path.join(__dirname, 'controller') });
});

// PORT
server.listen(8082);

// -------------------------------------------------------------------------------
// VARS
// -------------------------------------------------------------------------------

const WIZ_PORT = 38899;
const MEMORY_FILE = path.join(__dirname, 'lamp_memory.json');

// Philips WIZ UDP lamps-----------------
var udpLight1IP = '10.0.2.20'; 
var udpLight2IP = '10.0.2.21'; 
var udpLight3IP = '10.0.2.22';
var udpLight4IP = '10.0.2.23';
var udpLight5IP = '10.0.2.24';
var udpLight6IP = '10.0.2.25';
var udpLight7IP = '10.0.2.26';
var udpLight8IP = '10.0.2.27';
var udpLight9IP = '10.0.2.28';
var udpLight10IP = '10.0.2.29';
var udpLight11IP = '10.0.2.30';
var udpLight12IP = '10.0.2.31';
var udpLight13IP = '10.0.2.32';
var udpLight14IP = '10.0.2.33';

var lampMemoryDefaults = {
  1: { color: '#fcf6aa', dimming: 100 },
  2: { color: '#fcf6aa', dimming: 100 },
  3: { color: '#fcf6aa', dimming: 100 },
  4: { color: '#fcf6aa', dimming: 100 },
  5: { color: '#fcf6aa', dimming: 100 },
  6: { color: '#fcf6aa', dimming: 100 },
  7: { color: '#fcf6aa', dimming: 100 },
  8: { color: '#fcf6aa', dimming: 100 },
  9: { color: '#fcf6aa', dimming: 100 },
  10: { color: '#fcf6aa', dimming: 100 },
  11: { color: '#fcf6aa', dimming: 100 },
  12: { color: '#fcf6aa', dimming: 100 },
  13: { color: '#fcf6aa', dimming: 100 },
  14: { color: '#2da847', dimming: 100 }
};

var lampMemory = loadLampMemory();

// -------------------------------------------------------------------------------
// MEMORY HELPERS
// -------------------------------------------------------------------------------

function loadLampMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      var raw = fs.readFileSync(MEMORY_FILE, 'utf8');
      var parsed = JSON.parse(raw);

      return {
        1: parsed['1'] || lampMemoryDefaults[1],
        2: parsed['2'] || lampMemoryDefaults[2],
        3: parsed['3'] || lampMemoryDefaults[3],
        4: parsed['4'] || lampMemoryDefaults[4],
        5: parsed['5'] || lampMemoryDefaults[5],
        6: parsed['6'] || lampMemoryDefaults[6],
        7: parsed['7'] || lampMemoryDefaults[7],
        8: parsed['8'] || lampMemoryDefaults[8],
        9: parsed['9'] || lampMemoryDefaults[9],
        10: parsed['10'] || lampMemoryDefaults[10],
        11: parsed['11'] || lampMemoryDefaults[11],
        12: parsed['12'] || lampMemoryDefaults[12],
        13: parsed['13'] || lampMemoryDefaults[13],
        14: parsed['14'] || lampMemoryDefaults[14]
      };
    }
  } catch (err) {
    console.log('Could not load lamp memory:', err.message);
  }

  return JSON.parse(JSON.stringify(lampMemoryDefaults));
}

function saveLampMemory() {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(lampMemory, null, 2), 'utf8');
  } catch (err) {
    console.log('Could not save lamp memory:', err.message);
  }
}

function rememberLampColor(lightId, hexColor, dimming) {
  lightId = normalizeLightId(lightId);

  if (!lightId) return;

  dimming = parseInt(dimming, 10);
  if (isNaN(dimming)) dimming = 100;
  if (dimming < 10) dimming = 10;
  if (dimming > 100) dimming = 100;

  lampMemory[lightId] = {
    color: String(hexColor).toLowerCase(),
    dimming: dimming
  };

  saveLampMemory();
}

// -------------------------------------------------------------------------------
// WIZ HELPERS
// -------------------------------------------------------------------------------

function normalizeLightId(lightId) {
  if (lightId === 1 || lightId === '1' || lightId === 'light1') return 1;
  if (lightId === 2 || lightId === '2' || lightId === 'light2') return 2;
  if (lightId === 3 || lightId === '3' || lightId === 'light3') return 3;
  return 1;
}

function getLampIP(lightId) {
  lightId = normalizeLightId(lightId);

  if (lightId === 1) return udpLight1IP;
  if (lightId === 2) return udpLight2IP;
  if (lightId === 3) return udpLight3IP;

  return udpLight1IP;
}

function parseLightSelection(data, defaultLights) {
  var lightIds = defaultLights || [1];

  if (Array.isArray(data)) {
    lightIds = data;
  } else if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data.lights) && data.lights.length > 0) {
      lightIds = data.lights;
    } else if (data.light) {
      lightIds = [data.light];
    }
  } else if (typeof data === 'number' || typeof data === 'string') {
    lightIds = [data];
  }

  return lightIds.map(normalizeLightId);
}

function hexToRgb(hex) {
  if (!hex) throw new Error('No hex color received');

  hex = String(hex).replace('#', '').trim();

  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error('Invalid hex color: ' + hex);
  }

  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

function sendWizCommand(ip, payload, callback) {
  const socket = dgram.createSocket('udp4');
  const message = Buffer.from(JSON.stringify(payload));
  let done = false;

  const timer = setTimeout(function() {
    if (done) return;
    done = true;
    try { socket.close(); } catch (e) {}
    callback(new Error('WiZ UDP timeout'));
  }, 1500);

  socket.on('message', function(msg) {
    if (done) return;
    done = true;
    clearTimeout(timer);

    try {
      const response = JSON.parse(msg.toString());
      socket.close();
      callback(null, response);
    } catch (err) {
      try { socket.close(); } catch (e) {}
      callback(err);
    }
  });

  socket.on('error', function(err) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try { socket.close(); } catch (e) {}
    callback(err);
  });

  socket.send(message, 0, message.length, WIZ_PORT, ip, function(err) {
    if (err && !done) {
      done = true;
      clearTimeout(timer);
      try { socket.close(); } catch (e) {}
      callback(err);
    }
  });
}

function getWizState(lightId, callback) {
  var ip = getLampIP(lightId);

  sendWizCommand(ip, {
    method: 'getPilot',
    params: {}
  }, function(err, response) {
    if (err) return callback(err);

    const result = response.result || {};

    callback(null, {
      light: normalizeLightId(lightId),
      isOn: !!result.state,
      r: typeof result.r !== 'undefined' ? result.r : null,
      g: typeof result.g !== 'undefined' ? result.g : null,
      b: typeof result.b !== 'undefined' ? result.b : null,
      dimming: typeof result.dimming !== 'undefined' ? result.dimming : null,
      memory: lampMemory[normalizeLightId(lightId)] || null,
      raw: response
    });
  });
}

function setWizColor(lightId, hexColor, dimming, callback) {
  var ip = getLampIP(lightId);
  let rgb;

  try {
    rgb = hexToRgb(hexColor);
  } catch (err) {
    return callback(err);
  }

  dimming = parseInt(dimming, 10);
  if (isNaN(dimming)) dimming = 100;
  if (dimming < 10) dimming = 10;
  if (dimming > 100) dimming = 100;

  rememberLampColor(lightId, '#' + String(hexColor).replace('#', '').trim(), dimming);

  sendWizCommand(ip, {
    method: 'setPilot',
    params: {
      state: true,
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      dimming: dimming
    }
  }, callback);
}

function lampOn(lightId, callback) {
  lightId = normalizeLightId(lightId);

  var memory = lampMemory[lightId] || { color: '#ffffff', dimming: 100 };

  setWizColor(lightId, memory.color, memory.dimming, callback);
}

function lampOff(lightId, callback) {
  var ip = getLampIP(lightId);

  sendWizCommand(ip, {
    method: 'setPilot',
    params: {
      state: false
    }
  }, callback);
}

function toggleWizLight(lightId, callback) {
  lightId = normalizeLightId(lightId);

  getWizState(lightId, function(err, state) {
    if (err) return callback(err);

    if (state.isOn) {
      lampOff(lightId, function(err2, response) {
        if (err2) return callback(err2);
        callback(null, { isOn: false, response: response });
      });
    } else {
      lampOn(lightId, function(err2, response) {
        if (err2) return callback(err2);
        callback(null, { isOn: true, response: response });
      });
    }
  });
}

function toggleWizLightWithColor(lightId, hexColor, dimming, callback) {
  lightId = normalizeLightId(lightId);

  getWizState(lightId, function(err, state) {
    if (err) return callback(err);

    if (state.isOn) {
      lampOff(lightId, function(err2, response) {
        if (err2) return callback(err2);
        callback(null, { isOn: false, response: response });
      });
    } else {
      setWizColor(lightId, hexColor, dimming, function(err2, response) {
        if (err2) return callback(err2);
        callback(null, { isOn: true, response: response });
      });
    }
  });
}

function runForLights(lightIds, worker, done) {
  var results = [];
  var pending = lightIds.length;

  if (pending === 0) {
    return done([]);
  }

  lightIds.forEach(function(lightId) {
    worker(lightId, function(result) {
      results.push(result);
      pending--;

      if (pending === 0) {
        results.sort(function(a, b) { return a.light - b.light; });
        done(results);
      }
    });
  });
}

// -------------------------------------------------------------------------------
// SOCKET IO
// -------------------------------------------------------------------------------

io.on('connection', function(socket) {
  console.log('User connected: ' + socket.id);

  socket.on('disconnect', function() {
    console.log('User disconnected: ' + socket.id);
  });

  // ------------------------- SET COLOR -----------------------------------------

  socket.on('colorToBack', function(data) {
    var lightIds = parseLightSelection(data, [1]);
    var hexColor = null;
    var dimming = 100;

    if (typeof data === 'string') {
      hexColor = data;
    } else if (typeof data === 'object' && data !== null) {
      hexColor = data.color || data.hex || null;
      dimming = data.dimming || 100;
    }

    if (!hexColor) {
      socket.emit('wizStatus', {
        ok: false,
        action: 'setColor',
        error: 'No color received'
      });
      return;
    }

    runForLights(lightIds, function(lightId, next) {
      console.log('colorToBack -> light:', lightId, 'ip:', getLampIP(lightId), 'color:', hexColor);

      setWizColor(lightId, hexColor, dimming, function(err, response) {
        next({
          light: lightId,
          ok: !err,
          error: err ? err.message : null,
          response: err ? null : response
        });
      });
    }, function(results) {
      socket.emit('wizStatus', {
        ok: results.some(function(r) { return r.ok; }),
        action: 'setColor',
        color: hexColor,
        dimming: dimming,
        results: results
      });
    });
  });

  // ------------------------- TOGGLE LIGHT --------------------------------------

  socket.on('toggleLamp', function(data) {
    var lightIds = parseLightSelection(data, [1]);
    var hexColor = null;
    var dimming = 100;

    if (typeof data === 'object' && data !== null) {
      hexColor = data.color || data.hex || null;
      dimming = data.dimming || 100;
    }

    runForLights(lightIds, function(lightId, next) {
      function done(err, result) {
        next({
          light: lightId,
          ok: !err,
          error: err ? err.message : null,
          isOn: err ? null : result.isOn
        });
      }

      if (hexColor) {
        toggleWizLightWithColor(lightId, hexColor, dimming, done);
      } else {
        toggleWizLight(lightId, done);
      }
    }, function(results) {
      socket.emit('wizStatus', {
        ok: results.some(function(r) { return r.ok; }),
        action: 'toggleLamp',
        color: hexColor,
        results: results
      });
    });
  });

  // ------------------------- GET LAMP STATE ------------------------------------

  socket.on('getLampState', function(data) {
    var lightIds = parseLightSelection(data, [1]);

    runForLights(lightIds, function(lightId, next) {
      getWizState(lightId, function(err, state) {
        next({
          light: lightId,
          ok: !err,
          error: err ? err.message : null,
          isOn: err ? null : state.isOn,
          r: err ? null : state.r,
          g: err ? null : state.g,
          b: err ? null : state.b,
          dimming: err ? null : state.dimming,
          memory: err ? null : state.memory
        });
      });
    }, function(results) {
      socket.emit('lampState', {
        ok: results.some(function(r) { return r.ok; }),
        results: results
      });
    });
  });

  // ------------------------- FORCE OFF -----------------------------------------

  socket.on('lampOff', function(data) {
    var lightIds = parseLightSelection(data, [1]);

    runForLights(lightIds, function(lightId, next) {
      lampOff(lightId, function(err, response) {
        next({
          light: lightId,
          ok: !err,
          error: err ? err.message : null,
          response: err ? null : response
        });
      });
    }, function(results) {
      socket.emit('wizStatus', {
        ok: results.some(function(r) { return r.ok; }),
        action: 'lampOff',
        results: results
      });
    });
  });

  // ------------------------- FORCE ON ------------------------------------------

  socket.on('lampOn', function(data) {
    var lightIds = parseLightSelection(data, [1]);

    runForLights(lightIds, function(lightId, next) {
      lampOn(lightId, function(err, response) {
        next({
          light: lightId,
          ok: !err,
          error: err ? err.message : null,
          response: err ? null : response
        });
      });
    }, function(results) {
      socket.emit('wizStatus', {
        ok: results.some(function(r) { return r.ok; }),
        action: 'lampOn',
        results: results
      });
    });
  });
});

console.log('WIZ CONTROLLER RUNNING...');

// -------------------------------------------------------------------------------
// NODE EXIT HANDLER
// -------------------------------------------------------------------------------

process.stdin.resume();

function exitHandler(options, err) {
  if (options.cleanup) {
    saveLampMemory();
    console.log('clean');
  }
  if (err) console.log(err.stack);
  if (options.exit) process.exit();
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
