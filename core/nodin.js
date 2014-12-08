// nodin - controls his ravens :-)

var munin = require("./munin.js")


var redis = require('redis');
var redis_server = "127.0.0.1";
var redis_port = 6379;
var redis_database_number = 2;
var redis_client = redis.createClient(redis_port, redis_server);


// Read configuration files
var dns = require('dns');
var fs = require('fs');
var SNMP_CONFIG = './conf/snmp_poller.conf'
// Default values, if not existent
default_interval = 1000;
default_type = "switch";
default_model = "procurve";

if (fs.existsSync(SNMP_CONFIG)){
    try{
        var hostlist = JSON.parse(fs.readFileSync(SNMP_CONFIG, 'utf8'));
    } catch(error) {
        console.log("config file failure!!!")
        console.log(error)
        process.exit(1);
    }
    checkhosts();
}

else{
    console.log("nodin");
    console.log("Configfile not found!")
}


function checkhosts(){
// Check if host is already stored in REDIS
    Object.keys(hostlist).forEach(function(host_key){
        redis_client.select(redis_database_number, function(){
            redis_client.keys(host_key, function(err, replies){
                if (err) console.log("nodin: checkhost error: "+err);
                else{
                    if (replies.length <= 0){
                        anerror = false;
                        // Host does not exist
                        if (hostlist[host_key].Community){
                            // If the host has an community
                            if (hostlist[host_key].IP){
                                // If there is an IP address in the config fire up munin to get all details of the device
                                munin.gethostdetails(hostlist[host_key].IP, hostlist[host_key].Community, host_key)
                                save_data(host_key, "IP", hostlist[host_key].IP)
                            }
                            else{
                                dns.resolve4(host_key.trim(), function (err, addresses) {
                                    if (err) {
                                        console.log("IP Address of " + host_key +  " was not found! Please check and restart!")
                                        anerror = true;
                                    }
                                    else{
                                        munin.gethostdetails(addresses, hostlist[host_key].Community, host_key)
                                        save_data(host_key, "IP", addresses)
                                    }
                                })
                            }
                            if (anerror) console.log("nodin: Device lookup for " + host_key + " aborted.")
                            else {
                                save_data(host_key, "community", hostlist[host_key].Community)
                                // Check other values
                                // Check interval
                                if (hostlist[host_key].interval) save_data(host_key, "interval", hostlist[host_key].interval)
                                else save_data(host_key, "interval", default_interval)
                                // Device type
                                if (hostlist[host_key].type) save_data(host_key, "interval", hostlist[host_key].type)
                                else save_data(host_key, "interval", default_type)
                                // model
                                if (hostlist[host_key].model) save_data(host_key, "interval", hostlist[host_key].model)
                                else save_data(host_key, "interval", default_model)
                            }
                        }
                        else{
                            console.log(host_key + " has no community set! Please check and restart!")
                        }
                    }
                    else{
                    // Device alread in REDIS
                        redis_client.hget(host_key, "IP", function(err, redis_ip_address){
                            if (err) console.log ("nodin: get device details for " + host_key + "failed: "+err)
                            else{
                                redis_client.hget(host_key, "community", function(err, redis_community){
                                    if (err) console.log ("nodin: get device details for " + host_key + "failed: "+err)
                                    else{
                                        munin.gethostdetails(redis_ip_address, redis_community, host_key)
                                    }
                                })
                            }
                        })
                        
                    }
                }
            })
        })
    })
}


function save_data(device, key, value, portnum, portkey, methode){
    redis_client.select(redis_database_number, function(){  
        if (key != "Ports"){
            redis_client.hset(device, key, value)
        }
        else{
            redis_client.hmset(device, key+"_"+portnum+"_"+portkey, value)
        }
    })
}

function get_data(methode, key, portnum, portkey){
    if (methode == "devices"){
        redis_client.select(redis_database_number, function(){
            redis_client.keys("*", function(err, replies){
                if (err) console.log(err)
                else{
                    console.log("Reply: " + replies)
                }
            })
        })
    }
    if (key != "Ports"){
        
    }
    else{
        
    }
    
    
}

redis_client.on("error", function (err) {
    console.log("REDIS Error: " + err);
});


exports.get_data = get_data;
exports.save_data = save_data;