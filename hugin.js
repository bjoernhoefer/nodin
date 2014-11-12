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
var influx = '127.0.0.1';
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

// Convert OID to OID Array
function getoid(rawoid){
    return rawoid.split('.').filter(function (s) { return s.length > 0; }).map(function (s) { return parseInt(s, 10); });
}

// Convert OID Array to OID
function revertoid(oid_data) {
    theoid = "." + oid_data.slice(0, -1).join('.')
    return (alloids["." + oid_data.slice(0, -1).join('.')])
}

// Convert float to integer
function float2int (value) {
    return value | 0;
}

function build_snmp(host, host_details){
        
        // Count ports to fire up SNMP only when all ports are in theoids-arry (async workaround)
        portcounter = 0;
        
        // Filter offline or scan-excluded ports to build port OIDs
        theoids = [];

        Object.keys(host_details.Ports).forEach(function(Ports_key){
                if (host_details.Ports[Ports_key].online){
                        if (host_details.Ports[Ports_key].scan){
                                Object.keys(alloids).forEach(function(oids_key){
                                        theoids.push(getoid(oids_key + "." + Ports_key))
                                        
                                })
                        }
                }
                portcounter++
                if (Object.keys(host_details.Ports).length == portcounter){

                        // Fire up SNMP Poller for filtered ports
                        query_snmp(host_details.IP, host, host_details.Community, theoids)
                }
        })
        
}


function query_snmp(host, hostname, snmp_community, theoids){
        
        snmpsession.getAll({ oids: theoids, host: host, community: snmp_community}, function (error, varbinds) {

                message = '';
                
        
        
                // Calculate the difference between octets
                varbinds.forEach(function (values){
                        // What type of value do we get back?
                        // Type 65 = Counter32
                        // Type 2 = Integer
        
                        if (values.type == 65) {
                                if (revertoid(values.oid).search("octet") >= 0) {
                                        values.value = values.value * 8
                                }
                        }
        
                        // Workaround for 32bit counter limits
                        index = hostname + values.oid
                        try {
                                diff = values.value - prev_val[index]
                        } catch(error) {
                                diff = 0
                        }
                        prev_val[index] = values.value
                        
                        if (diff >= 0) {
                                oid=revertoid(values.oid)
        
                                message += hostname + "." + values.oid.slice(-1) +"." + revertoid(values.oid) + " " + diff + " " + float2int(values.sendStamp/1000) + "\n"
                        }
        
                })
        
                if (error == undefined) {
                        host.state = "good";
                }
                else{
                    console.log("query_snmp - Error: " + error +" Host: " + host.ip);
                    host.state = "bad";
                }

                client.write(message);
    })
}


function prestart(){
        Object.keys(hostlist).forEach(function(host_key){
                if (!hostlist[host_key].IP) {
                        dns.resolve4(host_key.trim(), function (err, addresses) {
                                if (err) throw err;
                                hostlist[host_key].IP = addresses
                                setInterval(build_snmp, query_interval, host_key, hostlist[host_key])
                        })
                }
                
        })
}



function init(){
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
