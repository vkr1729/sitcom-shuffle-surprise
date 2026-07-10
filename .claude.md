# Universal Agent Rules

> This file contains the core engineering principles for all AI models (Claude, Gemini, Kimi, MiniMax, GLM, etc.).
> All models are capable of any role (Planning, Implementing, Reviewing) and must follow these rules strictly.

---

## 🧠 Core Engineering Principles

### 1. Karpathy Principles
*   **Think Before Coding:** State assumptions and design decisions before editing code. Never make silent assumptions.
*   **Simplicity First:** Write the absolute minimum code required. Avoid speculative abstractions.
*   **Surgical Changes:** Modify only the files and lines necessary. Match the host repo's style. No drive-by formatting.
*   **Goal-Driven Execution:** Every change must map to a checklist item and a success criterion.

### 2. State Portability & Second Brain
*   **Workspace is Source of Truth:** `implementation_plan.md` must be kept current after every action.
*   **Plan Synchronization:** Whenever you write or update `implementation_plan.md` or `success_criteria.md` in your internal artifact folder, you MUST immediately synchronize the identical content directly to the project root directory.
*   **Actionable Capture:** Capture key debugging configurations, tricky commands, and design trade-offs in `## ⚠️ Blockers / Open Questions`.

### 3. Unix & Pragmatic Programmer Rules
*   **DRY:** Single, unambiguous representation for every piece of logic. If you wrote the same code twice, extract it.
*   **ETC (Easy to Change):** Keep interfaces clean and code decoupled.
*   **Crash Early:** Never catch exceptions silently. Log failures noisily and exit early on invalid states.

### 4. Context Hub (chub) Documentation Retrieval
*   Before writing integration code for external APIs/libraries, use `chub search <query>` and `chub get <id>` to fetch up-to-date docs.
*   Keep cache fresh with `chub update`. Record quirks with `chub annotate`.

### 5. High-Performance Python Tooling (uv)
*   Use `uv venv`, `uv pip install`, and `uvx <tool>` instead of standard `venv`/`pip`.

---

## 🛡️ Mobile Longevity & Anti-Overengineering Protocol

To ensure software longevity (2-3+ years of "develop-and-forget" stability), low runtime error rates, and rapid debugging, all planning and coding must strictly follow these rules:

### 1. Flat "Boring Code" Architecture (Anti-Overengineering)
*   **Max 2 Layers:** Standard applications must be flat. Strictly use only the UI layer and a single Controller/ViewModel/Store layer. Absolutely no repository layers, interactor modules, custom presenters, data transfer objects (DTOs), or data-mapper files unless explicitly requested or working in an existing heavily-layered codebase.
*   **No Speculative Protocols/Interfaces:** Write concrete classes, structs, or files directly. Do not define a Swift Protocol, Kotlin Interface, or TypeScript Interface unless there are *at least two* distinct concrete implementations that will run simultaneously. Defining protocols/interfaces for "future mockability" or "decoupling" is strictly forbidden.
*   **First-Party & Stable SDKs Only:** Rely strictly on official platform frameworks (Swift Standard Library, SwiftUI, UIKit, Foundation, Kotlin Standard Library, Jetpack Compose, Jetpack ViewModel, Room, SQLite). Do not pull in third-party libraries for layouts, networking, UI components, state management, or utilities unless they are industry-standard LTS releases and there is zero alternative.
*   **No "Architecture Hype":** Avoid complex, highly-abstracted architectural frameworks (e.g., TCA / Composable Architecture on iOS, clean architecture with domain/data/presentation submodules on Android). Use simple, native unidirectional data flow (MVVM or basic State/Observable).

### 2. Sandbox, Platform & Offline Resilience
*   **Defensive API Usage:** Never use experimental, beta, or newly introduced APIs. Use APIs that have been stable for at least 2 major OS versions to prevent fast deprecation.
*   **Strict Exception & Failure Boundaries:** Wrap all networking, database queries, file system I/O, and JSON serialization in robust `try-catch` / `runCatching` blocks. The app must *never* crash due to unexpected payloads or missing files; it must degrade gracefully, show a helpful, user-friendly error UI, and offer a retry action.
*   **Pure Logic Decoupling (Mock-less Core Testing):** Keep core business logic, parsers, and state machine transitions strictly decoupled from platform UI libraries (no `import UIKit` or `import android.content` in pure logic files).

### 3. Sandbox Mitigation & Verification Strategy
*   **Stubbed Hardware Providers:** When dealing with hardware or sandboxed APIs (Camera, GPS), always implement a stub/mock mock-provider class controlled by a build flag. This ensures the app can run fully in a standard emulator.
*   **Developer Diagnostics Screen:** Implement a hidden "Developer Diagnostics Panel" in the app (triggered by a shake gesture or multi-tap). It must display recent HTTP logs, permissions, local DB inspector, and buttons to clear cache/copy logs.

---

## 🚨 Git Safety Rule
- **NEVER** stage or commit: `.claude.md`, `.agents/AGENTS.md`, `implementation_plan.md`, `success_criteria.md`, `.plan_state.json`, or `.bugfix_plan.md`.
- Verify `git status` before making any commits.
