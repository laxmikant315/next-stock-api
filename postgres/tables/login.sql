
BEGIN TRANSACTION;
CREATE TABLE login (
    id serial PRIMARY KEY,
    hash VARCHAR(100),
    email text UNIQUE NOT NULL
);
COMMIT;