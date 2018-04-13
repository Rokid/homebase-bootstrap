
dbus-send --print-reply \
  --type=method_call \
  --dest=$1 /activation/prop com.rokid.activation.prop.all string:""

