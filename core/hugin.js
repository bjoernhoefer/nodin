/* Hugin - created by bjoernhoefer with much support of helmut stock
 * Hugin polls the state of the devices
*/

var snmp = require('snmp-native');
var dns = require('dns');
var net = require('net');
var fs = require('fs');
var http = require("http");
var dgram = require("dgram");
var client = dgram.createSocket("udp4");
var influx_host = '1.2.3.4';
var influx_port = 4444;
var query_interval = 1000 //ms
var snmpsession = new snmp.Session({port: 161})
var SNMP_CONFIG = './conf/snmp_poller.conf'


if (fs.existsSync(SNMP_CONFIG)){
        try{
            var hostlist = JSON.parse(fs.readFileSync(SNMP_CONFIG, 'utf8'));
        } catch(error) {
                console.log("hugin")
                console.log("config file failure!!!")
                console.log(error)
                process.exit(1);
        }
}
else{
        console.log("Configfile not found!")
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
                
        // Filter offline or scan-excluded ports to build port OIDs
        Object.keys(host_details.Ports).forEach(function(Ports_key){
		theoids = [];
                if (host_details.Ports[Ports_key].online){
                        if (host_details.Ports[Ports_key].scan){
                                Object.keys(alloids).forEach(function(oids_key){
                                        theoids.push(getoid(oids_key + "." + Ports_key))
                                        
                                })
                        }
                }
		// Fire up SNMP Poller for filtered ports
		if (theoids.length > 0) {
			query_snmp(host_details.IP, host, host_details.Community, theoids)
		}

        })
        
}

function query_snmp(host, hostname, snmp_community, theoids){

        snmpsession.getAll({ oids: theoids, host: host, community: snmp_community }, function (error, varbinds) {

                message = '';

                var INFLUX_OUT = [{name:"",
                        columns:["time"],
                        points:[[]]
                        }];

                ports = 0;

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
                                delta_time = (values.receiveStamp - prev_val[index][1]) / 1000
                                diff = Math.round((values.value - prev_val[index][0]) / delta_time)
                        } catch(error) {
                                diff = 0
                        }
                        prev_val[index] = [values.value, values.receiveStamp]

                        // If the difference is larger than 0 (Counter not exceeded, build up array)
                        if (diff >= 0) {
                                INFLUX_OUT[0].name = hostname + '.port.' + values.oid.slice(-1)[0]
                                INFLUX_OUT[0].columns.push(revertoid(values.oid));
                                INFLUX_OUT[0].points[0].push(diff);
                        }
                })
                if (error == undefined) {
                        host.state = "good";
                }
                else{
                    console.log("query_snmp - Error: " + error +" Host: " + host.ip);
                    host.state = "bad";
                }

                // Prevent some unusal things....
                if (INFLUX_OUT[0].name != "") {
                        INFLUX_OUT[0].points[0].unshift(float2int(varbinds[0].receiveStamp/1000))

                        // Build and send the UDP message
                        udp_message=new Buffer(JSON.stringify(INFLUX_OUT));
                        client.send(udp_message, 0, udp_message.length, influx_port, influx_host, function(err, byte){
                                if (err){console.error("\n\nUDP Error!!!!\n\n")}
                        })
                }
    })
}



function prestart(){
        Object.keys(hostlist).forEach(function(host_key){
                if (!hostlist[host_key].IP) {
                        dns.resolve4(host_key.trim(), function (err, addresses) {
                                if (err) throw err;
                                hostlist[host_key].IP = addresses
				// console.log(hostlist[host_key].Community)
                                
				if (hostlist[host_key].interval) {
					//console.log("interval given!" + hostlist[host_key].interval)
					setInterval(build_snmp, hostlist[host_key].interval, host_key, hostlist[host_key])
				}
				else {
					setInterval(build_snmp, query_interval, host_key, hostlist[host_key])
				}
				// setInterval(build_snmp, query_interval, host_key, hostlist[host_key])
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