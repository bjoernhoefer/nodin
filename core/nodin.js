// nodin - controls his ravens :-)

// Read nodin configuration file
var fs = require('fs');
var NODIN_CONFIG = './conf/nodin.conf'
if (fs.existsSync(NODIN_CONFIG)){
    try{
        var configuration = JSON.parse(fs.readFileSync(NODIN_CONFIG, 'utf8'));
        exports.configuration = configuration;
    } catch(error) {
        console.log("config file failure!!!")
        console.log(error)
        process.exit(1);
    }
}

// Read SNMP configuration file
var SNMP_CONFIG = './conf/snmp.conf'
if (fs.existsSync(SNMP_CONFIG)){
    try{
        var snmp_config = JSON.parse(fs.readFileSync(SNMP_CONFIG, 'utf8'));
        exports.snmp_configuration = snmp_config
    } catch(error) {
        console.log("SNMP config file failure!!!")
        console.log(error)
        process.exit(1);
    }
    ;
}

// Load all needed modules
var munin = require("./munin.js")
var hugin = require("./hugin.js")
var dns = require('dns');
var redis = require('redis');
var redis_client = redis.createClient(configuration.redis.port, configuration.redis.host);

// Read device configuration file
var DEVICE_CONFIG = './conf/devices.conf'
if (fs.existsSync(DEVICE_CONFIG)){
    try{
        var hostlist = JSON.parse(fs.readFileSync(DEVICE_CONFIG, 'utf8'));
    } catch(error) {
        console.log("Device config file failure!!!")
        console.log(error)
        process.exit(1);
    }
    checkhosts();
}

else{
    console.log("Host definition file "+DEVICE_CONFIG+" not found, trying REDIS only mode")
    
    redis_client.select(configuration.redis.device_db, function(){
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

// Check details of device
function checkhosts(){
// Check if host is already stored in REDIS
    Object.keys(hostlist).forEach(function(file_host_name){
        redis_client.select(configuration.redis.device_db, function(){
            redis_client.keys(file_host_name, function(err, replies){
                if (err) console.log("nodin: checkhost error: "+err);
                else{
                    if (replies.length == 0){
                        // Use values provided by config-file
                        check_file_hosts(file_host_name)
                    }
                    else{
                        // Device alread in REDIS
                        check_redis_hosts(file_host_name)
                    }
                }
            })
        })
    })
    start_ravens();
}

function check_file_hosts(file_host_name){
    anerror = false;
    // Host does not exist
    if (hostlist[file_host_name].IP){
        // If there is an IP address check if there is an community set and save IP
        save_data(file_host_name, "IP", hostlist[file_host_name].IP)
        if (hostlist[file_host_name].Community){
            // Community found - Fire up munin
            munin.gethostdetails(hostlist[file_host_name].IP, hostlist[file_host_name].Community, file_host_name)
            save_data(file_host_name, "community", hostlist[file_host_name].Community)
        }
        else{
            // Inform user about missing value, save value and fire up munin
            console.log("No SNMP community found in configfile - using default!")
            munin.gethostdetails(hostlist[file_host_name].IP, configuration.defaults.snmp_community, file_host_name)
            save_data(file_host_name, "community", configuration.defaults.snmp_community)
        }
        
    }
    else{
        // No IP address configured - lookup with DNS
        dns.resolve4(file_host_name.trim(), function (err, addresses) {
            if (err) {
                console.log("IP Address of " + file_host_name +  " was not found! Please check and restart!")
                anerror = true;
            }
            else{
                if (hostlist[file_host_name].Community){
                    // Community found - Fire up munin 
                    munin.gethostdetails(addresses, hostlist[file_host_name].Community, file_host_name)
                    save_data(file_host_name, "community", hostlist[file_host_name].Community)
                    save_data(file_host_name, "IP", addresses)
                }
                else{
                    // Inform user about missing value, save value and fire up munin
                    console.log("No SNMP community found in configfile - using default!")
                    munin.gethostdetails(addresses, configuration.defaults.snmp_community, file_host_name)
                    save_data(file_host_name, "community", configuration.defaults.snmp_community)
                    save_data(file_host_name, "IP", addresses)
                }
            }
        })
    }
    // Prevent further work if an error happens
    if (anerror) console.log("nodin: Device lookup for " + file_host_name + " aborted.")
    
    else {
        // Check other values - if not present use default values
        // Check interval
        if (hostlist[file_host_name].interval) save_data(file_host_name, "interval", hostlist[file_host_name].interval)
        else save_data(file_host_name, "interval", configuration.defaults.interval)
        // Device type
        if (hostlist[file_host_name].type) save_data(file_host_name, "type", hostlist[file_host_name].type)
        else save_data(file_host_name, "type", configuration.defaults.type)
        // Device model
        if (hostlist[file_host_name].model) save_data(file_host_name, "model", hostlist[file_host_name].model)
        else save_data(file_host_name, "model", configuration.defaults.model)
    }
}

function check_redis_hosts(redis_host_name){
    redis_client.select(configuration.redis.device_db, function(){
        redis_client.HGETALL(redis_host_name, function(err, check_hostdetails){
            if (err){
                console.log ("nodin: get device details for " + redis_host_name + "failed: "+err)
                console.log("Trying file-based lookup")
                check_file_hosts(redis_host_name)
            }
            else{
                check_consistence(redis_host_name, check_hostdetails, function(consistence_result){
                    if (consistence_result == "inconsistent"){
                        check_file_hosts(redis_host_name)
                    }
                    else{
                        munin.gethostdetails(check_hostdetails.IP, check_hostdetails.community, redis_host_name)
                    }
                })
            }
        })
    })
}

// Check if SNMP consistent (configuration-file == REDIS Databse)
function check_consistence(consistence_host, consistence_host_details, callback){
    if (consistence_host_details.community == hostlist[consistence_host].Community){
        callback("consistent")
    }
    else{
        callback("inconsistent")
    }
    
}


function start_ravens(){
    // Start hugin
    redis_client.select(configuration.redis.device_db, function(){
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
    redis_client.select(configuration.redis.device_db, function(){  
        
        if (methode == "ports"){
            
            redis_client.hset(device, key, JSON.stringify(value));
        }
        else{
            redis_client.hset(device, key, value)
        }
        
    })
}

redis_client.on("error", function (err) {
    console.log("REDIS Error: " + err);
});


exports.save_data = save_data;
