/*
Munin finds out details about switches...

*/

var dns = require('dns');
var fs = require('fs');
var ping = require('net-ping');
var SNMP_CONFIG = './conf/snmp_poller.conf'

function readhosts(){
    if (fs.existsSync(SNMP_CONFIG)){
        try{
            var hostlist = JSON.parse(fs.readFileSync(SNMP_CONFIG, 'utf8'));
        } catch(error) {
            console.log("munin");
            console.log("config file failure!!!")
            console.log(error)
            process.exit(1);
        }
        
        Object.keys(JSON.parse(fs.readFileSync(SNMP_CONFIG, 'utf8'))).forEach(function(host_key){
                    if (!hostlist[host_key].IP) {
                            dns.resolve4(host_key.trim(), function (err, addresses) {
                                    if (err) throw err;
                                    hostlist[host_key].IP = addresses
                                    //setInterval(build_snmp, hostlist[host_key].interval, host_key, hostlist[host_key])
                                    console.log(host_key)
                            })
                    }
                    
            }) 
    }
    else{
        console.log("munin");
        console.log("Configfile not found!")
    }
}

function testhosts(){
    
}

readhosts();