/*
Munin finds out details about devices...

*/

var snmp = require('snmp-native');
var snmpsession = new snmp.Session({port: 161})

var ifindex = [1, 3, 6, 1, 2, 1, 2, 2, 1]

// nodin
nodin = require("./nodin.js")


function gethostdetails(snmp_host, community, hostname){
    snmpsession.getSubtree({ oid: ifindex, host: snmp_host, community: community}, function(error, snmp_answer){
        if (error){
            console.log("Error: "+ error)
        }
        else{
            snmp_answer.forEach(function (values){
                
                if (values.oid.slice(-2, -1) == 2){
                    // Interface Name
                    nodin.save_data(hostname,"Ports", values.value, values.oid[values.oid.length-1], "name")
                }
                
                else if (values.oid.slice(-2, -1) == 3){
                    // Interface Type
                    nodin.save_data(hostname,"Ports", values.value, values.oid[values.oid.length-1], "type")
                }
                
                else if (values.oid.slice(-2, -1) == 4){
                    // Interface MTU
                    nodin.save_data(hostname,"Ports", values.value, values.oid[values.oid.length-1], "mtu")
                }
                
                else if (values.oid.slice(-2, -1) == 5){
                    // Interface Speed
                    nodin.save_data(hostname,"Ports", values.value, values.oid[values.oid.length-1], "speed")
                }
                
                else if (values.oid.slice(-2, -1) == 7){
                    // Interface Admin state
                    nodin.save_data(hostname,"Ports", values.value, values.oid[values.oid.length-1], "adminstate")
                }
                
                else if (values.oid.slice(-2, -1) == 8){
                    // Interface Operational State
                    nodin.save_data(hostname,"Ports", values.value, values.oid[values.oid.length-1], "operational")
                }
                
                else if (values.oid.slice(-2, -1) == 9){
                    // Interface Last Chance
                    nodin.save_data(hostname,"Ports", values.value, values.oid[values.oid.length-1], "lastchange")
                }
                
            })
        }
    })
}

exports.gethostdetails = gethostdetails;