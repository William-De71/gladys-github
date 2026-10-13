# GitHub

## Presentación

Sigue repositorios de GitHub desde Gladys: cada repositorio se convierte en un dispositivo con sus estrellas, forks, issues y pull requests abiertas, y su última versión, etiqueta, commit, issue, pull request y discusión. Las escenas reaccionan a una nueva versión, issue, pull request, discusión, commit, estrella o a las comprobaciones (CI) de la rama predeterminada. Tres widgets del panel muestran un repositorio, la actividad reciente y tu cuenta.

La integración consulta la API de GitHub (nube): nada más sale de tu red, y solo lee, nunca escribe en GitHub.

![Widget de repositorio (ilustración)](https://raw.githubusercontent.com/William-De71/gladys-github/main/docs/assets/widget-repository.svg)

## Requisitos

- Gladys Assistant 5.1.0 o posterior.
- Una cuenta de GitHub y un token de acceso personal. Un token **de grano fino** con el acceso «Public repositories» (solo lectura) basta para los repositorios públicos. Para repositorios privados, selecciónalos y concede en solo lectura «Metadata», «Contents», «Issues», «Pull requests» y «Discussions». Un token clásico sin ningún ámbito también funciona para los repositorios públicos.

## Configuración

1. Crea el token en [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Abre **Integraciones → GitHub**, pega el token y enumera los repositorios a seguir.
3. Guarda y pulsa **Probar la conexión**: muestra tu cuenta, la cuota de API restante y los repositorios leídos.

| Campo                    | Descripción                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Token de acceso personal | Obligatorio. Nunca se vuelve a mostrar ni se escribe en los registros.                 |
| Repositorios a seguir    | `propietario/nombre` o el enlace de github.com, separados por comas, 20 como máximo.   |
| Intervalo de lectura (s) | De 60 a 3600, 120 por defecto. Es también el retardo de los disparadores de escena.    |
| Idioma de los textos     | Nombres de los dispositivos y resúmenes de escenas. Automático: el idioma de tu panel. |

Una sola petición lo lee todo en cada ronda: a 120 segundos, la integración usa alrededor del 1 % de los 5000 puntos por hora que GitHub concede a un token.

## Uso

### Dispositivos

En la pestaña **Descubrir**, añade los repositorios y tu cuenta. Un repositorio ofrece: estrellas, forks, seguidores, issues abiertas, pull requests abiertas, pull requests fusionadas, discusiones, descargas de la última versión (si tiene archivos) y, como texto, la última versión, etiqueta, commit, issue, pull request y discusión. La cuenta ofrece seguidores, seguidos, repositorios públicos y gists públicos.

### Disparadores de escena

| Disparador                | Filtros                           | Variables                                        |
| ------------------------- | --------------------------------- | ------------------------------------------------ |
| Versión publicada         | repositorio, versión o preliminar | nombre, etiqueta, autor, enlace, resumen         |
| Issue abierta             | repositorio                       | número, título, autor, enlace, resumen           |
| Pull request abierta      | repositorio                       | número, título, autor, borrador, enlace, resumen |
| Discusión iniciada        | repositorio                       | número, título, autor, enlace, resumen           |
| Nuevo commit              | repositorio                       | rama, SHA, mensaje, autor, enlace, resumen       |
| Nueva estrella            | repositorio                       | estrellas, estrellas añadidas, enlace, resumen   |
| Comprobaciones terminadas | repositorio, superadas o fallidas | rama, SHA, mensaje, enlace, resumen              |

Ejemplos:

- Cuando sale una versión de un proyecto que usas → envíate un mensaje con `{{triggerEvent.data.summary}}`.
- Cuando fallan las comprobaciones de tu proyecto → pon en rojo la lámpara del despacho.
- Cuando tu repositorio recibe una estrella → reproduce un sonido en el altavoz.

La primera lectura tras un arranque sirve de referencia: no se repite nada de lo ocurrido mientras Gladys estaba apagado.

### Acción de escena

**GitHub: leer un repositorio** devuelve sus estrellas, forks, seguidores, issues y pull requests abiertas, su última versión (y su enlace), su último commit, sus comprobaciones y una frase de resumen. Un contador desconocido vale -1.

### Widgets

- **Repositorio de GitHub**: estrellas, forks, issues, pull requests, última versión, comprobaciones de la rama predeterminada y un enlace.
- **Actividad de GitHub**: las últimas versiones, issues, pull requests y commits de todos los repositorios (o de uno), con filtro.
- **Cuenta de GitHub**: seguidores, seguidos, repositorios públicos y la cuota de API restante.

## Solución de problemas

- **«GitHub ha rechazado el token»**: el token ha caducado o se ha revocado: crea uno nuevo.
- **«No encontrado o no permitido por el token»**: revisa el nombre del repositorio o da acceso al token (repositorio privado).
- **«Cuota de la API de GitHub agotada»**: otra herramienta usa el mismo token: aumenta el intervalo de lectura o usa un token propio. La lectura se reanuda sola.
- **Sin autor de las estrellas**: la integración solo recibe de GitHub el número de estrellas, no quién las ha dado.
- Para informar de un problema, abre una issue en [GitHub](https://github.com/William-De71/gladys-github/issues) con las versiones de Gladys y de la integración y los registros (`DEBUG=gladys-integration-sdk`).
