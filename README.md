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

