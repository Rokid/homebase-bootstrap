#!/bin/sh

trap 'echo ============ killing homebase processes ============ \
  ; kill $(jobs -p) \
  ; echo "============ killing result $? ============" \
  ; exit 0' INT TERM

echo '============ starting homebase ============'
echo 'using [setprop persist.sys.rokid.homebase.prt 110] to enable print'
echo 'using [setprop persist.sys.rokid.homebase.upd 110] to disable upload'
echo 'using [setprop persist.sys.rokid.homebase.env $ENV] to set homebase env'

exec iotjs /etc/homebase/index.js
HOMEBASE_PID=$!
echo "============ homebase running with pid $HOMEBASE_PID ============"
wait $HOMEBASE_PID
echo "============ homebase exit with code $? ============"
echo '============ restart homebase after 5s ============'
sleep 5