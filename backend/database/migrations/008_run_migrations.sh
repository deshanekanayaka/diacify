#!/bin/bash
# Run all Diacify database migrations in order against diacify_db
# Usage: bash 008_run_migrations.sh
# Warning: run only once — migration data comes from diabetic_db

DB_USER=${DB_USER:-root}
DB_HOST=${DB_HOST:-localhost}
DB_PASS=${DB_PASS:-}  

echo "Running Diacify migrations against diacify_db..."

for file in 001 002 003 004 005 006 007; do
  echo "Running ${file}..."
  mysql -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} -h "$DB_HOST" < ${file}_*.sql
  if [ $? -ne 0 ]; then
    echo "FAILED at ${file}. Stopping."
    exit 1
  fi
  echo "${file} complete."
done

echo "All migrations complete."
echo "Verifying..."
mysql -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} -h "$DB_HOST" diacify_db -e "
  SELECT CONCAT('patients: ', COUNT(*)) AS status FROM patients;
  SELECT CONCAT('visits: ',   COUNT(*)) AS status FROM visits;
"
