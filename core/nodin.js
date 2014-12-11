// nodin - controls his ravens :-)

var munin = require("./munin.js")
var hugin = require("./hugin.js")

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
    console.log("Host definition file "+SNMP_CONFIG+" not found, trying REDIS only mode")
    
    redis_client.select(redis_database_number, function(){
        redis_client.keys("*", function(err, redis_hosts){
            if (err){
                console.log("Redis also failed - aborting!")
                redis_client.end()
                exit(1);
            }
            else{
                if (redis_hosts.length > 0){
                    redis_hosts.forEach(function(redis_stored_hosts){
                        check_redis_hosts(redis_stored_hosts)
                    })
                }
                else{
                    console.log("No hosts in REDIS found - aborting!")
                    redis_client.end()
                    exit(1)
                }
            }
            
        })
    })
        
    
}


function checkhosts(){
// Check if host is already stored in REDIS
    Object.keys(hostlist).forEach(function(host_key){
        redis_client.select(redis_database_number, function(){
            redis_client.keys(host_key, function(err, replies){
                if (err) console.log("nodin: checkhost error: "+err);
                else{
                    if (replies.length == 0){
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
                                // No IP address configured - lookup with DNS
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
                            // Prevent further work if an error happens
                            if (anerror) console.log("nodin: Device lookup for " + host_key + " aborted.")
                            
                            else {
                                save_data(host_key, "community", hostlist[host_key].Community)
                                // Check other values
                                // Check interval
                                if (hostlist[host_key].interval) save_data(host_key, "interval", hostlist[host_key].interval)
                                else save_data(host_key, "interval", default_interval)
                                // Device type
                                if (hostlist[host_key].type) save_data(host_key, "type", hostlist[host_key].type)
                                else save_data(host_key, "type", default_type)
                                // Device model
                                if (hostlist[host_key].model) save_data(host_key, "model", hostlist[host_key].model)
                                else save_data(host_key, "model", default_model)
                            }
                        }
                        else{
                            console.log(host_key + " has no community set! Please check and restart!")
                        }
                    }
                    else{
                        // Device alread in REDIS
                        check_redis_hosts(host_key)
                    }
                }
            })
        })
    })
    start_ravens();
}

function check_redis_hosts(redis_host_name){
    redis_client.select(redis_database_number, function(){
        redis_client.hget(redis_host_name, "IP", function(err, redis_ip_address){
            if (err) console.log ("nodin: get device details for " + redis_host_name + "failed: "+err)
            else{
                redis_client.hget(redis_host_name, "community", function(err, redis_community){
                    if (err) console.log ("nodin: get device details for " + redis_host_name + "failed: "+err)
                    else{
                        munin.gethostdetails(redis_ip_address, redis_community, redis_host_name)
                    }
                })
            }
        })
    })
}

function start_ravens(){
    // Start hugin
    redis_client.select(redis_database_number, function(){
        redis_client.keys("*", function(err, hosts){
            if (err) console.log("hugin start failed: "+err)
            else{
                Object.keys(hosts).forEach(function(host_num){
                    redis_client.HGETALL(hosts[host_num], function(err, hostdetails){
                        if (err) console.log("hugin start failed: "+err)
                        else{
                            setInterval(hugin.snmpquery, hostdetails.interval, hosts[host_num], hostdetails)
                            setInterval(munin.gethostdetails, hostdetails.interval*500, hostdetails.IP, hostdetails.community, hosts[host_num])
                        }
                    })
                })
            }
            
        })
    })
}

function save_data(device, key, value, methode){
    redis_client.select(redis_database_number, function(){  
        
        if (methode == "ports"){
            
            redis_client.hset(device, key, JSON.stringify(value));
        }
        else{
            redis_client.hset(device, key, value)
        }
        
    })
}

function get_data(methode, key, portnum, portkey){
    if (methode == "devices"){
        //console.log("devices")
        redis_client.select(redis_database_number, function(){
            redis_client.keys("*", function(err, replies){
                if (err) {
                    console.log("Nodin - get devices: "+err);
                    return null;
                }
                else{
                    return replies
                }
            })
        })
    }
    else if(methode == "ports"){
        console.log("ports")
        redis_client.select(redis_database_number, function(){
            redis_client.hget(key, "ports", function(err, replies){
                if (err) {
                    console.log("Nodin - get ports: "+err)
                    return null
                }
                else{
                    return JSON.parse(replies)
                }
            })
        })
    }
}

redis_client.on("error", function (err) {
    console.log("REDIS Error: " + err);
});


exports.get_data = get_data;
exports.save_data = save_data;