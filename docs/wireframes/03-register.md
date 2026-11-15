# 03 — Register

| | |
| :--- | :--- |
| **Ruta** | `/register` |
| **Archivo** | `apps/frontend/src/app/register/page.tsx` |
| **Componentes** | `AppLayout` → `RegisterForm` |
| **Acceso** | Solo sin sesión. Si existe la cookie `artemis_auth_token` → redirect a `/`. |
| **Objetivo** | Crear una cuenta para registrar signos vitales y la rutina diaria de contramedidas. |

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
│                       │  Create account                       │                      │
│                       │  Register to track your vital signs   │                      │
│                       │  and daily countermeasure routine.    │                      │
│                       │                                       │                      │
│                       │ ┌───────────────────────────────────┐ │  ← solo si error     │
│                       │ │ ⚠ {errorMessage}                  │ │    (rojo)            │
│                       │ └───────────────────────────────────┘ │                      │
│                       │                                       │                      │
│                       │  Full name                            │                      │
│                       │  [ Jeremy Hansen__________________ ]  │                      │
│                       │                                       │                      │
│                       │  Email address                        │                      │
│                       │  [ j.hansen@nasa.gov______________ ]  │                      │
│                       │                                       │                      │
│                       │  Password                             │                      │
│                       │  [ Minimum 6 characters___________ ]  │                      │
│                       │                                       │                      │
│                       │  Confirm password                     │                      │
│                       │  [ Repeat your password___________ ]  │                      │
│                       │                                       │                      │
│                       │  [            Register             ]  │                      │
│                       │                                       │                      │
│                       │    Already have an account? Sign in   │                      │
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
│ │ Create account       │ │
│ │ Register to track…   │ │
│ │                      │ │
│ │ Full name            │ │
│ │ [__________________] │ │
│ │ Email address        │ │
│ │ [__________________] │ │
│ │ Password             │ │
│ │ [__________________] │ │
│ │ Confirm password     │ │
│ │ [__________________] │ │
│ │ [     Register     ] │ │
│ │ Already have an      │ │
│ │ account? Sign in     │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

## Campos y validaciones (en orden)

| Campo | Tipo | Placeholder | Regla → mensaje |
| :--- | :--- | :--- | :--- |
| Full name | `text` | `Jeremy Hansen` | Requerido → `Complete all fields to continue.` |
| Email address | `email` | `j.hansen@nasa.gov` | Requerido → `Complete all fields to continue.` |
| Password | `password` | `Minimum 6 characters` | ≥ 6 caracteres → `Password must be at least 6 characters.` |
| Confirm password | `password` | `Repeat your password` | Igual a Password → `Passwords do not match.` |

## Estados

| Estado | UI |
| :--- | :--- |
| Inicial | Formulario vacío |
| Error de validación / API | Callout rojo arriba del formulario (`ApiError.message` o `Could not create account. Please try again.`) |
| Enviando | Botón deshabilitado: `Creating account...` |
| Éxito | `router.push('/')` → 01 Home (sesión iniciada) |

## Interacciones

- `Register` → `useAuth().register({ name, email, password })`.
- `Sign in` → `/login` (02).
