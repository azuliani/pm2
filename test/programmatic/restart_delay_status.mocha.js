
// @azuliani/pm2: with a restart delay set, the status says what PM2 will do:
// "waiting restart" while a restart is scheduled, "errored" once max_restarts
// is hit, "stopped" when the app does not autorestart

const PM2 = require('../..');
const should = require('should');
const path = require('path')

describe('Status of a crashed app with a restart delay', function() {
  this.timeout(30000);
  var pm2
  var test_path = path.join(__dirname, 'fixtures', 'restart-delay')
  var script = path.join(test_path, 'throw.js')

  function waitForProc(predicate, cb) {
    var iv = setInterval(() => {
      pm2.list((err, procs) => {
        if (err || !procs || !procs[0]) return
        if (predicate(procs[0])) {
          clearInterval(iv)
          cb(procs[0])
        }
      })
    }, 50)
  }

  // The status once PM2 has stopped acting on the app: no restart for a second
  function settledStatus(cb) {
    var last = -1
    var iv = setInterval(() => {
      pm2.list((err, procs) => {
        if (err || !procs || !procs[0]) return
        if (procs[0].pm2_env.restart_time === last) {
          clearInterval(iv)
          return cb(procs[0])
        }
        last = procs[0].pm2_env.restart_time
      })
    }, 1000)
  }

  before(function(done) {
    pm2 = new PM2.custom({
      cwd : test_path
    });

    pm2.delete('all', () => done())
  })

  after(function(done) {
    pm2.delete('all', function() {
      pm2.kill(done);
    })
  });

  afterEach(function(done) {
    pm2.delete('all', () => done())
  })

  it('should be waiting restart between two restarts', (done) => {
    pm2.start({ script, restart_delay: 1000, max_restarts: 100 }, (err) => {
      should(err).be.null()
      waitForProc((proc) => proc.pm2_env.status === 'waiting restart', (proc) => {
        var restarts = proc.pm2_env.restart_time
        waitForProc((proc) => proc.pm2_env.restart_time > restarts, () => done())
      })
    })
  })

  it('should be errored after max_restarts (restart_delay)', (done) => {
    pm2.start({ script, restart_delay: 100, max_restarts: 3 }, (err) => {
      should(err).be.null()
      settledStatus((proc) => {
        should(proc.pm2_env.status).eql('errored')
        should(proc.pm2_env.restart_time).eql(2)
        done()
      })
    })
  })

  it('should be errored after max_restarts (exp_backoff_restart_delay)', (done) => {
    pm2.start({ script, exp_backoff_restart_delay: 100, max_restarts: 3 }, (err) => {
      should(err).be.null()
      settledStatus((proc) => {
        should(proc.pm2_env.status).eql('errored')
        should(proc.pm2_env.restart_time).eql(2)
        done()
      })
    })
  })

  it('should be stopped when the app does not autorestart', (done) => {
    pm2.start({ script, restart_delay: 100, autorestart: false }, (err) => {
      should(err).be.null()
      settledStatus((proc) => {
        should(proc.pm2_env.status).eql('stopped')
        should(proc.pm2_env.restart_time).eql(0)
        done()
      })
    })
  })
})
