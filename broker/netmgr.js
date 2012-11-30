/***********************************************************************************
  conf:
    announce		segundos, intervalo de tiempo entre paquetes 'iamalive'
    port		puerto en el que escuchar
    networks		redes a las que escuchar
      [*]
        name		nombre de la red
        broadcast	dirección de broadcast
        port		puerto de broadcast
        
  <object>:
    callback		función al llamar cuando haya tráfico
    sendTo		función para mandar tráfico a un destino
***********************************************************************************/

var netmgr=function(conf)
    {
     
    }

module.exports=netmgr;
