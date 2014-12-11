/*
Hugin - created by bjoernhoefer with much support of helmut stock
Hugin polls the state of the devices

*/

var snmp = require('snmp-native');
var http = require("http");
var dgram = require("dgram");
var client = dgram.createSocket("udp4");
var influx_host = '1.2.3.4';
var influx_port = 4444;
var snmpsession = new snmp.Session({port: 161})


var nodin = require("./nodin.js")

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

// Prepare OID Array to send it to query_snmp
function snmp_prepare(host, hostdetails){
        Object.keys(JSON.parse(hostdetails.ports)).forEach(function(port_detail_num){
                var theoids = [];
                if (hostdetails.ports[port_detail_num].operational != 2){
                        if (hostdetails.ports[port_detail_num].adminstate != 2){
                                Object.keys(alloids).forEach(function(oids_key){
                                        theoids.push(getoid(oids_key + "." + port_detail_num))
                                })
                        }
                }
                // Query SNMP for every port (easier to handle in query_snmp)
                query_snmp(theoids, host, hostdetails)
        })
        
}

function query_snmp(theoids, hostname, hostdetails){
        
        // Start SNMP Session at host
        snmpsession.getAll({ oids: theoids, host: hostdetails.IP, community: hostdetails.community }, function (error, varbinds) {

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
                        
                        // If the difference is larger than 0 (Counter not exceeded, build up array) - otherwise dump the package
                        if (diff >= 0) {
                                INFLUX_OUT[0].name = hostname + "." + JSON.parse(hostdetails.ports)[values.oid.slice(-1)[0]].name
                                INFLUX_OUT[0].columns.push(revertoid(values.oid));
                                INFLUX_OUT[0].points[0].push(diff);
                        }
                })
                if (error != undefined) {
                        console.log("query_snmp - Error: " + error +" Host: " + host.ip);
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

exports.snmpquery = snmp_prepare