var express = require('express');
var router = express.Router();
var nodin = require('../core/nodin.js')

var devicearray = {}

router.get('/', function(req, res) {
    nodin.list_devices(function(hosts){
        Object.keys(hosts).forEach(function(host){
            nodin.list_device_ports(hosts[host], function(ports){
                devicearray[hosts[host]] = JSON.parse(ports)
                if (host == hosts.length-1){
                    res.render('index', { title: 'Welcome to nOdin', devices: devicearray });
                }
            })
        })
        
    })
        
});

router.get('/configuration', function(req, res){
    res.render('configuration', {title: 'Configuration', nodin_config: nodin.configuration})
})

router.get('/add_device', function(req, res){
    res.render('add_device', {title: 'Add a device'})
})

router.post('/configuration_change/*', function(req, res){
    errorcount = 0;
    Object.keys(req.body).forEach(function(changed_key){

        nodin.change_config(req.url.split('/')[req.url.split('/').length-1], changed_key, req.body[changed_key], function(result){  
            if(result == "error"){
                errorcount++
            }
            else(console.log(result))
        });
    })
    if (errorcount == 0){
        res.send("set");
    }
    else{
        res.send("error");
        console.log(errorcount)
    }
})

router.post('/add_device', function(req, res){
    nodin.add_device(req.body, function(add_device_result){
        res.send(add_device_result)
    })
    
    /*
    Possible callback states:
    ok - everything is good - device was added
    lookup - lookup failure (Host not found)
    file - writing configuration file failed
    duplicate - host is already configured in nodin
    */
    
})




module.exports = router;