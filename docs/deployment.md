# Despliegue

## Servidor

Requiere Node.js 24 o posterior. Desde la raíz del repositorio:

```sh
npm ci
npm run build
npm start
```

El servidor entrega la aplicación compilada y simula las partidas en línea. `PORT` cambia el puerto; las demás opciones están en [`.env.example`](../.env.example). En producción, configura `ARENA_PUBLIC_URL` con el origen público y `ARENA_TRUST_PROXY` según el proxy utilizado.

La configuración de Docker Compose, proxy y copias de seguridad está en [`deploy/`](../deploy/). El contenedor conserva la aplicación, los assets públicos y las dependencias necesarias. Los datos privados del creador se guardan en el volumen configurado con `ARENA_DATA_DIR`; las credenciales y los archivos `.env` quedan fuera del repositorio.

Para comprobar una instancia desplegada:

```sh
node scripts/security-smoke.mjs https://arenacriolla.com/
```

Esta comprobación valida HTTP y WebSocket y crea una partida privada temporal con dos invitados.

## Entrega continua: `main` → `prod`

El flujo sigue el modelo de Gotchu y entrega Arena Criolla al servidor Docker existente:

1. Integra los cambios en `main` mediante un PR con `validate` aprobado.
2. Cuando `main` queda en verde, **Prepare production promotion** abre o actualiza **Release main to production**, con base `prod` y origen `main`. Su `validate` falla si el código exacto de `main` no pasó CI, y `prod-source` exige que venga de `main`. No se repiten tests: `main` queda en verde reutilizando el resultado del PR cuando el árbol de git es idéntico (ver [testing.md](testing.md)).
3. Revisa el diff completo y fusiona ese PR. Esa fusión autoriza el despliegue a `https://arenacriolla.com`. No hay fusión automática.
4. **Deploy production** no repite los tests: se niega a continuar si el árbol de `prod` no pasó CI; después construye la imagen del commit exacto de `prod`, la escanea con Trivy y comprueba HTTP/WebSocket arrancándola.
5. Exporta esa misma imagen Docker, con la revisión etiquetada, como un artefacto comprimido con SHA256. El job de entrega descarga el artefacto de esa ejecución y lo envía por SSH. No se reconstruye en el servidor ni se requiere un registro de imágenes.
6. El instalador verifica checksum, revisión y que `prod` siga apuntando a ese commit; crea una copia de seguridad, actualiza el contenedor y comprueba HTTP/WebSocket tanto en loopback como en el dominio público.

Los PR creados con `GITHUB_TOKEN` no disparan por sí solos los workflows de `pull_request`. Por eso la promoción despacha CI explícitamente en `main`, pasando el número del PR. Los criterios de selección están en [testing.md](testing.md). El check `prod-source` consulta la API y verifica que ese PR esté abierto, tenga base `prod`, venga de `main` del mismo repositorio y corresponda al SHA comprobado. Un PR hacia `prod` que no sea la promoción no recibe checks y no se puede fusionar.

`main` requiere `validate`. `prod` requiere `validate` y `prod-source`; ambas ramas requieren PR, bloquean force-push y eliminación, y aplican las reglas a administradores. El entorno GitHub **production** solo admite la rama `prod`, no etiquetas. Los workflows de promoción y entrega solo actúan en `0bkevin/arena-criolla`. Una ejecución manual de **Deploy production** debe seleccionar `prod`; otra rama no despliega.

La rama `prod` se inicializa desde la revisión de la imagen que ya estaba sirviendo producción. Crear la rama y configurar el host no reinicia el juego. El primer PR de promoción incluye los cambios de `main` posteriores a esa revisión, además de esta configuración.

### Configuración de GitHub y del host

En el entorno **production**, configura:

| Nombre | Tipo | Contenido |
| --- | --- | --- |
| `DEPLOY_HOST` | Variable | Dirección del servidor existente. |
| `DEPLOY_USER` | Variable | `arena-deploy`. |
| `DEPLOY_PORT` | Variable | `2222`, listener exclusivo de despliegue. |
| `DEPLOY_KNOWN_HOSTS` | Variable | Línea de `known_hosts` con la clave pública real del host, verificada por el operador. |
| `DEPLOY_SSH_KEY` | Secret | Clave privada Ed25519 exclusiva para esta entrega. |

Activa **Allow GitHub Actions to create and approve pull requests** en la configuración de Actions; el workflow solo crea/actualiza el PR y no lo aprueba. No uses un token personal para la promoción.

Para instalar o actualizar los controles desde un checkout revisado, en el servidor existente:

```sh
sudo bash deploy/install-delivery-controls.sh /ruta/a/deploy-key.pub
```

