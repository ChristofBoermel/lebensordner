# Lebensordner Digital - Codebase Context for LLM Planning

## 📋 Project Overview
**Lebensordner Digital** is a secure digital organizer for important documents and emergency preparedness, specifically designed for the German market and users aged 40+. It allows users to store documents, manage trusted persons, set reminders, and maintain emergency/medical information.

## 🛠️ Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5.9
- **Frontend**: React 19, Tailwind CSS 3.4 (Custom Theme: sage/warmgray/cream)
- **UI Components**: Shadcn UI (Radix UI based), Lucide React Icons
- **Backend / DB**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **Payments**: Stripe (Subscriptions, Webhooks)
- **Emails**: Resend
- **Analytics**: PostHog
- **Hosting**: Vercel

## 📁 Project Structure
```
lebensordner/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login, Register, Password Reset
│   │   ├── (dashboard)/         # Protected Dashboard Area
│   │   │   ├── abo/             # Stripe Subscriptions
│   │   │   ├── dokumente/       # Document Management
│   │   │   ├── einstellungen/   # User Profile & Settings
│   │   │   ├── notfall/         # Medical & Emergency Info
│   │   │   └── zugriff/         # Trusted Persons Management
│   │   └── api/                 # Backend API Routes (Stripe, Cron, etc.)
│   ├── components/
│   │   ├── ui/                  # Shadcn UI Components
│   │   ├── layout/              # Dashboard Navigation & Shell
│   │   └── ...                  # Feature-specific components
│   ├── lib/
│   │   ├── supabase/            # Supabase Client Config
│   │   ├── subscription-tiers.ts # Core Tier & Limit Logic
│   │   └── utils.ts             # Tailwind Merge & Misc Utils
│   └── types/
│       └── database.ts          # Generated Database Types
├── supabase/
│   ├── migration_*.sql          # Database Migrations
│   └── schema.sql               # Initial Schema Definition
└── public/                      # Static Assets
```

## 🗄️ Core Database Schema
- **`profiles`**: User metadata, Stripe IDs, subscription status, and 2FA settings.
- **`documents`**: Metadata for uploaded files (categories: identity, finance, health, etc.).
- **`trusted_persons`**: Information about people granted access, with configurable delay/emergency logic.
- **`reminders`**: Custom and document-based reminders.
- **`medical_info`**: Medical data (blood type, allergies, conditions).
- **`emergency_contacts`**: Primary and secondary contacts for emergencies.

## 💎 Subscription Tiers (Business Logic)
Defined in `src/lib/subscription-tiers.ts`:
- **Free**: 10 Docs, 100MB Storage, 1 Trusted Person, 3 Folders. No 2FA/Reminders.
- **Basic (4.90€)**: 50 Docs, 500MB Storage, 3 Trusted Persons, 10 Folders. Includes Email Reminders.
- **Premium (11.90€)**: Unlimited Docs, 4GB Storage, 5 Trusted Persons, Unlimited Folders. Includes 2FA, SMS, Family Dashboard.

## 🎨 Design System
- **Colors**: Custom Tailwind palette (`sage`, `warmgray`, `cream`).
- **Typography**: Source Sans 3 (Sans), Source Serif 4 (Serif).
- **Aesthetics**: Warm, organic, high readability, senior-friendly (large inputs, clear borders).

## 🚀 Key Workflows
- **Onboarding**: Multi-step flow to capture initial user data and documents.
- **Emergency Access**: Trusted persons can request access; access is granted immediately or after a delay based on settings.
- **Stripe Integration**: Webhooks handle subscription lifecycle (active, trialing, canceled).
