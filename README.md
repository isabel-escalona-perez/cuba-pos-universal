# Cuba POS Universal

Aplicación profesional **offline-first** para actores económicos cubanos (mipyme privada/estatal/mixta, CNA, TCP).

- **Inventario** completo
- **Punto de venta (POS)** multimoneda CUP/USD
- **Arqueo de billetes y monedas** (denominaciones cubanas + USD)
- **Autodiagnóstico fiscal ONAT** (umbral 500 000 CUP)
- Compatible con **Android 5.0+** (PWA + Capacitor 6)
- Preparado para Transfermóvil y EnZona
- APK objetivo ≤ 50 MB

## Requisitos para generar el APK

1. Node.js 18+
2. Android Studio (o Android SDK + JDK 17)
3. Variables de entorno `ANDROID_HOME` configuradas

## Instalación y build del APK

```bash
# 1. Clonar
git clone https://github.com/luiseilerys/cuba-pos-universal.git
cd cuba-pos-universal

# 2. Instalar dependencias
npm install

# 3. Construir la PWA
npm run build

# 4. Añadir plataforma Android (solo la primera vez)
npx cap add android

# 5. Sincronizar
npx cap sync android

# 6. Abrir en Android Studio
npx cap open android
```

En Android Studio:
- File → Project Structure → SDK Location (verifica Android SDK)
- Build → Build Bundle(s) / APK(s) → Build APK(s)
- El APK debug estará en `android/app/build/outputs/apk/debug/app-debug.apk`

### Build por línea de comandos (requiere SDK)

```bash
cd android
./gradlew assembleDebug
```

## Configuración de minSdk para Android 5+

Capacitor 6 soporta oficialmente Android 5.1 (API 22).  
Para forzar compatibilidad máxima, en `android/app/build.gradle` se puede ajustar:

```gradle
android {
    defaultConfig {
        minSdkVersion 22   // o 21 si se prueba exhaustivamente con WebView actualizable
        targetSdkVersion 34
    }
}
```

**Importante**: La WebView de Android 5+ se actualiza de forma independiente. La app funciona con Chrome/WebView 61+.

## Estructura del proyecto

```
src/
├── modules/
│   ├── onboarding/     # Autodiagnóstico fiscal obligatorio
│   ├── pos/            # Punto de venta
│   ├── cash/           # Arqueo de billetes
│   ├── inventory/      # (expandir)
│   ├── dashboard/
│   └── settings/
├── offline/            # Motor de sincronización (IndexedDB + outbox)
├── components/
└── lib/
```

## Características del esqueleto actual

- Asistente de primera ejecución completo (6 pasos ONAT)
- POS con carrito, cambio de moneda CUP/USD y registro offline
- Arqueo con todas las denominaciones principales CUP + USD, semáforo de diferencias
- Indicador de estado de red en tiempo real
- Almacenamiento local con IndexedDB + Capacitor Preferences
- Diseño táctil optimizado para tablets 1024×600

## Próximos pasos recomendados

1. Completar módulo de inventario (productos, kardex, movimientos)
2. Implementar motor de sincronización bidireccional real
3. Integrar plugins de impresora térmica y lector de códigos
4. Añadir stubs de Transfermóvil / EnZona con interfaces
5. Configurar GitHub Actions para generar APK automáticamente en cada release

## Licencia

Proyecto de código abierto orientado al mercado cubano y exportación futura.
