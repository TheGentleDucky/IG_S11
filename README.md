# IG_S11 - Dispara a Pepe!

https://codesandbox.io/p/sandbox/busy-fermat-y9v8r9
## Descripción

Proyecto de Informática Gráfica desarrollado con **Three.js**, **Ammo.js** y **Tween.js**.

La aplicación consiste en una escena 3D interactiva en la que un esqueleto humano, Pepe. situado sobre una plataforma puede recibir impactos de proyectiles. Mediante un sistema de físicas, animaciones y efectos de sonido, el esqueleto reacciona a los golpes e intenta recuperar su postura original. Disfruta con su tortura, y riete cuando lo tiras

El proyecto combina simulación física, animación de estructuras articuladas y reproducción de audio para crear una escena interactiva.

## Funcionalidades

### Escena 3D
- Escenario con una plataforma texturizada y un fondo personalizado.
- Iluminación ambiental y direccional.
- Sombras y materiales para los elementos de la escena.
- Cámara controlable mediante `OrbitControls`.

### Pepe
- "Modelo" del esqueleto humano low poly importado mediante un archivo `.glb`.
- Armature compuesto por diferentes huesos articulados.
- Cuerpo físico representado mediante un collider de tipo cápsula.
- Postura inicial personalizada.
- Animación de reposo (*idle*), con pequeños movimientos de diferentes articulaciones.
- Animación de impacto (*hit*), modificando las rotaciones de los huesos.
- Animación de recuperación (*recover*), que devuelve progresivamente las articulaciones a su postura original.

### Sistema de proyectiles
- Creación de proyectiles esféricos con propiedades físicas.
- Disparo mediante la barra espaciadora.
- Dirección de lanzamiento determinada por la posición del cursor.
- Intervalo de 800 ms entre disparos.
- Detección de colisiones entre los proyectiles y el esqueleto mediante los puntos de contacto de Ammo.js.

### Efectos de sonido
- Reproducción de diferentes sonidos de impacto.
- Selección aleatoria de sonidos para variar los efectos.
- Evita repetir consecutivamente el mismo sonido cuando hay varias opciones disponibles.
- Sonido independiente cuando el esqueleto cae fuera de los límites de la plataforma.

### Física
- Simulación de cuerpos rígidos mediante Ammo.js.
- Gravedad y propiedades físicas configuradas para los diferentes objetos.
- Sincronización entre las transformaciones físicas y los modelos gráficos.
- Detección de la caída del esqueleto al abandonar la plataforma.

## Controles

| Control | Acción |
|---|---|
| Movimiento del ratón | Apuntar los proyectiles |
| Barra espaciadora | Disparar |
| Arrastrar con el ratón | Rotar la cámara |
| Rueda del ratón | Acercar o alejar la cámara |

## Tecnologías utilizadas

- **[Three.js](https://threejs.org/):** creación y representación de la escena 3D.
- **[Ammo.js](https://github.com/kripken/ammo.js/):** simulación física y detección de colisiones.
- **[Tween.js](https://github.com/tweenjs/tween.js/):** interpolación y animación de las articulaciones.
- **GLTFLoader:** carga del modelo tridimensional en formato GLB.
- **Parcel:** empaquetado y ejecución del proyecto.


## Recursos

El proyecto utiliza recursos externos almacenados en el directorio `src`:

- Modelo tridimensional de Pepe (`Eiskeleto.glb`).
- Texturas para el suelo y el fondo de la escena.
- Archivos de audio para los impactos y la caída del esqueleto.

## Repositorio

[IG_S11 - GitHub](https://github.com/TheGentleDucky/IG_S11)
