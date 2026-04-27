# Portfolio Overview React

Migracion del dashboard original de HTML/CSS/JavaScript puro a React.

## Estructura

```text
src/
  App.jsx       Componentes, estado principal y pantallas
  data.js       Matriz, productos y detalles
  main.jsx      Punto de entrada React
  styles.css    Estilos del dashboard
  utils.js      Formateadores y helpers
```

## Ejecutar

```bash
npm install
npm run dev
```

Luego abre la URL que muestre Vite, normalmente:

```text
http://localhost:5173
```

## Agregar mas detalles de producto

Anade una entrada en `src/data.js`, dentro de `PRODUCT_DETAILS`, usando el SKU como clave:

```js
export const PRODUCT_DETAILS = {
  "AT-93847": {
    sku: "AT-93847",
    type: "markdown",
    name: "Active Training T-Shirt",
    defaultScenario: "md10",
    scenarios: {
      md10: { label: "Markdown -10% (Recommended)", price: 19.9 }
    },
    series: [
      { d: 0, cur: 100, md10: 100 },
      { d: 180, cur: 24, md10: 0 }
    ]
  }
};
```

Si un producto no tiene detalle completo, la app genera automaticamente un detalle basico usando los datos de la tabla.
