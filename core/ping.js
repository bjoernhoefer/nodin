var os = require('os');
var ip = require('ip');
var ping = require('ping');

var ifaces = os.networkInterfaces();

Object.keys(ifaces).forEach(function (ifname) {
  var alias = 0;

  ifaces[ifname].forEach(function (iface) {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }

    if (alias >= 1) {
    }
    else {
      i = 0;
      while (i < ip.subnet(iface.address, '255.255.255.0').numHosts){
          var ipaddress = ip.subnet(iface.address, '255.255.255.0').networkAddress.replace("0",i);
          pinghost(ipaddress);
          //console.log(ipaddress);
          /*
          ping.sys.probe(ipaddress, function(isAlive){
            jobs--;
            var msg = isAlive ? 'host ' + ipaddress + ' is alive' : 'host ' + ipaddress + ' is dead';
            console.log(msg);
          });
          */
          i++;
        };
    };
  });
});


function pinghost(hostip){
  ping.sys.probe(hostip, function(isAlive){
    var msg = isAlive ? 'host ' + hostip + ' is alive' : 'host ' + hostip + ' is dead';
    console.log(msg);
    return;
  });
}
