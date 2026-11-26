-- Removes the personal data of ONE registered account, as the privacy policy promises (data-requests.md).
-- The row of the account stays, emptied, because finished games point to it.
-- Run in one go (Neon SQL editor, or psql) after replacing the address in the first statement, which must be
-- written in lower case. It stops with "division by zero" and changes nothing unless exactly one account matches.
BEGIN;

CREATE TEMP TABLE target ON COMMIT DROP AS
  SELECT id FROM users WHERE email = 'email@can-xoa.example';

SELECT 1 / (CASE WHEN (SELECT count(*) FROM target) = 1 THEN 1 ELSE 0 END) AS exactly_one_account;

DELETE FROM learn_events   WHERE user_id IN (SELECT id FROM target) OR actor IN (SELECT 'u:' || id FROM target);
DELETE FROM account_visits WHERE user_id IN (SELECT id FROM target);
DELETE FROM ratings        WHERE user_id IN (SELECT id FROM target);
DELETE FROM user_roles     WHERE user_id IN (SELECT id FROM target);
-- Reports they made, and reports about them (these hold their chat lines).
DELETE FROM player_reports
  WHERE reporter_id IN (SELECT id FROM target) OR target_id IN (SELECT id FROM target);

UPDATE users
  SET kind = 'guest',
      display_name = 'Tài khoản đã xóa',
      email = NULL,
      password_hash = NULL,
      avatar = NULL,
      learn_progress = NULL,
      last_seen_at = NULL
  WHERE id IN (SELECT id FROM target);

-- A ban or mute stays on the emptied row on purpose: the old sign-in token keeps working for up to 30 days.

COMMIT;
