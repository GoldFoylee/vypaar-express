# Project Context: Vypaar Express

This document provides a comprehensive overview of the Vypaar Express project, detailing its purpose, architecture, tech stack, and core logic. It is designed to serve as a standalone context file for AI agents and developers.

## 1. High-Level Overview
*   **Project Purpose:** Vypaar Express is a logistics and fleet management platform designed for the Indian market ("Vypaar" meaning business). It aims to digitize the logistics workflow, eliminating paperwork for truck owners and operators.
*   **Core Features:**
    *   **Fleet Management:** Track and manage a fleet of trucks, including registration details and status.
    *   **Driver Management:** Maintain a directory of drivers and their current availability.
    *   **Trip Management:** Create and track logistics trips (LR - Lorries Receipt). Includes a multi-step trip creation flow with drafting capabilities.
    *   **Real-time Dashboard:** View key metrics like active trips, available trucks, and monthly freight revenue.
    *   **Company Onboarding:** Multi-tenant architecture where users set up their company/tenant before using the app.

## 2. Tech Stack & Dependencies
*   **Languages & Frameworks:**
    *   **Frontend:** React Native with **Expo** (v54).
    *   **Routing:** **Expo Router** (File-based navigation).
    *   **Language:** TypeScript.
*   **Key Libraries/Dependencies:**
    *   **Backend/Auth:** `@supabase/supabase-js` - Handles authentication and real-time database interactions.
    *   **State Management:** `zustand` - Used for global application state (session, user) and feature-specific state (trip drafts).
    *   **Forms:** `react-hook-form` + `zod` - For robust form handling and validation.
    *   **UI/Icons:** `lucide-react-native` and `expo-symbols`.
    *   **Storage:** `@react-native-async-storage/async-storage` - For session persistence.
*   **Infrastructure/Deployment:**
    *   The app is configured for universal deployment (iOS, Android, Web) via Expo.
    *   Supabase is used as a managed backend-as-a-service.

## 3. Architecture & Data Flow
*   **System Architecture:**
    *   The application follows a **Serverless** architecture. The frontend communicates directly with **Supabase** for Auth and Data.
    *   **Multi-tenancy:** Data is partitioned by `tenant_id` to support multiple companies on the same platform.
*   **Data Flow (Trip Creation Example):**
    1.  **Drafting:** User starts creating a trip. The data is stored in `useTripStore` (Zustand) to persist across multiple screens (Step 1, Step 2, etc.).
    2.  **Validation:** Upon final submission, `react-hook-form` and `zod` validate the entire payload.
    3.  **Persistence:** The validated data is pushed to the `trips` table in Supabase via the Supabase client.
    4.  **Update:** The dashboard and trips list fetch updated data using real-time listeners or manual refreshes.
*   **State Management:**
    *   **Global State (`useStore`):** Manages user session, user profile, and current `tenantId`.
    *   **Feature State (`useTripStore`):** Manages the complex state of a trip draft before it is committed to the database.

## 4. Directory Structure & Key Files
```text
.
├── app/                  # Main application routes (Expo Router)
│   ├── (onboarding)/     # Login, Signup, and Company Setup flows
│   ├── (tabs)/           # Main app tabs: Dashboard, Trips, Trucks, Drivers
│   ├── (trip)/           # Multi-step flow for creating new trips
│   ├── (trip-details)/   # Dynamic route for viewing specific trip information
│   ├── _layout.tsx       # Root layout handling fonts, themes, and auth state listeners
│   └── index.tsx         # Initial entry point (handles auth redirection)
├── components/           # Reusable UI components
│   ├── ui/               # Atomic components like Button, Input, StatusPill
│   └── ...               # Feature-specific UI components
├── constants/            # Theme constants, colors, and global configuration
├── hooks/                # Custom React hooks (theme, color scheme)
├── lib/                  # External library configurations
│   └── supabase.ts       # Supabase client initialization with SSR-safe storage
├── store/                # Zustand state management
│   ├── useStore.ts       # Core app state (auth, tenant)
│   └── useTripStore.ts   # State for the trip creation wizard
├── assets/               # Fonts, images, and static resources
├── package.json          # Dependency manifest and scripts
└── tsconfig.json         # TypeScript configuration
```

## 5. Core Logic & Important Algorithms
*   **Auth Redirection Logic (`app/index.tsx`):**
    The app uses a splash-style entry point that checks for an active session and a `tenantId`. It intelligently routes users to either the login flow, company setup, or the main dashboard to ensure they are never in an invalid state.
*   **SSR-Safe Supabase Client (`lib/supabase.ts`):**
    Includes a custom storage adapter for Supabase that checks for `window` availability. This prevents crashes during Server-Side Rendering (SSR) in web builds when accessing `AsyncStorage`.
*   **Dashboard Metrics Aggregation (`app/(tabs)/index.tsx`):**
    Uses multiple parallel Supabase queries to aggregate counts for active trips and available trucks, while calculating monthly revenue via client-side reduction of filtered records.

## 6. Setup & Execution Instructions
*   **Prerequisites:** Node.js, npm/yarn, and Expo Go (for mobile testing).
*   **Local Setup:**
    1.  Clone the repository.
    2.  Install dependencies: `npm install`.
*   **Environment Variables:**
    *   The Supabase URL and Anon Key are currently hardcoded in `lib/supabase.ts` (should be moved to `.env` for production).
*   **Running the App:**
    *   **Start Expo:** `npx expo start`
    *   **iOS/Android:** Press `i` or `a` respectively.
    *   **Web:** Press `w`.

## 7. Current State & Pending Tasks
*   **Current Focus:** The project recently addressed SSR storage issues for web compatibility. The core logistics entities (Trucks, Drivers, Trips) are implemented.
*   **Pending/In-Progress:**
    *   The "Explore" tab appears to be a placeholder or basic view.
    *   Metrics on the dashboard currently use some mocked data for "Expiring Soon" items.
    *   Transitioning hardcoded Supabase credentials to environment variables.
    *   Advanced trip tracking (GPS/Maps) is not yet visible in the core logic.
