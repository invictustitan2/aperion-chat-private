-- Migration: Add tags to memory tables
-- This migration adds tags support for memory categorization

-- Add tags column to episodic table
ALTER TABLE episodic ADD COLUMN tags TEXT DEFAULT '[]';

-- Add tags column to semantic table
ALTER TABLE semantic ADD COLUMN tags TEXT DEFAULT '[]';

-- Add importance scoring column to episodic
ALTER TABLE episodic ADD COLUMN importance REAL DEFAULT 0.5;

-- Add importance scoring column to semantic
ALTER TABLE semantic ADD COLUMN importance REAL DEFAULT 0.5;
