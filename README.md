moonitor
========

Monitor tool 4 Linux using node.js

Moonitor será una herramienta de monitorización de elementos en una red.

Cada elemento a monitorizar tiene un daemon (moon-daemon) y habrá al menos un agregador o broker (moon-broker).

En la configuración básica un broker controla la información enviada por los daemons bajo petición (cliente-servidor) y mantiene
una base de datos con la información proporcionada.

Cada daemon tendrá un servidor web embebido encargado de publicar la información agregada de los daemons.

