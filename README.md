moonitor
========

Monitor tool 4 Linux using node.js

Moonitor será una herramienta de monitorización de elementos en una red.

Cada elemento a monitorizar ejecuta un (moon-daemon.js) y habrá al menos un agregador o broker (moon-broker.js) en la red.

En la configuración básica un broker controla la información enviada por los daemons bajo petición (cliente-servidor) y 
mantiene una base de datos con la información proporcionada.

Cada broker tendrá un servidor web embebido encargado de publicar la información agregada de los daemons.

ficheros
--------

common/*	Código común al broker y a los daemons

moon-broker.js	Punto de entrada del broker (enlace)
broker/*	Código fuente del broker
modules/*	Módulos del broker

moon-daemon.js	Punto de entrada del daemon (enlace)
daemon/*	Código fuente del daemon
plugins/*	Plugins del daemon

Makefile	Auntomatización de varias cosas
