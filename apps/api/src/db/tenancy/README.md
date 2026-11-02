# Tenancy por aliado

D1 es SQLite y **no tiene RLS**. El aislamiento se aplica en la capa de
aplicación con un wrapper sobre Drizzle (`scopeDb`). Toda ruta debe usar
`c.get('db')`; esa instancia ya viene envuelta con el scope de la request.

## Scopes

| Scope     | Origen                                        | Comportamiento                              |
| --------- | --------------------------------------------- | ------------------------------------------- |
| `admin`   | sesión con `role = 'admin'` o `'collaborator'` | sin filtro; acceso global                   |
| `partner` | sesión de rol de aliado con `partnerId`       | agrega `partner_id = <sesión>` a cada query |
| `system`  | `/api/setup`, `/api/invites`                  | operaciones internas acotadas               |
| `deny`    | cualquier otro request sin sesión             | falla cerrado                               |

El scope nunca sale de un parámetro del cliente.

## Clasificación de tablas

Toda tabla del schema debe estar en `registry.ts`. Si se agrega una tabla y se
olvida, `resolveTablePolicy` lanza error y el test de completitud falla.

- **Tenant**: tiene `partnerId` (o `id` en `partners`). El wrapper filtra por el
  aliado y, en inserts, inyecta/valida el `partnerId`.
- **Global**: no tiene tenant; se permite explícitamente (`exchange_rate`,
  `healthcheck`) o solo al admin (`session`, `account`, `verification`).

## Reglas para una tabla tenant nueva

1. Agregar `partnerId: text('partner_id').notNull()` con FK e índice.
2. Registrarla en `registry.ts` con las operaciones permitidas por scope.
3. Definir `insertPartner`:
   - `partner: 'force'` si el aliado crea filas (ej. ventas).
   - `admin: 'require'` si el admin debe indicar el aliado.
   - `optional` solo si el `partner_id` puede ser null.
4. Para tablas hijas (ej. ítems de una venta), agregar una FK compuesta
   `(hijo_id, partner_id) → (padre_id, partner_id)`. Así la DB también impide
   cruzar aliados.
5. Agregar tests de lectura, escritura y join cruzado.

## Reglas de consulta

- `select` sin `where` se filtra automáticamente.
- `where` se combina con `AND`; no se puede ampliar el resultado.
- `update`/`delete` exigen `where` explícito.
- `insert` de un aliado fuerza `partnerId`; si mandan otro, error.
- Joins sobre tablas tenant agregan la condición también al `ON`.
- `batch` solo acepta queries construidas con el wrapper (atomicidad para
  ventas + ítems).
- No se permite SQL crudo (`run`, `all`, `get`, `values`, `execute`), CTEs,
  subqueries en `from` ni transacciones interactivas.
- Las rutas partner deben usar proyecciones explícitas y evitar subqueries
  escalares/SQL crudo en campos de `select`; el wrapper filtra filas, no
  columnas.

## Catálogo

`products`, `product_categories` y `product_price_history` son tablas tenant.
En esta fase el `admin` escribe y los demás roles leen el catálogo que les
corresponde. `collaborator` puede leer el catálogo de todos los aliados si tiene
el módulo `catalog`; `partner_admin` y `partner_collaborator` leen únicamente su
propio catálogo. La tabla `products` usa una FK compuesta
`(category_id, partner_id)` para que una categoría de otro aliado no pueda
asignarse ni siquiera desde una ruta admin. El historial de precios conserva el
nombre del actor para que el aliado pueda leerlo sin acceder a la tabla global
`user`.

## Permisos por módulo

`admin` y `partner_admin` tienen acceso total. `collaborator` y
`partner_collaborator` guardan en `user.module_access` un JSON con los módulos
habilitados. `requireModule` en la API y `canAccessPath` en la web fallan cerrado.
Los módulos de administración (`/api/admin/*`) siguen reservados al rol
`admin`; los colaboradores no pueden gestionar aliados, usuarios ni
invitaciones.

## Defensa en profundidad

- Trigger `user_partner_required`: los roles de aliado no pueden quedar sin
  aliado y los roles globales no pueden tener aliado.
- Índices por `partner_id` y `(partner_id, created_at)`.
- `pnpm test` (Vitest + SQLite en memoria) y `check-tenancy.mjs` en
  `pnpm check`.
