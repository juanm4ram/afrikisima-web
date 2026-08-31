# assets/

Materiales **fuente**. Nada de acá se sirve en la web: las versiones optimizadas
que usa el sitio viven en `public/`.

```
assets/
├─ brand/    logo original y sus variantes (svg, png, png sobre blanco)
└─ photos/   fotos originales de las tortas, como salieron del teléfono (.heic/.mov)
```

## De acá a `public/`

Las fotos originales son HEIC de ~2 MB: el navegador no las muestra y pesan
demasiado. Para incorporar una foto nueva al catálogo, convertirla a WebP
cuadrado de 1400 px y dejarla en `public/products/`:

```bash
convert "assets/photos/Torta nueva.heic" -auto-orient \
        -resize 1400x1400^ -gravity center -extent 1400x1400 \
        -quality 82 public/products/torta-nueva.webp
```

(Requiere ImageMagick. En Windows: `winget install ImageMagick.ImageMagick`.)

Después agregar el producto en `src/features/catalog/data/products.ts`
apuntando a `/products/torta-nueva.webp`.

## Sobre el control de versiones

`assets/photos/` está en el `.gitignore`: son ~50 MB de originales de cámara que
no hacen falta para compilar el sitio, y hacen lento cada `git push` y cada
deploy. Conviene respaldarlos aparte (Drive, disco externo).

Si preferís versionarlos igual, borrá la línea `/assets/photos/` del `.gitignore`.
