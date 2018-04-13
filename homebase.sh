#!/bin/sh
#
# Start homebase
#

echo 'start homebase'

# BOOT_PID=`ps | grep '/etc/homebase-bootstrap/boot.js' |  grep -v grep | awk '{print $1}'`
# echo "boot pid $BOOT_PID"
# if [ $BOOT_PID ]; then
#   echo "boot is running, will kill $BOOT_PID"
#   kill $BOOT_PID
# fi

HOMEBASE_PID=`ps | grep '/data/homebase/core/index.js' |  grep -v grep | awk '{print $1}'`
echo "homebaes pid $HOMEBASE_PID"
if [ $HOMEBASE_PID ]; then
  echo "homebase is running, will kill $HOMEBASE_PID"
  kill $HOMEBASE_PID
fi
iotjs /etc/homebase-bootstrap/boot.js
sleep 5