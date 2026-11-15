# 02 — Sign in

| | |
| :--- | :--- |
| **Ruta** | `/login` (`?expired=true` muestra aviso de sesión expirada) |
| **Archivo** | `frontend/src/app/login/page.tsx` |
| **Componentes** | `AppLayout` → `Suspense` → `LoginForm` |
| **Acceso** | Solo sin sesión. Si existe la cookie `artemis_auth_token` → redirect a `/`. |
| **Objetivo** | Autenticar a tripulantes y personal médico de vuelo. |

## Desktop

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ORBVITAL   Home  My Health  Log Reading  Routine  Missions  3D Orbit  Crew           │
│                                                            (⇥ Sign in) [Register]    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ fondo web1.jpg ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│                                                                                      │
│                       ┌─ surface-card · max-w-md · centrada ──┐                      │
│                       │                                       │                      │
│                       │  Sign in                              │                      │
│                       │  Sign in with your Orbvital crew or   │                      │
│                       │  flight medical personnel account.    │                      │
│                       │ ───────────────────────────────────── │                      │
│                       │                                       │                      │
│                       │ ┌───────────────────────────────────┐ │  ← solo si           │
│                       │ │ ⚠ Your session has expired. Please│ │    ?expired=true     │
│                       │ │   sign in again to continue.      │ │    (ámbar)           │
│                       │ └───────────────────────────────────┘ │                      │
│                       │ ┌───────────────────────────────────┐ │  ← solo si error     │
│                       │ │ ⚠ {errorMessage}                  │ │    (rojo)            │
│                       │ └───────────────────────────────────┘ │                      │
│                       │                                       │                      │
│                       │  Email address                        │                      │
│                       │  [ name@nasa.gov__________________ ]  │                      │
│                       │                                       │                      │
│                       │  Password                             │                      │
│                       │  [ ••••••••_______________________ ]  │                      │
│                       │                                       │                      │
│                       │  [            Continue             ]  │                      │
│                       │                                       │                      │
│                       │     Don't have an account? Register   │                      │
│                       └───────────────────────────────────────┘                      │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Móvil

```
┌──────────────────────────┐
│ ORBVITAL            [☰]  │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ Sign in              │ │
│ │ Sign in with your    │ │
│ │ Orbvital crew…       │ │
│ │──────────────────────│ │
│ │ Email address        │ │
│ │ [__________________] │ │
│ │ Password             │ │
│ │ [__________________] │ │
│ │ [     Continue     ] │ │
│ │ Don't have an        │ │
│ │ account? Register    │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

## Campos

| Campo | Tipo | Placeholder | Reglas |
| :--- | :--- | :--- | :--- |
| Email address | `email` | `name@nasa.gov` | Requerido, `trim()` |
| Password | `password` | `••••••••` | Requerido |

## Estados

| Estado | UI |
| :--- | :--- |
| Cargando (Suspense) | Bloque `surface-tinted` de 384 px con `animate-pulse` |
| Inicial | Formulario vacío |
| Sesión expirada | Callout ámbar arriba del formulario |
| Validación local | Callout rojo: `Enter your email and password.` |
| Enviando | Botón deshabilitado: `Signing in...` |
| Error API | Callout rojo con `ApiError.message` o `Unable to sign in. Check your credentials.` |
| Éxito | `router.push('/')` → 01 Home |

## Interacciones

- `Continue` → `useAuth().login({ email, password })`.
- `Register` → `/register` (03).
