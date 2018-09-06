
dbus-send --print-reply \
   --type=method_call \
   --dest=$1 $2 $3 string:""

