/*
Munin finds out details about devices...

*/

var snmp = require('snmp-native');
var snmpsession = new snmp.Session({port: 161})


// nodin
var nodin = require("./nodin.js")

function gethostdetails(snmp_host, community, hostname){
    switch_data = {}
    
    snmpsession.getSubtree({ oid: [1, 3, 6, 1, 2, 1, 2, 2, 1 ], host: snmp_host, community: community}, function(error, snmp_answer){
        if (error){
            console.log("Munin Get Subtree Error: "+ error)
        }
        else{
            if (snmp_answer.length > 0){
                Object.keys(snmp_answer).forEach(function(snmp_values){
                    
                    if (snmp_answer[snmp_values].oid.slice(-2, -1) == 2){
                        // Interface Name
                        if (switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] == undefined){
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] = {}
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['name'] = snmp_answer[snmp_values].value
                        }
                        else{
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['name'] = snmp_answer[snmp_values].value
                        }
                    }
                    
                    else if (snmp_answer[snmp_values].oid.slice(-2, -1) == 3){
                        // Interface Type
                        if (switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] == undefined){
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] = {}
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['type'] = snmp_answer[snmp_values].value
                        }
                        else{
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['type'] = snmp_answer[snmp_values].value
                        }
                    }
                    
                    else if (snmp_answer[snmp_values].oid.slice(-2, -1) == 4){
                        // Interface MTU
                        if (switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] == undefined){
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] = {}
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['mtu'] = snmp_answer[snmp_values].value
                        }
                        else{
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['mtu'] = snmp_answer[snmp_values].value
                        }
                    }
                    
                    else if (snmp_answer[snmp_values].oid.slice(-2, -1) == 5){
                        // Interface Speed
                        if (switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] == undefined){
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] = {}
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['speed'] = snmp_answer[snmp_values].value
                        }
                        else{
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['speed'] = snmp_answer[snmp_values].value
                        }
                    }
                    
                    else if (snmp_answer[snmp_values].oid.slice(-2, -1) == 7){
                        // Interface Admin state
                        if (switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] == undefined){
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] = {}
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['adminstate'] = snmp_answer[snmp_values].value
                        }
                        else{
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['adminstate'] = snmp_answer[snmp_values].value
                        }
                    }
                    
                    else if (snmp_answer[snmp_values].oid.slice(-2, -1) == 8){
                        // Interface Operational State
                        if (switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] == undefined){
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] = {}
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['operational'] = snmp_answer[snmp_values].value
                        }
                        else{
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['operational'] = snmp_answer[snmp_values].value
                        }
                    }
                    
                    else if (snmp_answer[snmp_values].oid.slice(-2, -1) == 9){
                        // Interface Last Chance
                        if (switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] == undefined){
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]] = {}
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['lastchange'] = snmp_answer[snmp_values].value
                        }
                        else{
                            switch_data[snmp_answer[snmp_values].oid[snmp_answer[snmp_values].oid.length-1]]['lastchange'] = snmp_answer[snmp_values].value
                        }
                    }
                })
                nodin.save_data(hostname, "ports", switch_data, "ports");
                if (nodin.hostlist[hostname].processed){
                    nodin.hostlist[hostname].processed = false
                }
            }
            else{
                console.log("No SNMP Answer from "+hostname)
                if (nodin.hostlist[hostname].processed){
                    nodin.hostlist[hostname].processed = false
                }
            }
        }
    })
    
}

exports.gethostdetails = gethostdetails;