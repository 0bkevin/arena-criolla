# Mantenimiento del alojamiento existente

El plan del 18 de octubre de 2026 registraba tareas pendientes en `t3code-agents`. Durante la revisión del 20 de octubre, el ejecutable del proxy todavía tenía la huella indicada abajo y seguía presente `/var/run/reboot-required`. Esta limpieza del repositorio no aplicó esas tareas.

## Proxy compartido

- Servicio: `30x-radar-web.service`; ejecutable: `/opt/30x-radar/bin/caddy`.
- SHA-256 observado: `678ade3bfc088749c81a681adc603333ee0bb023b6a6cfe3c0f58bef8ff854e9`.
- El plan anterior preparaba un reemplazo en `/opt/arena-criolla/security/caddy-v2.11.7-go1.26.9` y una copia de seguridad en `/opt/arena-criolla/security/caddy.before-20261018`. El reemplazo no estaba disponible en esa ruta durante esta revisión; hay que preparar y validar una versión actual antes de instalarla.

Coordina la interrupción con los responsables de los otros servicios. Antes de cambiar el proxy, comprueba su versión y huella actuales, valida la configuración compartida con el reemplazo, respalda los datos del juego y conserva una copia del ejecutable instalado para poder restaurarlo.

Después de un cambio autorizado, comprueba el servicio, los sitios que comparte y una partida HTTPS/WebSocket:

```bash
node scripts/security-smoke.mjs https://arena.kevinbravo.com
```

Los otros sitios registrados en el plan eran `https://radar.kevinbravo.com/` y `https://30x-radar.161-153-114-230.sslip.io/`; verifica cuáles siguen activos antes de intervenir.

## Sistema y contenedor

Revisa el motivo actual de `/var/run/reboot-required`, el núcleo previsto para el arranque y el acceso de recuperación externo antes de programar un reinicio. Coordina también los servicios de T3 que corren en esa máquina. Después, verifica el núcleo activo, el proxy, los demás servicios y la persistencia de los datos del juego.

El plan anterior también dejaba pendiente revisar las siguientes actualizaciones de seguridad de Node 24. Al actualizar la imagen, usa una base vigente, ejecuta las pruebas y los escaneos de CI, prueba el contenedor de forma aislada y respalda los datos antes del despliegue.
