/*
 *  Copyright 2015 TWO SIGMA OPEN SOURCE, LLC
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

module.exports = (function() {
  var BrowserWindow = require('browser-window');
  var backendRunner = require('./backend-runner.js');
  var ipc = require('ipc');
  var Faye = require('faye');

  var _windows = {};
  var _windowToSession = {};
  var _sessionToWindow = {};

  var client;

  // Initialize cometd

  ipc.on('window-session', function(event, msg) {
    _sessionToWindow[msg.sessionId] = msg.windowId;
    _windowToSession[msg.windowId] = msg.sessionId;
  });

  ipc.on('session-closed', function(event, sessionId) {
    // Cannot use _windows instead of BrowserWindow until it is completely accurate.
    // Right now, windows that are closed through non-beaker means remain in this map.
    // There is also no handling of multiple windows working on the same session.
    var windowId = _sessionToWindow[sessionId];
    BrowserWindow.fromId(windowId).close();
    event.returnValue = 'done';
  });

  ipc.on('session-focused', function(event, sessionId) {
    var windowId = _sessionToWindow[sessionId];
    BrowserWindow.fromId(windowId).focus()
    ;
  });

  var defaultOptions = {
    width: 800,
    height: 900,
    show: false
  };

  var popupOptions = {
    type: 'toolbar',
    width: 420,
    height: 153,
    show: false,
    resizable: false,
    'auto-hide-menu-bar': true,
    'skip-taskbar': true
  };

  function connectToBackend() {
    console.log('Rebinding faye to: ' + backendRunner.getUrl() + backendRunner.getHash() + '/beaker/cometd/');
    client = new Faye.Client(backendRunner.getUrl() + backendRunner.getHash() + '/beaker/cometd/');
    var subscription = client.subscribe('/sessionClosed', function(msg) {
      var windowId = _sessionToWindow[msg.id];
      BrowserWindow.fromId(windowId).destroy();
    });
  }

  function newWindow(url, type){
    var options;
    var devTools = false;
    switch (type){
      case 'popup':
      options = popupOptions;
      break;
      default:
      devTools = false;
      options = defaultOptions;
      break;
    }
    var window = new BrowserWindow(options);

    _windows[window.id] = window;

    window.unref = function () {
      delete _windows[window.id];
    }

    if (type != 'popup'){
      // Let smarter windows handle their own close
      window.on('close', function(e) {
        // Start close sequence
        window.webContents.send('close-window');
        e.preventDefault();
      });
    }

    window.on('closed', function (e){
      var sessionId = _windowToSession[window.id];
      _sessionToWindow[sessionId] = null,
      _windowToSession[window.id] = null
      window.unref();
    });

    if (devTools){
      window.toggleDevTools();
    }

    window.webContents.once('did-finish-load', function () {
      window.show();
    });
    window.loadUrl(url);
  }

  function closeAll() {
    var windows = BrowserWindow.getAllWindows();
    for (var i = 0; i < windows.length; ++i) {
      windows[i].close();
    }
  }

  return {
    newWindow: newWindow,
    closeAll: closeAll,
    windows: _windows,
    connectToBackend: connectToBackend
  };
})();