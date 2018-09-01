#!/bin/sh

HOMEBASE_PID=`ps | grep '/data/homebase/core/index.js' |  grep -v grep | awk '{print $1}'`
if [ $HOMEBASE_PID ]; then
  echo "homebase [${HOMEBASE_PID}] is running, will kill $HOMEBASE_PID"
  kill $HOMEBASE_PID
fi
echo '==================starting homebase================'
echo 'using [setprop persist.sys.rokid.homebase.prt 110] to enable print'
echo 'using [setprop persist.sys.rokid.homebase.upd 110] to disable upload'
iotjs /etc/homebase/index.js
echo '==================stopping homebase================'
sleep 5
