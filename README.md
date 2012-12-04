moonitor
========

Monitor tool 4 Linux using node.js

**Moonitor** is a tool to monitorize a set of elements on a network.

It is formed by a broker daemon and several client daemons, 
each client daemon report data - on request or periodically - to a broker, 
and one broker support several networks each one with a indeterminated number of clients.

**Moonitor** is pluggable, so each client daemon could have a set of plugins, 
each one specialized on a specific task.

Broker daemon use a built in graph oriented database to store all these data and a integrated web server 
to publish it.

Install broker
--------------

1. Download **moon-broker.tgz** and unpack it into a folder.
2. You will need **nodejs** get installed into your system, I began to use nodejs v0.8.15, below this version you could have errors.
3. Execute:

   node ./moon-broker.tgz help

4. You will have a usage guide.
5. Create a **moon-broker.conf** (json) to put the environment, read the code by the time being.
6. See **moon-broker.log** to see what is happend into the broker.

Install daemon
--------------

1. Download **moon-daemon.tgz** and unpack it into a folder.
2. You will need **nodejs** get installed into your system, I began to use nodejs v0.8.15, below this version you could have errors.
3. Execute:

   node ./moon-daemon.tgz help

4. You will have a usage guide.
5. Create a **moon-daemon.conf** (json) to put the environment, read the code by the time being.
6. See **moon-daemon.log** to see what is happend into the client.