El script conserva Compose, `/etc/arena-criolla/server.env`, `/etc/arena-criolla/release.env`, el proxy y el volumen `/workspace/arena-criolla-production/data`. Instala controles propiedad de root fuera de la imagen y una cuenta sin acceso general a sudo ni al grupo Docker. La clave pública queda restringida a los comandos `probe` y `deploy <sha> <run-id> <attempt> <checksum>`, sin forwarding ni terminal. La transferencia usa stdin; no habilites SCP o una shell general. Los despliegues normales no reemplazan estos controles. Los cambios a Compose, proxy, variables del servidor o al instalador requieren una actualización separada del operador.

El transporte usa `arena-criolla-deploy-sshd.service`, con configuración independiente en TCP 2222, autenticación por clave y acceso exclusivo de `arena-deploy`. El instalador añade una regla acotada de iptables y la conserva en `/etc/iptables/rules.v4`. En OCI (`us-phoenix-1`), el NSG `arena-criolla-deployment` (`ocid1.networksecuritygroup.oc1.phx.aaaaaaaapqs73jc6tbyfwfyhwd6s3szof64zhb4tqhi2ohfo7w4g27j7m2eq`) del VNIC del servidor permite TCP 2222 desde internet para los runners de GitHub, cuyas IP cambian. El SSH del operador en TCP 22 conserva su lista de direcciones autorizadas. Al recrear el host, aplica también esa regla OCI al VNIC; instalar el servicio no modifica la red cloud.

Para rotar la clave, genera un par nuevo, vuelve a ejecutar el instalador con su clave pública y sustituye `DEPLOY_SSH_KEY`. Verifica la conexión con `ssh -p 2222 arena-deploy@servidor probe`, usando la clave y la huella del host configuradas. La línea de `known_hosts` debe usar `[servidor]:2222`. No desactives la comprobación de `known_hosts` ni abras puertos adicionales de la aplicación.

### Fallos y recuperación

La entrega usa `/opt/arena-criolla/.deployment.lock` y registra su estado en `/var/lib/arena-criolla-deploy/state.json`. Rechaza ejecuciones antiguas, intentos fallidos repetidos y transacciones sin reconciliar. Repetir una entrega ya completada solo comprueba la salud de la imagen instalada. El servidor conserva la imagen anterior y no elimina imágenes de otros proyectos.

Un fallo antes del cambio deja la versión actual en servicio. Si falla la nueva versión, el instalador la detiene y compara el esquema SQLite con el registrado antes del cambio. Solo vuelve a la imagen anterior si el esquema permanece igual y esa imagen pasa las comprobaciones. Si cambia el esquema, falla la recuperación o se interrumpe el proceso durante el cambio, bloquea posteriores entregas para revisión del operador. Nunca restaura datos automáticamente. La igualdad del esquema no demuestra compatibilidad de los datos: revisa por separado cualquier migración de contenido antes de promoverla.

Ante un timeout de Actions, el resultado remoto puede ser desconocido. Comprueba el registro, la imagen real de `arena-criolla`, `release.env`, el esquema y la salud pública antes de modificar el registro. Conserva una copia del estado; solo después de reconciliar una transacción `installing` o `recovery_required`, márcala como `failed`, preservando su generación, para permitir un intento nuevo. Los detalles de la copia previa están en `/var/backups/arena-criolla`.

Para reintentar un fallo terminado, usa **Re-run all jobs**, de modo que la imagen, el artefacto y la entrega compartan el nuevo intento. Para revertir una versión que ya se desplegó correctamente, crea un commit de reversión en `main` y promuévelo normalmente. Revisa la compatibilidad de datos; no resetees `prod` a un commit antiguo.

Las partidas en memoria y las conexiones WebSocket se interrumpen durante la sustitución del único contenedor. Los datos persistentes se conservan. Los artefactos de Actions caducan a los tres días; las imágenes locales retenidas requieren limpieza periódica, preservando siempre la imagen en ejecución y la anterior.

La validación local de los controles es `python3 -B deploy/test_install_release.py`. Estas pruebas no ejecutan Docker ni modifican producción. La prueba de transporte SSH tampoco equivale a una entrega completa desde GitHub; registra el resultado de la primera promoción por separado.

## Imagen al compartir enlaces

La imagen social se sirve como JPEG de 1200 × 630. Su URL incluye una huella del archivo que cambia automáticamente al desplegar una imagen nueva; Open Graph, Twitter y los datos estructurados usan la misma URL.

```sh
npm run assets:og
npm run build
```

Después, despliega la nueva compilación. Las peticiones a versiones retiradas se redirigen temporalmente a la imagen actual.

Comprueba el sitio y la dirección exacta compartida con [Sharing Debugger de Meta](https://developers.facebook.com/tools/debug/) y [Post Inspector de LinkedIn](https://www.linkedin.com/post-inspector/). Cada plataforma conserva su propia caché; reemplazar el archivo del servidor no elimina sus copias ni garantiza que cambien las publicaciones existentes.

En X y otras aplicaciones, compartir una URL con un parámetro nuevo, como `?preview=2`, puede provocar una consulta nueva, pero depende de cómo almacenen el enlace. El canonical del sitio permanece sin parámetros.
