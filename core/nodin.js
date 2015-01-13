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
                check_snmp_consistence(redis_host_name, check_hostdetails, function(consistence_result){
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
function check_snmp_consistence(consistence_host, consistence_host_details, callback){
    if (consistence_host_details.community == hostlist[consistence_host].Community){
        callback("consistent")
    }
    else{
        callback("inconsistent")
    }
    
}

var timerid_hugin = {}
var timerid_munin = {}

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
                            timerid_hugin[hosts[host_num]] = setInterval(hugin.snmpquery, hostdetails.interval, hosts[host_num], hostdetails)
                            timerid_munin[hosts[host_num]] = setInterval(munin.gethostdetails, hostdetails.interval*500, hostdetails.IP, hostdetails.community, hosts[host_num])
                        }
                    })
                })
            }
            
        })
    })
}

// Save data to Redis
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

exports.list_devices = function(devices_callback){
    redis_client.keys("*", function(err, redis_hosts){
        if (err) console.log("nodin failed - list devices: " +err)
        else{
            devices_callback(redis_hosts)
        }
    })
}

exports.list_device_ports = function(device, deviceports){
    redis_client.select(configuration.redis.device_db, function(){
        redis_client.hget(device, "ports", function(err, ports) {
            if (err) console.log("nodin failed - list ports: " +err)
            else{
                deviceports(ports)
            }
        })
    })
}

// Configuration Management

// Check if values of configuration file and Redis database are consistent - otherwise overwrite values in Redis with values read from config object
function check_config_consistency(callback){
    redis_client.select(configuration.redis.system_db, function(){
        Object.keys(configuration).forEach(function(config_key){
            redis_client.exists(config_key, function(err, config_exists){
                if (err) console.log("nodin config consistency failed : " +err)
                else{
                    // Config values are not set in Redis
                    if (config_exists == 0){
                        Object.keys(configuration[config_key]).forEach(function(config_value){
                            redis_client.hset(config_key, config_value, configuration[config_key][config_value], function(err, redis_message){
                                if (err) console.log("nodin config consistency failed : " +err)
                            })
                        })
                    }
                    // Config values are set in Redis
                    else{
                        Object.keys(configuration[config_key]).forEach(function(config_value){
                            redis_client.hexists(config_key, config_value, function(err, config_exists){
                                if (err) console.log("nodin config consistency failed : " +err)
                                else {
                                    if (config_exists == 1){
                                        redis_client.hget(config_key, config_value, function(err, config_value_value) {
                                            if (err) console.log("nodin config consistency failed : " +err)
                                            else{
                                                if (configuration[config_key][config_value] != config_value_value){
                                                    redis_client.hset(config_key, config_value, configuration[config_key][config_value], function(err, redis_message){
                                                        if (err) console.log("nodin config consistency failed : " +err)
                                                    })
                                                }
                                            }
                                            
                                        })
                                    }
                                    else {
                                        console.log(config_value + "configuation value does exist")
                                        redis_client.hset(config_key, config_value, configuration[config_key][config_value], function(err, redis_message){
                                            if (err) console.log("nodin config consistency failed : " +err)
                                        })
                                    }
                                    
                                    
                                }
                            })
                            
                            
                        })
                    }
                }
            }) 
        })
    })
}

function change_config(section, key, value, callback){
    if (configuration[section][key]){
        configuration[section][key] = value
        callback("set")
        check_config_consistency()
    }
    else{
        callback("error")
    }
    
}

function stop_raven(raven, device){
    Object.keys(timerid_hugin).forEach(function(timerids){
        if (timerids == device){
            if (raven == "hugin"){
                clearInterval(timerid_hugin[timerids])
            }
            else{
                clearInterval(timerid_munin[timerids])
            }
        }
    })
}

// add a device to nodin
function add_device(device_details, callback){
    // check if host already exists
    
    if (hostlist[device_details.device]){
        callback("duplicate");
    }
    
    
    else {
        dns.resolve4(device_details.device, function (err, address) {
            if (err) {
                console.log("IP Address of " + device_details.device +  " was not found! Please check and restart!")
                callback("lookup")
            }
            else{
                device_details.IP = address
                // use user definied settings
                if (device_details.defaults == "false"){
                    
                    // check if all details are set
                    // Community
                    if (device_details.Community == '') { device_details.Community = configuration.defaults.community}
                    // interval
                    if (device_details.interval == '') { device_details.interval = configuration.defaults.interval }
                    // device_type
                    if (device_details.type == '') { device_details.type = configuration.defaults.type }
                    // model
                    if (device_details.model == '') { device_details.type = configuration.defaults.type }
                    
                    hostlist[device_details.device] = {
                        Community : device_details.Community,
                        interval : device_details.interval,
                        type : device_details.type,
                        model : device_details.model
                    }
                    write_device_config_file(function(result){
                        callback(result)
                    })
                    check_file_hosts(device_details.device)
                }
                else{
                    // Fill up hostlist array with default values
                    hostlist[device_details.device] = {
                        Community : configuration.defaults.community,
                        interval : configuration.defaults.interval,
                        type : configuration.defaults.type,
                        model: configuration.defaults.model
                    }
                    write_device_config_file(function(result){
                        callback(result)
                    })
                    check_file_hosts(device_details.device)
                }
            }
        })
    }
    
}

// Write config file
function write_device_config_file(callback){
    fs.writeFile(DEVICE_CONFIG, JSON.stringify(hostlist), function(err){
        if (err) {
            console.log("nodin config save failed: " + err)
            callback("file")
        }
        else {
            callback("ok")
        }
    })
}

exports.save_data = save_data;
exports.confguraiton = configuration;
exports.check_config_consistency = check_config_consistency;
exports.change_config = change_config;
exports.add_device = add_device;
