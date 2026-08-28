-- Demo policy: only 2 portal logins (admin + employee ESS).
-- Does NOT change admin/fatima email or password.
-- For full employee removal see patch-remove-demo-employees.sql.

DELETE FROM users
WHERE LOWER(email) IN (
  'boss@digitaldive.demo',
  'omar@digitaldive.demo'
);
