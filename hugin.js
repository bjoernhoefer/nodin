/* Hugin - created by bjoernhoefer with much support of helmut stock
 * Hugin polls the state of the devices

Version history:
1.0 - Initial release
1.1 - Octets are now multiplied by 8 so the represent bit/s




*/
var snmp = require('snmp-native');
var dns = require('dns');
var net = require('net');
var fs = require('fs');
var http = require("http");

var client = new net.Socket();
var influx = '1.2.3.4';
var influx_port = 2003;
var query_interval = 1000 //ms
var snmpsession = new snmp.Session({port: 161})

client.connect(influx_port, influx, function() {
        console.log('Influx connection detail: ' + influx + ':' + influx_port);
});

try{
    var hostlist = JSON.parse(fs.readFileSync('./snmp_poller.conf', 'utf8'));
} catch(error) {
    console.log("config file failure!!!")
    process.exit(1);
}

var prev_val = {};

qinterfaces = [1, 2, 3, 15, 16, 17];

var theoids = [];

var alloids = {

    // Octets
    '.1.3.6.1.2.1.2.2.1.10' : "inoctet",
    '.1.3.6.1.2.1.2.2.1.16' : "outoctet",

    //discards
    '.1.3.6.1.2.1.2.2.1.13' : "indiscards",
    '.1.3.6.1.2.1.2.2.1.19' : "outdiscards",

    // errors
    '.1.3.6.1.2.1.2.2.1.14' : "inerrors",
    '.1.3.6.1.2.1.2.2.1.20' : "outerrors",

    //unicast packets
    '.1.3.6.1.2.1.2.2.1.11' : "inucast",
    '.1.3.6.1.2.1.2.2.1.17' : "outucast",

    // non unicast packets
    '.1.3.6.1.2.1.2.2.1.12' : "innucast",
    '.1.3.6.1.2.1.2.2.1.18' :  "outnucast"

}

function getoid(rawoid){
    return rawoid.split('.').filter(function (s) { return s.length > 0; }).map(function (s) { return parseInt(s, 10); });
}

function revertoid(oid_data) {
    theoid = "." + oid_data.slice(0, -1).join('.')
    return (alloids["." + oid_data.slice(0, -1).join('.')])
}

function float2int (value) {
    return value | 0;
}

function query_snmp(host){
    snmpsession.getAll({ oids: theoids, host: host.ip }, function (error, varbinds) {

        hostname = host.name.split('.').slice(0,1)+ "."
        message = '';

        // Calculate the difference between octets
        varbinds.forEach(function (values){

            // Type 65 = Counter32
            // Type 2 = Integer

            if (values.type == 65) {
                if (revertoid(values.oid).search("octet") >= 0) {
                    values.value = values.value * 8
                }
            }

            // Workaround for 32bit counter limits
            index = host.name + values.oid
            try {
                diff = values.value - prev_val[index]
            } catch(error) {
                diff = 0
            }
            prev_val[index] = values.value

            //console.log()

            if (diff >= 0) {
                oid=revertoid(values.oid)

                message += hostname + values.oid.slice(-1) +"." + revertoid(values.oid) + " " + diff + " " + float2int(values.sendStamp/1000) + "\n"
            }

        })

        if (error == undefined) {
            host.state = "gut";
        }
        else{
            console.log("query_snmp - Error: " + error +" Host: " + host.ip);
            host.state = "nix gut";
        }

        client.write(message);


    })
}

function prestart(hostname, instancer){
    hostlist.forEach(function (host, index){
        if (!host.ip) {
            dns.resolve4(host.name.trim(), function (err, addresses) {
                if (err) throw err;
                host.ip = addresses
                console.log(host.ip)
                setInterval(query_snmp, query_interval, host)
            })
        }

    })

}

function init(){
    Object.keys(alloids).forEach(function(key){
        qinterfaces.forEach(function(interface_num){
            theoids.push(getoid(key + "." + interface_num))
        })
    })
    prestart()
}

function http_server(){
    http.createServer(function(request, response) {
    response.writeHead(200, {"Content-Type": "text/plain"});
    hostlist.forEach(function (host){
        response.write("Host: " + host.ip + " - Status: " + host.state + "\n")
    })

    response.end();
    }).listen(8888);
}

init();
http_server();