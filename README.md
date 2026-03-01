# SalesTracker

A simple and intuitive web application for tracking inventory and sales, built with React.

## Features

- **Inventory Management**: Add, edit, and delete inventory items with price and quantity tracking
- **Sales Tracking**: Record sales transactions with automatic inventory updates
- **Sales Statistics**: View total sales revenue and transaction counts
- **Low Stock Alerts**: Visual indicators for items with low inventory
- **Database Ready**: Includes placeholder for easy Supabase integration

## Tech Stack

- React 19
- Vite (build tool)
- CSS3 (styling)
- LocalStorage (data persistence)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rdingal/SalesTracker.git
cd SalesTracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Using with Supabase

The app uses Supabase when env vars are set; otherwise it falls back to localStorage.

1. Create a project at [supabase.com](https://supabase.com) and get your **Project URL** and **anon public** key (Settings → API).

2. Create the tables: in the Supabase dashboard open **SQL Editor**, then run the script in `supabase/schema.sql`.

3. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` = your project URL  
   - `VITE_SUPABASE_ANON_KEY` = your anon key  

4. Restart the dev server (`npm run dev`). Data will be stored in Supabase. Without these env vars, the app still runs using localStorage.

### Login (Supabase Auth)

When Supabase is configured, the app requires sign-in before showing the main dashboard.

1. **Enable Auth**  
   In the Supabase dashboard, go to **Authentication** → **Providers**. Email is enabled by default. Optionally enable **Confirm email** if you want users to verify their address before signing in.

2. **Create a user**  
   - **Option A:** In the app, use “Need an account? Sign up”, enter email and password, then sign in. If “Confirm email” is on, check the inbox and confirm before signing in.  
   - **Option B:** In Supabase dashboard go to **Authentication** → **Users** → **Add user** and create a user (set a password).

3. **Optional: Row Level Security (RLS)**  
   To restrict data per user, enable RLS on your tables and add policies that use `auth.uid()`. The app already sends the session with every request via the Supabase client.

### Access levels (roles)

You can give users different roles so that only **super admins** can delete employees or stores; **admins** can edit everything else but not delete.

- **admin** (default): Can add and edit inventory, sales, attendance, employees, stores, and analytics. Cannot delete employees or stores.
- **super_admin**: Same as admin, plus can delete employees and delete stores.

**How to set a user’s role**

1. In Supabase dashboard go to **Authentication** → **Users**.
2. Open the user (or create one).
3. Under **User Metadata**, add a key `role` with value `admin` or `super_admin`.  
   Example: `{"role": "super_admin"}`.  
   If you leave metadata empty or omit `role`, the app treats the user as **admin**.

Roles are read from `user_metadata.role`; only the value `super_admin` is special (delete buttons are enabled). Any other value (e.g. `admin`) disables delete employees/stores.

## Project Structure

```
src/
├── components/
│   ├── InventoryManager.jsx    # Inventory management component
│   ├── InventoryManager.css
│   ├── SalesTracker.jsx         # Sales tracking component
│   └── SalesTracker.css
├── services/
│   └── database.js              # Data persistence layer
├── App.jsx                      # Main application component
├── App.css
└── main.jsx                     # Application entry point
```

## Usage

### Managing Inventory

1. Click the "Inventory" tab
2. Click "+ Add Item" to add a new inventory item
3. Fill in the item name, price, quantity, and description
4. Edit or delete items using the action buttons in the table

### Recording Sales

1. Click the "Sales" tab
2. Click "+ Record Sale" to record a new sale
3. Select an item from the dropdown (only in-stock items shown)
4. Enter the quantity and optionally a customer name
5. Submit to record the sale and automatically update inventory

## Data Persistence

- **With Supabase**: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and run `supabase/schema.sql` in your project. Data is stored in the cloud.
- **Without Supabase**: the app uses browser localStorage (data is local only; clearing browser data resets it).

## License

MIT
