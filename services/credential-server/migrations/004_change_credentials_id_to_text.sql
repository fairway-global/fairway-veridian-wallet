DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'credentials'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE credentials
      ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;
