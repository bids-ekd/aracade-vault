# CLAUDE.md

Este archivo ofrece guía a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

@AGENTS.md

## Descripción del proyecto

Arcade Vault es una plataforma para jugar online y competir por la mayor cantidad de puntos (ver README.md). El código es actualmente el scaffold recién generado por `create-next-app` — todavía no existe lógica de juego, rutas ni componentes propios más allá de la plantilla por defecto (`app/layout.tsx`, `app/page.tsx`).

## Stack tecnológico

- Next.js 16.2.12 (App Router, directorio `app/`)
- React 19.2.4
- TypeScript (modo strict, alias de rutas `@/*` → raíz del repo)
- Tailwind CSS v4, cargado vía `@tailwindcss/postcss` y configurado con `@theme inline` en `app/globals.css` (sin `tailwind.config.*` separado)
- ESLint 9 con configuración flat (`eslint.config.mjs`) usando los rule sets `core-web-vitals` y `typescript` de `eslint-config-next`

## Comandos

- `npm run dev` — inicia el servidor de desarrollo
- `npm run build` — build de producción
- `npm run start` — ejecuta el build de producción
- `npm run lint` — lint con ESLint

Todavía no hay un test runner configurado.

## Crítico: este no es el Next.js que conoces

Según AGENTS.md, este proyecto fija una versión de Next.js con cambios incompatibles respecto a versiones anteriores con las que puedas haber entrenado. Antes de escribir o modificar cualquier código relacionado con Next.js (routing, data fetching, configuración, metadata, server/client components, etc.), lee la guía correspondiente en `node_modules/next/dist/docs/` (organizada en `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) y respeta los avisos de deprecación que encuentres. No asumas que las APIs de versiones anteriores de Next.js siguen aplicando.

## Flujo de trabajo previsto

El README.md indica que este proyecto pretende seguir un flujo de trabajo de diseño guiado por especificaciones (comandos `/spec` y `/spec-impl`), basado en https://github.com/Klerith/fernando-skills, instalable con `npx skills@latest add Klerith/fernando-skills`. Estas skills no están instaladas actualmente en `.claude/`.
