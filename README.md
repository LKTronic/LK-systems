# LK-Tronic Product Management System (PMS)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](#technology-stack)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](#technology-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](#technology-stack)
[![Prisma](https://img.shields.io/badge/Prisma-5-2d3748?logo=prisma&logoColor=white)](#technology-stack)
[![MySQL](https://img.shields.io/badge/MySQL-Relational%20DB-4479a1?logo=mysql&logoColor=white)](#technology-stack)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss&logoColor=white)](#technology-stack)
[![Security](https://img.shields.io/badge/Security-RBAC%20%7C%20Audit%20Logged-10b981.svg)](#security--governance)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-emerald.svg)](#executive-summary)

---

## Executive Summary

The **LK-Tronic Product Management System (PMS)** is an enterprise-grade inventory, quotation, and catalog orchestration platform developed specifically for LK-Tronic. The system serves as the central operational backbone bridging internal procurement workflows, multi-tiered supplier quotations, and customer-facing e-commerce operations.

By establishing a unified repository, PMS consolidates local warehouse inventory with live online store products, automates landing cost calculations across foreign currencies, enforces strict price expiration governance, and coordinates overseas supplier quote cycles.

---

## Technology Stack

The platform is engineered using modern full-stack web and enterprise data technologies, structured for high throughput, type safety, and real-time operational reliability:

| Layer / Domain | Technology | Operational Function |
| :--- | :--- | :--- |
| **Application Runtime** | **Next.js 16 (App Router)** | Full-stack platform utilizing React Server Components (RSC) and high-performance serverless Route Handlers. |
| **Frontend Framework** | **React 19** | Concurrent UI rendering with component hydration for dynamic catalog manipulation. |
| **Language & Typing** | **TypeScript 5** | Strict end-to-end static type governance across database models, API payloads, and client states. |
| **Database & ORM** | **MySQL & Prisma ORM 5** | Normalized relational data persistence, schema migrations, and type-safe query generation. |
| **Authentication & AuthZ** | **NextAuth.js (Auth.js)** | Secure JWT-based session state management, credential verification, and role-based route guard middleware. |
| **Cryptography** | **Bcrypt.js** | Salted multi-round cryptographic hashing of user authentication credentials. |
| **Styling & Design System** | **Tailwind CSS v4** | Modern utility-first responsive styling configured with specialized visual badge tokens and dark/light themes. |
| **Data Validation** | **Zod** | Runtime schema validation, request payload sanitization, and environment configuration assertions. |
| **Form Management** | **React Hook Form** | High-performance uncontrolled form handling with minimized re-renders for large catalog edit flows. |
| **Office Automation** | **ExcelJS** | Server-side Excel `.xlsx` generation with embedded high-resolution product imagery and formula injection defense. |
| **Iconography** | **Lucide React** | Comprehensive, accessible SVG icon suite tailored for enterprise administrative interfaces. |
| **External Integrations** | **WooCommerce REST API v3** | Authenticated consumer key/secret integration for bi-directional e-commerce catalog and stock level synchronization. |

---

## Key Business Capabilities

### 1. Unified Multi-Source Catalog
* **Dual-Source Architecture**: Unifies local PMS inventory and the live online store (`lk-tronics.com`) into a single, high-performance operational table.
* **Instant Visual Differentiation**:
  * **🌐 Online Web Products**: Identified with dedicated orange typography, visual badges, direct storefront hyperlinks, and live stock tracking.
  * **📦 PMS Local Products**: Highlighted in distinctive blue badges with full internal record tracking, supplier links, and cost history.
* **Intelligent Search & Filtering**: Multi-parameter search spanning Model & Name, SKU, Internal Record Numbers, Categories, Suppliers, Stock Status, and Price Statuses.

### 2. Live Web Store Synchronization Engine
* **Automated Periodic Sync**: Background synchronization engine regularly queries the WooCommerce REST API to ingest new listings, update active inventory counts, and sync price adjustments.
* **Zero-Collision Data Handling**: Read-only synchronization safeguards internal pricing formulas and local supplier mappings while keeping public catalog data up to date.
* **Hotlink & Asset Delivery Optimization**: Custom image caching and referrer headers ensure high-definition catalog imagery is displayed reliably across all environments without security or CSP blocks.

### 3. Comprehensive Taxonomic Multi-Categorization
* **Multi-Category Assignment**: Products can belong to multiple categories simultaneously (e.g., *Sensors*, *Arduino Modules*, *Industrial Automation*).
* **Multi-Badge Table Presentation**: The catalog interface presents every assigned category with distinct badge styling for rapid recognition.
* **Deep Category Filtering**: Searching or filtering by any category dynamically surfaces all products mapped to that classification, regardless of whether it is designated as a primary or secondary department.

### 4. Specialized Logistics & "Over the Sea" Processing
* **Direct Overseas Identification**: Fully integrates specialized shipping classifications, flagging on-demand international sea-freight products with a dedicated `🚢 Over the Sea` designation.
* **Context-Aware Stock Display**: Automatically hides standard shelf-count figures for on-demand overseas goods, eliminating confusion between domestic shelf stock and pre-order imports.

### 5. Supplier Quotation & Price Lifecycle Workflow
* **Pending Quotation Generation**: Single-click "Request Price" transitions allow staff to mark expired or unpriced products for supplier bidding.
* **Dynamic Price Expiration**: Configurable validity rules monitor quotation freshness, transitioning stale prices to `EXPIRED` status once the validity threshold has passed.
* **Excel-Based Bidding Cycle**:
  1. **Export**: Generates structured Excel quotation requests populated with product specifications, reference URLs, and embedded product images.
  2. **Supplier Bid**: Suppliers provide unit pricing in USD, lead times, warranties, and supply notes.
  3. **Re-Import & Landed Cost Calculation**: Automated formula processors convert foreign currencies to LKR, apply shipping surcharges, factor margin tiers, update price history, and promote items to `ACTIVE`.

### 6. Role-Based Access Control (RBAC) & Governance
* **Multi-Tier Authorization**:
  * **SUPERADMIN**: Complete governance, system-wide settings, user administration, and isolated database purge capabilities.
  * **ADMIN**: Catalog management, quotation approval, supplier configuration, and pricing validity adjustments.
  * **STAFF**: Catalog browsing, pending request downloads, and quotation preparation.
* **Separated Data Cleanup Controls**: Dedicated administrative safety controls allow independent clearing of external web-synced products or local inventory with explicit confirmation safeguards.

---

## System Architecture

```
                      ┌─────────────────────────────────────────┐
                      │          LK-Tronic Storefront           │
                      │         (https://lk-tronics.com)        │
                      └────────────────────┬────────────────────┘
                                           │ Read-Only Sync
                                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PMS Enterprise Core Platform                         │
│                                                                        │
│   ┌────────────────────────┐  ┌────────────────────────────────────┐   │
│   │   Catalog Operations   │  │    Quotation & Pricing Engine      │   │
│   │  • Unified Inventory   │  │   • Landing Cost Conversion (USD)  │   │
│   │  • Multi-Categorization│  │   • Price Expiry Governance        │   │
│   │  • Over the Sea Flags  │  │   • Historical Rate Auditing       │   │
│   └────────────────────────┘  └────────────────────────────────────┘   │
│   ┌────────────────────────┐  ┌────────────────────────────────────┐   │
│   │  Security & Governance │  │     Excel Automation Services      │   │
│   │  • RBAC (NextAuth.js)  │  │   • High-Res Image Ingestion       │   │
│   │  • Sliding-Window Rate │  │   • Formula Injection Defense      │   │
│   │  • Audit Event Trails  │  │   • Bulk Sheet Parsing             │   │
│   └────────────────────────┘  └────────────────────────────────────┘   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────────────────┐
                      │       Relational Data Management        │
                      │     MySQL Engine via Prisma ORM         │
                      └─────────────────────────────────────────┘
```

---

## Data Management & Schema

The data layer is built on a normalized relational architecture managed via Prisma:

| Entity | Primary Purpose |
| :--- | :--- |
| **Product** | Central catalog record tracking SKUs, pricing (LKR/USD), dual sources (`PMS` / `ONLINE_WEB`), shipping classes, stock status, and multiple category references. |
| **Category** | Hierarchical department catalog with automatic upsert mapping for live web store synchronization. |
| **Supplier** | Registry of authorized domestic and foreign component vendors with quotation metadata. |
| **ProductPriceHistory**| Immutable ledger tracking price updates, author attribution, previous price deltas, and timestamped audit logs. |
| **ProductHistory** | Activity log capturing status transitions, quotation triggers, and catalog alterations. |
| **User** | Authentication and authorization directory managing credentials, account states, and privilege tiers (`SUPERADMIN`, `ADMIN`, `STAFF`). |
| **Setting** | Enterprise configuration storage for global parameters such as price validity duration. |

---

## Security & Governance

* **Authentication & Session Lifecycle**: JWT session cookies configured with rolling expirations and live database status validation on every sensitive request.
* **Defense-in-Depth Authorization**: Route-level and API-level authorization verification preventing privilege escalation or unauthorized record mutation.
* **Formula Injection Defense**: All Excel imports and exports strip, sanitize, and escape potential command injection characters (`=`, `+`, `-`, `@`) to protect staff workstations.
* **Rate Limiting & Threat Mitigation**: Sliding-window rate limiters shield authentication endpoints from credential stuffing and brute-force attempts.
* **Content Security Standards**: Custom HTTP headers and CSP directives enforce secure communication while permitting verified external image assets.

---

## Enterprise Support & Maintenance

The PMS application is maintained as an internal operational system for **LK-Tronic Systems**. All feature requests, schema modifications, and deployment lifecycles are governed according to internal engineering standards.

* **Project**: LK-Tronic Product Management System (PMS)
* **Organization**: LK-Tronic Systems
* **Repository**: [LKTronic/Systems-LK](https://github.com/LKTronic/Systems-LK)
* **Access Level**: Private / Enterprise Internal
