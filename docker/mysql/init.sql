CREATE DATABASE IF NOT EXISTS solar_tracking;
USE solar_tracking;

SOURCE /docker-entrypoint-initdb.d/schema.sql;
