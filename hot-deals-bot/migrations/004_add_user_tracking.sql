
-- Migration 004: Add last_hot_check to users for notification tracking
ALTER TABLE users ADD COLUMN last_hot_check DATETIME;
