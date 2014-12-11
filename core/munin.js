/*
Munin finds out details about devices...

*/

var snmp = require('snmp-native');
var snmpsession = new snmp.Session({port: 161})

var ifindex = [1, 3, 6, 1, 2, 1, 2, 2, 1]

// nodin
var nodin = require("./nodin.js")


function gethostdetails(snmp_host, community, hostname){
    switch_data = {}
    
    snmpsession.getSubtree({ oid: ifindex, host: snmp_host, community: community}, function(error, snmp_answer){
        if (error){
            console.log("Munin Get Subtree Error: "+ error)
        }
        else{
            snmp_answer.forEach(function (values){
                
                if (values.oid.slice(-2, -1) == 2){
                    // Interface Name
                    if (switch_data[values.oid[values.oid.length-1]] == undefined){
                        switch_data[values.oid[values.oid.length-1]] = {}
                        switch_data[values.oid[values.oid.length-1]]['name'] = values.value
                    }
                    else{
                        switch_data[values.oid[values.oid.length-1]]['name'] = values.value
                    }
                }
                
                else if (values.oid.slice(-2, -1) == 3){
                    // Interface Type
                    if (switch_data[values.oid[values.oid.length-1]] == undefined){
                        switch_data[values.oid[values.oid.length-1]] = {}
                        switch_data[values.oid[values.oid.length-1]]['type'] = values.value
                    }
                    else{
                        switch_data[values.oid[values.oid.length-1]]['type'] = values.value
                    }
                }
                
                else if (values.oid.slice(-2, -1) == 4){
                    // Interface MTU
                    if (switch_data[values.oid[values.oid.length-1]] == undefined){
                        switch_data[values.oid[values.oid.length-1]] = {}
                        switch_data[values.oid[values.oid.length-1]]['mtu'] = values.value
                    }
                    else{
                        switch_data[values.oid[values.oid.length-1]]['mtu'] = values.value
                    }
                }
                
                else if (values.oid.slice(-2, -1) == 5){
                    // Interface Speed
                    if (switch_data[values.oid[values.oid.length-1]] == undefined){
                        switch_data[values.oid[values.oid.length-1]] = {}
                        switch_data[values.oid[values.oid.length-1]]['speed'] = values.value
                    }
                    else{
                        switch_data[values.oid[values.oid.length-1]]['speed'] = values.value
                    }
                }
                
                else if (values.oid.slice(-2, -1) == 7){
                    // Interface Admin state
                    if (switch_data[values.oid[values.oid.length-1]] == undefined){
                        switch_data[values.oid[values.oid.length-1]] = {}
                        switch_data[values.oid[values.oid.length-1]]['adminstate'] = values.value
                    }
                    else{
                        switch_data[values.oid[values.oid.length-1]]['adminstate'] = values.value
                    }
                }
                
                else if (values.oid.slice(-2, -1) == 8){
                    // Interface Operational State
                    if (switch_data[values.oid[values.oid.length-1]] == undefined){
                        switch_data[values.oid[values.oid.length-1]] = {}
                        switch_data[values.oid[values.oid.length-1]]['operational'] = values.value
                    }
                    else{
                        switch_data[values.oid[values.oid.length-1]]['operational'] = values.value
                    }
                }
                
                else if (values.oid.slice(-2, -1) == 9){
                    // Interface Last Chance
                    if (switch_data[values.oid[values.oid.length-1]] == undefined){
                        switch_data[values.oid[values.oid.length-1]] = {}
                        switch_data[values.oid[values.oid.length-1]]['lastchange'] = values.value
                    }
                    else{
                        switch_data[values.oid[values.oid.length-1]]['lastchange'] = values.value
                    }
                }
            })
            nodin.save_data(hostname, "ports", switch_data, "ports");
        }
    })
    
}

exports.gethostdetails = gethostdetails;