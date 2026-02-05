  /**
 * Copyright 2013-2022 the PM2 project authors. All rights reserved.
 * Use of this source code is governed by a license that
 * can be found in the LICENSE file.
 */
var url = require('url');
var cst = require('../constants.js');
// Inject custom modules
var ProcessUtils = require('./ProcessUtils')
ProcessUtils.injectModules()

if (typeof(process.env.source_map_support) != "undefined" &&
    process.env.source_map_support !== "false") {
  require('source-map-support').install();
}

// Rename the process
process.title = process.env.PROCESS_TITLE || 'node ' + process.env.pm_exec_path;

if (process.connected &&
    process.send &&
    process.versions &&
    process.versions.node)
  process.send({
    'node_version': process.versions.node
  });

// Capture base listeners (from pm2-io) before user code runs
// Any listeners added after this point are user-provided
var baseListeners = {
  uncaughtException: process.listeners('uncaughtException').slice(),
  unhandledRejection: process.listeners('unhandledRejection').slice()
};

function getUncaughtExceptionListener(listener) {
  return function uncaughtListener(err) {
    var error = err && err.stack ? err.stack : err;

    if (listener === 'unhandledRejection') {
      error = 'You have triggered an unhandledRejection, you may have forgotten to catch a Promise rejection:\n' + error;
    }

    console.error(error);

    // Notify master that an exception has been caught
    try {
      if (err) {
        var errObj = {};
        Object.getOwnPropertyNames(err).forEach(function(key) {
          errObj[key] = err[key];
        });
      }

      if (process.send) {
        process.send({
          type: 'log:err',
          topic: 'log:err',
          data: '\n' + error + '\n'
        });
        process.send({
          type: 'process:exception',
          data: errObj !== undefined ? errObj : {message: 'No error but ' + listener + ' was caught!'}
        });
      }
    } catch(e) {
      console.error('Channel is already closed can\'t broadcast error:\n' + e.stack);
    }

    // Check if there are user-provided listeners (not ours, not pm2-io's base listeners)
    var userListeners = process.listeners(listener).filter(function (l) {
      return l !== uncaughtListener && baseListeners[listener].indexOf(l) === -1;
    });

    // Exit if no user-provided handlers exist
    if (!userListeners.length) {
      process.emit('disconnect');
      process.exit(cst.CODE_UNCAUGHTEXCEPTION);
    }
  }
}

process.on('uncaughtException', getUncaughtExceptionListener('uncaughtException'));
process.on('unhandledRejection', getUncaughtExceptionListener('unhandledRejection'));

// Require the real application
if (process.env.pm_exec_path) {
  if (ProcessUtils.isESModule(process.env.pm_exec_path) === true) {
    import(url.pathToFileURL(process.env.pm_exec_path));
  }
  else
    require('module')._load(process.env.pm_exec_path, null, true);
}
else
  throw new Error('Could not _load() the script');

// Change some values to make node think that the user's application
// was started directly such as `node app.js`
process.mainModule = process.mainModule || {};
process.mainModule.loaded = false;
require.main = process.mainModule;
