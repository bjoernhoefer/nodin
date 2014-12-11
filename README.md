nodin
=====

NodeJS SNMP Monitoring

###What can currently be done:
- Monitor different devices/ports of devices via SNMP (hugin)
- Discover device states automatically/periodically (munin)
- Write SNMP Values to a Influx Database
- Configuration and states are stored in REDIS

###What should be possible in the future (aka ToDO): 
- Web-Interface for Values and configuration (module will be caled nodin)

## How to start nodin?
1. Get the databases to store your data 
⋅⋅* REDIS (stores all properties of your devices) -> http://redis.io/ 
⋅⋅* INFLUXDB (stores all values of your devices) -> http://influxdb.com/
2. Install the databases
3. Get and install the current version of nodeJS -> http://nodejs.org/
4. Install all necessary modules for nodin
- redis -> https://github.com/mranney/node_redis
- net-snap (for munin) -> https://www.npmjs.com/package/net-snmp
- snmp-native (for hugin) -> https://github.com/calmh/node-snmp-native
5. Go to the directory where you cloned this repo (e.g. /opt/node/nodin (for linux)) and start nodin (node core/nodin.js)

(Optional)
To view your data you might also get grafana -> http://grafana.org/

###Where does the name come from?
Odin should be know, by the most people - otherwise: http://en.wikipedia.org/wiki/Odin 

Odins two birds were called hugin and munin they provided him information about the things going on around him - both names were already taken by other projects so I decided to use the a mixture of the programming language and the "master" of hugin and munin -> NodeJS + Odin = nodin
