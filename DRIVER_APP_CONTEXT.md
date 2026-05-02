# Cross-App Integration Context: Vypaar Express Driver App

This document serves as the technical integration contract and domain context for building the **Vypaar Express Driver App**. It outlines the existing database schemas, state lifecycles, and backend architectures implemented by the companion Fleet Manager application.

## 1. System Overview & Domain Model

The Vypaar Express system is a multi-tenant logistics management platform. It uses a serverless architecture powered by **Supabase** (PostgreSQL, GoTrue Auth, Storage, and Realtime). 

### Core Entities
*   **Tenants (Companies):** The top-level partition. All records belong to a specific `tenant_id`.
*   **Users (Fleet Managers):** Authenticated users who manage the fleet for a tenant.
*   **Trucks:** Vehicles registered to a tenant.
*   **Drivers:** Personnel registered to a tenant who can be assigned to trips.
*   **Trips (LRs - Lorries Receipts):** The central domain object representing a logistics load, containing origin, destination, goods, and financial data.
*   **Trip Photos:** Images uploaded during a trip's lifecycle (e.g., Proof of Delivery).

### Relationships
*   A **Trip** has exactly one **Truck** and one **Driver** assigned.
*   A **Trip** belongs to one **Tenant**.
*   A **Trip** can have multiple **Senders** and **Receivers** (stored as JSON arrays).
*   A **Trip** can have multiple **Trip Photos** linked via `trip_id`.

---

## 2. Shared Data Structures

The companion Driver App must strictly adhere to the following payload structures to maintain compatibility with the Fleet Manager's UI and PostgreSQL schema.

```typescript
// Driver Entity
interface Driver {
  id: string; // UUID
  tenant_id: string; // UUID
  name: string;
  phone: string; // Potential unique identifier for Driver Auth
  license_number: string;
  license_expiry: string; // ISO Date String
  status: 'AVAILABLE' | 'ON_TRIP';
  driver_tag: 'Company' | 'Market' | 'Custom';
  custom_driver_tag?: string;
}

// Truck Entity
interface Truck {
  id: string; // UUID
  tenant_id: string; // UUID
  registration_number: string;
  truck_type: string; // e.g., "Mini Truck", "19ft Open", "Multi-axle"
  status: 'AVAILABLE' | 'ON_TRIP';
}

// Trip Entity
interface Trip {
  id: string; // UUID
  tenant_id: string; // UUID
  lr_number: string; // Auto-generated string (e.g., "LR-1024")
  truck_id: string; // UUID (Foreign Key)
  driver_id: string; // UUID (Foreign Key)
  status: 'LR_CREATED' | 'IN_TRANSIT' | 'DELIVERED' | 'SETTLED';
  origin: string;
  destination: string;
  senders: { name: string; phone: string }[]; // JSONB
  receivers: { name: string; phone: string }[]; // JSONB
  receiver_name: string; // Legacy/Fallback field
  receiver_phone: string; // Legacy/Fallback field
  goods_description: string;
  weight_kg: number;
  freight_amount: number;
  goods_value: number | null;
  ewaybill_required: boolean;
  lr_pdf_url: string | null;
  created_at: string; // ISO Timestamp
}

// Trip Photo Entity
interface TripPhoto {
  id: string; // UUID
  trip_id: string; // UUID (Foreign Key)
  photo_type: 'LOADING' | 'UNLOADING' | 'POD';
  photo_url: string; // Public Supabase Storage URL
  created_at: string; // ISO Timestamp
}
```

---

## 3. API Contracts & Backend Communication

Since the system uses Supabase, the Driver App will communicate directly with the Supabase REST API via `@supabase/supabase-js`. 

### A. Fetching Assigned Trips
*   **Method:** `GET` (Supabase `.select()`)
*   **Route:** `/rest/v1/trips`
*   **Query Params:** `driver_id=eq.{driver_id}` & `status=in.(LR_CREATED,IN_TRANSIT)`
*   **Purpose:** Load the active itinerary for the authenticated driver.

