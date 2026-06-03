# Diacify Database Migrations

These migrations create the `diacify_db` schema and migrate existing data from `diabetic_db`.

## Migration Files

| File | Description |
|------|-------------|
| `001_create_patients.sql` | Creates the `patients` table with identity fields and a `PAT-YYYY-NNNN` primary key. |
| `002_create_visits.sql` | Creates the `visits` table for per-visit clinical measurements, linked to `patients`. |
| `003_create_appointments.sql` | Creates the `appointments` table for scheduling, linked to both `patients` and `visits`. |
| `004_create_audit_log.sql` | Creates the `audit_log` table to track clinician actions on patient records. |
| `005_add_indices.sql` | Adds performance indices on frequently queried columns across `visits`, `appointments`, and `audit_log`. |
| `006_seed_patients.sql` | Migrates identity data from `diabetic_db.patients` into the new `patients` table. |
| `007_seed_visits.sql` | Migrates measurement data from `diabetic_db.patients` into the new `visits` table (one row → one visit). |

## How to Run

From inside the `backend/database/migrations/` directory:

```bash
bash 008_run_migrations.sh
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | `root` | MySQL username |
| `DB_PASS` | _(required)_ | MySQL password |
| `DB_HOST` | `localhost` | MySQL host |

Example:

```bash
DB_USER=myuser DB_PASS=mypassword DB_HOST=127.0.0.1 bash 008_run_migrations.sh
```

## Warnings

> **`diabetic_db` must exist**: Migrations 006 and 007 read from `diabetic_db.patients`. Do not drop or rename that database until migrations have been verified.

> **Run only once**: These migrations use `INSERT IGNORE` to avoid duplicates, but running them twice may cause unexpected state if data in `diabetic_db` has changed between runs. Treat this as a one-time operation.
