#!/usr/bin/env bash

SRC=$(cd $(dirname "$0"); pwd)
source "${SRC}/../include.sh"

cd $file_path/promise/

# @azuliani/pm2: unhandled rejections behave as under a plain `node app.js`:
# the process exits with code 1 and PM2 restarts it, unless the app handles them

for mode in cluster fork; do
  echo "###### ${mode} mode"
  if [ $mode = cluster ]; then ARGS="-i 1"; else ARGS=""; fi

  > rejection.log
  $pm2 start rejection.js $ARGS -l rejection.log --merge-logs
  sleep 3
  shouldnot 'should have restarted process' 'restart_time: 0' 1
  should 'should have exited with code 1' 'exit_code: 1' 1
  # Bun prints the fatal rejection natively, bypassing the cluster container's log capture
  if [ $IS_BUN = false ] || [ $mode = fork ]; then
    grep "Errorla" rejection.log
    spec "should have logged the rejection"
  fi

  $pm2 delete all

  > empty-rejection.log
  $pm2 start empty-rejection.js $ARGS -l empty-rejection.log --merge-logs
  sleep 3
  shouldnot 'should have restarted process' 'restart_time: 0' 1
  should 'should have exited with code 1' 'exit_code: 1' 1

  $pm2 delete all

  > handled-rejection.log
  $pm2 start handled-rejection.js $ARGS -l handled-rejection.log --merge-logs
  sleep 3
  should 'should not have restarted process' 'restart_time: 0' 1
  grep "handled rejection: Handledla" handled-rejection.log
  spec "should have let the app handle the rejection"

  $pm2 delete all
done
