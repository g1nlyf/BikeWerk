-- Add condition analysis columns to bikes table
ALTER TABLE bikes ADD COLUMN condition_score INTEGER;
ALTER TABLE bikes ADD COLUMN condition_grade TEXT;
ALTER TABLE bikes ADD COLUMN condition_penalty REAL;
ALTER TABLE bikes ADD COLUMN condition_reason TEXT;
