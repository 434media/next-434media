# 434 Media Website (next-434media)

This repository contains the source code for the official 434 Media website. It is a modern, full-stack application built with Next.js 15 (App Router), TypeScript, and a PostgreSQL database.

## Key Features

*   **Next.js 15 with App Router**: Leverages the latest features of Next.js for server components, layouts, and API routes.
*   **TypeScript**: Fully typed codebase for improved developer experience and code quality.
*   **PostgreSQL Database**: Uses a Neon serverless Postgres database for storing blog content, images, and analytics data.
*   **Internationalization (i18n)**: Supports multiple languages (English and Spanish) using dictionary files and dynamic routing.
*   **Blog Engine**: A complete blog with posts, categories, and an image media library. Images are stored directly in the database as binary data.
*   **Admin Dashboard**: A password-protected admin area to manage blog content, upload media, and view/upload website analytics.
*   **Analytics Integration**: Supports uploading and displaying analytics data from CSV/Excel files or connecting directly to the Google Analytics API.
*   **Tailwind CSS**: Styled with Tailwind CSS for a utility-first approach.
*   **SEO Optimized**: Includes comprehensive metadata generation, `robots.txt` configuration, and Open Graph tags for optimal search engine visibility.

## Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Neon](https://neon.tech/))
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [Shadcn/ui](https://ui.shadcn.com/), [Lucide React](https://lucide.dev/)
*   **Deployment**: [Vercel](https://vercel.com/)

---

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18.x or later)
*   [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), or [pnpm](https://pnpm.io/)
*   [Git](https://git-scm.com/)

### 1. Clone the Repository

First, clone the repository to your local machine:

```sh
git clone https://github.com/your-username/next-434media.git
cd next-434media
```

### 2. Install Dependencies

Install the project dependencies using your preferred package manager:

```sh
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root of the project by copying the example file:

```sh
cp .env.example .env.local
```

Now, open `.env.local` and fill in the required values:

*   `DATABASE_URL`: The connection string for your PostgreSQL database. You can get this from your Neon dashboard.
*   `ADMIN_PASSWORD`: A secret key to protect the admin routes (`/admin/*`).
*   `NEXT_PUBLIC_SITE_URL`: The public URL of your local development environment (e.g., `http://localhost:3000`).

### 4. Run the Development Server

Start the Next.js development server:

```sh
npm run dev
```

The application should now be running at [http://localhost:3000](http://localhost:3000).

The first time you run the application, the necessary database tables (for the blog, images, etc.) will be automatically created. You can see the status logs in your terminal.

---

## Project Structure

*   `app/`: Core application directory using the Next.js App Router.
    *   `[lang]/`: Dynamic routes for internationalization.
    *   `admin/`: Components and pages for the admin dashboard.
    *   `api/`: API route handlers for server-side logic (e.g., data uploads, database queries).
    *   `components/`: Shared, reusable React components.
    *   `lib/`: Helper functions, database logic (`blog-db.ts`), and utilities.
    *   `dictionaries/`: JSON files containing translations for i18n.
*   `public/`: Static assets like images and fonts.
*   `middleware.ts`: Handles request processing, primarily for i18n locale detection.
*   `i18n-config.ts`: Configuration file for internationalization.

---

## Contribution & Git Workflow

We follow a standard feature-branch workflow.

1.  **Create a Branch**: Create a new branch from the `main` branch for your feature or bugfix.
    ```sh
    git checkout -b feature/your-feature-name
    ```
2.  **Make Changes**: Implement your changes and commit them with clear, descriptive messages.
    ```sh
    git commit -m "feat: Add new feature for X"
    ```
3.  **Push to GitHub**: Push your branch to the remote repository.
    ```sh
    git push origin feature/your-feature-name
    ```
4.  **Create a Pull Request (PR)**: Open a Pull Request on GitHub from your feature branch to the `main` branch.
5.  **Review and Merge**: Once the PR is reviewed, approved, and all automated checks have passed, it will be merged into `main`. The `main` branch is automatically deployed to production by