### B. Updating Trip Status
*   **Method:** `PATCH` (Supabase `.update()`)
*   **Route:** `/rest/v1/trips?id=eq.{trip_id}`
*   **Payload:** `{ "status": "IN_TRANSIT" }`
*   **Note:** Changing status to `DELIVERED` must ideally also update the associated `trucks` and `drivers` rows back to `status: 'AVAILABLE'`. In the Fleet Manager app, this is handled synchronously.

### C. Uploading Photos (POD / Loading)
This is a two-step process:
1.  **Storage Upload:**
    *   **Method:** `POST`
    *   **Route:** `/storage/v1/object/trip-photos/{tenant_id}/{trip_id}-{type}-{timestamp}.jpg`
    *   **Payload:** Binary Image Data (JPEG)
2.  **Database Record:**
    *   **Method:** `POST`
    *   **Route:** `/rest/v1/trip_photos`
    *   **Payload:** `{ "trip_id": "{trip_id}", "photo_type": "POD", "photo_url": "{public_url_from_step_1}" }`

---

## 4. State & Status Lifecycles

### Trip Lifecycle
1.  **`LR_CREATED`**: The trip is drafted and assigned to a driver. (Driver is `ON_TRIP`).
2.  **`IN_TRANSIT`**: The driver has begun the journey. Fleet Manager shows "Live Tracking active".
3.  **`DELIVERED`**: The driver has reached the destination and submitted the Proof of Delivery (POD). (Driver becomes `AVAILABLE`).
4.  **`SETTLED`**: The Fleet Manager has reconciled the finances (Driver app rarely interacts with this).

### Real-time Sync
*   The Fleet Manager app actively listens to Postgres changes via `supabase.channel('trip_updates')`.
*   Any status changes or `trip_photos` inserts made by the Driver App will instantly reflect on the manager's dashboard without needing manual WebSocket orchestration.

---

## 5. Authentication & Authorization Flow

*   **Current Setup:** Authentication heavily revolves around the `users` table, which maps a Supabase `auth.uid()` to a `tenant_id`. Row Level Security (RLS) policies enforce that users can only view/edit data where `tenant_id = auth.jwt()->>user_tenant_id`.
*   **Role-Based Access:** Currently, the system assumes anyone authenticated is a Fleet Manager. There is no explicit RBAC separating "Manager" from "Driver" in the active auth setup.

---

## 6. Blind Spots & Necessary Backend Additions for the Driver App

The Fleet Manager codebase reveals several missing components that must be architected for the Driver App to function:

1.  **Driver Authentication Mechanism:** 
    *   Drivers exist only as rows in the `drivers` table. They are *not* mapped to Supabase `auth.users`. 
    *   *Requirement:* You must implement a Phone OTP login flow (`supabase.auth.signInWithOtp()`) and a database trigger/RPC to link the resulting `auth.uid()` to the `drivers` table row.
2.  **Location Tracking Infrastructure:**
    *   The Fleet Manager UI displays a "Live Tracking active" stub when a trip is `IN_TRANSIT`. However, **no database table exists for GPS pings**.
    *   *Requirement:* Create a `location_updates` table (`trip_id`, `lat`, `lng`, `timestamp`) or utilize Supabase Realtime Broadcasts if historical path tracing isn't required.
3.  **Loading/Unloading Photos:**
    *   The Fleet Manager's UI expects and filters for `LOADING` and `UNLOADING` photos in the `trip_photos` grid, but its own camera feature only uploads `POD` photos. 
    *   *Requirement:* The Driver app must be the primary producer of `LOADING` and `UNLOADING` image payloads.
4.  **Security / RLS Limitations:**
    *   Currently, drivers have no RLS policies scoped to them. 
    *   *Requirement:* RLS policies must be updated so a Driver token can only read `trips` where `trips.driver_id = auth.uid()` and can only update `status` and insert `trip_photos`.
